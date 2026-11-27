<?php
declare(strict_types=1);

// Respuestas JSON y validación de entradas.

function sendJson(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function inputData(): array
{
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        sendJson(['error' => 'El cuerpo de la solicitud debe ser un objeto JSON.'], 400);
    }
    return $input;
}

function requiredText(array $data, string $key, int $maxLength): string
{
    $value = trim((string)($data[$key] ?? ''));
    if ($value === '' || strlen($value) > $maxLength) {
        sendJson(['error' => "El campo {$key} es obligatorio y admite hasta {$maxLength} caracteres."], 422);
    }
    return $value;
}

function requiredTextRange(array $data, string $key, int $minLength, int $maxLength): string
{
    $value = trim((string)($data[$key] ?? ''));
    $len = strlen($value);
    if ($len < $minLength || $len > $maxLength) {
        sendJson(['error' => "El campo {$key} debe tener entre {$minLength} y {$maxLength} caracteres."], 422);
    }
    return $value;
}

function optionalText(array $data, string $key, int $maxLength = 255): ?string
{
    $value = trim((string)($data[$key] ?? ''));
    if ($value === '') {
        return null;
    }
    if (strlen($value) > $maxLength) {
        sendJson(['error' => "El campo {$key} admite hasta {$maxLength} caracteres."], 422);
    }
    return $value;
}

function validDate(mixed $value, bool $required = false): ?string
{
    if ($value === null || $value === '') {
        if ($required) {
            sendJson(['error' => 'La fecha es obligatoria.'], 422);
        }
        return null;
    }
    $date = DateTime::createFromFormat('!Y-m-d', (string)$value);
    if (!$date || $date->format('Y-m-d') !== $value) {
        sendJson(['error' => 'La fecha debe tener el formato AAAA-MM-DD.'], 422);
    }
    return $date->format('Y-m-d');
}

