<?php
declare(strict_types=1);

// Auditorías de herramientas por técnico.
// Tablas: auditorias_herramientas y auditoria_herramientas_detalle (database/schema.mysql.sql).
// Cada auditoría es un registro permanente: no se edita ni se elimina, así el historial es confiable.

const TOOL_AUDIT_NOTE_MIN = 5;      // caracteres mínimos de la nota cuando hay una novedad
const TOOL_AUDIT_MAX_QTY = 100000;
// Estados que se pueden encontrar al auditar ("Disponible" cuenta como "En uso"; "Baja" se da con la casilla de dar de baja).
const TOOL_AUDIT_STATUSES = ['En uso', 'En reparación', 'Dañada', 'No encontrada'];

function toolAuditTablesMissing(): never
{
    sendJson(['error' => 'Faltan las tablas de auditoría. Importa database/schema.mysql.sql en MySQL.'], 503);
}

// Lista de auditorías (las 300 más recientes) con el detalle de cada una.
// Si la migración aún no se ejecutó devuelve [] para no romper el resto de la aplicación.
function fetchToolAudits(PDO $db): array
{
    try {
        $audits = $db->query(
            'SELECT auditoria_id, tecnico_id, tecnico_nombre, fecha_auditoria, auditor, resultado,
                    total_herramientas, unidades_registradas, unidades_encontradas, novedades, nota_general
             FROM auditorias_herramientas
             ORDER BY fecha_auditoria DESC, auditoria_id DESC
             LIMIT 300'
        )->fetchAll();
    } catch (PDOException $error) {
        if ($error->getCode() === '42S02') {
            return [];
        }
        throw $error;
    }
    if (!$audits) {
        return [];
    }
    $ids = array_map(static fn(array $row): int => (int)$row['auditoria_id'], $audits);
    $marks = implode(',', array_fill(0, count($ids), '?'));
    $query = $db->prepare(
        "SELECT auditoria_id, herramienta_id, herramienta_nombre, marca, serial, cantidad_registrada, cantidad_encontrada,
                estado_registrado, estado_encontrado, resultado, nota
         FROM auditoria_herramientas_detalle
         WHERE auditoria_id IN ({$marks})
         ORDER BY detalle_id"
    );
    $query->execute($ids);
    $items = [];
    foreach ($query->fetchAll() as $row) {
        $items[(int)$row['auditoria_id']][] = [
            'toolId' => $row['herramienta_id'] === null ? null : (string)$row['herramienta_id'],
            'name' => $row['herramienta_nombre'],
            'brand' => $row['marca'],
            'serial' => $row['serial'],
            'registeredQty' => (int)$row['cantidad_registrada'],
            'foundQty' => (int)$row['cantidad_encontrada'],
            'registeredStatus' => $row['estado_registrado'],
            'foundStatus' => $row['estado_encontrado'],
            'result' => $row['resultado'],
            'note' => $row['nota'],
        ];
    }
    return array_map(static fn(array $row): array => [
        'id' => (string)$row['auditoria_id'],
        'technicianId' => (string)$row['tecnico_id'],
        'technician' => $row['tecnico_nombre'],
        'date' => $row['fecha_auditoria'],
        'auditor' => $row['auditor'],
        'result' => $row['resultado'],
        'toolCount' => (int)$row['total_herramientas'],
        'unitsRegistered' => (int)$row['unidades_registradas'],
        'unitsFound' => (int)$row['unidades_encontradas'],
        'novelties' => (int)$row['novedades'],
        'note' => $row['nota_general'],
        'items' => $items[(int)$row['auditoria_id']] ?? [],
    ], $audits);
}

// Registra una auditoría completa. Lo "registrado" se toma de la base de datos (no de lo que envía la pantalla);
// de la pantalla solo se aceptan cantidad, estado y nota encontrados por herramienta.
function saveToolAudit(PDO $db, array $account, array $data): array
{
    $technicianId = filter_var($data['technicianId'] ?? null, FILTER_VALIDATE_INT);
    if (!$technicianId) {
        sendJson(['error' => 'El técnico seleccionado no es válido.'], 422);
    }
    $technician = $db->prepare('SELECT nombre_completo FROM usuarios WHERE usuario_id=?');
    $technician->execute([$technicianId]);
    $technicianName = $technician->fetchColumn();
    if ($technicianName === false) {
        sendJson(['error' => 'El técnico seleccionado no existe.'], 422);
    }
    $generalNote = optionalText($data, 'generalNote', 1000);
    $sentItems = $data['items'] ?? null;
    if (!is_array($sentItems) || !$sentItems) {
        sendJson(['error' => 'La auditoría no incluye herramientas.'], 422);
    }

    $tools = $db->prepare(
        'SELECT h.herramienta_id, h.nombre, COALESCE(m.nombre, h.marca) AS marca, h.serial, h.cantidad, h.estado
         FROM herramientas h
         LEFT JOIN marcas m ON m.marca_id = h.marca_id
         WHERE h.usuario_id = ? AND h.estado <> ?
         ORDER BY h.nombre'
    );
    $tools->execute([$technicianId, 'Baja']);
    $registered = [];
    foreach ($tools->fetchAll() as $row) {
        $registered[(int)$row['herramienta_id']] = $row;
    }
    if (!$registered) {
        sendJson(['error' => 'Este técnico no tiene herramientas asignadas para auditar.'], 422);
    }

    $byTool = [];
    foreach ($sentItems as $item) {
        $toolId = is_array($item) ? filter_var($item['toolId'] ?? null, FILTER_VALIDATE_INT) : false;
        if ($toolId) {
            $byTool[$toolId] = $item;
        }
    }

    $rows = [];
    $novelties = 0;
    $unitsRegistered = 0;
    $unitsFound = 0;
    $writeOffIds = [];
    foreach ($registered as $toolId => $tool) {
        $label = (string)$tool['nombre'];
        $item = $byTool[$toolId] ?? null;
        if ($item === null) {
            sendJson(['error' => "Falta revisar «{$label}». La auditoría debe incluir todas las herramientas del técnico; recarga la página e inténtalo de nuevo."], 422);
        }
        $found = filter_var($item['quantity'] ?? null, FILTER_VALIDATE_INT);
        if ($found === false || $found < 0 || $found > TOOL_AUDIT_MAX_QTY) {
            sendJson(['error' => "La cantidad encontrada de «{$label}» debe ser un número entero mayor o igual a cero."], 422);
        }
        $status = trim((string)($item['status'] ?? ''));
        if (!in_array($status, TOOL_AUDIT_STATUSES, true)) {
            sendJson(['error' => "El estado encontrado de «{$label}» no es válido."], 422);
        }
        $note = optionalText($item, 'note', 500);
        $registeredQty = (int)$tool['cantidad'];
        $registeredStatus = $tool['estado'] === 'Disponible' ? 'En uso' : $tool['estado'];
        $writeOff = filter_var($item['writeOff'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if ($writeOff && $status !== 'Dañada') {
            sendJson(['error' => "Solo se puede dar de baja una herramienta dañada («{$label}»)."], 422);
        }
        if ($status === 'No encontrada') {
            $found = 0;
        }
        if ($writeOff) {
            $result = 'Dada de baja';
            $writeOffIds[] = $toolId;
        } elseif ($found === 0) {
            $result = 'No encontrada';
        } elseif ($found !== $registeredQty || $status !== $registeredStatus) {
            $result = 'Con novedad';
        } else {
            $result = 'Conforme';
        }
        if ($result !== 'Conforme' && ($note === null || mb_strlen($note) < TOOL_AUDIT_NOTE_MIN)) {
            sendJson(['error' => "Explica en la nota qué pasó con «{$label}» (mínimo " . TOOL_AUDIT_NOTE_MIN . ' caracteres).'], 422);
        }
        if ($result !== 'Conforme') {
            $novelties++;
        }
        $unitsRegistered += $registeredQty;
        $unitsFound += $found;
        $rows[] = [
            $toolId, $label, $tool['marca'], $tool['serial'], $registeredQty, $found,
            $tool['estado'], $status, $result, $note,
        ];
    }

    $overall = $novelties > 0 ? 'Con novedades' : 'Conforme';
    $auditor = mb_substr((string)(($account['name'] ?? '') !== '' ? $account['name'] : ($account['username'] ?? '')), 0, 180);
    $ip = mb_substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);

    try {
        $db->beginTransaction();
        $db->prepare(
            'INSERT INTO auditorias_herramientas
             (tecnico_id, tecnico_nombre, auditor, resultado, total_herramientas, unidades_registradas, unidades_encontradas, novedades, nota_general, ip)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $technicianId, $technicianName, $auditor !== '' ? $auditor : null, $overall, count($rows),
            $unitsRegistered, $unitsFound, $novelties, $generalNote, $ip !== '' ? $ip : null,
        ]);
        $auditId = (int)$db->lastInsertId();
        $insert = $db->prepare(
            'INSERT INTO auditoria_herramientas_detalle
             (auditoria_id, herramienta_id, herramienta_nombre, marca, serial, cantidad_registrada, cantidad_encontrada,
              estado_registrado, estado_encontrado, resultado, nota)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($rows as $row) {
            $insert->execute([$auditId, ...$row]);
        }
        // Las herramientas dadas de baja pasan a estado Baja en el inventario (dentro de la misma transacción).
        $writeOffQuery = $db->prepare('UPDATE herramientas SET estado = ? WHERE herramienta_id = ? AND usuario_id = ?');
        foreach ($writeOffIds as $toolId) {
            $writeOffQuery->execute(['Baja', $toolId, $technicianId]);
        }
        $db->commit();
    } catch (PDOException $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        if ($error->getCode() === '42S02') {
            toolAuditTablesMissing();
        }
        throw $error;
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }

    return [
        'id' => (string)$auditId,
        'result' => $overall,
        'novelties' => $novelties,
        'writtenOff' => count($writeOffIds),
        'label' => 'Auditoría #' . $auditId . ' · ' . $technicianName,
    ];
}
