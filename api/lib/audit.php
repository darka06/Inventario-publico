<?php
declare(strict_types=1);

// Auditoría, justificaciones e historial de cambios.

// ---------------------------------------------------------------------------
// Historial de cambios (tabla registro_cambios, incluida en database/schema.mysql.sql)
// Nunca debe romper la operación principal: si falla, solo se escribe en el log de PHP.
// ---------------------------------------------------------------------------
const AUDIT_ACTIONS = [
    // acción de la API => [verbo, módulo, operación, tabla, columna id, expresión del nombre]
    'asset.save' => ['auto', 'Activos', ['Nuevo activo', 'Activo modificado'], 'activos', 'activo_id', "CONCAT(codigo_inventario, ' - ', nombre)"],
    'asset.delete' => ['Eliminó', 'Activos', 'Activo eliminado', 'activos', 'activo_id', "CONCAT(codigo_inventario, ' - ', nombre)"],
    'asset.assign' => ['Movimiento', 'Activos', 'Asignación de activo', 'activos', 'activo_id', "CONCAT(codigo_inventario, ' - ', nombre)"],
    'asset.loan' => ['Movimiento', 'Activos', 'Alquiler, préstamo o venta de activo', 'activos', 'activo_id', "CONCAT(codigo_inventario, ' - ', nombre)"],
    'asset.return' => ['Movimiento', 'Activos', 'Devolución de activo', 'activos', 'activo_id', "CONCAT(codigo_inventario, ' - ', nombre)"],
    'loan.return' => ['Movimiento', 'Activos', 'Devolución de activo', 'activos', 'activo_id', "CONCAT(codigo_inventario, ' - ', nombre)"],
    'loan.update' => ['Modificó', 'Alquiler / Venta', 'Operación modificada', null, null, null],
    'loan.delete' => ['Eliminó', 'Alquiler / Venta', 'Operación eliminada', null, null, null],
    'brand.create' => ['Creó', 'Marcas', 'Nueva marca', 'marcas', 'marca_id', 'nombre'],
    'brand.rename' => ['Modificó', 'Marcas', 'Cambio de nombre de marca', 'marcas', 'marca_id', 'nombre'],
    'brand.delete' => ['Eliminó', 'Marcas', 'Marca eliminada', 'marcas', 'marca_id', 'nombre'],
    'category.save' => ['auto', 'Categorías', ['Nueva categoría', 'Categoría modificada'], 'categorias_activo', 'categoria_id', 'nombre'],
    'category.delete' => ['Eliminó', 'Categorías', 'Categoría eliminada', 'categorias_activo', 'categoria_id', 'nombre'],
    'supply.save' => ['auto', 'Insumos', ['Nuevo insumo', 'Insumo modificado'], 'insumos', 'insumo_id', "CONCAT(codigo, ' - ', descripcion)"],
    'supply.delete' => ['Eliminó', 'Insumos', 'Insumo eliminado', 'insumos', 'insumo_id', "CONCAT(codigo, ' - ', descripcion)"],
    'supply.move' => ['Movimiento', 'Insumos', 'Movimiento de insumo', 'insumos', 'insumo_id', "CONCAT(codigo, ' - ', descripcion)"],
    'movement.delete' => ['Eliminó', 'Movimientos', 'Movimiento eliminado', null, null, null],
    'purchase.create' => ['Creó', 'Compras', 'Compra registrada', null, null, null],
    'purchase.update' => ['Modificó', 'Compras', 'Compra modificada', null, null, null],
    'purchase.delete' => ['Eliminó', 'Compras', 'Compra eliminada', null, null, null],
    'contact.create' => ['Creó', 'Contactos', 'Contacto', null, null, null],
    'contact.update' => ['Modificó', 'Contactos', 'Contacto', null, null, null],
    'contact.delete' => ['Eliminó', 'Contactos', 'Contacto eliminado', null, null, null],
    'user.create' => ['Creó', 'Funcionarios', 'Nuevo funcionario', 'usuarios', 'usuario_id', 'nombre_completo'],
    'user.update' => ['Modificó', 'Funcionarios', 'Funcionario modificado', 'usuarios', 'usuario_id', 'nombre_completo'],
    'user.delete' => ['Eliminó', 'Funcionarios', 'Funcionario eliminado', 'usuarios', 'usuario_id', 'nombre_completo'],
    'tool.create' => ['Creó', 'Herramientas', 'Nueva herramienta', 'herramientas', 'herramienta_id', 'nombre'],
    'tool.update' => ['Modificó', 'Herramientas', 'Herramienta modificada', 'herramientas', 'herramienta_id', 'nombre'],
    'tool.delete' => ['Eliminó', 'Herramientas', 'Herramienta eliminada', 'herramientas', 'herramienta_id', 'nombre'],
    'toolaudit.save' => ['Creó', 'Auditorías', 'Auditoría de herramientas', null, null, null],
    'role.save' => ['auto', 'Accesos', ['Nuevo rol', 'Rol modificado'], 'app_roles', 'rol_id', 'nombre'],
    'role.delete' => ['Eliminó', 'Accesos', 'Rol eliminado', 'app_roles', 'rol_id', 'nombre'],
    // Las cuentas no declaran tabla: así nunca se copia password_hash al historial.
    'account.save' => ['auto', 'Accesos', ['Nuevo usuario', 'Usuario modificado'], null, null, null],
    'account.delete' => ['Eliminó', 'Accesos', 'Usuario eliminado', null, null, null],
];

// Resuelve tabla/columna del registro afectado cuando depende del payload (contactos).
function auditTarget(string $action, array $data, array $meta): array
{
    if (str_starts_with($action, 'contact.')) {
        $idText = (string)($data['id'] ?? '');
        $type = (string)($data['type'] ?? '');
        if (preg_match('/^(cliente|proveedor):([0-9]+)$/', $idText, $m) === 1) {
            $type = $m[1] === 'cliente' ? 'Cliente' : 'Proveedor';
        }
        $meta[1] = $type === 'Proveedor' ? 'Proveedores' : 'Clientes';
        $meta[2] = ($type === 'Proveedor' ? 'Proveedor' : 'Cliente') . ($action === 'contact.create' ? ' nuevo' : ($action === 'contact.update' ? ' modificado' : ' eliminado'));
        $meta[3] = $type === 'Proveedor' ? 'proveedores' : 'clientes';
        $meta[4] = $type === 'Proveedor' ? 'proveedor_id' : 'cliente_id';
        $meta[5] = 'razon_social';
    }
    return $meta;
}

// Id numérico del registro afectado, según lo enviado por la pantalla.
function auditRecordId(string $action, array $data): ?int
{
    $key = match ($action) {
        'asset.assign', 'asset.loan', 'asset.return', 'loan.return' => 'assetId',
        'supply.move' => 'supplyId',
        default => 'id',
    };
    $raw = (string)($data[$key] ?? '');
    if (preg_match('/^(?:cliente|proveedor):([0-9]+)$/', $raw, $m) === 1) {
        return (int)$m[1];
    }
    return ctype_digit($raw) ? (int)$raw : null;
}

// Motivo obligatorio: toda modificación o eliminación debe explicar el porqué.
const JUSTIFICATION_MIN = 10;
const JUSTIFICATION_MAX = 500;

// Devuelve 'Modificó' / 'Eliminó' si la acción exige motivo; null si no (creaciones y movimientos).
function justificationKind(string $action, array $data): ?string
{
    $meta = AUDIT_ACTIONS[$action] ?? null;
    if ($meta === null) {
        return null;
    }
    $verb = $meta[0];
    if ($verb === 'auto') {
        return auditRecordId($action, $data) !== null ? 'Modificó' : null;
    }
    return in_array($verb, ['Modificó', 'Eliminó'], true) ? $verb : null;
}

// Texto del motivo ya limpio (sin espacios sobrantes), o '' si no vino.
function justificationText(array $data): string
{
    $raw = $data['justification'] ?? '';
    $text = is_string($raw) ? trim((string)preg_replace('/\s+/u', ' ', $raw)) : '';
    return $text;
}

// Se llama ANTES de ejecutar la acción: si falta el motivo se rechaza y NO se toca nada.
function requireJustification(string $action, array $data): void
{
    $kind = justificationKind($action, $data);
    if ($kind === null) {
        return;
    }
    $text = justificationText($data);
    $verb = $kind === 'Eliminó' ? 'eliminar' : 'modificar';
    if (mb_strlen($text) < JUSTIFICATION_MIN) {
        sendJson([
            'error' => 'Para ' . $verb . ' este registro debes explicar el motivo (mínimo ' . JUSTIFICATION_MIN . ' caracteres).',
            'code' => 'justification',
        ], 422);
    }
    if (mb_strlen($text) > JUSTIFICATION_MAX) {
        sendJson([
            'error' => 'El motivo es demasiado largo (máximo ' . JUSTIFICATION_MAX . ' caracteres).',
            'code' => 'justification',
        ], 422);
    }
}

// Se llama ANTES de ejecutar la acción: guarda cómo estaba el registro (para modificar / eliminar).
function auditBefore(PDO $db, string $action, array $data): ?array
{
    $meta = AUDIT_ACTIONS[$action] ?? null;
    if ($meta === null) {
        return null;
    }
    $state = ['meta' => $meta, 'label' => null, 'before' => null];
    try {
        $meta = auditTarget($action, $data, $meta);
        $state['meta'] = $meta;
        $id = auditRecordId($action, $data);
        if ($id !== null && $meta[3] !== null) {
            $query = $db->prepare("SELECT {$meta[5]} AS etiqueta, t.* FROM {$meta[3]} t WHERE {$meta[4]} = ?");
            $query->execute([$id]);
            $row = $query->fetch();
            if ($row) {
                $state['label'] = $row['etiqueta'];
                unset($row['etiqueta']);
                $state['before'] = $row;
            }
        }
    } catch (Throwable $error) {
        error_log('[Inventario API][historial] ' . $error->getMessage());
    }
    return $state;
}

// Se llama DESPUÉS de que la acción terminó bien.
function auditAfter(PDO $db, string $action, array $data, array $result, ?array $state): void
{
    if ($state === null) {
        return;
    }
    try {
        [$verb, $module, $operation] = $state['meta'];
        $id = auditRecordId($action, $data);
        if ($id === null && isset($result['id'])) {
            $id = (int)preg_replace('/^\D+/', '', (string)$result['id']);
        }
        // "auto": si la pantalla envió un id es una modificación, si no, una creación.
        if ($verb === 'auto') {
            $isUpdate = auditRecordId($action, $data) !== null;
            $verb = $isUpdate ? 'Modificó' : 'Creó';
            $operation = is_array($operation) ? $operation[$isUpdate ? 1 : 0] : (string)$operation;
        }
        $label = $state['label'];
        if ($label === null) {
            // Registro nuevo: se toma el nombre o código de lo que se envió.
            foreach (['name', 'code', 'description', 'nombre', 'username'] as $key) {
                if (!empty($data[$key])) {
                    $label = trim((string)$data[$key]);
                    break;
                }
            }
            if ($action === 'brand.rename' && !empty($data['name'])) {
                $label = trim((string)$data['name']);
            }
            if ($label === null && !empty($result['label'])) {
                $label = (string)$result['label'];
            }
        } elseif ($action === 'brand.rename' && !empty($data['name'])) {
            $label .= ' → ' . trim((string)$data['name']);
        } elseif ($action === 'asset.assign' || $action === 'asset.loan') {
            $label .= ' → ' . trim((string)($data['person'] ?? ''));
        } elseif ($action === 'supply.move') {
            $label .= ' (' . ($data['type'] ?? '') . ' ' . ($data['quantity'] ?? '') . ')';
        }
        $options = JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE;
        $sent = $data;
        foreach (['password', 'currentPassword', 'newPassword', 'justification'] as $secret) {
            unset($sent[$secret]);
        }
        $justification = justificationText($data);
        $base = [
            $verb,
            $module,
            $operation,
            $label !== null ? mb_substr((string)$label, 0, 255) : null,
            $id !== null ? (string)$id : null,
            $state['before'] !== null ? json_encode($state['before'], $options) : null,
        ];
        $network = [
            mb_substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45) ?: null,
            mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255) ?: null,
        ];
        $actor = currentAccount($db)['username'] ?? null;
        $encode = static fn(array $payload): ?string => $payload ? (json_encode($payload, $options) ?: null) : null;

        // Del más completo al más antiguo, según qué migraciones tenga la base. Si falta la columna
        // `justificacion`, el motivo se guarda dentro de datos_enviados para no perderlo nunca.
        $variants = [
            [
                'INSERT INTO registro_cambios (accion, modulo, operacion, registro, registro_id, datos_antes, datos_enviados, ip, equipo, usuario_app, justificacion)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [...$base, $encode($sent), ...$network, $actor, $justification !== '' ? $justification : null],
            ],
            [
                'INSERT INTO registro_cambios (accion, modulo, operacion, registro, registro_id, datos_antes, datos_enviados, ip, equipo, usuario_app)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [...$base, $encode($justification !== '' ? $sent + ['justificacion' => $justification] : $sent), ...$network, $actor],
            ],
            [
                'INSERT INTO registro_cambios (accion, modulo, operacion, registro, registro_id, datos_antes, datos_enviados, ip, equipo)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [...$base, $encode($justification !== '' ? $sent + ['justificacion' => $justification] : $sent), ...$network],
            ],
        ];
        foreach ($variants as $index => [$sql, $params]) {
            try {
                $db->prepare($sql)->execute($params);
                break;
            } catch (PDOException $error) {
                if ($error->getCode() !== '42S22' || $index === count($variants) - 1) {
                    throw $error;
                }
            }
        }
    } catch (Throwable $error) {
        error_log('[Inventario API][historial] ' . $error->getMessage());
    }
}

function fetchChanges(PDO $db): array
{
    $columns = 'cambio_id, fecha_hora, accion, modulo, operacion, registro, registro_id, datos_antes, datos_enviados, equipo';
    $limit = (int)(envValue('INVENTARIO_AUDIT_LIMIT', '2000'));
    $tail = "FROM registro_cambios ORDER BY fecha_hora DESC, cambio_id DESC LIMIT {$limit}";
    // Del más completo al más antiguo, según qué migraciones tenga la base.
    $queries = [
        "SELECT {$columns}, usuario_app, justificacion {$tail}",
        "SELECT {$columns}, usuario_app, NULL AS justificacion {$tail}",
        "SELECT {$columns}, NULL AS usuario_app, NULL AS justificacion {$tail}",
    ];
    $rows = null;
    try {
        foreach ($queries as $index => $query) {
            try {
                $rows = $db->query($query)->fetchAll();
                break;
            } catch (PDOException $error) {
                if ($error->getCode() !== '42S22' || $index === count($queries) - 1) {
                    throw $error;
                }
            }
        }
    } catch (PDOException $error) {
        if ($error->getCode() === '42S02') {
            sendJson(['error' => 'Falta la tabla del historial. Importa database/schema.mysql.sql en MySQL.'], 503);
        }
        throw $error;
    }
    return ['changes' => array_map(static function (array $row): array {
        $sent = $row['datos_enviados'] === null ? null : json_decode($row['datos_enviados'], true);
        $reason = $row['justificacion'];
        // Si la base aún no tiene la columna, el motivo viaja dentro de lo enviado.
        if (($reason === null || $reason === '') && is_array($sent) && isset($sent['justificacion'])) {
            $reason = (string)$sent['justificacion'];
            unset($sent['justificacion']);
        }
        return [
            'id' => (string)$row['cambio_id'],
            'date' => $row['fecha_hora'],
            'action' => $row['accion'],
            'module' => $row['modulo'],
            'operation' => $row['operacion'],
            'record' => $row['registro'],
            'recordId' => $row['registro_id'],
            'before' => $row['datos_antes'] === null ? null : json_decode($row['datos_antes'], true),
            'sent' => $sent,
            'user' => $row['usuario_app'],
            'device' => $row['equipo'],
            'justification' => $reason === '' ? null : $reason,
        ];
    }, $rows)];
}

