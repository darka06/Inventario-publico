<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, max-age=60');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');
$isProduction = envValue('INVENTARIO_ENV', 'development') === 'production';
if ($isProduction || (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on')) {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'self'");

// Funciones por tema (ver api/lib/). El orden no afecta: se definen todas antes de atender la petición.
require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/fetch.php';
require_once __DIR__ . '/lib/assets.php';
require_once __DIR__ . '/lib/supplies.php';
require_once __DIR__ . '/lib/purchases.php';
require_once __DIR__ . '/lib/records.php';
require_once __DIR__ . '/lib/audit.php';
require_once __DIR__ . '/lib/tool_audits.php';

try {
    $db = database();
    $fkCheck = checkForeignKeys($db);
    startAppSession();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $resource = (string)($_GET['resource'] ?? '');

    if ($method === 'GET' && $resource === 'health') {
        $db->query('SELECT 1');
        $health = ['ok' => true, 'database' => 'connected'];
        if (!empty($fkCheck['missing'])) {
            $health['warnings'] = ['missing_foreign_keys' => $fkCheck['missing']];
        }
        if (!empty($fkCheck['errors'])) {
            $health['errors'] = ['foreign_key_check_failed' => $fkCheck['errors']];
        }
        sendJson($health);
    }
    $account = currentAccount($db);
    if ($method === 'GET' && $resource === 'session') {
        // Público: la pantalla de login lo usa para saber si hay sesión o si falta crear el primer administrador.
        sendJson(sessionPayload($db, $account));
    }

    // Rate limiting por IP para endpoints públicos (login, setup, session)
    // Rate limiting por cuenta para endpoints autenticados
    if ($account === null) {
        checkRateLimit();
    } else {
        checkAccountRateLimit($account['id']);
    }

    if ($method === 'GET') {
        if ($account === null) {
            sendJson(['error' => 'Debes iniciar sesión.', 'code' => 'auth'], 401);
        }
        $dataSets = ['assets', 'categories', 'brands', 'supplies', 'purchases', 'movements', 'contacts', 'loans', 'users', 'tools'];
        if (in_array($resource, $dataSets, true) && !canViewData($account, $resource)) {
            requirePermission($account, DATA_VIEW_PERMISSIONS[$resource]);
        }
        if ($resource === 'dashboard') {
            requirePermission($account, 'dashboard.ver');
        }
        if ($resource === 'changes') {
            requirePermission($account, 'historial.ver');
        }
        if ($resource === 'toolaudits') {
            requirePermission($account, ['auditorias.ver', 'inventario.ver']);
        }
        if (in_array($resource, ['roles', 'accounts'], true)) {
            requirePermission($account, 'accesos.ver');
        }
        $data = match ($resource) {
            'all' => loadAll($db, $account),
            'assets' => ['assets' => fetchAssets($db)],
            'categories' => ['categories' => fetchCategories($db)],
            'brands' => ['brands' => fetchBrands($db)],
            'supplies' => ['supplies' => fetchSupplies($db)],
            'purchases' => ['purchases' => fetchPurchases($db)],
            'movements' => ['movements' => fetchMovements($db)],
            'contacts' => ['contacts' => fetchContacts($db)],
            'loans' => ['loans' => fetchLoans($db)],
            'users' => ['users' => fetchUsers($db)],
            'tools' => ['tools' => fetchTools($db)],
            'dashboard' => fetchDashboard($db),
            'changes' => fetchChanges($db),
            'toolaudits' => ['toolAudits' => fetchToolAudits($db)],
            'roles' => fetchRoles($db),
            'accounts' => fetchAccounts($db),
            'permissions' => ['catalog' => permissionCatalogForClient()],
            default => null,
        };
        if ($data === null) {
            sendJson(['error' => 'El recurso solicitado no existe.'], 404);
        }
        sendJson($data);
    }
    if ($method !== 'POST') {
        header('Allow: GET, POST');
        sendJson(['error' => 'Método HTTP no permitido.'], 405);
    }

    // Exigir JSON impide que otro sitio dispare formularios simples contra la API (CSRF).
    if (stripos((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) {
        sendJson(['error' => 'La solicitud debe enviarse como application/json.'], 415);
    }
    $data = inputData();
    $action = (string)($_GET['action'] ?? '');

    // Validar token CSRF para acciones que modifican datos (POST)
    // auth.login y auth.setup están exentos porque no tienen sesión aún
    if (!in_array($action, ['auth.login', 'auth.setup'], true)) {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!hash_equals($_SESSION['csrf_token'] ?? '', $token)) {
            sendJson(['error' => 'Token de seguridad inválido. Recarga la página e inténtalo de nuevo.'], 403);
        }
    }

    // Acciones públicas de sesión
    if ($action === 'auth.login') {
        sendJson(loginAccount($db, $data));
    }
    if ($action === 'auth.setup') {
        sendJson(setupFirstAdmin($db, $data));
    }
    if ($action === 'auth.logout') {
        destroyAppSession();
        sendJson(['ok' => true]);
    }
    if ($account === null) {
        sendJson(['error' => 'Debes iniciar sesión.', 'code' => 'auth'], 401);
    }
    if ($action === 'auth.password') {
        sendJson(changeOwnPassword($db, $account, $data));
    }

    $isUpdate = ($data['id'] ?? '') !== '' && ($data['id'] ?? null) !== null;
    $needed = match ($action) {
        'asset.save' => $isUpdate ? 'activos.editar' : 'activos.crear',
        'asset.delete' => 'activos.eliminar',
        'asset.assign', 'asset.return' => 'activos.asignar',
        'asset.loan' => ['prestamos.crear', 'activos.asignar'],
        'loan.update' => 'prestamos.editar',
        'loan.delete' => 'prestamos.eliminar',
        'loan.return' => ['prestamos.devolver', 'activos.asignar'],
        'brand.create' => 'marcas.crear',
        'brand.rename' => 'marcas.editar',
        'brand.delete' => 'marcas.eliminar',
        'category.save' => $isUpdate ? 'categorias.editar' : 'categorias.crear',
        'category.delete' => 'categorias.eliminar',
        'supply.save' => $isUpdate ? 'insumos.editar' : 'insumos.crear',
        'supply.move' => 'insumos.movimientos',
        'supply.delete' => 'insumos.eliminar',
        'movement.delete' => 'movimientos.eliminar',
        'purchase.create' => 'compras.crear',
        'purchase.update' => 'compras.editar',
        'purchase.delete' => 'compras.eliminar',
        'contact.create' => 'contactos.crear',
        'contact.update' => 'contactos.editar',
        'contact.delete' => 'contactos.eliminar',
        'user.create' => 'funcionarios.crear',
        'user.update' => 'funcionarios.editar',
        'user.delete' => 'funcionarios.eliminar',
        'tool.create' => 'herramientas.crear',
        'tool.update' => 'herramientas.editar',
        'tool.delete' => 'herramientas.eliminar',
        'toolaudit.save' => 'auditorias.crear',
        'role.save', 'account.save' => $isUpdate ? 'accesos.editar' : 'accesos.crear',
        'role.delete', 'account.delete' => 'accesos.eliminar',
        default => null,
    };
    if ($needed !== null) {
        requirePermission($account, $needed);
    }
    if ($action === 'asset.loan' && !empty($data['supplyItems'])) {
        requirePermission($account, 'insumos.movimientos');
    }

    // El motivo se valida ANTES de tocar la base: sin motivo no se modifica ni elimina nada.
    requireJustification($action, $data);
    $auditState = auditBefore($db, $action, $data);
    $result = match ($action) {
        'role.save' => saveRole($db, $account, $data, $isUpdate),
        'role.delete' => deleteRole($db, $data),
        'account.save' => saveAccount($db, $account, $data, $isUpdate),
        'account.delete' => deleteAccount($db, $account, $data),
        'asset.save' => saveAsset($db, $data),
        'asset.delete' => (function () use ($db, $data): array {
            deleteAsset($db, $data);
            return ['ok' => true];
        })(),
        'brand.create' => createBrand($db, $data),
        'brand.rename' => renameBrand($db, $data),
        'brand.delete' => (function () use ($db, $data): array {
            deleteBrand($db, $data);
            return ['ok' => true];
        })(),
        'category.save' => saveCategory($db, $data),
        'category.delete' => (function () use ($db, $data): array {
            deleteCategory($db, $data);
            return ['ok' => true];
        })(),
        'asset.assign' => assignAsset($db, $data),
        'asset.loan' => assignAsset($db, $data, true),
        'loan.update' => updateLoanOperation($db, $data),
        'loan.delete' => deleteLoanOperation($db, $data),
        'asset.return' => (function () use ($db, $data): array {
            $id = filter_var($data['assetId'] ?? null, FILTER_VALIDATE_INT);
            if (!$id) {
                sendJson(['error' => 'El identificador del activo no es válido.'], 422);
            }
            returnAsset($db, (int)$id);
            return ['ok' => true];
        })(),
        'loan.return' => (function () use ($db, $data): array {
            $loanId = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
            $assetId = filter_var($data['assetId'] ?? null, FILTER_VALIDATE_INT);
            if (!$loanId || !$assetId) {
                sendJson(['error' => 'El préstamo seleccionado no es válido.'], 422);
            }
            returnAsset($db, (int)$assetId, (int)$loanId);
            return ['ok' => true];
        })(),
        'supply.save' => saveSupply($db, $data),
        'supply.delete' => (function () use ($db, $data): array {
            deleteSupply($db, $data);
            return ['ok' => true];
        })(),
        'supply.move' => (function () use ($db, $data): array {
            stockMovement($db, $data);
            return ['ok' => true];
        })(),
        'movement.delete' => (function () use ($db, $data): array {
            deleteMovement($db, $data);
            return ['ok' => true, 'id' => (string)($data['id'] ?? '')];
        })(),
        'purchase.create' => (function () use ($db, $data): array {
            registerPurchase($db, $data);
            return ['ok' => true];
        })(),
        'purchase.update' => updatePurchase($db, $data),
        'purchase.delete' => deletePurchase($db, $data),
        'contact.create' => saveContact($db, $data),
        'contact.update' => saveContact($db, $data, true),
        'contact.delete' => (function () use ($db, $data): array {
            deleteContact($db, $data);
            return ['ok' => true];
        })(),
        'user.create' => saveUser($db, $data),
        'user.update' => saveUser($db, $data, true),
        'user.delete' => (function () use ($db, $data): array {
            deleteUser($db, $data);
            return ['ok' => true];
        })(),
        'tool.create' => saveTool($db, $data, $account),
        'tool.update' => saveTool($db, $data, $account, true),
        'tool.delete' => (function () use ($db, $data): array {
            deleteTool($db, $data);
            return ['ok' => true];
        })(),
        'toolaudit.save' => saveToolAudit($db, $account, $data),
        default => null,
    };
    if ($result === null) {
        sendJson(['error' => 'La operación solicitada no existe.'], 404);
    }
    auditAfter($db, $action, $data, $result, $auditState);
    sendJson($result, 200);
} catch (Throwable $error) {
    $errorId = 'ERR-' . bin2hex(random_bytes(8));
    error_log("[Inventario API] [{$errorId}] " . get_class($error) . ': ' . $error->getMessage() . ' in ' . $error->getFile() . ':' . $error->getLine());
    $failure = ['error' => 'Error de base de datos o del servidor.'];
    // Diagnóstico: en modo debug, mostrar el ID de error para buscar en los logs del servidor
    if (envValue('INVENTARIO_DEBUG', '') === '1') {
        $failure['errorId'] = $errorId;
    }
    sendJson($failure, 500);
}
