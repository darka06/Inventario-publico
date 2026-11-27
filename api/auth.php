<?php
declare(strict_types=1);

// ---------------------------------------------------------------------------
// Autenticación (sesión PHP) y permisos por rol.
// Tablas: app_roles, app_rol_permisos, app_usuarios (database/schema.mysql.sql).
// ---------------------------------------------------------------------------

// La configuración se obtiene de config.php::authConfig()
function authCfg(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $cfg = authConfig();
    }
    return $cfg;
}

// Catálogo de permisos: módulo => [etiqueta, grupo, [acción => descripción]]
// La clave de cada permiso es "módulo.acción", por ejemplo "activos.crear".
const PERMISSION_CATALOG = [
    'dashboard'    => ['Inicio', 'General', ['ver' => 'Ver el tablero de inicio']],
    'estadisticas' => ['Estadísticas', 'General', ['ver' => 'Ver estadísticas']],
    'activos'      => ['Activos', 'Productos', [
        'ver' => 'Ver activos', 'crear' => 'Crear activos', 'editar' => 'Modificar activos',
        'eliminar' => 'Eliminar activos', 'asignar' => 'Asignar y devolver activos',
    ]],
    'insumos'      => ['Insumos', 'Productos', [
        'ver' => 'Ver insumos', 'crear' => 'Crear insumos', 'editar' => 'Modificar insumos',
        'movimientos' => 'Registrar entradas y salidas de stock', 'eliminar' => 'Eliminar insumos',
    ]],
    'herramientas' => ['Herramientas', 'Productos', [
        'ver' => 'Ver herramientas', 'crear' => 'Crear herramientas',
        'editar' => 'Modificar herramientas', 'eliminar' => 'Eliminar herramientas',
    ]],
    'auditorias'   => ['Auditoría de herramientas', 'Productos', [
        'ver' => 'Ver auditorías de herramientas', 'crear' => 'Realizar auditorías de herramientas',
    ]],
    'prestamos'    => ['Alquiler / Venta', 'Productos', [
        'ver' => 'Ver alquileres y ventas', 'crear' => 'Registrar alquileres y ventas',
        'editar' => 'Modificar alquileres y ventas', 'eliminar' => 'Eliminar alquileres y ventas',
        'devolver' => 'Registrar devoluciones',
    ]],
    'compras'      => ['Compras', 'Productos', [
        'ver' => 'Ver compras', 'crear' => 'Registrar compras',
        'editar' => 'Modificar compras', 'eliminar' => 'Eliminar compras',
    ]],
    'inventario'   => ['Inventario y técnicos', 'Productos', ['ver' => 'Ver inventario y técnicos']],
    'categorias'   => ['Categorías', 'Catálogos', [
        'ver' => 'Ver categorías', 'crear' => 'Crear categorías',
        'editar' => 'Modificar categorías', 'eliminar' => 'Eliminar categorías',
    ]],
    'marcas'       => ['Marcas', 'Catálogos', [
        'ver' => 'Ver marcas', 'crear' => 'Crear marcas', 'editar' => 'Renombrar marcas', 'eliminar' => 'Eliminar marcas',
    ]],
    'contactos'    => ['Clientes y proveedores', 'Catálogos', [
        'ver' => 'Ver clientes y proveedores', 'crear' => 'Crear contactos',
        'editar' => 'Modificar contactos', 'eliminar' => 'Eliminar contactos',
    ]],
    'funcionarios' => ['Funcionarios', 'Catálogos', [
        'ver' => 'Ver funcionarios', 'crear' => 'Crear funcionarios',
        'editar' => 'Modificar funcionarios', 'eliminar' => 'Eliminar funcionarios',
    ]],
    'movimientos'  => ['Movimientos', 'Registros', ['ver' => 'Ver movimientos', 'eliminar' => 'Eliminar movimientos']],
    'historial'    => ['Historial de cambios', 'Registros', ['ver' => 'Ver el historial de cambios']],
    'accesos'      => ['Usuarios y roles', 'Administración', [
        'ver' => 'Ver usuarios y roles', 'crear' => 'Crear usuarios y roles',
        'editar' => 'Modificar usuarios y roles', 'eliminar' => 'Eliminar usuarios y roles',
    ]],
];

function permissionCatalogForClient(): array
{
    $out = [];
    foreach (PERMISSION_CATALOG as $module => [$label, $group, $actions]) {
        $items = [];
        foreach ($actions as $action => $description) {
            $items[] = ['key' => "{$module}.{$action}", 'action' => $action, 'label' => $description];
        }
        $out[] = ['module' => $module, 'label' => $label, 'group' => $group, 'permissions' => $items];
    }
    return $out;
}

function allPermissionKeys(): array
{
    $keys = [];
    foreach (PERMISSION_CATALOG as $module => [, , $actions]) {
        foreach (array_keys($actions) as $action) {
            $keys[] = "{$module}.{$action}";
        }
    }
    return $keys;
}

function startAppSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $isProduction = envValue('INVENTARIO_ENV', 'production') === 'production';
    session_name('INVENTARIO_SESSION');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $isProduction ? true : $https,
        'httponly' => true,
        'samesite' => $isProduction ? 'Strict' : 'Lax',
    ]);
    ini_set('session.use_strict_mode', '1');
    session_start();
    $cfg = authCfg();
    $last = (int)($_SESSION['last'] ?? 0);
    if ($last > 0 && time() - $last > $cfg['session_idle_seconds']) {
        destroyAppSession();
        session_start();
    }
    $_SESSION['last'] = time();
}

function destroyAppSession(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'],
            'httponly' => true, 'samesite' => 'Lax',
        ]);
    }
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
}

function authTablesMissing(PDOException $error): never
{
    if ($error->getCode() === '42S02') {
        sendJson(['error' => 'Faltan las tablas de acceso. Importa database/schema.mysql.sql en MySQL.'], 503);
    }
    throw $error;
}

function accountCount(PDO $db): int
{
    try {
        return (int)$db->query('SELECT COUNT(*) FROM app_usuarios')->fetchColumn();
    } catch (PDOException $error) {
        authTablesMissing($error);
    }
}

function loadRolePermissions(PDO $db, int $roleId, bool $isAdmin): array
{
    if ($isAdmin) {
        return allPermissionKeys();
    }
    $query = $db->prepare('SELECT permiso FROM app_rol_permisos WHERE rol_id = ?');
    $query->execute([$roleId]);
    return array_values(array_intersect($query->fetchAll(PDO::FETCH_COLUMN), allPermissionKeys()));
}

// Cuenta de la sesión actual, o null. Se consulta en cada petición, así que
// desactivar a un usuario o cambiar su rol surte efecto de inmediato.
function currentAccount(PDO $db): ?array
{
    $id = (int)($_SESSION['uid'] ?? 0);
    if ($id <= 0) {
        return null;
    }
    try {
        $query = $db->prepare(
            'SELECT u.app_usuario_id, u.username, u.nombre_visible, u.estado, u.rol_id,
                    r.nombre AS rol_nombre, r.color AS rol_color, r.es_admin
             FROM app_usuarios u JOIN app_roles r ON r.rol_id = u.rol_id
             WHERE u.app_usuario_id = ?'
        );
        $query->execute([$id]);
        $row = $query->fetch();
    } catch (PDOException $error) {
        authTablesMissing($error);
    }
    if (!$row || $row['estado'] !== 'Activo') {
        destroyAppSession();
        return null;
    }
    $isAdmin = (int)$row['es_admin'] === 1;
    return [
        'id' => (int)$row['app_usuario_id'],
        'username' => $row['username'],
        'name' => $row['nombre_visible'],
        'isAdmin' => $isAdmin,
        'role' => ['id' => (int)$row['rol_id'], 'name' => $row['rol_nombre'], 'color' => $row['rol_color']],
        'permissions' => loadRolePermissions($db, (int)$row['rol_id'], $isAdmin),
    ];
}

// $needed: un permiso o una lista (basta con tener uno).
function hasPermission(?array $account, string|array $needed): bool
{
    if ($account === null) {
        return false;
    }
    foreach ((array)$needed as $permission) {
        if (in_array($permission, $account['permissions'], true)) {
            return true;
        }
    }
    return false;
}

function requirePermission(?array $account, string|array $needed): void
{
    if ($account === null) {
        sendJson(['error' => 'Debes iniciar sesión.', 'code' => 'auth'], 401);
    }
    if (!hasPermission($account, $needed)) {
        sendJson(['error' => 'No tienes permiso para realizar esta acción.', 'code' => 'forbidden'], 403);
    }
}

function sessionPayload(PDO $db, ?array $account): array
{
    if ($account === null) {
        return ['authenticated' => false, 'setupRequired' => accountCount($db) === 0];
    }
    return ['authenticated' => true, 'setupRequired' => false, 'account' => $account, 'csrfToken' => $_SESSION['csrf_token'] ?? null];
}

function normalizeUsername(string $value): string
{
    $username = mb_strtolower(trim($value));
    if (preg_match('/^[a-z0-9._-]{3,32}$/', $username) !== 1) {
        sendJson(['error' => 'El nombre de usuario debe tener de 3 a 32 caracteres: letras minúsculas, números, punto, guion o guion bajo.'], 422);
    }
    return $username;
}

function validPassword(string $password): string
{
    $cfg = authCfg();
    if (strlen($password) < $cfg['min_password_length'] || strlen($password) > 200) {
        sendJson(['error' => 'La contraseña debe tener al menos ' . $cfg['min_password_length'] . ' caracteres.'], 422);
    }
    return password_hash($password, PASSWORD_DEFAULT);
}

function startLogin(int $accountId): void
{
    session_regenerate_id(true);
    $_SESSION['uid'] = $accountId;
    $_SESSION['last'] = time();
    // Generar token CSRF para proteger solicitudes POST
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

function loginAccount(PDO $db, array $data): array
{
    $username = mb_strtolower(trim((string)($data['username'] ?? '')));
    $password = (string)($data['password'] ?? '');
    $invalid = ['error' => 'Usuario o contraseña incorrectos.'];

    try {
        $query = $db->prepare('SELECT app_usuario_id, password_hash, estado, intentos_fallidos,
                                      (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > NOW()) AS bloqueado
                               FROM app_usuarios WHERE username = ?');
        $query->execute([$username]);
        $row = $query->fetch();
    } catch (PDOException $error) {
        authTablesMissing($error);
    }

    if (!$row) {
        // Hash de relleno para que tardar lo mismo no delate si el usuario existe.
        password_verify($password, '$2y$10$.vGA1O9wmRjrwAVXD98HNOgsNpDczlqm3Jq7KnEd1rVAGv3Fykk1a');
        sendJson($invalid, 401);
    }
    if ((int)$row['bloqueado'] === 1) {
        $cfg = authCfg();
        sendJson(['error' => 'Demasiados intentos fallidos. Espera ' . $cfg['lock_minutes'] . ' minutos e inténtalo de nuevo.'], 429);
    }
    if (!password_verify($password, $row['password_hash'])) {
        $cfg = authCfg();
        $failed = (int)$row['intentos_fallidos'] + 1;
        if ($failed >= $cfg['max_failed_logins']) {
            $db->prepare('UPDATE app_usuarios SET intentos_fallidos = 0, bloqueado_hasta = DATE_ADD(NOW(), INTERVAL ' . $cfg['lock_minutes'] . ' MINUTE) WHERE app_usuario_id = ?')
               ->execute([$row['app_usuario_id']]);
        } else {
            $db->prepare('UPDATE app_usuarios SET intentos_fallidos = ? WHERE app_usuario_id = ?')
               ->execute([$failed, $row['app_usuario_id']]);
        }
        sendJson($invalid, 401);
    }
    if ($row['estado'] !== 'Activo') {
        sendJson(['error' => 'Esta cuenta está inactiva. Contacta a un administrador.'], 403);
    }
    $db->prepare('UPDATE app_usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = NOW() WHERE app_usuario_id = ?')
       ->execute([$row['app_usuario_id']]);
    startLogin((int)$row['app_usuario_id']);
    return sessionPayload($db, currentAccount($db));
}

// Crea el primer administrador. Solo funciona mientras no exista ninguna cuenta.
function setupFirstAdmin(PDO $db, array $data): array
{
    if (accountCount($db) > 0) {
        sendJson(['error' => 'El sistema ya tiene usuarios. Inicia sesión.'], 409);
    }
    $username = normalizeUsername((string)($data['username'] ?? ''));
    $name = requiredText($data, 'name', 120);
    $hash = validPassword((string)($data['password'] ?? ''));

    $roleId = $db->query('SELECT rol_id FROM app_roles WHERE es_admin = 1 ORDER BY rol_id LIMIT 1')->fetchColumn();
    if ($roleId === false) {
        $db->prepare("INSERT INTO app_roles (nombre, descripcion, color, es_admin) VALUES ('Administrador', 'Acceso total al sistema', '#130a74', 1)")->execute();
        $roleId = $db->lastInsertId();
    }
    $db->prepare('INSERT INTO app_usuarios (username, nombre_visible, password_hash, rol_id, estado) VALUES (?, ?, ?, ?, \'Activo\')')
       ->execute([$username, $name, $hash, (int)$roleId]);
    startLogin((int)$db->lastInsertId());
    return sessionPayload($db, currentAccount($db));
}

function changeOwnPassword(PDO $db, array $account, array $data): array
{
    $query = $db->prepare('SELECT password_hash FROM app_usuarios WHERE app_usuario_id = ?');
    $query->execute([$account['id']]);
    $hash = $query->fetchColumn();
    if ($hash === false || !password_verify((string)($data['currentPassword'] ?? ''), $hash)) {
        sendJson(['error' => 'La contraseña actual no es correcta.'], 422);
    }
    $new = validPassword((string)($data['newPassword'] ?? ''));
    $db->prepare('UPDATE app_usuarios SET password_hash = ? WHERE app_usuario_id = ?')->execute([$new, $account['id']]);
    return ['ok' => true];
}

// ---------------------------------------------------------------------------
// Administración de roles y usuarios (requiere permisos "accesos.*")
// ---------------------------------------------------------------------------

function fetchRoles(PDO $db): array
{
    $roles = $db->query(
        'SELECT r.rol_id, r.nombre, r.descripcion, r.color, r.es_admin,
                (SELECT COUNT(*) FROM app_usuarios u WHERE u.rol_id = r.rol_id) AS miembros
         FROM app_roles r ORDER BY r.es_admin DESC, r.nombre'
    )->fetchAll();
    $grants = [];
    foreach ($db->query('SELECT rol_id, permiso FROM app_rol_permisos')->fetchAll() as $grant) {
        $grants[(int)$grant['rol_id']][] = $grant['permiso'];
    }
    $valid = allPermissionKeys();
    return ['roles' => array_map(static fn(array $role): array => [
        'id' => (int)$role['rol_id'],
        'name' => $role['nombre'],
        'description' => $role['descripcion'],
        'color' => $role['color'],
        'isAdmin' => (int)$role['es_admin'] === 1,
        'members' => (int)$role['miembros'],
        'permissions' => (int)$role['es_admin'] === 1
            ? $valid
            : array_values(array_intersect($grants[(int)$role['rol_id']] ?? [], $valid)),
    ], $roles)];
}

function fetchAccounts(PDO $db): array
{
    $rows = $db->query(
        'SELECT u.app_usuario_id, u.username, u.nombre_visible, u.estado, u.rol_id, u.ultimo_acceso,
                u.creado_en, r.nombre AS rol_nombre, r.color AS rol_color, r.es_admin
         FROM app_usuarios u JOIN app_roles r ON r.rol_id = u.rol_id
         ORDER BY u.nombre_visible'
    )->fetchAll();
    return ['accounts' => array_map(static fn(array $row): array => [
        'id' => (int)$row['app_usuario_id'],
        'username' => $row['username'],
        'name' => $row['nombre_visible'],
        'status' => $row['estado'],
        'roleId' => (int)$row['rol_id'],
        'roleName' => $row['rol_nombre'],
        'roleColor' => $row['rol_color'],
        'isAdmin' => (int)$row['es_admin'] === 1,
        'lastAccess' => $row['ultimo_acceso'],
        'createdAt' => $row['creado_en'],
    ], $rows)];
}

function adminCountExcluding(PDO $db, int $excludeAccountId): int
{
    $query = $db->prepare(
        "SELECT COUNT(*) FROM app_usuarios u JOIN app_roles r ON r.rol_id = u.rol_id
         WHERE r.es_admin = 1 AND u.estado = 'Activo' AND u.app_usuario_id <> ?"
    );
    $query->execute([$excludeAccountId]);
    return (int)$query->fetchColumn();
}

function roleRow(PDO $db, int $id): array
{
    $query = $db->prepare('SELECT rol_id, nombre, es_admin FROM app_roles WHERE rol_id = ?');
    $query->execute([$id]);
    $row = $query->fetch();
    if (!$row) {
        sendJson(['error' => 'No se encontró el rol solicitado.'], 404);
    }
    return $row;
}

function saveRole(PDO $db, array $account, array $data, bool $update): array
{
    $name = requiredText($data, 'name', 60);
    $description = optionalText($data, 'description', 255);
    $color = (string)($data['color'] ?? '#99aab5');
    if (preg_match('/^#[0-9a-fA-F]{6}$/', $color) !== 1) {
        sendJson(['error' => 'El color del rol no es válido.'], 422);
    }
    $permissions = $data['permissions'] ?? [];
    if (!is_array($permissions)) {
        sendJson(['error' => 'Los permisos deben enviarse como una lista.'], 422);
    }
    $permissions = array_values(array_unique(array_filter($permissions, 'is_string')));
    if (array_diff($permissions, allPermissionKeys())) {
        sendJson(['error' => 'Se envió un permiso que no existe.'], 422);
    }

    $db->beginTransaction();
    try {
        if ($update) {
            $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$id) {
                sendJson(['error' => 'El identificador del rol no es válido.'], 422);
            }
            $current = roleRow($db, (int)$id);
            $isAdminRole = (int)$current['es_admin'] === 1;
            if ($isAdminRole && !$account['isAdmin']) {
                sendJson(['error' => 'Solo un administrador puede modificar el rol Administrador.'], 403);
            }
            $db->prepare('UPDATE app_roles SET nombre = ?, descripcion = ?, color = ? WHERE rol_id = ?')
               ->execute([$name, $description, $color, $id]);
        } else {
            $db->prepare('INSERT INTO app_roles (nombre, descripcion, color, es_admin) VALUES (?, ?, ?, 0)')
               ->execute([$name, $description, $color]);
            $id = (int)$db->lastInsertId();
            $isAdminRole = false;
        }
        // El rol Administrador tiene todo de forma implícita: no se guardan permisos sueltos.
        if (!$isAdminRole) {
            $db->prepare('DELETE FROM app_rol_permisos WHERE rol_id = ?')->execute([$id]);
            $insert = $db->prepare('INSERT INTO app_rol_permisos (rol_id, permiso) VALUES (?, ?)');
            foreach ($permissions as $permission) {
                $insert->execute([$id, $permission]);
            }
        }
        $db->commit();
    } catch (PDOException $error) {
        $db->rollBack();
        if ($error->getCode() === '23000') {
            sendJson(['error' => 'Ya existe un rol con ese nombre.'], 409);
        }
        throw $error;
    }
    return ['id' => (string)$id];
}

function deleteRole(PDO $db, array $data): array
{
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
    if (!$id) {
        sendJson(['error' => 'El identificador del rol no es válido.'], 422);
    }
    $role = roleRow($db, (int)$id);
    if ((int)$role['es_admin'] === 1) {
        sendJson(['error' => 'El rol Administrador no se puede eliminar.'], 409);
    }
    $members = $db->prepare('SELECT COUNT(*) FROM app_usuarios WHERE rol_id = ?');
    $members->execute([$id]);
    if ((int)$members->fetchColumn() > 0) {
        sendJson(['error' => 'Este rol tiene usuarios asignados. Cámbiales el rol antes de eliminarlo.'], 409);
    }
    $db->prepare('DELETE FROM app_roles WHERE rol_id = ?')->execute([$id]);
    return ['ok' => true];
}

function saveAccount(PDO $db, array $actor, array $data, bool $update): array
{
    $username = normalizeUsername((string)($data['username'] ?? ''));
    $name = requiredText($data, 'name', 120);
    $status = requiredText($data, 'status', 20);
    if (!in_array($status, ['Activo', 'Inactivo'], true)) {
        sendJson(['error' => 'El estado debe ser Activo o Inactivo.'], 422);
    }
    $roleId = filter_var($data['roleId'] ?? null, FILTER_VALIDATE_INT);
    if (!$roleId) {
        sendJson(['error' => 'Selecciona un rol.'], 422);
    }
    $role = roleRow($db, (int)$roleId);
    $targetIsAdminRole = (int)$role['es_admin'] === 1;
    if ($targetIsAdminRole && !$actor['isAdmin']) {
        sendJson(['error' => 'Solo un administrador puede asignar el rol Administrador.'], 403);
    }
    $password = (string)($data['password'] ?? '');

    try {
        if ($update) {
            $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$id) {
                sendJson(['error' => 'El identificador del usuario no es válido.'], 422);
            }
            $query = $db->prepare('SELECT u.estado, r.es_admin FROM app_usuarios u JOIN app_roles r ON r.rol_id = u.rol_id WHERE u.app_usuario_id = ?');
            $query->execute([$id]);
            $current = $query->fetch();
            if (!$current) {
                sendJson(['error' => 'No se encontró el usuario solicitado.'], 404);
            }
            $wasAdmin = (int)$current['es_admin'] === 1;
            if ($wasAdmin && !$actor['isAdmin']) {
                sendJson(['error' => 'Solo un administrador puede modificar a otro administrador.'], 403);
            }
            $stillActiveAdmin = $targetIsAdminRole && $status === 'Activo';
            if ($wasAdmin && !$stillActiveAdmin && adminCountExcluding($db, (int)$id) === 0) {
                sendJson(['error' => 'Debe quedar al menos un administrador activo.'], 409);
            }
            if ((int)$id === $actor['id'] && $status !== 'Activo') {
                sendJson(['error' => 'No puedes desactivar tu propia cuenta.'], 409);
            }
            $db->prepare('UPDATE app_usuarios SET username = ?, nombre_visible = ?, rol_id = ?, estado = ? WHERE app_usuario_id = ?')
               ->execute([$username, $name, $roleId, $status, $id]);
            if ($password !== '') {
                $db->prepare('UPDATE app_usuarios SET password_hash = ?, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE app_usuario_id = ?')
                   ->execute([validPassword($password), $id]);
            }
            return ['id' => (string)$id];
        }
        $hash = validPassword($password);
        $db->prepare('INSERT INTO app_usuarios (username, nombre_visible, password_hash, rol_id, estado) VALUES (?, ?, ?, ?, ?)')
           ->execute([$username, $name, $hash, $roleId, $status]);
        return ['id' => (string)$db->lastInsertId()];
    } catch (PDOException $error) {
        if ($error->getCode() === '23000') {
            sendJson(['error' => 'Ese nombre de usuario ya está en uso.'], 409);
        }
        throw $error;
    }
}

function deleteAccount(PDO $db, array $actor, array $data): array
{
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
    if (!$id) {
        sendJson(['error' => 'El identificador del usuario no es válido.'], 422);
    }
    if ((int)$id === $actor['id']) {
        sendJson(['error' => 'No puedes eliminar tu propia cuenta.'], 409);
    }
    $query = $db->prepare('SELECT r.es_admin FROM app_usuarios u JOIN app_roles r ON r.rol_id = u.rol_id WHERE u.app_usuario_id = ?');
    $query->execute([$id]);
    $isAdmin = $query->fetchColumn();
    if ($isAdmin === false) {
        sendJson(['error' => 'No se encontró el usuario solicitado.'], 404);
    }
    if ((int)$isAdmin === 1) {
        if (!$actor['isAdmin']) {
            sendJson(['error' => 'Solo un administrador puede eliminar a otro administrador.'], 403);
        }
        if (adminCountExcluding($db, (int)$id) === 0) {
            sendJson(['error' => 'Debe quedar al menos un administrador activo.'], 409);
        }
    }
    $db->prepare('DELETE FROM app_usuarios WHERE app_usuario_id = ?')->execute([$id]);
    return ['ok' => true];
}
