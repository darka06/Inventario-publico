<?php
declare(strict_types=1);

/*
 * Ensamblador de js/modulos/*.js
 *
 * La lógica de las páginas de módulos vive en archivos pequeños dentro de js/modulos/.
 * Este script los une EN EL ORDEN de la lista de abajo, dentro de una sola función
 * autoejecutable (así comparten las mismas variables), y los entrega como un único .js.
 *
 * - El ORDEN importa: no lo cambies sin probar.
 * - Para agregar un archivo nuevo: créalo en js/modulos/ y añádelo a $parts.
 * - El navegador lo cachea con ETag: si no cambia ningún archivo responde 304 (sin descargar).
 */

$dir = __DIR__ . '/modulos';
$parts = [
    '01-estado.js',                 // Estado compartido, constantes y carga de datos
    '02-utilidades.js',             // Fechas, avisos, text(), button()
    '03-formularios-campos.js',     // Campos y secciones de formulario
    '04-ventanas.js',               // Ventanas flotantes e historial
    '05-detalle-animacion.js',      // Animación y apertura del detalle
    '06-detalle-componentes.js',    // Secciones, métricas y hero del detalle
    '07-shell-y-busqueda.js',       // Pestañas, estructura de la página y búsqueda
    '08-filtros.js',                // Constructor y evaluación de filtros
    '09-resumen-tablas.js',         // Resumen, menú de vista, paginación y tablas
    '10-tecnicos.js',               // Vista Por técnico y tarjeta expandida
    '11-render-tabla.js',           // Contenido de cada tabla
    '12-activos.js',                // Activos: editar, detalle, asignar y devolver
    '13-insumos-compras.js',        // Insumos, stock y compras
    '14-catalogos-contactos.js',    // Categorías, marcas y contactos
    '15-usuarios-herramientas.js',  // Funcionarios y herramientas
    '16-prestamos.js',              // Alquiler / Venta e impresión
    '17-acciones-y-arranque.js',    // Acciones, eventos y arranque
    '18-auditoria-herramientas.js', // Auditoría de herramientas por técnico (solo funciones)
];

$files = [];
$signature = '';
$latest = 0;
foreach ($parts as $name) {
    $path = $dir . '/' . $name;
    if (!is_file($path)) {
        http_response_code(500);
        header('Content-Type: text/plain; charset=utf-8');
        echo "Falta el archivo js/modulos/{$name}";
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

echo "// Operaciones de activos, insumos, compras, movimientos, contactos y préstamos.\n";
echo "(() => {\n";
foreach ($files as $path) {
    readfile($path);
}
echo "})();";
