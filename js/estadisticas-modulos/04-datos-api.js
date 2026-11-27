// Panel de Estadísticas - Módulo 4: Procesamiento de datos de la API

/*  Datos reales (API)  */

let D = null;                                   // respuesta de la API (resource=all)
const notice = document.getElementById('stats-notice');
const PAL = [C.green, C.blue, C.yellow, C.pink, C.red, C.orange, '#8e6bd8', '#16a2b8', '#7f8c8d', '#d35400'];
const num = v => Number(v) || 0;
const money = v => '$ ' + Math.round(v).toLocaleString('es-CO');
const pct = v => Number(v).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' %';
const bucket = s => {
  s = String(s || '').toUpperCase();
  return ['ASIGNADO', 'ALQUILADO', 'PRESTADO'].includes(s) ? 'inUse' : s === 'DISPONIBLE' ? 'inStore' : s === 'EN REPARACIÓN' ? 'inRepair' : 'others';
};
const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const day = v => String(v || '').slice(0, 10);

// cuenta elementos por clave; lo que exceda el límite se agrupa en "Otros"
const group = (list, key, limit = 8) => {
  const m = new Map();
  list.forEach(x => { const k = key(x); m.set(k, (m.get(k) || 0) + 1); });
  let r = [...m].sort((a, b) => b[1] - a[1]);
  if (r.length > limit) {
    const otherLabels = r.slice(limit - 1).map(([label]) => label);
    r = [...r.slice(0, limit - 1), ['Otros', r.slice(limit - 1).reduce((t, x) => t + x[1], 0), otherLabels]];
  }
  return r.map(([label, value, otherLabels], i) => ({ label, value, color: PAL[i % PAL.length], otherLabels }));
};

// Función auxiliar para filtrar activos por marca/categoría/estado con soporte para "Otros"
const filterByField = (list, field, value, otherLabels) => {
  if (value === 'Otros' && otherLabels) {
    return list.filter(item => otherLabels.includes(item[field]));
  }
  return list.filter(item => (item[field] || 'Sin ' + field) === value);
};

const lastDays = n => Array.from({ length: n }, (_, i) => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate() - (n - 1 - i)); });
const weekDays = off => {
  const t = new Date(), mon = new Date(t.getFullYear(), t.getMonth(), t.getDate() - ((t.getDay() + 6) % 7) - 7 * off);
  return Array.from({ length: 7 }, (_, i) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
};
const movesPerDay = (days, kind) => days.map(d => D.movements.filter(m => m.kind === kind && day(m.date) === fmt(d)).length);
