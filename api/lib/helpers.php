<?php
declare(strict_types=1);

// Identificadores y registro de estados de activos.

function newSourceKey(): string
{
    return 'API:' . bin2hex(random_bytes(20));
}

// Función genérica para obtener o crear un registro por nombre.
// Maneja condiciones de carrera (doble inserción) de forma segura.
function getOrCreate(PDO $db, string $table, string $idColumn, string $nameColumn, string $name, array $insertData = []): int
{
    $query = $db->prepare("SELECT {$idColumn} FROM {$table} WHERE UPPER(TRIM({$nameColumn})) = UPPER(TRIM(?)) LIMIT 1");
    $query->execute([$name]);
    $id = $query->fetchColumn();
    if ($id !== false) {
        return (int)$id;
    }

    if (empty($insertData)) {
        $insert = $db->prepare("INSERT INTO {$table} ({$nameColumn}) VALUES (?)");
        try {
            $insert->execute([$name]);
        } catch (PDOException $error) {
            if ($error->getCode() !== '23000') {
                throw $error;
            }
            $query->execute([$name]);
            $id = $query->fetchColumn();
            if ($id === false) {
                throw $error;
            }
            return (int)$id;
        }
    } else {
        $columns = array_keys($insertData);
        $placeholders = array_fill(0, count($insertData), '?');
        $insert = $db->prepare(
            "INSERT INTO {$table} ({$nameColumn}, " . implode(', ', $columns) . ') VALUES (?, ' . implode(', ', $placeholders) . ')'
        );

        try {
            $insert->execute([$name, ...array_values($insertData)]);
        } catch (PDOException $error) {
            if ($error->getCode() !== '23000') {
                throw $error;
            }
            $query->execute([$name]);
            $id = $query->fetchColumn();
            if ($id === false) {
                throw $error;
            }
            return (int)$id;
        }
    }
    return (int)$db->lastInsertId();
}

function statusId(PDO $db, string $name): int
{
    return getOrCreate($db, 'estados_activo', 'estado_id', 'nombre', $name, [
        'descripcion' => 'Creado por la aplicación de inventario',
        'permite_asignacion' => 0,
        'es_final' => $name === 'Vendido' ? 1 : 0,
    ]);
}

function categoryId(PDO $db, ?string $name): ?int
{
    if ($name === null || trim($name) === '') {
        return null;
    }
    return getOrCreate($db, 'categorias_activo', 'categoria_id', 'nombre', $name);
}

function recordAssetStatus(PDO $db, int $assetId, string $code, ?string $from, string $to, ?string $person, ?string $client, ?string $note, string $date): void
{
    $oldId = $from === null ? null : statusId($db, $from);
    $newId = statusId($db, $to);
    $history = $db->prepare(
        'INSERT INTO historial_estados
         (activo_id, codigo_activo, estado_anterior_id, estado_nuevo_id, cambiado_por_id, cambiado_en, motivo, responsable_texto, fuente_clave)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)'
    );
    $history->execute([$assetId, $code, $oldId, $newId, $date . ' 12:00:00', $note, $person, newSourceKey()]);

    $movement = $db->prepare(
        'INSERT INTO movimientos_activos
         (fuente_clave, activo_id, codigo_activo, estado_id, cliente_id, cliente_texto, responsable_id, responsable_texto, fecha_movimiento, observaciones)
         VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?)'
    );
    $movement->execute([newSourceKey(), $assetId, $code, $newId, $client, $person, $date, $note]);
}

