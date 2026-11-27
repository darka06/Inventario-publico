<?php
declare(strict_types=1);

// Configuración de errores - ocultar en producción
$isProduction = envValue('INVENTARIO_ENV', 'production') === 'production';
if ($isProduction) {
    ini_set('display_errors', '0');
    ini_set('display_startup_errors', '0');
    error_reporting(E_ALL);
    ini_set('log_errors', '1');
    ini_set('error_log', __DIR__ . '/../logs/php-error.log');
} else {
    ini_set('display_errors', '1');
    ini_set('display_startup_errors', '1');
    error_reporting(E_ALL);
}

$localConfig = __DIR__ . '/config.local.php';
if (is_file($localConfig)) {
    require $localConfig;
}

function envValue(string $name, ?string $default = null): ?string
{
    // Primero verificar variables de entorno
    $value = getenv($name);
    if ($value !== false) {
        return $value;
    }
    // Luego verificar $GLOBALS (usado por config.local.php)
    if (isset($GLOBALS[$name])) {
        return (string)$GLOBALS[$name];
    }
    return $default;
}

function database(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = envValue('INVENTARIO_DB_HOST', '127.0.0.1');
    $port = envValue('INVENTARIO_DB_PORT', '3306');
    $name = envValue('INVENTARIO_DB_NAME', 'inventario_global');
    $user = envValue('INVENTARIO_DB_USER', null);
    $password = envValue('INVENTARIO_DB_PASSWORD', null);

    // Si no están configurados, mostrar error
    if ($user === null || $password === null) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(500);
        echo json_encode([
            'error' => 'Configuración de base de datos incompleta.',
            'detail' => 'Copia api/config.local.php.example como api/config.local.php y configura INVENTARIO_DB_USER y INVENTARIO_DB_PASSWORD. No uses credenciales vacías en producción.'
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }

    // Advertencia si se usa contraseña vacía (solo para desarrollo)
    if ($password === '' && $user === 'root') {
        error_log('[Inventario API] Advertencia: Usando usuario root con contraseña vacía. Esto no es seguro para producción.');
    }

    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";

    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

// Verifica que las restricciones de clave foránea estén instaladas
// shortcut: verifica cada 1000 solicitudes para balancear rendimiento y detección inmediata; verificar database/schema.mysql.sql si falta
function checkForeignKeys(PDO $db): array
{
    static $result = null;
    static $counter = 0;
    if ($result !== null && $counter++ < 1000) {
        return $result;
    }
    $counter = 0;

    $missing = [];
    $errors = [];

    // Restricciones críticas del esquema MySQL
    $expectedConstraints = [
        'fk_asignaciones_activo' => 'asignaciones',
        'fk_asignaciones_usuario' => 'asignaciones',
        'fk_prestamos_asignacion' => 'prestamos_activos',
        'fk_movimientos_insumos_codigo' => 'movimientos_insumos',
        'fk_compras_insumos_codigo' => 'compras_insumos',
        'fk_compras_activos_activo' => 'compras_activos',
        'fk_historial_activo' => 'historial_estados',
        'fk_historial_estado_anterior' => 'historial_estados',
        'fk_historial_estado_nuevo' => 'historial_estados',
        'fk_movimientos_activo' => 'movimientos_activos',
        'fk_movimientos_estado' => 'movimientos_activos',
    ];

    try {
        foreach ($expectedConstraints as $constraint => $table) {
            $stmt = $db->query("SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
                               WHERE TABLE_SCHEMA = DATABASE()
                               AND CONSTRAINT_NAME = '{$constraint}'
                               AND TABLE_NAME = '{$table}'");
            $exists = (int)$stmt->fetchColumn();
            if ($exists === 0) {
                $missing[] = $constraint;
            }
        }

        if (!empty($missing)) {
            $msg = '[Inventario API] ADVERTENCIA: Faltan restricciones de clave foránea: ' . implode(', ', $missing) . '. Revisa database/schema.mysql.sql en MySQL.';
            error_log($msg);
        }
    } catch (PDOException $error) {
        $error = '[Inventario API] No se pudo verificar restricciones de clave foránea: ' . $error->getMessage();
        error_log($error);
        $errors[] = $error;
    }

    $result = ['missing' => $missing, 'errors' => $errors];
    return $result;
}

// Límites de seguridad configurables
function authConfig(): array
{
    return [
        'max_failed_logins' => (int)envValue('INVENTARIO_MAX_FAILED_LOGINS', '5'),
        'lock_minutes' => (int)envValue('INVENTARIO_LOCK_MINUTES', '15'),
        'session_idle_seconds' => (int)envValue('INVENTARIO_SESSION_IDLE_SECONDS', '7200'), // 2 horas por defecto
        'min_password_length' => (int)envValue('INVENTARIO_MIN_PASSWORD_LENGTH', '12'),
    ];
}

// shortcut: implementación con archivos no escala a alta concurrencia; para producción usar Redis/memcached
function checkRateLimitInternal(string $hash, int $maxRequests, int $windowSeconds): void
{
    $cacheDir = sys_get_temp_dir() . '/inventario_ratelimit';
    if (!is_dir($cacheDir)) {
        @mkdir($cacheDir, 0700, true);
    }

    // Limpieza probabilística de archivos viejos (1% de las veces) para evitar acumulación
    if (random_int(1, 100) === 1) {
        $cutoff = time() - $windowSeconds;
        foreach (glob($cacheDir . '/*.json') as $oldFile) {
            if (filemtime($oldFile) < $cutoff) {
                @unlink($oldFile);
            }
        }
    }

    $file = $cacheDir . '/' . $hash . '.json';
    $now = time();

    // Usar flock exclusivo para evitar condiciones de carrera en escritura concurrente
    $fp = fopen($file, 'c+');
    if ($fp === false) {
        // Si no podemos abrir el archivo, permitir la solicitud (fall-open para evitar DoS)
        header('X-RateLimit-Limit: ' . $maxRequests);
        header('X-RateLimit-Remaining: ' . $maxRequests);
        return;
    }

    if (flock($fp, LOCK_EX)) {
        // Leer datos existentes con bloqueo
        $data = ['requests' => []];
        if (filesize($file) > 0) {
            $content = stream_get_contents($fp);
            if ($content !== false) {
                $decoded = json_decode($content, true);
                if (is_array($decoded)) {
                    $data = $decoded;
                }
            }
        }

        // Limpiar entradas viejas fuera de la ventana
        if (isset($data['requests'])) {
            $data['requests'] = array_filter($data['requests'], fn($t) => $t > $now - $windowSeconds);
        }

        $data['requests'][] = $now;
        $count = count($data['requests']);

        // Truncar y escribir datos nuevos (con bloqueo mantenido)
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data));
        fflush($fp);

        flock($fp, LOCK_UN);
        fclose($fp);

        // Verificar si excede el límite
        if ($count > $maxRequests) {
            header('Content-Type: application/json; charset=utf-8');
            header('X-RateLimit-Limit: ' . $maxRequests);
            header('X-RateLimit-Remaining: 0');
            header('Retry-After: ' . $windowSeconds);
            http_response_code(429);
            echo json_encode(['error' => 'Demasiadas solicitudes. Intenta de nuevo en ' . $windowSeconds . ' segundos.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Headers informativos
        header('X-RateLimit-Limit: ' . $maxRequests);
        header('X-RateLimit-Remaining: ' . ($maxRequests - $count));
    } else {
        // Si no podemos obtener el bloqueo, permitir la solicitud (fail-open)
        fclose($fp);
        header('X-RateLimit-Limit: ' . $maxRequests);
        header('X-RateLimit-Remaining: ' . $maxRequests);
    }
}

// Rate limiting simple basado en IP (para endpoints públicos)
function checkRateLimit(): void
{
    $maxRequests = (int)envValue('INVENTARIO_RATE_LIMIT_MAX', '100');
    $windowSeconds = (int)envValue('INVENTARIO_RATE_LIMIT_WINDOW', '60');
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $hash = hash('sha256', $ip);
    checkRateLimitInternal($hash, $maxRequests, $windowSeconds);
}

// Rate limiting por cuenta (para endpoints autenticados)
function checkAccountRateLimit(int $accountId): void
{
    $maxRequests = (int)envValue('INVENTARIO_ACCOUNT_RATE_LIMIT_MAX', '200');
    $windowSeconds = (int)envValue('INVENTARIO_RATE_LIMIT_WINDOW', '60');
    $hash = hash('sha256', 'account:' . $accountId);
    checkRateLimitInternal($hash, $maxRequests, $windowSeconds);
}