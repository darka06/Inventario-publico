<?php
declare(strict_types=1);

// Consultas de lectura (GET) y permisos de datos.

function fetchAssets(PDO $db): array
{
    $sql = "SELECT a.activo_id, a.codigo_inventario, a.nombre, COALESCE(m.nombre, a.marca) AS marca, a.modelo, a.numero_serie,
                   a.descripcion, a.fecha_compra, a.costo_compra, a.tipo, a.subtipo, a.proveedor_texto,
                   a.factura, a.iva_porcentaje, a.valor_con_iva, a.fecha_registro_compra, a.fecha_ultimo_movimiento,
                   a.cliente_actual, a.responsable_actual, a.notas, a.fin_garantia, a.ubicacion, a.creado_en, a.actualizado_en,
                   c.nombre AS categoria, s.nombre AS estado,
                   asignacion.persona_asignada, asignacion.cliente_texto AS asignacion_cliente
            FROM activos a
            LEFT JOIN marcas m ON m.marca_id = a.marca_id
            LEFT JOIN categorias_activo c ON c.categoria_id = a.categoria_id
            LEFT JOIN estados_activo s ON s.estado_id = a.estado_id
            LEFT JOIN (
              SELECT actual.activo_id, actual.persona_asignada, actual.cliente_texto
              FROM asignaciones actual
              INNER JOIN (
                SELECT activo_id, MAX(asignacion_id) AS asignacion_id
                FROM asignaciones WHERE devuelto_en IS NULL GROUP BY activo_id
              ) reciente ON reciente.asignacion_id = actual.asignacion_id
            ) asignacion ON asignacion.activo_id = a.activo_id
            ORDER BY a.codigo_inventario";
    $items = $db->query($sql)->fetchAll();
    $history = $db->query(
        'SELECT codigo_activo, estado_anterior_id, estado_nuevo_id, cambiado_en, motivo, responsable_texto,
                anterior.nombre AS estado_anterior, nuevo.nombre AS estado_nuevo
         FROM historial_estados h
         LEFT JOIN estados_activo anterior ON anterior.estado_id = h.estado_anterior_id
         LEFT JOIN estados_activo nuevo ON nuevo.estado_id = h.estado_nuevo_id
         ORDER BY cambiado_en DESC'
    )->fetchAll();
    $byCode = [];
    foreach ($history as $entry) {
        $byCode[$entry['codigo_activo']][] = [
            'date' => substr((string)$entry['cambiado_en'], 0, 10),
            'from' => $entry['estado_anterior'] ?? '—',
            'to' => $entry['estado_nuevo'] ?? '—',
            'note' => $entry['motivo'] ?? '',
        ];
    }
    return array_map(static function (array $asset) use ($byCode): array {
        $code = (string)$asset['codigo_inventario'];
        return [
            'id' => (string)$asset['activo_id'],
            'code' => $code,
            'name' => $asset['nombre'],
            'category' => $asset['categoria'],
            'brand' => $asset['marca'],
            'model' => $asset['modelo'],
            'serial' => $asset['numero_serie'],
            'status' => $asset['estado'] ?? 'Disponible',
            'purchaseDate' => $asset['fecha_compra'],
            'supplier' => $asset['proveedor_texto'],
            'invoice' => $asset['factura'],
            'cost' => $asset['valor_con_iva'] ?? $asset['costo_compra'],
            'assignedTo' => $asset['persona_asignada'] ?? $asset['responsable_actual'],
            'client' => $asset['asignacion_cliente'] ?? $asset['cliente_actual'],
            'notes' => $asset['notas'],
            'description' => $asset['descripcion'],
            'location' => $asset['ubicacion'],
            'warrantyEnd' => $asset['fin_garantia'],
            'type' => $asset['tipo'],
            'subtype' => $asset['subtipo'],
            'tax' => $asset['iva_porcentaje'],
            'registeredAt' => $asset['fecha_registro_compra'],
            'lastMovement' => $asset['fecha_ultimo_movimiento'],
            'createdAt' => $asset['creado_en'],
            'updatedAt' => $asset['actualizado_en'],
            'history' => $byCode[$code] ?? [],
        ];
    }, $items);
}

function fetchCategories(PDO $db): array
{
    $items = $db->query(
        'SELECT c.categoria_id, c.nombre, COUNT(a.activo_id) AS total_activos
         FROM categorias_activo c
         LEFT JOIN activos a ON a.categoria_id = c.categoria_id
         GROUP BY c.categoria_id, c.nombre
         ORDER BY c.nombre'
    )->fetchAll();
    return array_map(static fn(array $item): array => [
        'id' => (string)$item['categoria_id'],
        'name' => $item['nombre'],
        'assetCount' => (int)$item['total_activos'],
    ], $items);
}

function fetchSupplies(PDO $db): array
{
    return array_map(static fn(array $item): array => [
        'id' => (string)$item['insumo_id'],
        'code' => $item['codigo'],
        'name' => $item['descripcion'],
        'unit' => $item['unidad_medida'],
        'brand' => $item['nombre_marca'],
        'entries' => (float)($item['entradas'] ?? 0),
        'exits' => (float)($item['salidas'] ?? 0),
        'stock' => (float)($item['stock_actual'] ?? 0),
        'minimum' => (float)($item['stock_minimo'] ?? 0),
        'unitCost' => (float)($item['valor_unitario'] ?? 0),
        'notes' => $item['notas'] ?? null,
    ], $db->query(
        'SELECT i.*, COALESCE(m.nombre, i.marca) AS nombre_marca
         FROM insumos i LEFT JOIN marcas m ON m.marca_id=i.marca_id
         ORDER BY i.codigo'
    )->fetchAll());
}

function fetchBrands(PDO $db): array
{
    $items = $db->query(
        'SELECT m.marca_id, m.nombre,
                (SELECT COUNT(*) FROM activos a WHERE a.marca_id=m.marca_id) AS total_activos,
                (SELECT COUNT(*) FROM insumos i WHERE i.marca_id=m.marca_id) AS total_insumos
         FROM marcas m ORDER BY m.nombre'
    )->fetchAll();
    return array_map(static fn(array $item): array => [
        'id' => (string)$item['marca_id'],
        'name' => $item['nombre'],
        'assetCount' => (int)$item['total_activos'],
        'supplyCount' => (int)$item['total_insumos'],
    ], $items);
}

function fetchPurchases(PDO $db): array
{
    $assets = $db->query(
        "SELECT CONCAT('A-', ca.compra_activo_id) AS id, 'Activo' AS type, ca.fecha_compra AS date,
                ca.codigo_activo AS code, a.nombre AS description, 1 AS quantity, 'Activo' AS unit,
                ca.proveedor_texto AS supplier, ca.factura AS invoice,
                COALESCE(ca.valor_con_iva, ca.valor_unitario) AS total, ca.valor_unitario AS unitCost,
                ca.iva_porcentaje AS tax, a.marca AS brand, a.modelo AS model, a.numero_serie AS serial,
                a.tipo AS category, a.descripcion AS notes
         FROM compras_activos ca LEFT JOIN activos a ON a.activo_id = ca.activo_id"
    )->fetchAll();
    $supplies = $db->query(
        "SELECT CONCAT('I-', compra_insumo_id) AS id, 'Insumo' AS type, fecha_compra AS date,
                codigo_insumo AS code, descripcion AS description, cantidad AS quantity,
                unidad_medida AS unit, proveedor_texto AS supplier, factura AS invoice,
                costo_total AS total, valor_unitario AS unitCost, iva_porcentaje AS tax, marca AS brand,
                NULL AS model, NULL AS serial, NULL AS category, NULL AS notes
         FROM compras_insumos"
    )->fetchAll();
    $items = array_merge($assets, $supplies);
    usort($items, static fn(array $a, array $b): int => strcmp((string)$b['date'], (string)$a['date']));
    return $items;
}

function fetchMovements(PDO $db): array
{
    $assets = $db->query(
        "SELECT CONCAT('A-', movimiento_activo_id) AS id, 'Activo' AS kind,
                COALESCE(estado.nombre, 'Movimiento') AS action, fecha_movimiento AS date,
                codigo_activo AS code, COALESCE(activo.nombre, '') AS description,
                1 AS quantity, 'Activo' AS unit, responsable_texto AS person, cliente_texto AS destination,
                observaciones AS note
         FROM movimientos_activos movimiento
         LEFT JOIN activos activo ON activo.activo_id = movimiento.activo_id
         LEFT JOIN estados_activo estado ON estado.estado_id = movimiento.estado_id"
    )->fetchAll();
    $supplies = $db->query(
        "SELECT CONCAT('I-', movimiento_insumo_id) AS id, 'Insumo' AS kind,
                tipo_movimiento AS action, fecha AS date, codigo_insumo AS code,
                COALESCE(insumo.descripcion, '') AS description, cantidad AS quantity,
                insumo.unidad_medida AS unit, entregado_a AS person, destino AS destination, observaciones AS note
         FROM movimientos_insumos movimiento
         LEFT JOIN insumos insumo ON insumo.codigo = movimiento.codigo_insumo"
    )->fetchAll();
    $items = array_merge($assets, $supplies);
    usort($items, static fn(array $a, array $b): int => strcmp((string)$b['date'], (string)$a['date']));
    return $items;
}

function fetchContacts(PDO $db): array
{
    $clients = $db->query(
        "SELECT CONCAT('cliente:', cliente_id) AS id, 'Cliente' AS type, razon_social AS name,
                nit, correo AS email, telefono AS phone, direccion AS address, notas AS notes FROM clientes"
    )->fetchAll();
    $suppliers = $db->query(
        "SELECT CONCAT('proveedor:', proveedor_id) AS id, 'Proveedor' AS type, razon_social AS name,
                nit, correo AS email, telefono AS phone, direccion AS address, notas AS notes FROM proveedores"
    )->fetchAll();
    return array_merge($clients, $suppliers);
}

function fetchLoans(PDO $db): array
{
    $assets = $db->query(
        "SELECT CONCAT('prestamo:', asignacion.asignacion_id) AS id,
                CAST(activo.activo_id AS CHAR) AS assetId, activo.codigo_inventario AS code,
                activo.nombre AS assetName, COALESCE(prestamo.tipo, 'Alquiler') AS type,
                COALESCE(asignacion.persona_asignada, usuario.nombre_completo) AS person,
                asignacion.cliente_texto AS client,
                DATE(asignacion.asignado_en) AS date, prestamo.fecha_devolucion_prevista AS dueDate,
                DATE(asignacion.devuelto_en) AS returnedAt, asignacion.observaciones AS note,
                prestamo.operacion_id AS operationId
         FROM asignaciones asignacion
         INNER JOIN activos activo ON activo.activo_id = asignacion.activo_id
         LEFT JOIN prestamos_activos prestamo ON prestamo.asignacion_id = asignacion.asignacion_id
         LEFT JOIN usuarios usuario ON usuario.usuario_id = asignacion.usuario_id
         WHERE (asignacion.devuelto_en IS NOT NULL OR activo.estado_id IN (
           SELECT estado_id FROM estados_activo WHERE UPPER(nombre) IN ('ALQUILADO', 'PRESTADO', 'VENDIDO')
         ))
         ORDER BY asignacion.asignado_en DESC"
    )->fetchAll();
    $supplySales = $db->query(
        "SELECT CONCAT('venta-insumo:', movimiento.movimiento_insumo_id) AS id, NULL AS assetId,
                movimiento.codigo_insumo AS code, COALESCE(insumo.descripcion, '') AS assetName,
                COALESCE(movimiento.operacion_tipo, 'Venta') AS type, movimiento.entregado_a AS person, movimiento.destino AS client,
                movimiento.fecha AS date, NULL AS dueDate, NULL AS returnedAt, movimiento.observaciones AS note,
                movimiento.cantidad AS quantity, insumo.unidad_medida AS unit, 1 AS supplyOnly,
                movimiento.operacion_id AS operationId
         FROM movimientos_insumos movimiento
         LEFT JOIN insumos insumo ON insumo.codigo = movimiento.codigo_insumo
         WHERE movimiento.tipo_movimiento = 'Venta' OR movimiento.operacion_id IS NOT NULL"
    )->fetchAll();
    $items = array_merge($assets, $supplySales);
    usort($items, static fn(array $a, array $b): int => strcmp((string)$b['date'], (string)$a['date']));
    return $items;
}

function fetchUsers(PDO $db): array
{
    $items = $db->query(
        'SELECT u.usuario_id, u.nombre_completo, u.cargo, u.documento, u.correo, u.telefono,
                u.estado, u.rol, u.sede, u.notas, d.nombre AS departamento
         FROM usuarios u LEFT JOIN departamentos d ON d.departamento_id = u.departamento_id
         ORDER BY u.nombre_completo'
    )->fetchAll();
    $colors = ['#06c167', '#3b92ea', '#d4568a', '#ff7a5c', '#8e6bd8', '#e0a800'];
    return array_map(static function (array $user, int $index) use ($colors): array {
        return [
            'id' => (string)$user['usuario_id'],
            'nombre' => $user['nombre_completo'],
            'cargo' => $user['cargo'],
            'documento' => $user['documento'],
            'correo' => $user['correo'],
            'telefono' => $user['telefono'],
            'area' => $user['departamento'],
            'rol' => $user['rol'],
            'sede' => $user['sede'],
            'ingreso' => '',
            'estado' => $user['estado'],
            'notas' => $user['notas'],
            'color' => $colors[$index % count($colors)],
        ];
    }, $items, array_keys($items));
}

function fetchTools(PDO $db): array
{
    $history = [];
    foreach ($db->query('SELECT entrega_id, herramienta_id, herramienta_nombre, tecnico_id, tecnico_nombre, entregado_en, registrado_por FROM entregas_herramientas ORDER BY entregado_en DESC, entrega_id DESC')->fetchAll() as $entry) {
        $history[(string)$entry['herramienta_id']][] = [
            'id' => (string)$entry['entrega_id'], 'technicianId' => (string)$entry['tecnico_id'],
            'technician' => $entry['tecnico_nombre'], 'tool' => $entry['herramienta_nombre'],
            'date' => $entry['entregado_en'], 'by' => $entry['registrado_por'],
        ];
    }
    return array_map(static fn(array $item): array => [
        'id' => (string)$item['herramienta_id'],
        'name' => $item['nombre'],
        'brand' => $item['nombre_marca'],
        'description' => $item['descripcion'],
        'serial' => $item['serial'],
        'quantity' => (int)$item['cantidad'],
        'status' => $item['estado'],
        'responsibleId' => $item['usuario_id'] === null ? null : (string)$item['usuario_id'],
        'responsible' => $item['responsable'],
        'cost' => (float)$item['costo_compra'],
        'assignmentHistory' => $history[(string)$item['herramienta_id']] ?? [],
    ], $db->query(
        'SELECT h.herramienta_id, h.nombre, h.descripcion, h.serial, h.cantidad, h.estado, h.usuario_id, h.costo_compra,
                COALESCE(m.nombre, h.marca) AS nombre_marca, u.nombre_completo AS responsable
         FROM herramientas h
         LEFT JOIN marcas m ON m.marca_id = h.marca_id
         LEFT JOIN usuarios u ON u.usuario_id = h.usuario_id
         ORDER BY h.nombre'
    )->fetchAll());
}

function fetchDashboard(PDO $db): array
{
    $rows = $db->query(
        "SELECT COALESCE(NULLIF(TRIM(c.nombre), ''), NULLIF(TRIM(a.tipo), ''), 'Sin categoría') AS nombre,
                SUM(CASE WHEN UPPER(s.nombre) IN ('ASIGNADO', 'ALQUILADO', 'PRESTADO') THEN 1 ELSE 0 END) AS en_uso,
                SUM(CASE WHEN UPPER(s.nombre) = 'DISPONIBLE' THEN 1 ELSE 0 END) AS en_almacen,
                SUM(CASE WHEN UPPER(s.nombre) = 'EN REPARACIÓN' THEN 1 ELSE 0 END) AS en_reparacion,
                SUM(CASE WHEN UPPER(s.nombre) NOT IN ('ASIGNADO', 'ALQUILADO', 'PRESTADO', 'DISPONIBLE', 'EN REPARACIÓN') THEN 1 ELSE 0 END) AS otros,
                COUNT(*) AS total
         FROM activos a
         LEFT JOIN categorias_activo c ON c.categoria_id=a.categoria_id
         LEFT JOIN estados_activo s ON s.estado_id=a.estado_id
         GROUP BY nombre ORDER BY nombre"
    )->fetchAll();
    return ['categories' => array_map(static fn(array $row): array => [
        'name' => $row['nombre'],
        'inUse' => (int)$row['en_uso'],
        'inStore' => (int)$row['en_almacen'],
        'inRepair' => (int)$row['en_reparacion'],
        'others' => (int)$row['otros'],
        'total' => (int)$row['total'],
    ], $rows)];
}

// Permisos que dan lectura a cada conjunto de datos (basta con uno).
// Inicio y Estadísticas resumen todo el inventario, así que quien los ve recibe todos los conjuntos.
const DATA_VIEW_PERMISSIONS = [
    'assets' => ['activos.ver', 'prestamos.ver', 'inventario.ver', 'movimientos.ver'],
    'categories' => ['categorias.ver', 'activos.ver', 'insumos.ver'],
    'brands' => ['marcas.ver', 'activos.ver', 'insumos.ver', 'herramientas.ver'],
    'supplies' => ['insumos.ver', 'compras.ver', 'movimientos.ver', 'prestamos.ver'],
    'purchases' => ['compras.ver'],
    'movements' => ['movimientos.ver'],
    'contacts' => ['contactos.ver', 'compras.ver', 'prestamos.ver'],
    'loans' => ['prestamos.ver'],
    'users' => ['funcionarios.ver', 'inventario.ver', 'activos.ver', 'herramientas.ver', 'prestamos.ver'],
    'tools' => ['herramientas.ver', 'inventario.ver'],
    'toolAudits' => ['auditorias.ver', 'inventario.ver'],
];

function canViewData(array $account, string $set): bool
{
    return hasPermission($account, ['dashboard.ver', 'estadisticas.ver'])
        || hasPermission($account, DATA_VIEW_PERMISSIONS[$set]);
}

function loadAll(PDO $db, array $account): array
{
    $loaders = [
        'assets' => 'fetchAssets',
        'categories' => 'fetchCategories',
        'brands' => 'fetchBrands',
        'supplies' => 'fetchSupplies',
        'purchases' => 'fetchPurchases',
        'movements' => 'fetchMovements',
        'contacts' => 'fetchContacts',
        'loans' => 'fetchLoans',
        'users' => 'fetchUsers',
        'tools' => 'fetchTools',
        'toolAudits' => 'fetchToolAudits',
    ];
    $data = [];
    foreach ($loaders as $set => $loader) {
        $data[$set] = canViewData($account, $set) ? $loader($db) : [];
    }
    return $data;
}
