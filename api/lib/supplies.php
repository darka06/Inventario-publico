<?php
declare(strict_types=1);

// Insumos, marcas y movimientos de stock.

function saveSupply(PDO $db, array $data): array
{
    $id = isset($data['id']) && ctype_digit((string)$data['id']) ? (int)$data['id'] : null;
    $code = requiredTextRange($data, 'code', 3, 80);
    $name = requiredTextRange($data, 'name', 3, 255);
    $unit = requiredTextRange($data, 'unit', 2, 80);
    $brand = optionalText($data, 'brand', 120);
    $brandKey = brandId($db, $brand);
    $notes = optionalText($data, 'notes', 2000);
    $minimum = filter_var($data['minimum'] ?? 0, FILTER_VALIDATE_FLOAT);
    $unitCost = filter_var($data['unitCost'] ?? 0, FILTER_VALIDATE_FLOAT);
    if ($minimum === false || $minimum < 0 || $unitCost === false || $unitCost < 0) {
        sendJson(['error' => 'El stock mínimo y el costo deben ser números no negativos.'], 422);
    }
    $stock = filter_var($data['stock'] ?? 0, FILTER_VALIDATE_FLOAT);
    if ($stock === false || $stock < 0) {
        sendJson(['error' => 'El stock inicial debe ser un número no negativo.'], 422);
    }
    if ($id !== null) {
        $current = $db->prepare('SELECT stock_actual FROM insumos WHERE insumo_id=?');
        $current->execute([$id]);
        $existingStock = $current->fetchColumn();
        if ($existingStock === false) {
            sendJson(['error' => 'No se encontró el insumo solicitado.'], 404);
        }
        $stock = (float)($existingStock ?? 0);
        $query = $db->prepare('UPDATE insumos SET codigo=?, descripcion=?, unidad_medida=?, marca=?, marca_id=?, stock_minimo=?, valor_unitario=?, valor_total_stock=?, notas=? WHERE insumo_id=?');
        $params = [$code, $name, $unit, $brand, $brandKey, $minimum, $unitCost, $unitCost * $stock, $notes, $id];
    } else {
        $query = $db->prepare(
            'INSERT INTO insumos (codigo, descripcion, unidad_medida, marca, marca_id, entradas, salidas, stock_actual,
                                  stock_actual_data, valor_unitario, valor_total_stock, stock_minimo, notas)
             VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)'
        );
        $params = [$code, $name, $unit, $brand, $brandKey, $stock, (string)$stock, $unitCost, $unitCost * $stock, $minimum, $notes];
    }
    try {
        $query->execute($params);
    } catch (PDOException $error) {
        // 1062 = entrada duplicada: el código de insumo ya existe (clave única uq_insumos_codigo).
        if ((int)($error->errorInfo[1] ?? 0) === 1062) {
            sendJson(['error' => 'Ya existe un insumo con ese código. Usa otro código.'], 409);
        }
        throw $error;
    }
    return ['id' => (string)($id ?? $db->lastInsertId())];
}

function createBrand(PDO $db, array $data): array
{
    $name = requiredText($data, 'name', 120);
    $id = brandId($db, $name);
    return ['id' => (string)$id];
}

function renameBrand(PDO $db, array $data): array
{
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
    $name = requiredText($data, 'name', 120);
    if (!$id) {
        sendJson(['error' => 'La marca seleccionada no es válida.'], 422);
    }
    $db->beginTransaction();
    try {
        $sourceQuery = $db->prepare('SELECT marca_id, nombre FROM marcas WHERE marca_id=? FOR UPDATE');
        $sourceQuery->execute([$id]);
        $source = $sourceQuery->fetch();
        if (!$source) {
            $db->rollBack();
            sendJson(['error' => 'No se encontró la marca solicitada. Actualiza la página e inténtalo de nuevo.'], 404);
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
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
}

function deleteBrand(PDO $db, array $data): void
{
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
    if (!$id) sendJson(['error' => 'La marca seleccionada no es válida.'], 422);
    $usage = $db->prepare('SELECT (SELECT COUNT(*) FROM activos WHERE marca_id=?) + (SELECT COUNT(*) FROM insumos WHERE marca_id=?)');
    $usage->execute([$id, $id]);
    if ((int)$usage->fetchColumn() > 0) sendJson(['error' => 'No se puede eliminar esta marca porque tiene activos o insumos relacionados. Renómbrala o cambia la marca de esos productos primero.'], 409);
    $delete = $db->prepare('DELETE FROM marcas WHERE marca_id=?');
    $delete->execute([$id]);
    if (!$delete->rowCount()) sendJson(['error' => 'No se encontró la marca seleccionada.'], 404);
}

function stockMovement(PDO $db, array $data): void
{
    $id = filter_var($data['supplyId'] ?? null, FILTER_VALIDATE_INT);
    $quantity = filter_var($data['quantity'] ?? null, FILTER_VALIDATE_FLOAT);
    $type = requiredText($data, 'type', 20);
    $date = validDate($data['date'] ?? null, true);
    if (!$id || !$quantity || $quantity <= 0 || !in_array($type, ['Entrada', 'Salida'], true)) {
        sendJson(['error' => 'Selecciona un insumo y registra una cantidad válida.'], 422);
    }
    $db->beginTransaction();
    try {
        $select = $db->prepare('SELECT insumo_id, codigo, stock_actual FROM insumos WHERE insumo_id=? FOR UPDATE');
        $select->execute([$id]);
        $supply = $select->fetch();
        if (!$supply) {
            sendJson(['error' => 'No se encontró el insumo seleccionado.'], 404);
        }
        $stock = (float)($supply['stock_actual'] ?? 0);
        $costQuery = $db->prepare('SELECT valor_unitario FROM insumos WHERE insumo_id=?');
        $costQuery->execute([$id]);
        $unitCost = (float)($costQuery->fetchColumn() ?: 0);
        if ($type === 'Salida' && $quantity > $stock) {
            sendJson(['error' => "Stock insuficiente. Disponible: {$stock}."], 409);
        }
        $delta = $type === 'Entrada' ? $quantity : -$quantity;
        $db->prepare(
            'UPDATE insumos SET stock_actual=?, stock_actual_data=?, entradas=COALESCE(entradas,0)+?,
             salidas=COALESCE(salidas,0)+?, valor_total_stock=? WHERE insumo_id=?'
        )->execute([
            $stock + $delta, (string)($stock + $delta),
            $type === 'Entrada' ? $quantity : 0, $type === 'Salida' ? $quantity : 0,
            ($stock + $delta) * $unitCost,
            $id,
        ]);
        $insert = $db->prepare(
            'INSERT INTO movimientos_insumos
             (fuente_clave, fecha, tipo_movimiento, origen, destino, codigo_insumo, cantidad, entregado_a, responsable, observaciones)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $insert->execute([
            newSourceKey(), $date, $type, optionalText($data, 'origin', 180),
            optionalText($data, 'destination', 180), $supply['codigo'], $quantity,
            optionalText($data, 'person', 180), null, optionalText($data, 'note', 2000),
        ]);
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
}

function deleteMovement(PDO $db, array $data): void
{
    $rawId = (string)($data['id'] ?? '');
    if (preg_match('/^([AI])-([1-9][0-9]*)$/', $rawId, $match) !== 1) sendJson(['error' => 'El movimiento seleccionado no es válido.'], 422);
    $db->beginTransaction();
    try {
        if ($match[1] === 'A') {
            $query = $db->prepare('SELECT activo_id FROM movimientos_activos WHERE movimiento_activo_id=? FOR UPDATE');
            $query->execute([(int)$match[2]]);
            $assetId = $query->fetchColumn();
            if ($assetId === false) sendJson(['error' => 'No se encontró el movimiento.'], 404);
            if ($assetId !== null) sendJson(['error' => 'Este movimiento pertenece a un activo existente y no se puede borrar por separado.'], 409);
            $db->prepare('DELETE FROM movimientos_activos WHERE movimiento_activo_id=?')->execute([(int)$match[2]]);
        } else {
            $query = $db->prepare('SELECT * FROM movimientos_insumos WHERE movimiento_insumo_id=? FOR UPDATE');
            $query->execute([(int)$match[2]]);
            $movement = $query->fetch(PDO::FETCH_ASSOC);
            if (!$movement) sendJson(['error' => 'No se encontró el movimiento.'], 404);
            if (in_array($movement['tipo_movimiento'], ['COMPRA', 'Compra / entrada'], true)) sendJson(['error' => 'Este movimiento proviene de una compra. Elimínala desde Compras para ajustar también el registro de compra.'], 409);
            $stockQuery = $db->prepare('SELECT insumo_id, stock_actual, entradas, salidas, valor_unitario FROM insumos WHERE codigo=? FOR UPDATE');
            $stockQuery->execute([$movement['codigo_insumo']]);
            $supply = $stockQuery->fetch(PDO::FETCH_ASSOC);
            if ($supply) {
                $quantity = (float)$movement['cantidad'];
                $stock = (float)$supply['stock_actual'];
                $entries = (float)$supply['entradas'];
                $exits = (float)$supply['salidas'];
                if ($movement['tipo_movimiento'] === 'Entrada') {
                    if ($stock < $quantity) sendJson(['error' => 'No se puede borrar esta entrada: parte de esa cantidad ya salió del inventario.'], 409);
                    $stock -= $quantity;
                    $entries = max(0, $entries - $quantity);
                } elseif (in_array($movement['tipo_movimiento'], ['Salida', 'Venta'], true)) {
                    $stock += $quantity;
                    $exits = max(0, $exits - $quantity);
                } else {
                    sendJson(['error' => 'Este tipo de movimiento no se puede borrar por separado.'], 409);
                }
                $db->prepare('UPDATE insumos SET stock_actual=?, stock_actual_data=?, entradas=?, salidas=?, valor_total_stock=? WHERE insumo_id=?')
                    ->execute([$stock, (string)$stock, $entries, $exits, $stock * (float)$supply['valor_unitario'], $supply['insumo_id']]);
            }
            $db->prepare('DELETE FROM movimientos_insumos WHERE movimiento_insumo_id=?')->execute([(int)$match[2]]);
        }
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
}

// Elimina un insumo. Sus movimientos y compras se conservan (se enlazan por código, no por clave foránea).
function deleteSupply(PDO $db, array $data): void
{
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
    if (!$id) {
        sendJson(['error' => 'El identificador del insumo no es válido.'], 422);
    }
    try {
        $statement = $db->prepare('DELETE FROM insumos WHERE insumo_id=?');
        $statement->execute([$id]);
    } catch (PDOException $error) {
        error_log('[Inventario API] deleteSupply: ' . $error->getMessage());
        sendJson(['error' => 'No se puede eliminar este insumo porque tiene registros relacionados.'], 409);
    }
    if (!$statement->rowCount()) {
        sendJson(['error' => 'No se encontró el insumo solicitado.'], 404);
    }
}
