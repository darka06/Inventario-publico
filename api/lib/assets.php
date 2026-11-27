<?php
declare(strict_types=1);

// Activos: guardar, eliminar, asignar y devolver.

function brandId(PDO $db, ?string $name): ?int
{
    if ($name === null) {
        return null;
    }
    return getOrCreate($db, 'marcas', 'marca_id', 'nombre', $name);
}

function insertAssignment(PDO $db, int $assetId, string $person, ?string $client, ?string $note, string $date): int
{
    $query = $db->prepare('SELECT usuario_id FROM usuarios WHERE UPPER(TRIM(nombre_completo)) = UPPER(TRIM(?)) LIMIT 1');
    $query->execute([$person]);
    $userId = $query->fetchColumn();
    $insert = $db->prepare(
        'INSERT INTO asignaciones
         (activo_id, usuario_id, entregado_por_id, asignado_en, devuelto_en, observaciones, persona_asignada, cliente_texto, fuente_clave)
         VALUES (?, ?, NULL, ?, NULL, ?, ?, ?, ?)'
    );
    $insert->execute([$assetId, $userId === false ? null : (int)$userId, $date . ' 12:00:00', $note, $person, $client, newSourceKey()]);
    return (int)$db->lastInsertId();
}

function saveAsset(PDO $db, array $data): array
{
    $id = isset($data['id']) && ctype_digit((string)$data['id']) ? (int)$data['id'] : null;
    $code = requiredText($data, 'code', 60);
    $name = requiredText($data, 'name', 180);
    $category = optionalText($data, 'category', 120);
    if ($category === null) {
        // La columna activos.categoria_id no admite nulos: sin categoría la base rechaza el guardado.
        sendJson(['error' => 'Selecciona la categoría del activo.'], 422);
    }
    $status = requiredText($data, 'status', 80);
    $purchaseDate = validDate($data['purchaseDate'] ?? null);
    $cost = is_numeric($data['cost'] ?? 0) ? (float)($data['cost'] ?? 0) : 0;
    if ($cost < 0) {
        sendJson(['error' => 'El costo no puede ser negativo.'], 422);
    }

    $db->beginTransaction();
    try {
        $duplicate = $db->prepare('SELECT activo_id FROM activos WHERE codigo_inventario = ? AND activo_id <> COALESCE(?, 0) LIMIT 1');
        $duplicate->execute([$code, $id]);
        if ($duplicate->fetchColumn() !== false) {
            sendJson(['error' => "Ya existe un activo con el código {$code}."], 409);
        }
        $oldStatus = null;
        $person = null;
        $client = null;
        if ($id !== null) {
            $current = $db->prepare(
                'SELECT a.activo_id, s.nombre AS estado, a.responsable_actual, a.cliente_actual
                 FROM activos a LEFT JOIN estados_activo s ON s.estado_id = a.estado_id
                 WHERE a.activo_id = ? FOR UPDATE'
            );
            $current->execute([$id]);
            $record = $current->fetch();
            if (!$record) {
                sendJson(['error' => 'No se encontró el activo solicitado.'], 404);
            }
            $oldStatus = $record['estado'];
            $person = $record['responsable_actual'];
            $client = $record['cliente_actual'];
        }
        $categoryKey = categoryId($db, $category);
        $brand = optionalText($data, 'brand', 120);
        $brandKey = brandId($db, $brand);
        $statusKey = statusId($db, $status);
        $fields = [
            $code, $categoryKey, $statusKey, $name, $brand, $brandKey,
            optionalText($data, 'model', 120), optionalText($data, 'serial', 120),
            optionalText($data, 'notes', 2000), $purchaseDate, $cost,
            $category, null, optionalText($data, 'supplier', 160), optionalText($data, 'invoice', 80),
            is_numeric($data['tax'] ?? null) ? (float)$data['tax'] : null,
            $cost, $purchaseDate, date('Y-m-d'), $client, $person,
            optionalText($data, 'description', 2000), optionalText($data, 'location', 160), validDate($data['warrantyEnd'] ?? null),
        ];
        if ($id === null) {
            $insert = $db->prepare(
                'INSERT INTO activos
                 (codigo_inventario, categoria_id, estado_id, nombre, marca, marca_id, modelo, numero_serie, notas,
                  fecha_compra, costo_compra, tipo, subtipo, proveedor_texto, factura, iva_porcentaje,
                  valor_con_iva, fecha_registro_compra, fecha_ultimo_movimiento, cliente_actual, responsable_actual,
                  descripcion, ubicacion, fin_garantia)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $insert->execute($fields);
            $id = (int)$db->lastInsertId();
            recordAssetStatus($db, $id, $code, null, $status, $person, $client, 'Alta de activo', $purchaseDate ?? date('Y-m-d'));
        } else {
            $update = $db->prepare(
                'UPDATE activos SET codigo_inventario=?, categoria_id=?, estado_id=?, nombre=?, marca=?, marca_id=?, modelo=?,
                  numero_serie=?, notas=?, fecha_compra=?, costo_compra=?, tipo=?, subtipo=?, proveedor_texto=?,
                  factura=?, iva_porcentaje=?, valor_con_iva=?, fecha_registro_compra=?, fecha_ultimo_movimiento=?,
                  cliente_actual=?, responsable_actual=?, descripcion=?, ubicacion=?, fin_garantia=? WHERE activo_id=?'
            );
            $update->execute([...$fields, $id]);
            if ($oldStatus !== $status) {
                if (!in_array($status, ['Asignado', 'Alquilado', 'Prestado'], true)) {
                    $person = null;
                    $client = null;
                    $db->prepare('UPDATE activos SET responsable_actual=NULL, cliente_actual=NULL WHERE activo_id=?')->execute([$id]);
                }
                recordAssetStatus($db, $id, $code, $oldStatus, $status, $person, $client, 'Cambio de estado desde edición', date('Y-m-d'));
            }
        }
        $db->commit();
        return ['id' => (string)$id];
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
}

function deleteAsset(PDO $db, array $data): void
{
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
    if (!$id) {
        sendJson(['error' => 'El identificador del activo no es válido.'], 422);
    }

    $db->beginTransaction();
    try {
        $current = $db->prepare(
            'SELECT a.codigo_inventario, s.nombre AS estado
             FROM activos a LEFT JOIN estados_activo s ON s.estado_id = a.estado_id
             WHERE a.activo_id = ? FOR UPDATE'
        );
        $current->execute([$id]);
        $record = $current->fetch();
        if (!$record) {
            $db->rollBack();
            sendJson(['error' => 'No se encontró el activo solicitado.'], 404);
        }

        // Un activo en uso no se elimina: primero hay que registrar su devolución.
        $open = $db->prepare('SELECT COUNT(*) FROM asignaciones WHERE activo_id = ? AND devuelto_en IS NULL');
        $open->execute([$id]);
        if (in_array($record['estado'], ['Asignado', 'Alquilado', 'Prestado'], true) || (int)$open->fetchColumn() > 0) {
            $db->rollBack();
            sendJson(['error' => 'Este activo está asignado, alquilado o prestado. Registra su devolución antes de eliminarlo.'], 409);
        }

        // Registros propios del activo.
        $db->prepare('DELETE FROM prestamos_activos WHERE asignacion_id IN (SELECT asignacion_id FROM asignaciones WHERE activo_id = ?)')->execute([$id]);
        $db->prepare('DELETE FROM asignaciones WHERE activo_id = ?')->execute([$id]);
        $db->prepare('DELETE FROM historial_estados WHERE activo_id = ?')->execute([$id]);
        // Movimientos y compras se conservan (con su código de activo) pero ya sin enlace al activo borrado.
        $db->prepare('UPDATE movimientos_activos SET activo_id = NULL WHERE activo_id = ?')->execute([$id]);
        $db->prepare('UPDATE compras_activos SET activo_id = NULL WHERE activo_id = ?')->execute([$id]);

        $delete = $db->prepare('DELETE FROM activos WHERE activo_id = ?');
        $delete->execute([$id]);
        $db->commit();
    } catch (PDOException $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log('[Inventario API] deleteAsset: ' . $error->getMessage());
        sendJson(['error' => 'No se puede eliminar este activo porque tiene registros relacionados.'], 409);
    }
}

function assignAsset(PDO $db, array $data, bool $loan = false): array
{
    $ids = $data['assetIds'] ?? (isset($data['assetId']) ? [$data['assetId']] : []);
    $supplyItems = $data['supplyItems'] ?? [];
    if (!is_array($ids) || count($ids) > 100 || !is_array($supplyItems) || count($supplyItems) > 100) {
        sendJson(['error' => 'La selección de artículos no es válida.'], 422);
    }
    $ids = array_values(array_unique(array_map(static function ($value) {
        $id = filter_var($value, FILTER_VALIDATE_INT);
        if (!$id) sendJson(['error' => 'La selección de activos no es válida.'], 422);
        return (int)$id;
    }, $ids)));
    sort($ids, SORT_NUMERIC);
    $person = requiredText($data, 'person', 180);
    $client = optionalText($data, 'client', 180);
    $date = validDate($data['date'] ?? null, true);
    $note = optionalText($data, 'note', 2000);
    $type = $loan ? requiredText($data, 'type', 30) : 'Asignación';
    if ($loan && !in_array($type, ['Alquiler', 'Préstamo', 'Venta'], true)) {
        sendJson(['error' => 'El tipo debe ser alquiler, préstamo o venta.'], 422);
    }
    if ($supplyItems && !$loan) {
        sendJson(['error' => 'Los insumos solo se pueden registrar desde alquiler, préstamo o venta.'], 422);
    }
    if (!$ids && !$supplyItems) sendJson(['error' => 'Agrega al menos un activo o insumo.'], 422);
    $supplyItems = array_map(static function ($item): array {
        if (!is_array($item)) sendJson(['error' => 'La selección de insumos no es válida.'], 422);
        $id = filter_var($item['id'] ?? null, FILTER_VALIDATE_INT);
        $quantity = filter_var($item['quantity'] ?? null, FILTER_VALIDATE_FLOAT);
        if (!$id || $quantity === false || !is_finite((float)$quantity) || $quantity <= 0) {
            sendJson(['error' => 'Revisa los insumos y sus cantidades.'], 422);
        }
        return ['id' => (int)$id, 'quantity' => (float)$quantity];
    }, $supplyItems);
    $dueDate = $loan && $type !== 'Venta' ? validDate($data['dueDate'] ?? null) : null;
    $operationId = $loan ? newSourceKey() : null;
    $status = !$loan ? 'Asignado' : match ($type) {
        'Préstamo' => 'Prestado', 'Venta' => 'Vendido', default => 'Alquilado',
    };

    $db->beginTransaction();
    try {
        $select = $db->prepare(
            'SELECT a.activo_id, a.codigo_inventario, a.nombre, s.nombre AS estado
             FROM activos a INNER JOIN estados_activo s ON s.estado_id=a.estado_id
             WHERE a.activo_id=? FOR UPDATE'
        );
        $assets = [];
        foreach ($ids as $id) {
            $select->execute([$id]);
            $asset = $select->fetch();
            if (!$asset) sendJson(['error' => 'No se encontró uno de los activos seleccionados.'], 404);
            if ($asset['estado'] !== 'Disponible') sendJson(['error' => "El activo {$asset['codigo_inventario']} ya no está disponible."], 409);
            $assets[] = $asset;
        }
        $assignmentIds = [];
        foreach ($assets as $asset) {
            $id = (int)$asset['activo_id'];
            $assignmentId = insertAssignment($db, $id, $person, $client, $note, $date);
            $db->prepare('UPDATE activos SET estado_id=?, responsable_actual=?, cliente_actual=?, fecha_ultimo_movimiento=? WHERE activo_id=?')
                ->execute([statusId($db, $status), $person, $client, $date, $id]);
            recordAssetStatus($db, $id, $asset['codigo_inventario'], 'Disponible', $status, $person, $client, $note ?? ($loan ? $status : 'Asignación'), $date);
            if ($loan) {
                $insertLoan = $db->prepare('INSERT INTO prestamos_activos (asignacion_id, tipo, fecha_devolucion_prevista, operacion_id) VALUES (?, ?, ?, ?)');
                $insertLoan->execute([$assignmentId, $type, $dueDate, $operationId]);
            }
            $assignmentIds[] = (string)$assignmentId;
        }
        $supplySelect = $db->prepare('SELECT insumo_id, codigo, descripcion, stock_actual, valor_unitario FROM insumos WHERE insumo_id=? FOR UPDATE');
        $movement = $db->prepare('INSERT INTO movimientos_insumos (fuente_clave, fecha, tipo_movimiento, origen, destino, codigo_insumo, cantidad, entregado_a, responsable, observaciones, operacion_id, operacion_tipo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        foreach ($supplyItems as $item) {
            $supplySelect->execute([$item['id']]);
            $supply = $supplySelect->fetch();
            if (!$supply) sendJson(['error' => 'No se encontró uno de los insumos seleccionados.'], 404);
            $stock = (float)($supply['stock_actual'] ?? 0);
            if ($item['quantity'] > $stock) sendJson(['error' => "Stock insuficiente para {$supply['codigo']}. Disponible: {$stock}."], 409);
            $newStock = $stock - $item['quantity'];
            $db->prepare('UPDATE insumos SET stock_actual=?, stock_actual_data=?, salidas=COALESCE(salidas,0)+?, valor_total_stock=? WHERE insumo_id=?')
                ->execute([$newStock, (string)$newStock, $item['quantity'], $newStock * (float)$supply['valor_unitario'], $item['id']]);
            $movement->execute([newSourceKey(), $date, $type === 'Venta' ? 'Venta' : 'Salida', null, $client, $supply['codigo'], $item['quantity'], $person, null, $note, $operationId, $type]);
        }
        $db->commit();
        return ['id' => $assignmentIds[0] ?? null, 'ids' => $assignmentIds];
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
}

function updateLoanOperation(PDO $db, array $data): array
{
    $operationId = trim((string)($data['operationId'] ?? ''));
    if ($operationId === '' || mb_strlen($operationId) > 100) sendJson(['error' => 'La operación seleccionada no es válida.'], 422);
    $person = requiredText($data, 'person', 180);
    $client = optionalText($data, 'client', 180);
    $note = optionalText($data, 'note', 2000);
    $date = validDate($data['date'] ?? null, true);
    $dueDate = validDate($data['dueDate'] ?? null);

    $db->beginTransaction();
    try {
        $exists = $db->prepare('SELECT asignacion_id FROM prestamos_activos WHERE operacion_id=? FOR UPDATE');
        $exists->execute([$operationId]);
        $assignmentIds = $exists->fetchAll(PDO::FETCH_COLUMN);
        $supplyExists = $db->prepare('SELECT movimiento_insumo_id FROM movimientos_insumos WHERE operacion_id=? FOR UPDATE');
        $supplyExists->execute([$operationId]);
        $hasSupplies = (bool)$supplyExists->fetchColumn();
        if (!$assignmentIds && !$hasSupplies) sendJson(['error' => 'No se encontró la operación.'], 404);
        $db->prepare('UPDATE prestamos_activos SET fecha_devolucion_prevista=? WHERE operacion_id=?')
            ->execute([$dueDate, $operationId]);
        $db->prepare('UPDATE asignaciones SET asignado_en=?, persona_asignada=?, cliente_texto=?, observaciones=? WHERE asignacion_id IN (SELECT asignacion_id FROM prestamos_activos WHERE operacion_id=?)')
            ->execute([$date, $person, $client, $note, $operationId]);
        $db->prepare('UPDATE movimientos_insumos SET fecha=?, entregado_a=?, destino=?, observaciones=? WHERE operacion_id=?')
            ->execute([$date, $person, $client, $note, $operationId]);
        $db->commit();
        return ['ok' => true, 'id' => $assignmentIds[0] ?? null];
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
}

function deleteLoanOperation(PDO $db, array $data): array
{
    $operationId = trim((string)($data['operationId'] ?? ''));
    if ($operationId === '' || mb_strlen($operationId) > 100) sendJson(['error' => 'La operación seleccionada no es válida.'], 422);

    $db->beginTransaction();
    try {
        $assetsQuery = $db->prepare(
            "SELECT a.asignacion_id, a.activo_id, a.devuelto_en, a.persona_asignada, a.cliente_texto, a.observaciones,
                    x.codigo_inventario, x.responsable_actual, x.cliente_actual, e.nombre AS estado
             FROM prestamos_activos p
             INNER JOIN asignaciones a ON a.asignacion_id=p.asignacion_id
             INNER JOIN activos x ON x.activo_id=a.activo_id
             INNER JOIN estados_activo e ON e.estado_id=x.estado_id
             WHERE p.operacion_id=? FOR UPDATE"
        );
        $assetsQuery->execute([$operationId]);
        $assets = $assetsQuery->fetchAll(PDO::FETCH_ASSOC);
        $suppliesQuery = $db->prepare('SELECT movimiento_insumo_id, codigo_insumo, cantidad FROM movimientos_insumos WHERE operacion_id=? FOR UPDATE');
        $suppliesQuery->execute([$operationId]);
        $supplies = $suppliesQuery->fetchAll(PDO::FETCH_ASSOC);
        if (!$assets && !$supplies) sendJson(['error' => 'No se encontró la operación.'], 404);

        foreach ($assets as $asset) {
            if ($asset['devuelto_en'] !== null) continue;
            $latest = $db->prepare('SELECT asignacion_id FROM asignaciones WHERE activo_id=? AND devuelto_en IS NULL ORDER BY asignacion_id DESC LIMIT 1 FOR UPDATE');
            $latest->execute([$asset['activo_id']]);
            if ((int)$latest->fetchColumn() !== (int)$asset['asignacion_id']) continue;
            if (!in_array($asset['estado'], ['Disponible', 'Alquilado', 'Prestado', 'Vendido'], true)) {
                sendJson(['error' => "No se puede eliminar: el activo {$asset['codigo_inventario']} cambió de estado después de esta operación."], 409);
            }
            if ($asset['estado'] !== 'Disponible') {
                $db->prepare('UPDATE activos SET estado_id=?, responsable_actual=NULL, cliente_actual=NULL WHERE activo_id=?')
                    ->execute([statusId($db, 'Disponible'), $asset['activo_id']]);
                recordAssetStatus($db, (int)$asset['activo_id'], $asset['codigo_inventario'], $asset['estado'], 'Disponible', null, null, 'Operación eliminada: ' . (string)$asset['observaciones'], date('Y-m-d'));
            }
        }
        $quantities = [];
        foreach ($supplies as $supply) $quantities[$supply['codigo_insumo']] = ($quantities[$supply['codigo_insumo']] ?? 0) + (float)$supply['cantidad'];
        $stockQuery = $db->prepare('SELECT stock_actual, salidas, valor_unitario FROM insumos WHERE codigo=? FOR UPDATE');
        $restore = $db->prepare('UPDATE insumos SET stock_actual=?, stock_actual_data=?, salidas=?, valor_total_stock=? WHERE codigo=?');
        foreach ($quantities as $code => $quantity) {
            $stockQuery->execute([$code]);
            $supply = $stockQuery->fetch(PDO::FETCH_ASSOC);
            if (!$supply) sendJson(['error' => "No se puede restaurar el stock del insumo {$code}."], 409);
            $stock = (float)$supply['stock_actual'] + $quantity;
            $restore->execute([$stock, (string)$stock, max(0, (float)$supply['salidas'] - $quantity), $stock * (float)$supply['valor_unitario'], $code]);
        }
        $db->prepare('DELETE FROM movimientos_insumos WHERE operacion_id=?')->execute([$operationId]);
        $db->prepare('DELETE FROM prestamos_activos WHERE operacion_id=?')->execute([$operationId]);
        $deleteAssignment = $db->prepare('DELETE FROM asignaciones WHERE asignacion_id=?');
        foreach ($assets as $asset) $deleteAssignment->execute([$asset['asignacion_id']]);
        $db->commit();
        return ['ok' => true, 'id' => $assets[0]['asignacion_id'] ?? null];
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
}

function returnAsset(PDO $db, int $assetId, ?int $assignmentId = null): void
{
    $db->beginTransaction();
    try {
        $select = $db->prepare(
            'SELECT a.activo_id, a.codigo_inventario, s.nombre AS estado, a.responsable_actual, a.cliente_actual
             FROM activos a INNER JOIN estados_activo s ON s.estado_id=a.estado_id
             WHERE a.activo_id=? FOR UPDATE'
        );
        $select->execute([$assetId]);
        $asset = $select->fetch();
        if (!$asset) {
            sendJson(['error' => 'No se encontró el activo solicitado.'], 404);
        }
        if ($asset['estado'] === 'Vendido') {
            sendJson(['error' => 'Un activo vendido no se puede devolver como préstamo.'], 409);
        }
        $assignmentSql = 'SELECT asignacion_id FROM asignaciones WHERE activo_id=? AND devuelto_en IS NULL';
        $params = [$assetId];
        if ($assignmentId !== null) {
            $assignmentSql .= ' AND asignacion_id=?';
            $params[] = $assignmentId;
        }
        $assignmentSql .= ' ORDER BY asignacion_id DESC LIMIT 1 FOR UPDATE';
        $assignmentQuery = $db->prepare($assignmentSql);
        $assignmentQuery->execute($params);
        $openAssignment = $assignmentQuery->fetchColumn();
        if ($openAssignment !== false) {
            $db->prepare('UPDATE asignaciones SET devuelto_en=? WHERE asignacion_id=?')
                ->execute([date('Y-m-d H:i:s'), (int)$openAssignment]);
        }
        $date = date('Y-m-d');
        $db->prepare('UPDATE activos SET estado_id=?, cliente_actual=NULL, responsable_actual=NULL, fecha_ultimo_movimiento=? WHERE activo_id=?')
            ->execute([statusId($db, 'Disponible'), $date, $assetId]);
        recordAssetStatus(
            $db,
            $assetId,
            $asset['codigo_inventario'],
            $asset['estado'],
            'Disponible',
            $asset['responsable_actual'],
            $asset['cliente_actual'],
            'Devolución a almacén',
            $date
        );
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
}

