// Panel de Estadísticas - Módulo 12: Carga inicial y eventos finales

// Renderizar las tarjetas
root.innerHTML = W.map(card).join('');

/*  Carga de datos  */

const redraw = () => root.querySelectorAll('.wd').forEach(el => { $('.wd-body', el).innerHTML = show(W[el.dataset.i]); });

// selector de periodo (esta semana / semana pasada)
root.addEventListener('change', e => {
  const sel = e.target.closest('.period'); if (!sel) return;
  const wd = sel.closest('.wd'), w = W[wd.dataset.i];
  w.week = sel.selectedIndex;
  $('.wd-body', wd).innerHTML = show(w);
});

// un widget que se vuelve a agregar estuvo fuera del panel: se redibuja con los datos actuales
root.addEventListener('wd:added', e => {
  const el = e.detail;
  $('.wd-body', el).innerHTML = show(W[el.dataset.i]);
});

// Nuevo → Crear widget: el diálogo entrega la definición; se guarda y la tarjeta se agrega al panel
document.getElementById('new-widgets')?.addEventListener('click', e => {
  if (!e.target.closest('[data-create]')) return;
  SC.build(def => {
    const list = SC.load();
    def.n = Math.max(-1, ...list.map(d => d.n)) + 1;
    SC.save([...list, def]);
    const i = BASE + def.n;
    W[i] = mine(def);
    root.insertAdjacentHTML('beforeend', card(W[i], i));
    root.dispatchEvent(new CustomEvent('wd:created', { detail: root.lastElementChild }));
  });
});

// eliminar definitivamente un widget propio (lo pide organize.js desde el menú Nuevo)
root.addEventListener('wd:purge', e => {
  const w = W[e.detail];
  if (!w || !w.custom) return;
  SC.save(SC.load().filter(d => d.id !== w.custom));
  delete W[e.detail];
});

function load() {
  return window.inventarioApi.get('all').then(d => { D = d; loadFailed = false; notice.hidden = true; })
    .catch(e => { loadFailed = !D; notice.textContent = e.message; notice.hidden = false; });
}
load().then(redraw);
