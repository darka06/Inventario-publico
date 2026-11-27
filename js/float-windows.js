// Ventanas movibles: arrastrar una ventana por su título (detalles, formularios, historiales, usuarios...).
// Expone window.InventarioWindows para que modulos.js gestione varias ventanas abiertas a la vez.
(() => {
  const MOBILE = window.matchMedia('(max-width: 800px)');
  const KEEP = 60; // píxeles de la ventana que siempre deben quedar a la vista

  // El desplazamiento se guarda en la propiedad CSS `translate`, que se suma a `transform`
  // (así no choca con las animaciones de apertura y cierre).
  function shiftOf(box) {
    return [parseFloat(box.dataset.dx) || 0, parseFloat(box.dataset.dy) || 0];
  }

  function setShift(box, dx, dy) {
    box.dataset.dx = String(dx);
    box.dataset.dy = String(dy);
    box.style.translate = dx || dy ? `${dx}px ${dy}px` : '';
  }

  // Impide que la ventana se pierda fuera de la pantalla: el título siempre queda alcanzable.
  function clamp(box) {
    if (MOBILE.matches) { setShift(box, 0, 0); return; }
    const [dx, dy] = shiftOf(box);
    const rect = box.getBoundingClientRect();
    const head = box.querySelector('.modal-head');
    const headHeight = head ? head.offsetHeight : 40;
    let fixX = 0;
    let fixY = 0;
    if (rect.left > window.innerWidth - KEEP) fixX = window.innerWidth - KEEP - rect.left;
    else if (rect.right < KEEP) fixX = KEEP - rect.right;
    if (rect.top < 0) fixY = -rect.top;
    else if (rect.top > window.innerHeight - headHeight) fixY = window.innerHeight - headHeight - rect.top;
    if (fixX || fixY) setShift(box, dx + fixX, dy + fixY);
  }

  function startDrag(box, handle, event) {
    if (event.button !== 0 || MOBILE.matches) return;
    if (event.target.closest('button, a, input, select, textarea, label')) return;
    event.preventDefault();
    const [startX, startY] = shiftOf(box);
    const originX = event.clientX;
    const originY = event.clientY;
    handle.setPointerCapture(event.pointerId);
    box.classList.add('is-dragging');
    const move = e => {
      setShift(box, startX + e.clientX - originX, startY + e.clientY - originY);
      clamp(box);
    };
    const stop = () => {
      box.classList.remove('is-dragging');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
      handle.removeEventListener('pointercancel', stop);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  }

  function enableDrag(box, handle = box.querySelector('.modal-head')) {
    if (!handle) return;
    handle.addEventListener('pointerdown', event => startDrag(box, handle, event));
  }

  window.InventarioWindows = { enableDrag, clamp, setShift };

  // Modales clásicos de una sola ventana (con fondo oscuro), p. ej. Accesos o Usuario:
  // también se pueden mover, y vuelven al centro cada vez que se abren.
  document.addEventListener('pointerdown', event => {
    const head = event.target.closest('.modal:not(.float-layer) .modal-head');
    if (!head) return;
    const box = head.closest('.modal-box');
    if (box) startDrag(box, head, event);
  });
  new MutationObserver(records => records.forEach(record => {
    const modal = record.target;
    if (modal.classList && modal.classList.contains('modal') && !modal.classList.contains('float-layer')) {
      const box = modal.querySelector('.modal-box');
      if (box) setShift(box, 0, 0);
    }
  })).observe(document.documentElement, { attributes: true, attributeFilter: ['hidden'], subtree: true });

  window.addEventListener('resize', () => {
    document.querySelectorAll('.float-layer > .modal-box').forEach(clamp);
  });
})();
