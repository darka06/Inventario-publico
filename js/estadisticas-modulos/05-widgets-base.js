// Panel de Estadísticas - Módulo 5: Base de widgets

// Array de widgets (se llena en 09-widgets-definicion.js)
const W = [];

// widget de gráfico: guarda qué elementos de la leyenda están ocultos
const cw = (t, data, view, field = null) => {
  const savedViews = viewStore.get();
  const savedView = savedViews[t] || view;
  const w = { t, views: 1, view: savedView, hid: new Set(), data, field };
  Object.defineProperty(w, 'n', { get: () => data().length });
  w.body = v => chart(v, data(), w.hid);
  // Guardar los datos agrupados cuando se renderice para poder usarlos después
  w.getGroupedData = () => data();
  // Guardar la vista cuando cambie
  w.setView = (newView) => {
    w.view = newView;
    const views = viewStore.get();
    views[t] = newView;
    viewStore.set(views);
  };
  return w;
};

// widget de tabla: `cat` es el catálogo de columnas (on = visible por defecto, sum:false = sin total)
// y `make()` devuelve { rows, total, none }. Las columnas elegidas se guardan en localStorage.
const KEY_COLS = 'dash-tblcols';
const colStore = {
  get()  { try { return JSON.parse(localStorage.getItem(KEY_COLS)) || {}; } catch { return {}; } },
  set(o) { try { localStorage.setItem(KEY_COLS, JSON.stringify(o)); } catch { /* sin almacenamiento */ } },
};

// Almacenamiento para vistas de gráficos
const KEY_VIEWS = 'dash-views';
const viewStore = {
  get()  { try { return JSON.parse(localStorage.getItem(KEY_VIEWS)) || {}; } catch { return {}; } },
  set(o) { try { localStorage.setItem(KEY_VIEWS, JSON.stringify(o)); } catch { /* sin almacenamiento */ } },
};

const tw = (t, cat, make, key = t, clickableCells = true) => {
  const def = () => new Set(cat.filter(c => c.on).map(c => c.k));
  const s = colStore.get()[key], saved = Array.isArray(s) ? s.filter(k => cat.some(c => c.k === k)) : [];
  const w = { t, key, cat, on: saved.length ? new Set(saved) : def(), reset() { this.on = def(); } };
  w.body = () => {
    const r = make();
    return r.rows.length ? table({ cols: cat.filter(c => w.on.has(c.k)), rows: r.rows, total: r.total, scroll: 1, clickableCells }) : empty(r.none);
  };
  return w;
};

/*  Widgets creados por el usuario (js/estadisticas-custom.js)  */

const SC = window.statsCustom || { SRC: {}, load: () => [], save() {}, rows: () => [], build() {} };
// BASE se define en 09-widgets-definicion.js después de llenar W

// contenido de una tarjeta: carga, error o datos
const SK_HTML = '<div class="sk-lines" data-s="padding:12px;gap:10px" aria-busy="true" aria-label="Cargando"><span class="sk" data-s="width:70%;height:16px"></span><span class="sk" data-s="width:100%;height:12px"></span><span class="sk" data-s="width:85%;height:12px"></span><span class="sk" data-s="width:92%;height:12px"></span><span class="sk" data-s="width:60%;height:12px"></span></div>';
const show = w => D ? w.body(w.period ? w : w.view) : (loadFailed ? empty('No se pudieron cargar los datos') : SK_HTML);
let loadFailed = false;

/*  Tarjetas  */

const ICONS = {
  refresh:  ['Actualizar',        '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>'],
  table:    ['Columnas',           '<rect x="3" y="4" width="14" height="14" rx="1"/><path d="M3 9h14M8 4v14M19 16v6M16 19h6"/>'],
  expand:   ['Pantalla completa', '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'],
  collapse: ['Salir de pantalla completa', '<path d="M9 4v5H4M15 4v5h5M20 15h-5v5M4 15h5v5"/>'],
  pie:      ['Gráfico circular',  '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>'],
  line:     ['Gráfico de líneas', '<path d="M3 20h18M4 15l4-5 4 3 5-7 3 4"/>'],
  bar:      ['Gráfico de barras', '<path d="M5 20V10M12 20V4M19 20v-7"/>'],
  area:     ['Área',              '<path d="M3 20h18M3 16l5-6 4 3 5-7 4 4v12H3z"/>'],
  donut:    ['Rosquilla',         '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'],
  funnel:   ['Embudo',            '<path d="M4 4h16l-6 8v7l-4 2v-9z"/>'],
  pyramid:  ['Pirámide',          '<path d="M12 3l9 17H3zM7.5 12h9"/>'],
  hbar:     ['Barra horizontal',  '<path d="M4 5v14M4 7h12M4 12h16M4 17h8"/>'],
};

const svg = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k][1]}</svg>`;

const icon = (k, w) => `<button type="button" data-act="${k}" aria-label="${k === 'view' ? 'Cambiar tipo de gráfico' : ICONS[k][0]}">${svg(k === 'view' ? w.view : k)}</button>`;

const card = (w, i) => `
  <article class="wd" data-i="${i}"${w.custom ? ' data-custom' : ''}>
    <header class="wd-head">
      <h2>${w.t}</h2>
      ${w.period
        ? '<select class="period" aria-label="Periodo"><option>Esta semana</option><option>Semana pasada</option></select>'
        : `<div class="tools">${['refresh', ...(w.views ? ['view'] : w.cat ? ['table'] : []), 'expand'].map(k => icon(k, w)).join('')}</div>`}
    </header>
    <div class="wd-body">${show(w)}</div>
  </article>`;

/*  Pantalla completa  */

const modal = document.createElement('div');
modal.className = 'wd-modal';
modal.hidden = true;
modal.innerHTML = `
  <div class="wd wd-big">
    <header class="wd-head">
      <h2></h2>
      <div class="tools"></div>
    </header>
    <div class="wd-body"></div>
  </div>`;
document.body.appendChild(modal);

const $ = (sel, el) => el.querySelector(sel);
let current = null;
