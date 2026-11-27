<?php
declare(strict_types=1);

// Compras.

function registerPurchase(PDO $db, array $data): void
{
    $type = requiredText($data, 'type', 20);
    $date = validDate($data['date'] ?? null, true);
    $description = requiredText($data, 'description', 255);
    $quantity = filter_var($data['quantity'] ?? null, FILTER_VALIDATE_FLOAT);
    $unitCost = filter_var($data['unitCost'] ?? null, FILTER_VALIDATE_FLOAT);
    $tax = filter_var($data['tax'] ?? 0, FILTER_VALIDATE_FLOAT);
    if (!in_array($type, ['Activo', 'Insumo'], true) || !$quantity || $quantity <= 0 || $unitCost === false || $unitCost < 0 || $tax === false || $tax < 0 || $tax > 100) {
        sendJson(['error' => 'Revisa el tipo, la cantidad, el costo y el porcentaje de IVA.'], 422);
    }
    $code = optionalText($data, 'code', $type === 'Activo' ? 60 : 80);
    if ($type === 'Insumo' && $code === null) {
        sendJson(['error' => 'El código del insumo es obligatorio para registrarlo en el stock.'], 422);
    }
    $supplier = optionalText($data, 'supplier', 180);
    $invoice = optionalText($data, 'invoice', 80);
    $total = $quantity * $unitCost * (1 + $tax / 100);
    $db->beginTransaction();
    try {
        if ($type === 'Insumo') {
            $unit = requiredText($data, 'unit', 80);
            if (floor($quantity) !== $quantity) {
                sendJson(['error' => 'La compra de insumos debe usar una cantidad entera en esta pantalla.'], 422);
            }
            $query = $db->prepare('SELECT insumo_id, stock_actual FROM insumos WHERE codigo=? FOR UPDATE');
            $query->execute([$code]);
            $supply = $query->fetch();
            if (!$supply) {
                $insertSupply = $db->prepare(
                    'INSERT INTO insumos (codigo, descripcion, unidad_medida, entradas, salidas, stock_actual,
                                          stock_actual_data, valor_unitario, valor_total_stock, stock_minimo)
                     VALUES (?, ?, ?, 0, 0, 0, "0", ?, 0, 0)'
                );
                $insertSupply->execute([$code, $description, $unit, $unitCost]);
                $supply = ['insumo_id' => (int)$db->lastInsertId(), 'stock_actual' => 0];
            }
            $stock = (float)($supply['stock_actual'] ?? 0) + $quantity;
            $db->prepare(
                'UPDATE insumos SET descripcion=?, unidad_medida=?, entradas=COALESCE(entradas,0)+?,
                 stock_actual=?, stock_actual_data=?, valor_unitario=?, valor_total_stock=? WHERE insumo_id=?'
            )->execute([$description, $unit, $quantity, $stock, (string)$stock, $unitCost, $stock * $unitCost, $supply['insumo_id']]);
            $insertPurchase = $db->prepare(
                'INSERT INTO compras_insumos
                 (fuente_clave, fecha_compra, codigo_insumo, descripcion, cantidad, unidad_medida, marca,
                  proveedor_texto, factura, valor_unitario, iva_porcentaje, valor_unitario_iva, costo_total,
                  responsable_compra, tipo_movimiento)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $insertPurchase->execute([
                newSourceKey(), $date, $code, $description, $quantity, $unit,
                optionalText($data, 'brand', 120), $supplier, $invoice, $unitCost, $tax,
                $unitCost * (1 + $tax / 100), $total, $supplier, 'COMPRA',
            ]);
            $insertMovement = $db->prepare(
                'INSERT INTO movimientos_insumos
                 (fuente_clave, fecha, tipo_movimiento, origen, destino, codigo_insumo, cantidad, entregado_a, responsable, observaciones)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $insertMovement->execute([
                newSourceKey(), $date, 'Compra / entrada', $supplier, null, $code,
                $quantity, null, $supplier, 'Factura ' . ($invoice ?? 'sin factura'),
            ]);
        } else {
            if (floor($quantity) !== $quantity) {
                sendJson(['error' => 'La cantidad de activos debe ser un número entero.'], 422);
            }
            $startCode = $code;
            $codes = [];
            for ($index = 0; $index < (int)$quantity; $index++) {
                $assetCode = $quantity === 1
                    ? ($code ?? 'ACT-' . strtoupper(bin2hex(random_bytes(6))))
                    : ($startCode ? $startCode . '-' . str_pad((string)($index + 1), 3, '0', STR_PAD_LEFT) : 'ACT-' . strtoupper(bin2hex(random_bytes(6))));
                $codes[] = $assetCode;
            }
            $check = $db->prepare('SELECT 1 FROM activos WHERE codigo_inventario=? LIMIT 1');
            foreach ($codes as $assetCode) {
                $check->execute([$assetCode]);
                if ($check->fetchColumn() !== false) {
                    sendJson(['error' => "El código de activo {$assetCode} ya está registrado."], 409);
                }
            }
            $category = optionalText($data, 'category', 120);
            $categoryKey = categoryId($db, $category);
            $availableStatus = statusId($db, 'Disponible');
            $insertAsset = $db->prepare(
                'INSERT INTO activos
                 (codigo_inventario, categoria_id, estado_id, nombre, marca, modelo, numero_serie, descripcion,
                  fecha_compra, costo_compra, tipo, subtipo, proveedor_texto, factura, iva_porcentaje,
                  valor_con_iva, fecha_registro_compra, fecha_ultimo_movimiento, cliente_actual, responsable_actual, notas)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)'
            );
            $insertPurchase = $db->prepare(
                'INSERT INTO compras_activos
                 (fuente_clave, activo_id, codigo_activo, fecha_compra, proveedor_id, proveedor_texto, factura,
                  valor_unitario, iva_porcentaje, valor_con_iva, responsable_compra, usuario_registro, fecha_registro)
                 VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            foreach ($codes as $index => $assetCode) {
                $insertAsset->execute([
                    $assetCode, $categoryKey, $availableStatus, $description,
                    optionalText($data, 'brand', 120), optionalText($data, 'model', 120),
                    count($codes) === 1 ? optionalText($data, 'serial', 120) : null,
                    optionalText($data, 'notes', 2000), $date, $unitCost, $category,
                    null, $supplier, $invoice, $tax, $unitCost * (1 + $tax / 100), $date, $date,
                    optionalText($data, 'notes', 2000),
                ]);
                $assetId = (int)$db->lastInsertId();
                recordAssetStatus($db, $assetId, $assetCode, null, 'Disponible', null, null, 'Alta por compra', $date);
                $insertPurchase->execute([
                    newSourceKey(), $assetId, $assetCode, $date, $supplier, $invoice,
                    $unitCost, $tax, $unitCost * (1 + $tax / 100), $supplier, null, $date,
                ]);
            }
        }
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
}

function purchaseId(array $data): array
{
    $id = (string)($data['id'] ?? '');
    if (preg_match('/^([AI])-([1-9][0-9]*)$/', $id, $match) !== 1) sendJson(['error' => 'La compra seleccionada no es válida.'], 422);
    return [$match[1], (int)$match[2]];
}

function updatePurchase(PDO $db, array $data): array
{
    [$kind, $id] = purchaseId($data);
    $date = validDate($data['date'] ?? null, true);
    $description = requiredText($data, 'description', 255);
    $unitCost = filter_var($data['unitCost'] ?? null, FILTER_VALIDATE_FLOAT);
    $tax = filter_var($data['tax'] ?? 0, FILTER_VALIDATE_FLOAT);
    if ($unitCost === false || $unitCost < 0 || $tax === false || $tax < 0 || $tax > 100) sendJson(['error' => 'Revisa el costo y el porcentaje de IVA.'], 422);
    $supplier = optionalText($data, 'supplier', 180);
    $invoice = optionalText($data, 'invoice', 80);
    $totalFactor = 1 + $tax / 100;

    $db->beginTransaction();
    try {
        if ($kind === 'I') {
            $query = $db->prepare('SELECT * FROM compras_insumos WHERE compra_insumo_id=? FOR UPDATE');
            $query->execute([$id]);
            $purchase = $query->fetch(PDO::FETCH_ASSOC);
            if (!$purchase) sendJson(['error' => 'No se encontró la compra.'], 404);
            $quantity = filter_var($data['quantity'] ?? null, FILTER_VALIDATE_FLOAT);
            if ($quantity === false || $quantity <= 0 || round($quantity, 3) != $quantity) sendJson(['error' => 'La cantidad de insumos debe ser mayor que cero y tener máximo tres decimales.'], 422);
            $unit = requiredText($data, 'unit', 80);
            $code = $purchase['codigo_insumo'];
            $stockQuery = $db->prepare('SELECT stock_actual, entradas, valor_unitario FROM insumos WHERE codigo=? FOR UPDATE');
            $stockQuery->execute([$code]);
            $stock = $stockQuery->fetch(PDO::FETCH_ASSOC);
            if (!$stock) sendJson(['error' => 'No se encontró el insumo asociado a la compra.'], 409);
            $delta = $quantity - (float)$purchase['cantidad'];
            $newStock = (float)$stock['stock_actual'] + $delta;
            if ($newStock < 0) sendJson(['error' => 'No se puede reducir la compra por debajo de las cantidades que ya salieron del inventario.'], 409);
            $db->prepare('UPDATE insumos SET descripcion=?, unidad_medida=?, entradas=GREATEST(0,COALESCE(entradas,0)+?), stock_actual=?, stock_actual_data=?, valor_total_stock=? WHERE codigo=?')
                ->execute([$description, $unit, $delta, $newStock, (string)$newStock, $newStock * (float)$stock['valor_unitario'], $code]);
            $db->prepare('UPDATE compras_insumos SET fecha_compra=?, descripcion=?, cantidad=?, unidad_medida=?, marca=?, proveedor_texto=?, factura=?, valor_unitario=?, iva_porcentaje=?, valor_unitario_iva=?, costo_total=? WHERE compra_insumo_id=?')
                ->execute([$date, $description, $quantity, $unit, optionalText($data, 'brand', 120), $supplier, $invoice, $unitCost, $tax, $unitCost * $totalFactor, $quantity * $unitCost * $totalFactor, $id]);
            // shortcut: movements have no purchase foreign key; keep history unchanged rather than guessing a matching movement.
            $latestCost = $db->prepare('SELECT valor_unitario FROM compras_insumos WHERE codigo_insumo=? ORDER BY fecha_compra DESC, compra_insumo_id DESC LIMIT 1');
            $latestCost->execute([$code]);
            $latestUnitCost = $latestCost->fetchColumn();
            if ($latestUnitCost !== false) {
                $db->prepare('UPDATE insumos SET valor_unitario=?, valor_total_stock=? WHERE codigo=?')
                    ->execute([$latestUnitCost, $newStock * (float)$latestUnitCost, $code]);
            }
        } else {
            $query = $db->prepare('SELECT ca.*, a.estado_id, a.marca, a.modelo, a.numero_serie, a.descripcion AS notas FROM compras_activos ca LEFT JOIN activos a ON a.activo_id=ca.activo_id WHERE ca.compra_activo_id=? FOR UPDATE');
            $query->execute([$id]);
            $purchase = $query->fetch(PDO::FETCH_ASSOC);
            if (!$purchase) sendJson(['error' => 'No se encontró la compra.'], 404);
            $db->prepare('UPDATE compras_activos SET fecha_compra=?, proveedor_texto=?, factura=?, valor_unitario=?, iva_porcentaje=?, valor_con_iva=? WHERE compra_activo_id=?')
                ->execute([$date, $supplier, $invoice, $unitCost, $tax, $unitCost * $totalFactor, $id]);
            if ($purchase['activo_id'] !== null) {
                $db->prepare('UPDATE activos SET nombre=?, fecha_compra=?, costo_compra=?, marca=?, modelo=?, numero_serie=?, proveedor_texto=?, factura=?, iva_porcentaje=?, valor_con_iva=? WHERE activo_id=?')
                    ->execute([$description, $date, $unitCost, optionalText($data, 'brand', 120), optionalText($data, 'model', 120), optionalText($data, 'serial', 120), $supplier, $invoice, $tax, $unitCost * $totalFactor, $purchase['activo_id']]);
            }
        }
        $db->commit();
        return ['ok' => true, 'id' => $id];
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
}

function deletePurchase(PDO $db, array $data): array
{
    [$kind, $id] = purchaseId($data);
    $db->beginTransaction();
    try {
        if ($kind === 'I') {
            $query = $db->prepare('SELECT * FROM compras_insumos WHERE compra_insumo_id=? FOR UPDATE');
            $query->execute([$id]);
            $purchase = $query->fetch(PDO::FETCH_ASSOC);
            if (!$purchase) sendJson(['error' => 'No se encontró la compra.'], 404);
            $stockQuery = $db->prepare('SELECT stock_actual, entradas, valor_unitario FROM insumos WHERE codigo=? FOR UPDATE');
            $stockQuery->execute([$purchase['codigo_insumo']]);
            $stock = $stockQuery->fetch(PDO::FETCH_ASSOC);
            if (!$stock || (float)$stock['stock_actual'] < (float)$purchase['cantidad']) sendJson(['error' => 'No se puede eliminar esta compra: parte de su cantidad ya salió del inventario.'], 409);
            $newStock = (float)$stock['stock_actual'] - (float)$purchase['cantidad'];
            $db->prepare('UPDATE insumos SET stock_actual=?, stock_actual_data=?, entradas=GREATEST(0,COALESCE(entradas,0)-?), valor_total_stock=? WHERE codigo=?')
                ->execute([$newStock, (string)$newStock, $purchase['cantidad'], $newStock * (float)$stock['valor_unitario'], $purchase['codigo_insumo']]);
            // Keep the movement ledger: it is not linked to this purchase row and may be a separate event.
            $db->prepare('DELETE FROM compras_insumos WHERE compra_insumo_id=?')->execute([$id]);
            $latestCost = $db->prepare('SELECT valor_unitario FROM compras_insumos WHERE codigo_insumo=? ORDER BY fecha_compra DESC, compra_insumo_id DESC LIMIT 1');
            $latestCost->execute([$purchase['codigo_insumo']]);
            $latestUnitCost = $latestCost->fetchColumn();
            if ($latestUnitCost !== false) {
                $db->prepare('UPDATE insumos SET valor_unitario=?, valor_total_stock=? WHERE codigo=?')
                    ->execute([$latestUnitCost, $newStock * (float)$latestUnitCost, $purchase['codigo_insumo']]);
            }
        } else {
            $query = $db->prepare('SELECT ca.activo_id, ca.codigo_activo FROM compras_activos ca WHERE ca.compra_activo_id=? FOR UPDATE');
            $query->execute([$id]);
            $purchase = $query->fetch(PDO::FETCH_ASSOC);
            if (!$purchase) sendJson(['error' => 'No se encontró la compra.'], 404);
            if ($purchase['activo_id'] !== null) {
                $assetQuery = $db->prepare('SELECT a.codigo_inventario, e.nombre AS estado FROM activos a JOIN estados_activo e ON e.estado_id=a.estado_id WHERE a.activo_id=? FOR UPDATE');
                $assetQuery->execute([$purchase['activo_id']]);
                $asset = $assetQuery->fetch(PDO::FETCH_ASSOC);
                $used = $db->prepare('SELECT COUNT(*) FROM asignaciones WHERE activo_id=?');
                $used->execute([$purchase['activo_id']]);
                $otherPurchases = $db->prepare('SELECT COUNT(*) FROM compras_activos WHERE activo_id=? AND compra_activo_id<>?');
                $otherPurchases->execute([$purchase['activo_id'], $id]);
                if (!$asset || $asset['estado'] !== 'Disponible' || (int)$used->fetchColumn() > 0 || (int)$otherPurchases->fetchColumn() > 0) {
                    sendJson(['error' => 'No se puede eliminar la compra: el activo ya fue asignado, usado o tiene otros registros relacionados.'], 409);
                }
                $assetId = (int)$purchase['activo_id'];
                $db->prepare('UPDATE compras_activos SET activo_id=NULL WHERE activo_id=?')->execute([$assetId]);
                $db->prepare('DELETE FROM historial_estados WHERE activo_id=?')->execute([$assetId]);
                $db->prepare('UPDATE movimientos_activos SET activo_id=NULL WHERE activo_id=?')->execute([$assetId]);
                $db->prepare('DELETE FROM activos WHERE activo_id=?')->execute([$assetId]);
            }
            $db->prepare('DELETE FROM compras_activos WHERE compra_activo_id=?')->execute([$id]);
        }
        $db->commit();
        return ['ok' => true, 'id' => $id];
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
}

