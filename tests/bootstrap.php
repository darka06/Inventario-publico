<?php
declare(strict_types=1);

// Bootstrap para pruebas de PHPUnit
// Carga las funciones de la API sin iniciar sesión ni procesar HTTP

require_once __DIR__ . '/../api/lib/Exceptions.php';

// No cargamos config.php ni http.php en pruebas unitarias
// config.php tiene checkRateLimit() que usa header() y falla en PHPUnit
// http.php define sendJson() que necesitamos mockear
// En su lugar, definimos las funciones de validación que necesitamos

function requiredText(array $data, string $key, int $maxLength): string
{
    if (!isset($data[$key])) {
        throw new ApiException("El campo {$key} es obligatorio y admite hasta {$maxLength} caracteres.", 422);
    }
    $value = trim((string)$data[$key]);
    if ($value === '') {
        throw new ApiException("El campo {$key} es obligatorio y admite hasta {$maxLength} caracteres.", 422);
    }
    if (mb_strlen($value) > $maxLength) {
        throw new ApiException("El campo {$key} admite hasta {$maxLength} caracteres.", 422);
    }
    return $value;
}

function optionalText(array $data, string $key, int $maxLength): ?string
{
    if (!isset($data[$key])) {
        return null;
    }
    $value = trim((string)$data[$key]);
    if ($value === '') {
        return null;
    }
    if (mb_strlen($value) > $maxLength) {
        throw new ApiException("El campo {$key} admite hasta {$maxLength} caracteres.", 422);
    }
    return $value;
}

function validDate(?string $value, bool $required = false): ?string
{
    if ($value === null || $value === '') {
        if ($required) {
            throw new ApiException('La fecha es obligatoria.', 422);
        }
        return null;
    }
    $format = 'Y-m-d';
    $date = \DateTime::createFromFormat($format, $value);
    if ($date === false || $date->format($format) !== $value) {
        throw new ApiException('La fecha debe tener el formato AAAA-MM-DD.', 422);
    }
    return $value;
}

// Cargamos solo newSourceKey() de helpers.php para las pruebas
function newSourceKey(): string
{
    return 'API:' . bin2hex(random_bytes(20));
}

// Mock de sendJson() para pruebas (lanza excepción en lugar de terminar ejecución)
function sendJson(array $data, int $status = 200): never
{
    throw new ApiException('Error simulado en pruebas', $status, $data);
}

// Cargar brandId() de helpers.php para pruebas de marcas
function brandId(\PDO $db, ?string $name): ?int
{
    if ($name === null) {
        return null;
    }
    // Simplificado para pruebas: siempre crear o retornar el ID
    $stmt = $db->prepare("SELECT marca_id FROM marcas WHERE UPPER(TRIM(nombre)) = UPPER(TRIM(?)) LIMIT 1");
    $stmt->execute([$name]);
    $id = $stmt->fetchColumn();
    if ($id !== false) {
        return (int)$id;
    }
    $insert = $db->prepare("INSERT INTO marcas (nombre) VALUES (?)");
    $insert->execute([$name]);
    return (int)$db->lastInsertId();
}

// Función auxiliar para renameBrand en pruebas (versión simplificada sin FOR UPDATE para SQLite)
// NOTA: Esta función debe mantenerse sincronizada con api/lib/supplies.php::renameBrand()
// excepto por el FOR UPDATE que SQLite no soporta.
function renameBrandForTests(\PDO $db, array $data): array
{
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
    $name = requiredText($data, 'name', 120);
    if (!$id) {
        throw new ApiException('La marca seleccionada no es válida.', 422);
    }
    $db->beginTransaction();
    try {
        $sourceQuery = $db->prepare('SELECT marca_id, nombre FROM marcas WHERE marca_id=?');
        $sourceQuery->execute([$id]);
        $source = $sourceQuery->fetch();
        if (!$source) {
            $db->rollBack();
            throw new ApiException('No se encontró la marca solicitada.', 404);
        }

        $targetQuery = $db->prepare('SELECT marca_id, nombre FROM marcas WHERE nombre=? LIMIT 1');
        $targetQuery->execute([$name]);
        $target = $targetQuery->fetch();
        $targetId = $target ? (int)$target['marca_id'] : (int)$id;
        $targetName = $target && $targetId !== (int)$id ? $target['nombre'] : $name;

        if ($targetId !== (int)$id) {
            $db->prepare('UPDATE activos SET marca_id=?, marca=? WHERE marca_id=?')
                ->execute([$targetId, $targetName, $id]);
            $db->prepare('UPDATE insumos SET marca_id=?, marca=? WHERE marca_id=?')
                ->execute([$targetId, $targetName, $id]);
            $db->prepare('DELETE FROM marcas WHERE marca_id=?')->execute([$id]);
        } else {
            $db->prepare('UPDATE marcas SET nombre=? WHERE marca_id=?')->execute([$targetName, $id]);
            $db->prepare('UPDATE activos SET marca=? WHERE marca_id=?')->execute([$targetName, $id]);
            $db->prepare('UPDATE insumos SET marca=? WHERE marca_id=?')->execute([$targetName, $id]);
        }

        $counts = $db->prepare(
            'SELECT (SELECT COUNT(*) FROM activos WHERE marca_id=?) AS assets,
                    (SELECT COUNT(*) FROM insumos WHERE marca_id=?) AS supplies'
        );
        $counts->execute([$targetId, $targetId]);
        $result = $counts->fetch();
        $db->commit();
        return ['assets' => (int)$result['assets'], 'supplies' => (int)$result['supplies']];
    } catch (\Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
}

// Función envValue para pruebas (solo retorna default)
function envValue(string $name, ?string $default = null): ?string
{
    return $default;
}

// Función helper para configurar una DB de prueba
function createTestPDO(): \PDO
{
    // SQLite en memoria
    $pdo = new \PDO('sqlite::memory:');
    $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(\PDO::ATTR_DEFAULT_FETCH_MODE, \PDO::FETCH_ASSOC);

    // Cargar esquema
    $schema = file_get_contents(__DIR__ . '/schema.sql');
    $pdo->exec($schema);

    return $pdo;
}
