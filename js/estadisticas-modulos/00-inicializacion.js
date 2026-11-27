// Panel de Estadísticas - Módulo 0: Inicialización

// Declarar root antes de que lo usen los handlers
const root = document.getElementById('dash');
if (!root) return;

// patrón rayado que se muestra al pasar el mouse
const defs = document.createElement('div');
defs.innerHTML = '<svg width="0" height="0" data-s="position:absolute" aria-hidden="true"><defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#fff" stroke-opacity=".65" stroke-width="3"/></pattern></defs></svg>';
document.body.appendChild(defs);
