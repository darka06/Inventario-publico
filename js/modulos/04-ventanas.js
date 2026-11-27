// ===== Ventanas flotantes =====
  // Cada detalle, formulario o historial es una ventana independiente: no hay fondo que bloquee la página,
  // se mueve arrastrando el título, sube al frente al tocarla y puede haber varias abiertas a la vez.
  const Floating = window.InventarioWindows || { enableDrag() {}, clamp() {}, setShift() {} };
  const wins = [];            // ventanas abiertas, de atrás hacia delante
  let zTop = 1000;
  let winSeq = 0;
  let formWin = null;         // ventana de formulario activa: fija formModal / form / fields para el código de cada formulario
  let pendingSubmit = null;   // ventana cuyo guardado está en curso (closeForm() sin argumentos cierra esta)
  let ctxDetail = null;       // detalle desde el que se lanzó la acción en curso (closeDetail() sin argumentos cierra este)
  let formKeyHint = null;     // clave del registro que se edita: evita abrir dos veces el mismo formulario
  let pendingSource = null;   // registro que abre el detalle: sirve para no duplicarlo y para refrescarlo
  let refreshTarget = null;
  let detailOrigin = null;    // fila o tarjeta pulsada que abrió el detalle (origen de la animación)
  let listCounter = 0;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const winOf = element => wins.find(win => win.el.contains(element));

  function useForm(win) {
    formWin = win && win.open ? win : null;
    formModal = formWin ? formWin.el : null;
    form = formWin ? formWin.form : null;
    fields = formWin ? formWin.fields : null;
  }

  function raise(win) {
    if (!win.open) return;
    const index = wins.indexOf(win);
    if (index !== wins.length - 1) { wins.splice(index, 1); wins.push(win); }
    if (zTop >= 1900) {
      zTop = 1000;
      wins.forEach(item => { item.el.style.zIndex = String(++zTop); });
    } else {
      win.el.style.zIndex = String(++zTop);
    }
    wins.forEach(item => item.box.classList.toggle('is-top', item === win));
    if (win.kind === 'form') useForm(win);
  }

  // Parpadeo breve para señalar una ventana que ya estaba abierta.
  function flash(win) {
    win.box.classList.remove('win-flash');
    void win.box.offsetWidth;
    win.box.classList.add('win-flash');
    window.setTimeout(() => win.box.classList.remove('win-flash'), 800);
  }

  function createWindow(kind, template, key = null) {
    const el = template.cloneNode(true);
    el.removeAttribute('id');
    el.hidden = false;
    el.classList.add('float-layer');
    const box = el.querySelector('.modal-box');
    const title = el.querySelector('.modal-head h2');
    const titleId = `win-title-${++winSeq}`;
    title.id = titleId;
    box.setAttribute('aria-labelledby', titleId);
    box.setAttribute('aria-modal', 'false');   // la página de atrás sigue siendo utilizable
    const win = {
      kind, key, el, box, title, open: true, closing: false, anims: [], origin: null, source: null, parentDetail: null, onSubmit: null,
      head: el.querySelector('.modal-head'),
      body: el.querySelector('.modal-body'),
      form: el.querySelector('form'),
      fields: el.querySelector('.form-grid'),
    };
    el.addEventListener('pointerdown', () => raise(win), true);
    el.addEventListener('focusin', () => raise(win));
    el.querySelector('.modal-close').addEventListener('click', () => closeWindow(win, true));
    // Cada ventana nueva se abre un poco desplazada de la anterior para que se vean todas.
    const step = (wins.length % 7) * 26;
    Floating.setShift(box, step, step);
    document.body.append(el);
    wins.push(win);
    raise(win);
    Floating.enableDrag(box);
    Floating.clamp(box);
    return win;
  }

  function removeWindow(win) {
    if (!win.open) return;
    win.open = false;
    stopWinAnim(win);
    const index = wins.indexOf(win);
    if (index >= 0) wins.splice(index, 1);
    win.el.remove();
    if (ctxDetail === win) ctxDetail = null;
    if (formWin === win) useForm([...wins].reverse().find(item => item.kind === 'form') || null);
    const top = wins[wins.length - 1];
    wins.forEach(item => item.box.classList.toggle('is-top', item === top));
  }

  function closeWindow(win, animate = false) {
    if (!win || !win.open) return;
    if (win.kind === 'detail') closeDetail(animate, win);
    else removeWindow(win);
  }

  function openForm(title, setup, submit) {
    const key = formKeyHint;
    formKeyHint = null;
    const open = key && wins.find(item => item.kind === 'form' && item.key === key);
    if (open) { raise(open); flash(open); return; }
    const win = createWindow('form', formTemplate, key);
    win.parentDetail = ctxDetail && ctxDetail.open ? ctxDetail : null;
    win.onSubmit = submit;
    win.title.textContent = title;
    win.box.classList.add('module-form-modal');
    win.form.addEventListener('submit', event => {
      event.preventDefault();
      if (!win.form.reportValidity()) return;
      useForm(win);
      if (!win.onSubmit) return;
      pendingSubmit = win;
      const values = Object.fromEntries(new FormData(win.form).entries());
      let result;
      try {
        result = win.onSubmit(values);
      } catch (error) {
        pendingSubmit = null;
        throw error;
      }
      Promise.resolve(result)
        .catch(error => { if (!error.cancelled) showNotice(error.message, true); })
        .finally(() => { if (pendingSubmit === win) pendingSubmit = null; });
    });
    win.el.querySelectorAll('[data-close]').forEach(control => control.addEventListener('click', () => closeForm(win)));
    useForm(win);
    try {
      setup();
    } catch (error) {
      removeWindow(win);
      throw error;
    }
    Floating.clamp(win.box);
    const first = win.fields.querySelector('input, select, textarea');
    if (first) first.focus();
  }

  // Sin argumentos cierra el formulario que se está guardando o, si no, el último que se usó.
  function closeForm(win) {
    const target = win || (pendingSubmit && pendingSubmit.open ? pendingSubmit : formWin);
    if (target) removeWindow(target);
  }

  // Ventana de historial (se abre desde un detalle). Si ya está abierta solo se trae al frente.
  function openHistoryWindow(key, title, content) {
    let win = wins.find(item => item.kind === 'history' && item.key === key);
    if (!win) {
      const template = document.createElement('div');
      template.className = 'modal history-modal';
      template.innerHTML = '<div class="modal-box detail-history-box" role="dialog">'
        + '<header class="modal-head"><h2></h2><button type="button" class="modal-close" aria-label="Cerrar">✕</button></header>'
        + '<div class="modal-body"></div></div>';
      win = createWindow('history', template, key);
    }
    win.title.textContent = title;
    win.body.replaceChildren(content);
    raise(win);
  }

  // Historial de cambios (crear / modificar / eliminar) de un registro, tomado del registro de cambios.
  const RECORD_HISTORY = {
    'category-history': { list: () => data.categories, module: () => 'Categorías', label: item => item.name },
    'brand-history': { list: () => data.brands, module: () => 'Marcas', label: item => item.name },
    'user-history': { list: () => data.users, module: () => 'Funcionarios', label: item => item.nombre },
    'tool-history': { list: () => data.tools, module: () => 'Herramientas', label: item => item.name },
    'contact-history': {
      list: () => data.contacts,
      module: item => (item.type === 'Proveedor' ? 'Proveedores' : 'Clientes'),
      label: item => item.name,
    },
  };

  async function openRecordHistory(action, id) {
    const kind = RECORD_HISTORY[action];
    const item = kind && kind.list().find(entry => entry.id === id);
    if (!item) return;
    const moduleName = kind.module(item);
    const numericId = String(id).replace(/^\D+:/, '');
    let changes;
    try {
      changes = (await window.inventarioApi.get('changes')).changes || [];
    } catch (error) {
      return showNotice(error.message, true);
    }
    openHistoryWindow(`${action}:${id}`, `Historial · ${kind.label(item)}`, detailTimeline('Últimos cambios', changes
      .filter(change => change.module === moduleName && String(change.recordId) === numericId)
      .map(change => ({
        date: change.date,
        title: `${change.action} · ${change.operation}`,
        description: [change.user, deviceName(change.device), change.justification && `Motivo: ${change.justification}`].filter(Boolean).join(' · '),
      })), 'Sin cambios registrados para este registro.', 10));
  }

  function openAssetHistory(id) {
    const asset = data.assets.find(item => item.id === id);
    if (!asset) return;
    openHistoryWindow(`asset-history:${id}`, `Historial de estados · ${asset.code}`, detailTimeline('Últimos cambios de estado', (asset.history || []).map(entry => ({
      date: entry.date,
      title: `${entry.from || '—'} → ${entry.to}`,
      description: entry.note,
    })), 'Sin cambios de estado registrados.', 10));
  }