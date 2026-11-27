<?php
declare(strict_types=1);

/*
 * Ensamblador de js/estadisticas-modulos/*.js
 *
 * El archivo estadisticas.js original (3495 líneas) se dividió en módulos más pequeños
 * para cumplir con la regla de arquitectura de 400 líneas por archivo.
 *
 * Este script los une EN EL ORDEN de la lista de abajo, dentro de una sola función
 * autoejecutable (así comparten las mismas variables), y los entrega como un único .js.
 *
 * - El ORDEN importa: no lo cambies sin probar.
 * - Para agregar un archivo nuevo: créalo en js/estadisticas-modulos/ y añádelo a $parts.
 * - El navegador lo cachea con ETag: si no cambia ningún archivo responde 304 (sin descargar).
 */

$dir = __DIR__ . '/estadisticas-modulos';
$parts = [
    'constants.js',               // Constantes compartidas (CHART_COLORS) - debe ser primero
    '00-inicializacion.js',       // Inicialización: root, defs (debe ser segundo)
    '01-utilidades.js',           // Funciones base: C, sum, esc, nice, pt, legend, cell, table, empty
    '02-graficos-basicos.js',     // Gráficos SVG: pie, bars, line, funnel, pyramid, hbar
    '03-graficos-avanzados.js',  // Selector de gráficos (chart), gauge
    '04-datos-api.js',           // Procesamiento de datos de la API (D, PAL, num, money, pct, bucket, fmt, day, group, filterByField, lastDays, weekDays, movesPerDay)
    '05-widgets-base.js',         // Base de widgets (W, cw, tw, colStore, viewStore, SC, mine, show, ICONS, svg, icon, card, modal, $, current)
    '06-widgets-eventos.js',      // Eventos de widgets (closeModal, refresh, toggleLegend, menu, colMenu, closeMenu, openMenu, saveCols, fillCols, openCols)
    '07-tooltip.js',              // Tooltip (tip, mousemove handler)
    '08-handlers-modal-detail.js', // Funciones auxiliares para detalle del modal (getDetailContentByField, getMovementsContent, getPurchasesContent)
    '08-handlers-modal-clicks.js', // Handlers de clicks en el modal (handleModalClick)
    '08-handlers-modal.js',       // Handlers del modal principal (click events, keyboard events)
    '09-handlers-root-table.js',  // Handlers de clicks en tablas del root (handleRootTableRowClick, handleRootTableCellClick)
    '09-handlers-root.js',        // Handlers del root (panel principal, click events)
    '10-widgets-definicion.js',   // Definición de widgets por defecto (llena el array W)
    '11-modal-detail.js',         // Modal de detalle (detailModal, openDetailModal, closeDetailModal)
    '12-arranque.js',             // Carga inicial (renderizado, eventos finales, load, redraw)
];

$files = [];
$signature = '';
$latest = 0;
foreach ($parts as $name) {
    $path = $dir . '/' . $name;
    if (!is_file($path)) {
        http_response_code(500);
        header('Content-Type: text/plain; charset=utf-8');
        echo "Falta el archivo js/estadisticas-modulos/{$name}";
        exit;
    }
    $files[] = $path;
    $time = (int)filemtime($path);
    $latest = max($latest, $time);
    $signature .= $name . $time . filesize($path);
}
$signature .= (string)filemtime(__FILE__);
$latest = max($latest, (int)filemtime(__FILE__));
$etag = '"' . md5($signature) . '"';

header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-cache');
header('ETag: ' . $etag);
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $latest) . ' GMT');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
    http_response_code(304);
    exit;
}

echo "// Panel de Estadísticas con datos reales de la API (MySQL)\n";
echo "(() => {\n";
foreach ($files as $path) {
    readfile($path);
}
echo "})();";
