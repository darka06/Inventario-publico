// Constantes compartidas del sistema

// Paleta de colores para gráficos y visualizaciones
const CHART_COLORS = [
  '#130a74', // Azul oscuro (primario)
  '#2f66dd', // Azul medio
  '#06c167', // Verde
  '#e0a800', // Amarillo/dorado
  '#e63b4a', // Rojo
  '#8e44ad', // Púrpura
  '#16a2b8', // Cyan
  '#7f8c8d', // Gris
  '#d35400', // Naranja oscuro
  '#34495e', // Gris oscuro
];

// Escaping HTML seguro: protege contra XSS (reusable en todo el frontend)
const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// Hacer disponible globalmente para otros scripts
window.INVENTARIO_CONSTANTS = { CHART_COLORS, escapeHtml };
