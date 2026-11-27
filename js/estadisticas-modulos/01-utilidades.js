// Panel de Estadísticas - Módulo 1: Utilidades base

// Constantes de colores para indicadores de estado (diferentes de CHART_COLORS de gráficos)
const C = { green: '#06c167', blue: '#3b92ea', yellow: '#fcc23d', pink: '#d4568a', red: '#ff4757', orange: '#ff7a5c', gray: '#d0d0d0', bar: '#1ec878' };
const sum = a => a.reduce((s, v) => s + v, 0);
const esc = s => {
  const fn = window.INVENTARIO_CONSTANTS?.escapeHtml;
  if (fn) return fn(s);
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
};
const nice = v => { const p = 10 ** Math.floor(Math.log10(v)), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
const pt = (cx, cy, r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];

const legend = (items, h, click) =>
  `<ul class="legend${h ? ' h' : ''}">${items.map(([n, c, off]) => `<li${click ? ` class="${off ? 'off' : ''}" data-k="${esc(n)}" role="button" tabindex="0" aria-pressed="${!off}"` : ''}><i data-s="background:${c}"></i>${esc(n)}</li>`).join('')}</ul>`;

/*  Tabla  */

// celda de tabla: aplica el formato de la columna y escapa el texto; vacío → "—"
const cell = (c, v) => v == null || v === '' ? '—' : esc(c.fmt ? c.fmt(v) : v);

const table = ({ cols, rows, total, link, scroll, clickableCells = true }) => `
  <div class="tbl-wrap${scroll ? ' scroll' : ''}">
    <table class="tbl">
      <thead><tr><th></th>${cols.map(c => `<th class="${c.c ? 'c' : ''}">${c.t}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map(r => `<tr data-label="${esc(r.label)}" data-clickable="table-row"><td>${esc(r.label)}</td>${cols.map(c => `<td class="${c.c ? 'c' : ''} ${c.bad ? 'bad' : ''}" data-col="${esc(c.k)}" data-label="${esc(r.label)}"${clickableCells ? ' data-clickable="table-cell"' : ''}>${cell(c, r.v[c.k])}</td>`).join('')}</tr>`).join('')}
        ${total ? `<tr class="total"><td>Total</td>${cols.map(c => `<td class="${c.c ? 'c' : ''}">${c.sum === false ? '' : cell(c, sum(rows.map(r => r.v[c.k])))}</td>`).join('')}</tr>` : ''}
      </tbody>
    </table>
  </div>
  ${link ? '<a class="see-all" href="#">Ver todo</a>' : ''}`;

const empty = t => `<p class="empty" data-s="padding:12px;color:#888">${t}</p>`;
