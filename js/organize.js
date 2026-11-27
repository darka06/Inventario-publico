// Organizar widgets: columnas, orden y eliminar

(() => {
  const trigger = document.getElementById('organize-widgets');
  const bar     = document.getElementById('org-bar');
  const actions = document.querySelector('.head-actions');
  const dash    = document.getElementById('dash');
  const sel     = document.getElementById('org-cols');
  if (!trigger || !bar || !actions || !dash || !sel) return;

  const KEY_COLS = 'dash-cols', KEY_ORDER = 'dash-order';
  const store = {
    get(k)    { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  };

  const DEL = '<button type="button" class="wd-del" aria-label="Eliminar widget"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';

  const apply = n => {
    dash.classList.remove('dash-cols-1', 'dash-cols-2', 'dash-cols-3', 'dash-cols-4', 'dash-cols-5');
    dash.classList.add(`dash-cols-${n}`);
  };

  // todas las tarjetas (para poder restaurar las eliminadas al cancelar)
  const cards   = new Map([...dash.children].map(c => [c.dataset.i, c]));
  const layout  = order => dash.replaceChildren(...order.map(i => cards.get(i)).filter(Boolean));
  const current = () => [...dash.children].map(c => c.dataset.i);

  let savedCols  = store.get(KEY_COLS) || '2';
  let savedOrder = current();
  try {
    const o = JSON.parse(store.get(KEY_ORDER) || 'null');
    if (Array.isArray(o)) savedOrder = o.map(String).filter(i => cards.has(i));
  } catch { /* JSON inválido: se ignora */ }

  apply(savedCols);
  layout(savedOrder);

  // animación suave al mover / eliminar
  function flip(change) {
    const list  = [...dash.children];
    const first = new Map(list.map(c => [c, c.getBoundingClientRect()]));
    change();
    list.forEach(c => {
      if (!c.isConnected) return;
      const a = first.get(c), b = c.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (dx || dy) c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 220, easing: 'ease' });
    });
  }

  const startEdit = () => {
    dash.classList.add('organizing');
    [...dash.children].forEach(c => {
      c.draggable = true;
      if (!c.querySelector('.wd-del')) c.insertAdjacentHTML('beforeend', DEL);
    });
  };

  const endEdit = () => {
    dash.classList.remove('organizing');
    cards.forEach(c => {
      c.draggable = false;
      c.classList.remove('dragging');
      c.querySelector('.wd-del')?.remove();
    });
  };

  const open = () => {
    sel.value = savedCols;
    startEdit();
    actions.hidden = true;
    bar.hidden = false;
  };

  const close = () => {
    endEdit();
    bar.hidden = true;
    actions.hidden = false;
  };

  trigger.addEventListener('click', open);
  sel.addEventListener('change', () => apply(sel.value));          // vista previa

  document.getElementById('org-save').addEventListener('click', () => {
    savedCols  = sel.value;
    savedOrder = current();
    store.set(KEY_COLS, savedCols);
    store.set(KEY_ORDER, JSON.stringify(savedOrder));
    close();
    fillNew();
  });

  const cancel = () => { apply(savedCols); layout(savedOrder); close(); };
  document.getElementById('org-cancel').addEventListener('click', cancel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !bar.hidden) cancel(); });

  /*  Nuevo: agregar al panel los widgets que no están  */

  const newBtn  = document.getElementById('btn-new');
  const newMenu = document.getElementById('new-widgets');

  // "Crear widget" y, debajo, los widgets que no están en el panel para restaurarlos
  const PLUS = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  const title = c => c.querySelector('h2').textContent;

  const fillNew = () => {
    if (!newMenu) return;
    const shown  = new Set(current());
    const hidden = [...cards].filter(([i]) => !shown.has(i));
    newMenu.innerHTML = `<li><a role="menuitem" href="#" data-create>${PLUS} Crear widget…</a></li>`
      + (hidden.length ? '<li class="new-sep" role="separator"></li><li class="new-head" role="presentation">Restaurar eliminados</li>' : '')
      + hidden.map(([i, c]) => c.hasAttribute('data-custom')
          ? `<li class="new-row"><a role="menuitem" href="#" data-add="${i}">${title(c)}</a><button type="button" class="new-del" data-del="${i}" aria-label="Eliminar definitivamente">×</button></li>`
          : `<li><a role="menuitem" href="#" data-add="${i}">${title(c)}</a></li>`).join('');
  };

  // pone una tarjeta al final del panel y guarda el orden
  const place = card => {
    dash.append(card);
    card.animate([{ opacity: 0, transform: 'scale(.95)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease' });
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    savedOrder = current();
    store.set(KEY_ORDER, JSON.stringify(savedOrder));
    fillNew();
  };

  if (newMenu) {
    fillNew();
    newBtn.addEventListener('click', fillNew);

    newMenu.addEventListener('click', e => {
      const del = e.target.closest('[data-del]');
      if (del) {                                                   // eliminar definitivamente un widget creado
        const card = cards.get(del.dataset.del);
        if (!card || !confirm(`¿Eliminar definitivamente el widget «${card.querySelector('h2').textContent}»?`)) return;
        cards.delete(del.dataset.del);
        dash.dispatchEvent(new CustomEvent('wd:purge', { detail: del.dataset.del }));
        fillNew();
        return;
      }
      const link = e.target.closest('[data-add]');                 // restaurar uno eliminado
      const card = link && cards.get(link.dataset.add);
      if (!card) return;
      dash.dispatchEvent(new CustomEvent('wd:added', { detail: card }));   // estadisticas.js redibuja su contenido
      place(card);
    });

    // widget recién creado: estadisticas.js ya lo agregó al panel
    dash.addEventListener('wd:created', e => {
      cards.set(e.detail.dataset.i, e.detail);
      place(e.detail);
    });
  }

  /*  Eliminar  */

  dash.addEventListener('click', e => {
    const btn = e.target.closest('.wd-del');
    if (!btn) return;
    const card = btn.closest('.wd');
    card.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.9)' }], { duration: 180, easing: 'ease' })
        .onfinish = () => flip(() => card.remove());
  });

  /*  Mover (arrastrar y soltar)  */

  let drag = null, lock = false;

  dash.addEventListener('dragstart', e => {
    const card = e.target.closest('.wd');
    if (!card || !dash.classList.contains('organizing')) return;
    drag = card;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.i);
  });

  dash.addEventListener('dragover', e => {
    if (!drag) return;
    e.preventDefault();
    const over = e.target.closest('.wd');
    if (lock || !over || over === drag) return;
    const kids  = [...dash.children];
    const after = kids.indexOf(drag) < kids.indexOf(over);
    flip(() => dash.insertBefore(drag, after ? over.nextSibling : over));
    lock = true;
    setTimeout(() => { lock = false; }, 230);                      // evita rebotes mientras anima
  });

  dash.addEventListener('drop', e => e.preventDefault());

  dash.addEventListener('dragend', () => {
    if (drag) drag.classList.remove('dragging');
    drag = null;
  });
})();