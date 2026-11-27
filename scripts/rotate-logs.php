#!/usr/bin/env php
<?php
/**
 * Script de rotación de logs
 * Rota logs/php-error.log cuando supera 10MB
 * Mantiene hasta 5 archivos rotados
 *
 * Uso: php scripts/rotate-logs.php
 * Configurar como cron job para ejecutar diariamente
 */

$logFile = __DIR__ . '/../logs/php-error.log';
$maxSize = 10 * 1024 * 1024; // 10MB
$maxBackups = 5;

if (!file_exists($logFile)) {
    exit(0);
}

$fileSize = filesize($logFile);

// Si el archivo es más grande que el máximo, rotar
if ($fileSize > $maxSize) {
    // Eliminar el backup más antiguo si existe
    $oldestBackup = $logFile . '.' . $maxBackups;
    if (file_exists($oldestBackup)) {
        unlink($oldestBackup);
    }

    // Rotar los backups existentes
    for ($i = $maxBackups - 1; $i >= 1; $i--) {
        $oldBackup = $logFile . '.' . $i;
        $newBackup = $logFile . '.' . ($i + 1);
        if (file_exists($oldBackup)) {
            rename($oldBackup, $newBackup);
        }
    }

    // Mover el archivo actual a .1
    rename($logFile, $logFile . '.1');

    // Crear nuevo archivo vacío
    file_put_contents($logFile, '');

    echo "Log rotado. Tamaño anterior: " . round($fileSize / 1024 / 1024, 2) . " MB\n";
} else {
    echo "Log no requiere rotación. Tamaño actual: " . round($fileSize / 1024 / 1024, 2) . " MB\n";
}
