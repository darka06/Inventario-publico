#!/usr/bin/env php
<?php
/**
 * Script de monitoreo de logs de error de PHP
 * Revisa logs/php-error.log en busca de errores críticos y envía alertas
 *
 * Uso: php scripts/monitor-logs.php
 * Configurar como cron job para ejecutar cada 5 minutos
 */

$logFile = __DIR__ . '/../logs/php-error.log';
$errorLog = __DIR__ . '/../logs/monitor-errors.log';

// Crear directorio de logs si no existe
if (!is_dir(dirname($logFile))) {
    mkdir(dirname($logFile), 0750, true);
}

if (!file_exists($logFile)) {
    file_put_contents($errorLog, date('Y-m-d H:i:s') . " - Log file no existe: $logFile\n", FILE_APPEND);
    exit(0);
}

// Leer las últimas 50 líneas del log
$lines = array_slice(file($logFile), -50);
if ($lines === false) {
    file_put_contents($errorLog, date('Y-m-d H:i:s') . " - Error al leer log file\n", FILE_APPEND);
    exit(0);
}

// Buscar errores críticos
$criticalPatterns = [
    '/Fatal error/i',
    '/Uncaught Error/i',
    '/Allowed memory size/i',
    '/Maximum execution time/i',
    '/SQLSTATE/i',
];

$errorsFound = [];
foreach ($lines as $line) {
    foreach ($criticalPatterns as $pattern) {
        if (preg_match($pattern, $line)) {
            $errorsFound[] = trim($line);
            break;
        }
    }
}

// Si hay errores críticos, registrar
if (!empty($errorsFound)) {
    $message = date('Y-m-d H:i:s') . " - Se encontraron " . count($errorsFound) . " errores críticos en el log:\n";
    $message .= implode("\n", array_slice($errorsFound, 5)); // Solo los primeros 5 errores
    file_put_contents($errorLog, $message . "\n" . str_repeat("-", 80) . "\n", FILE_APPEND);
}

// Contar errores en la última hora
$oneHourAgo = date('Y-m-d H:i:s', strtotime('-1 hour'));
$recentErrors = 0;
foreach ($lines as $line) {
    if (preg_match('/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/', $line, $matches)) {
        if ($matches[1] >= $oneHourAgo) {
            $recentErrors++;
        }
    }
}

// Si hay más de 10 errores en la última hora, alertar
if ($recentErrors > 10) {
    $message = date('Y-m-d H:i:s') . " - ALERTA: $recentErrors errores en la última hora\n";
    file_put_contents($errorLog, $message . "\n", FILE_APPEND);
}

echo "Monitoreo completado. Errores críticos: " . count($errorsFound) . ", Errores en última hora: $recentErrors\n";
