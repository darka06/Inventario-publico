<?php
declare(strict_types=1);

// Categorías, contactos, funcionarios y herramientas.

function contactTable(string $type): string
{
    return match ($type) {
        'Cliente' => 'clientes',
        'Proveedor' => 'proveedores',
        default => '',
    };
}

function saveCategory(PDO $db, array $data): array
{
    $id = isset($data['id']) && ctype_digit((string)$data['id']) ? (int)$data['id'] : null;
    $name = requiredText($data, 'name', 120);

    $duplicate = $db->prepare(
        'SELECT categoria_id FROM categorias_activo
         WHERE UPPER(TRIM(nombre)) = UPPER(TRIM(?)) AND categoria_id <> COALESCE(?, 0)
         LIMIT 1'
    );
    $duplicate->execute([$name, $id]);
    if ($duplicate->fetchColumn() !== false) {
        sendJson(['error' => 'Ya existe una categoría con ese nombre.'], 409);
    }

    if ($id === null) {
        $insert = $db->prepare('INSERT INTO categorias_activo (nombre) VALUES (?)');
        $insert->execute([$name]);
        return ['id' => (string)$db->lastInsertId()];
    }

    $exists = $db->prepare('SELECT categoria_id FROM categorias_activo WHERE categoria_id=?');
    $exists->execute([$id]);
    if ($exists->fetchColumn() === false) {
        sendJson(['error' => 'No se encontró la categoría solicitada.'], 404);
    }
    $db->prepare('UPDATE categorias_activo SET nombre=? WHERE categoria_id=?')->execute([$name, $id]);
    return ['id' => (string)$id];
}

function deleteCategory(PDO $db, array $data): void
{
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
    if (!$id) {
        sendJson(['error' => 'El identificador de la categoría no es válido.'], 422);
    }

    $usage = $db->prepare('SELECT COUNT(*) FROM activos WHERE categoria_id=?');
    $usage->execute([$id]);
    if ((int)$usage->fetchColumn() > 0) {
        sendJson(['error' => 'No se puede eliminar esta categoría porque tiene activos relacionados. Cámbiales la categoría primero.'], 409);
    }

    $statement = $db->prepare('DELETE FROM categorias_activo WHERE categoria_id=?');
    $statement->execute([$id]);
    if (!$statement->rowCount()) {
        sendJson(['error' => 'No se encontró la categoría solicitada.'], 404);
    }
}

function saveContact(PDO $db, array $data, bool $update = false): array
{
    $type = requiredText($data, 'type', 20);
    $table = contactTable($type);
    if ($table === '') {
        sendJson(['error' => 'El tipo de contacto debe ser Cliente o Proveedor.'], 422);
    }
    $name = requiredText($data, 'name', 180);
    $nit = optionalText($data, 'nit', 40);
    $email = optionalText($data, 'email', 180);
    if ($email !== null && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendJson(['error' => 'El correo electrónico no es válido.'], 422);
    }
    $phone = optionalText($data, 'phone', 40);
    $address = optionalText($data, 'address', 255);
    $notes = optionalText($data, 'notes', 2000);
    $idText = (string)($data['id'] ?? '');
    $id = null;
    if ($update) {
        $prefix = $type === 'Cliente' ? 'cliente:' : 'proveedor:';
        if (!str_starts_with($idText, $prefix) || !ctype_digit(substr($idText, strlen($prefix)))) {
            sendJson(['error' => 'El contacto seleccionado no es válido.'], 422);
        }
        $id = (int)substr($idText, strlen($prefix));
        $query = $db->prepare("UPDATE {$table} SET razon_social=?, nit=?, correo=?, telefono=?, direccion=?, notas=? WHERE " . ($type === 'Cliente' ? 'cliente_id' : 'proveedor_id') . '=?');
        $query->execute([$name, $nit, $email, $phone, $address, $notes, $id]);
        if (!$query->rowCount()) {
            $exists = $db->prepare('SELECT 1 FROM ' . $table . ' WHERE ' . ($type === 'Cliente' ? 'cliente_id' : 'proveedor_id') . '=?');
            $exists->execute([$id]);
            if (!$exists->fetchColumn()) {
                sendJson(['error' => 'No se encontró el contacto solicitado.'], 404);
            }
        }
    } else {
        $column = $type === 'Cliente' ? 'cliente_id' : 'proveedor_id';
        $query = $db->prepare("INSERT INTO {$table} (nit, razon_social, correo, telefono, direccion, notas) VALUES (?, ?, ?, ?, ?, ?)");
        $query->execute([$nit, $name, $email, $phone, $address, $notes]);
        $id = (int)$db->lastInsertId();
    }
    return ['id' => $type === 'Cliente' ? 'cliente:' . $id : 'proveedor:' . $id];
}

function saveUser(PDO $db, array $data, bool $update = false): array
{
    $name = requiredText($data, 'nombre', 180);
    $email = optionalText($data, 'correo', 180);
    if ($email !== null && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendJson(['error' => 'El correo electrónico no es válido.'], 422);
    }
    $area = optionalText($data, 'area', 100);
    $departmentId = null;
    if ($area !== null) {
        $find = $db->prepare('SELECT departamento_id FROM departamentos WHERE UPPER(TRIM(nombre))=UPPER(TRIM(?)) LIMIT 1');
        $find->execute([$area]);
        $departmentId = $find->fetchColumn();
        if ($departmentId === false) {
            $db->prepare('INSERT INTO departamentos (nombre) VALUES (?)')->execute([$area]);
            $departmentId = (int)$db->lastInsertId();
        }
    }
    $values = [
        $name, optionalText($data, 'cargo', 100), optionalText($data, 'documento', 40),
        $email, $departmentId, requiredText($data, 'estado', 30),
        optionalText($data, 'telefono', 40), optionalText($data, 'notas', 2000),
    ];
    if ($update) {
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id) {
            sendJson(['error' => 'El identificador del usuario no es válido.'], 422);
        }
        $statement = $db->prepare('UPDATE usuarios SET nombre_completo=?, cargo=?, documento=?, correo=?, departamento_id=?, estado=?, telefono=?, notas=? WHERE usuario_id=?');
        $statement->execute([...$values, $id]);
        return ['id' => (string)$id];
    }
    $statement = $db->prepare('INSERT INTO usuarios (nombre_completo, cargo, documento, correo, departamento_id, estado, telefono, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $statement->execute($values);
    return ['id' => (string)$db->lastInsertId()];
}

const TOOL_STATUSES = ['Disponible', 'En uso', 'En reparación', 'Dañada', 'Baja'];

function saveTool(PDO $db, array $data, array $account, bool $update = false): array
{
    $name = requiredText($data, 'name', 180);
    $brand = optionalText($data, 'brand', 120);
    $brandKey = brandId($db, $brand);
    $status = requiredText($data, 'status', 30);
    if (!in_array($status, TOOL_STATUSES, true)) {
        sendJson(['error' => 'El estado de la herramienta no es válido.'], 422);
    }
    $responsible = null;
    $responsibleText = trim((string)($data['responsibleId'] ?? ''));
    if ($responsibleText !== '') {
        $responsible = filter_var($responsibleText, FILTER_VALIDATE_INT);
        if (!$responsible) {
            sendJson(['error' => 'El responsable seleccionado no es válido.'], 422);
        }
        $exists = $db->prepare('SELECT 1 FROM usuarios WHERE usuario_id=?');
        $exists->execute([$responsible]);
        if ($exists->fetchColumn() === false) {
            sendJson(['error' => 'El responsable seleccionado no existe.'], 422);
        }
    }
    $description = optionalText($data, 'description', 255);
    $serial = optionalText($data, 'serial', 120);
    $cost = filter_var($data['cost'] ?? 0, FILTER_VALIDATE_FLOAT);
    if ($cost === false || !is_finite((float)$cost) || $cost < 0) {
        sendJson(['error' => 'El precio de compra debe ser un número mayor o igual a cero.'], 422);
    }
    $quantity = filter_var($data['quantity'] ?? 1, FILTER_VALIDATE_INT);
    if ($quantity === false || $quantity < 0) {
        sendJson(['error' => 'La cantidad debe ser un número entero mayor o igual a cero.'], 422);
    }
    $values = [$name, $description, $brand, $brandKey, $serial, $quantity, $status, $responsible, $cost];
    $db->beginTransaction();
    try {
        if ($update) {
            $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$id) sendJson(['error' => 'El identificador de la herramienta no es válido.'], 422);
            $previous = $db->prepare('SELECT usuario_id FROM herramientas WHERE herramienta_id=? FOR UPDATE');
            $previous->execute([$id]);
            $oldResponsible = $previous->fetchColumn();
            if ($oldResponsible === false) sendJson(['error' => 'No se encontró la herramienta solicitada.'], 404);
            $statement = $db->prepare('UPDATE herramientas SET nombre=?, descripcion=?, marca=?, marca_id=?, serial=?, cantidad=?, estado=?, usuario_id=?, costo_compra=? WHERE herramienta_id=?');
            $statement->execute([...$values, $id]);
            $toolId = (int)$id;
            $changed = (string)($oldResponsible === null ? '' : $oldResponsible) !== (string)($responsible ?? '');
        } else {
            $statement = $db->prepare('INSERT INTO herramientas (nombre, descripcion, marca, marca_id, serial, cantidad, estado, usuario_id, costo_compra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $statement->execute($values);
            $toolId = (int)$db->lastInsertId();
            $changed = $responsible !== null;
        }
        if ($changed && $responsible !== null) {
            $person = $db->prepare('SELECT nombre_completo FROM usuarios WHERE usuario_id=?');
            $person->execute([$responsible]);
            $history = $db->prepare('INSERT INTO entregas_herramientas (herramienta_id, herramienta_nombre, tecnico_id, tecnico_nombre, registrado_por) VALUES (?, ?, ?, ?, ?)');
            $history->execute([$toolId, $name, $responsible, $person->fetchColumn(), $account['username'] ?? null]);
        }
        $db->commit();
        return ['id' => (string)$toolId];
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
}

function deleteTool(PDO $db, array $data): void
{
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
    if (!$id) {
        sendJson(['error' => 'El identificador de la herramienta no es válido.'], 422);
    }
    $statement = $db->prepare('DELETE FROM herramientas WHERE herramienta_id=?');
    $statement->execute([$id]);
    if (!$statement->rowCount()) {
        sendJson(['error' => 'No se encontró la herramienta solicitada.'], 404);
    }
}

function deleteContact(PDO $db, array $data): void
{
    $idText = (string)($data['id'] ?? '');
    if (preg_match('/^(cliente|proveedor):([0-9]+)$/', $idText, $match) !== 1) {
        sendJson(['error' => 'El contacto seleccionado no es válido.'], 422);
    }
    $table = $match[1] === 'cliente' ? 'clientes' : 'proveedores';
    $idColumn = $match[1] === 'cliente' ? 'cliente_id' : 'proveedor_id';
    $statement = $db->prepare("DELETE FROM {$table} WHERE {$idColumn}=?");
    $statement->execute([(int)$match[2]]);
    if (!$statement->rowCount()) {
        sendJson(['error' => 'No se encontró el contacto solicitado.'], 404);
    }
}

function deleteUser(PDO $db, array $data): void
{
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
    if (!$id) {
        sendJson(['error' => 'El identificador del usuario no es válido.'], 422);
    }
    $statement = $db->prepare('DELETE FROM usuarios WHERE usuario_id=?');
    try {
        $statement->execute([$id]);
    } catch (PDOException) {
        sendJson(['error' => 'No se puede eliminar este usuario porque tiene registros relacionados. Cámbialo a Inactivo.'], 409);
    }
    if (!$statement->rowCount()) {
        sendJson(['error' => 'No se encontró el usuario solicitado.'], 404);
    }
}

