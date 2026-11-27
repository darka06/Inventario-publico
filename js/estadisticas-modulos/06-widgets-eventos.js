// Panel de Estadísticas - Módulo 6: Eventos de widgets

// al cerrar, la tarjeta del panel se actualiza con el tipo de gráfico elegido
const closeModal = () => {
  closeMenu();
  modal.hidden = true;
  document.body.classList.remove('overflow-hidden');
  if (current?.views || current?.cat) {
    const cardEl = $(`.wd[data-i="${W.indexOf(current)}"]`, root);
    $('.wd-body', cardEl).innerHTML = show(current);
    if (current.views) $('[data-act="view"]', cardEl).innerHTML = svg(current.view);
  }
};

function refresh(btn, body, w) {
  if (btn.classList.contains('spin')) return;      // evita clics repetidos mientras carga

  btn.classList.add('spin');
  body.classList.add('loading');

  // vuelve a pedir los datos a la API y redibuja todo el panel
  Promise.all([load(), new Promise(r => setTimeout(r, 500))]).then(() => {
    redraw();
    if (!modal.hidden && current) $('.wd-body', modal).innerHTML = show(current);
    body.classList.remove('loading', 'reveal');
    void body.offsetWidth;                         // reinicia la animación de entrada
    body.classList.add('reveal');
    btn.classList.remove('spin');
  });
}

// clic en la leyenda: muestra / oculta ese elemento del gráfico
function toggleLegend(li) {
  const wd = li.closest('.wd'), w = wd.classList.contains('wd-big') ? current : W[wd.dataset.i];
  if (!w || !w.hid) return;
  const k = li.dataset.k;
  if (w.hid.has(k)) w.hid.delete(k);
  else if (w.n - w.hid.size > 1) w.hid.add(k);   // siempre queda al menos uno visible
  else return;
  $('.wd-body', wd).innerHTML = show(w);
}

[root, modal].forEach(el => el.addEventListener('keydown', e => {
  const li = e.target.closest('.legend [data-k]');
  if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleLegend(li); }
}));

// menú desplegable de tipo de gráfico
const KINDS = [['bar', 'Barra'], ['pie', 'Circular'], ['line', 'Línea'], ['area', 'Área'],
               ['donut', 'Rosquilla'], ['funnel', 'Embudo'], ['pyramid', 'Pirámide'], ['hbar', 'Barra horizontal']];

const menu = document.createElement('div');
menu.className = 'chart-menu';
menu.hidden = true;
menu.innerHTML = KINDS.map(([k, n]) => `<button type="button" data-kind="${k}">${svg(k)}<span>${n}</span></button>`).join('');
document.body.appendChild(menu);

// menú de columnas de las tablas
const colMenu = document.createElement('div');
colMenu.className = 'col-menu';
colMenu.hidden = true;
document.body.appendChild(colMenu);

let ctx = null, colCtx = null;
const closeMenu = () => { menu.hidden = true; ctx = null; colMenu.hidden = true; colCtx = null; };

function openMenu(btn, body, w) {
  if (ctx && ctx.btn === btn) return closeMenu();
  closeMenu();
  ctx = { btn, body, w };
  menu.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.kind === w.view));
  menu.hidden = false;
  const r = btn.getBoundingClientRect();
  menu.style.setProperty('--menu-top', r.bottom + 8 + 'px');
  menu.style.setProperty('--menu-left', Math.max(8, r.right - 220) + 'px');
}

menu.addEventListener('click', e => {
  const b = e.target.closest('[data-kind]');
  if (!b || !ctx) return;
  const { btn, body, w } = ctx;
  w.setView(b.dataset.kind);
  w.hid?.clear();
  btn.innerHTML = svg(w.view);
  body.innerHTML = show(w);
  body.classList.remove('reveal');
  void body.offsetWidth;
  body.classList.add('reveal');
  closeMenu();
});

/*  Columnas de las tablas  */

const saveCols = w => { const o = colStore.get(); o[w.key] = [...w.on]; colStore.set(o); };

const fillCols = w => {
  colMenu.innerHTML = '<p class="col-title">Columnas visibles</p>'
    + w.cat.map(c => `<label><input type="checkbox" data-k="${esc(c.k)}"${w.on.has(c.k) ? ' checked' : ''}><span>${esc(c.t)}</span></label>`).join('')
    + '<button type="button" class="col-reset">Restablecer</button>';
};

// el = tarjeta (.wd) o ventana ampliada (.wd-big) donde se redibuja la tabla
function openCols(btn, el, w) {
  if (colCtx && colCtx.btn === btn) return closeMenu();
  closeMenu();
  colCtx = { btn, el, w };
  fillCols(w);
  colMenu.hidden = false;
  const r = btn.getBoundingClientRect();
  const menuLeft = Math.max(8, r.right - 220);
  const menuTop = Math.max(8, Math.min(r.bottom + 8, innerHeight - 380 - 8));
  colMenu.style.setProperty('--menu-left', menuLeft + 'px');
  colMenu.style.setProperty('--menu-top', menuTop + 'px');
}

colMenu.addEventListener('change', e => {
  const i = e.target.closest('input[data-k]');
  if (!i || !colCtx) return;
  const { w, el } = colCtx;
  if (i.checked) w.on.add(i.dataset.k);
  else if (w.on.size > 1) w.on.delete(i.dataset.k);
  else { i.checked = true; return; }               // siempre queda al menos una columna
  saveCols(w);
  $('.wd-body', el).innerHTML = show(w);
});

colMenu.addEventListener('click', e => {
  if (!e.target.closest('.col-reset') || !colCtx) return;
  const { w, el } = colCtx;
  w.reset();
  saveCols(w);
  fillCols(w);
  $('.wd-body', el).innerHTML = show(w);
});

document.addEventListener('click', e => {
  if (!e.target.closest('.chart-menu, .col-menu, [data-act="view"], [data-act="table"]')) closeMenu();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
window.addEventListener('scroll', e => { if (!e.target.closest?.('.col-menu')) closeMenu(); }, true);
