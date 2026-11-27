// Cliente HTTP compartido por los módulos conectados a MySQL.
// También se encarga de la sesión: si no hay login redirige a pages/login.html
// y si el usuario no tiene permiso para la página actual muestra un aviso.
// La CSP no permite style="..." ni <style> escritos como texto (style-src 'self').
// Las plantillas del JS escriben data-s="..." y aquí se aplica por CSSOM (element.style),
// que la CSP sí permite. Se ejecuta una vez por elemento y retira el atributo.
(() => {
  const apply = node => {
    if (node.nodeType !== 1 || !node.hasAttribute('data-s')) return;
    node.style.cssText = node.getAttribute('data-s');
    node.removeAttribute('data-s');
  };
  const run = root => {
    apply(root);
    if (root.querySelectorAll) root.querySelectorAll('[data-s]').forEach(apply);
  };
  new MutationObserver(list => list.forEach(m => m.addedNodes.forEach(run)))
    .observe(document.documentElement, { childList: true, subtree: true });
  run(document.documentElement);
  window.inventarioApplyStyles = run;
})();

(() => {
  const root = document.body.dataset.root || '';
  const base = `${root}api/index.php`;
  const isPublic = document.body.dataset.public === 'true';
  const CACHE_KEY = 'inventario.session';

  // Página (data-page) => permiso necesario para abrirla.
  const PAGE_PERMISSION = {
    it: 'dashboard.ver', estadisticas: 'estadisticas.ver', assets: 'activos.ver',
    consumables: 'insumos.ver', tools: ['herramientas.ver', 'inventario.ver'], 'asset-loan': 'prestamos.ver',
    purchases: 'compras.ver', inventario: 'inventario.ver', usuario: 'inventario.ver',
    categories: 'categorias.ver', brands: 'marcas.ver', clients: 'contactos.ver',
    suppliers: 'contactos.ver', funcionarios: 'funcionarios.ver', movements: 'movimientos.ver',
    history: 'historial.ver', accesos: 'accesos.ver',
  };

  const cache = {
    get() { try { return JSON.parse(sessionStorage.getItem(CACHE_KEY)); } catch { return null; } },
    set(account) { try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(account)); } catch { /* sin almacenamiento */ } },
    clear() { try { sessionStorage.removeItem(CACHE_KEY); } catch { /* sin almacenamiento */ } },
  };

  function goToLogin() {
    cache.clear();
    const next = `${location.pathname}${location.search}`;
    location.replace(`${root}pages/login.html?next=${encodeURIComponent(next)}`);
  }

  async function request(query, options = {}) {
    let response;
    try {
      const headers = { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) };
        // Agregar token CSRF a los POST (excepto auth.login y auth.setup, que aún no tienen sesión)
        if (options.method === 'POST' && !query.includes('action=auth.login') && !query.includes('action=auth.setup')) {
        const session = cache.get();
        if (session && session.csrfToken) {
          headers['X-CSRF-Token'] = session.csrfToken;
        }
      }
      response = await fetch(`${base}${query}`, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers,
        ...options,
      });
    } catch (error) {
      throw new Error(`No se pudo contactar la API PHP (${error.message}). Abre la aplicación desde Apache/XAMPP.`);
    }

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error('La API no devolvió JSON. Verifica que estás usando Apache/PHP, no Live Server.');
    }
    if (response.status === 401 && result.code === 'auth' && !isPublic) goToLogin();
    if (!response.ok) throw new Error(`${result.error || `Error HTTP ${response.status}.`}${result.detail ? ` — ${result.detail}` : ''}`);
    return result;
  }

  const can = permission => {
    const account = cache.get();
    return !!account && account.permissions.includes(permission);
  };

  function showDenied() {
    const box = document.createElement('div');
    box.setAttribute('role', 'alert');
    box.className = 'permission-denied';
    const inner = document.createElement('div');
    inner.className = 'permission-denied-inner';
    const title = document.createElement('h2');
    title.textContent = 'No tienes permiso para ver esta página';
    title.className = 'permission-denied-title';
    const text = document.createElement('p');
    text.textContent = 'Tu rol no incluye acceso a este módulo. Si lo necesitas, pídele a un administrador que lo active.';
    text.className = 'permission-denied-text';
    const link = document.createElement('a');
    link.href = `${root}index.html`;
    link.textContent = 'Volver al inicio';
    link.className = 'permission-denied-link';
    inner.append(title, text);
    if (document.body.dataset.page !== 'it') inner.append(link);
    box.append(inner);
    document.body.append(box);
  }

  const sessionReady = isPublic ? Promise.resolve(null) : request('?resource=session').then(result => {
    if (!result.authenticated) { goToLogin(); return null; }
    const before = cache.get();
    // Guardar cuenta con token CSRF
    const accountWithToken = { ...result.account, csrfToken: result.csrfToken };
    cache.set(accountWithToken);
    // Si un administrador cambió los permisos desde el último menú dibujado, recarga una vez.
    if (before && JSON.stringify(before.permissions) !== JSON.stringify(result.account.permissions)) {
      location.reload();
      return result.account;
    }
    const needed = PAGE_PERMISSION[document.body.dataset.page];
    if (needed && ![].concat(needed).some(item => result.account.permissions.includes(item))) showDenied();
    return result.account;
  }).catch(() => null);

  // Skeletons: marcadores de carga que imitan la forma del contenido mientras llegan los datos de la API.
  const sk = (className, width, height) => {
    const node = document.createElement('span');
    node.className = `sk sk-dim ${className || ''}`.trim();
    if (width) node.style.setProperty('--sk-width', width);
    if (height) node.style.setProperty('--sk-height', height);
    return node;
  };
  const skBox = (tag, className, label) => {
    const node = document.createElement(tag);
    node.className = className;
    node.setAttribute('aria-busy', 'true');
    if (label) node.setAttribute('aria-label', label);
    return node;
  };
  const WIDTHS = ['62%', '78%', '48%', '70%', '55%', '84%', '40%'];
  const pick = (index, offset = 0) => WIDTHS[(index + offset) % WIDTHS.length];

  window.inventarioSkeleton = Object.freeze({
    // Tarjetas de resumen (mismo contenedor que .module-summary).
    stats(count = 3) {
      const box = skBox('section', 'module-summary', 'Cargando resumen');
      for (let i = 0; i < count; i += 1) {
        const item = document.createElement('article');
        item.className = 'module-stat';
        item.append(sk('', pick(i, 1), '14px'), sk('', '42px', '22px'));
        box.append(item);
      }
      return box;
    },
    // Tabla con cabecera y filas de barras.
    table(columns = 6, rows = 8) {
      const records = skBox('section', 'module-records', 'Cargando registros');
      const wrap = document.createElement('div');
      wrap.className = 'module-table-wrap';
      const table = document.createElement('table');
      table.className = 'module-table sk-table';
      const head = document.createElement('tr');
      for (let c = 0; c < columns; c += 1) {
        const th = document.createElement('th');
        th.append(sk('', pick(c, 2), '11px'));
        head.append(th);
      }
      const thead = document.createElement('thead');
      thead.append(head);
      const tbody = document.createElement('tbody');
      for (let r = 0; r < rows; r += 1) {
        const tr = document.createElement('tr');
        for (let c = 0; c < columns; c += 1) {
          const td = document.createElement('td');
          td.append(sk('', pick(r + c, c), '13px'));
          tr.append(td);
        }
        tbody.append(tr);
      }
      table.append(thead, tbody);
      wrap.append(table);
      records.append(wrap);
      return records;
    },
    // Rejilla de tarjetas (vista "Tarjetas").
    cards(count = 6, columns = 2) {
      const grid = skBox('div', 'module-card-grid', 'Cargando registros');
      grid.style.setProperty('--module-card-columns', String(columns));
      for (let i = 0; i < count; i += 1) {
        const card = document.createElement('article');
        card.className = 'card module-record-card sk-card';
        card.append(sk('', pick(i), '20px'), sk('', '90%', '12px'), sk('', pick(i, 3), '12px'), sk('', '35%', '12px'));
        grid.append(card);
      }
      return grid;
    },
    // Lista de filas con avatar (funcionarios, técnicos, cuentas).
    list(count = 5) {
      const box = skBox('div', 'sk-list', 'Cargando');
      for (let i = 0; i < count; i += 1) {
        const row = document.createElement('div');
        row.className = 'sk-row';
        const lines = document.createElement('div');
        lines.className = 'sk-lines';
        lines.append(sk('', pick(i), '15px'), sk('', pick(i, 4), '11px'));
        row.append(sk('sk-circle'), lines);
        box.append(row);
      }
      return box;
    },
    // Bloque rectangular genérico (gráficos, widgets).
    block(height = '120px') {
      const box = skBox('div', 'sk-block', 'Cargando');
      box.style.setProperty('--sk-block-height', height);
      return box;
    },
  });

  // ---------------------------------------------------------------------------
  // Motivo obligatorio: modificar o eliminar exige explicar el porqué.
  // El servidor es quien lo exige de verdad; esto solo evita idas y vueltas al usuario.
  // ---------------------------------------------------------------------------
  const REASON_MIN = 10;
  const REASON_MAX = 500;
  const REASON_DELETE = ['asset.delete', 'category.delete', 'contact.delete', 'user.delete', 'tool.delete', 'supply.delete', 'role.delete', 'account.delete'];
  const REASON_UPDATE = ['contact.update', 'user.update', 'tool.update', 'brand.rename'];
  const REASON_SAVE_WITH_ID = ['asset.save', 'category.save', 'supply.save', 'role.save', 'account.save'];

  function reasonKind(action, payload) {
    if (REASON_DELETE.includes(action)) return 'delete';
    if (REASON_UPDATE.includes(action)) return 'edit';
    const id = payload && payload.id;
    if (REASON_SAVE_WITH_ID.includes(action) && id !== undefined && id !== null && id !== '') return 'edit';
    return null;
  }

  const REASON_CSS = `
    .inventario-reason{position:fixed;inset:0;z-index:3500;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.55);font-family:"Lato","Segoe UI",Arial,sans-serif}
    .inventario-reason-box{width:min(480px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.35);color:#1f2937}
    .inventario-reason-head{padding:18px 22px 6px}
    .inventario-reason-head h2{margin:0;font-size:19px;line-height:1.3}
    .inventario-reason-head p{margin:6px 0 0;font-size:14px;line-height:1.45;color:#6b7280}
    .inventario-reason-body{padding:10px 22px 4px}
    .inventario-reason-body label{display:block;margin-bottom:6px;font-size:13px;font-weight:700;color:#333}
    .inventario-reason-body textarea{display:block;width:100%;min-height:96px;resize:vertical;padding:10px 12px;border:1px solid #d5d9e0;border-radius:6px;font:inherit;font-size:14px;color:#1f2937;box-sizing:border-box}
    .inventario-reason-body textarea:focus{outline:2px solid #2f66dd;outline-offset:-1px;border-color:transparent}
    .inventario-reason-meta{display:flex;justify-content:space-between;gap:10px;margin-top:6px;font-size:12px;color:#6b7280}
    .inventario-reason-meta .is-error{color:#c0391b}
    .inventario-reason-foot{display:flex;justify-content:flex-end;gap:10px;padding:14px 22px 20px}
    .inventario-reason-foot button{height:36px;padding:0 16px;border-radius:4px;font:inherit;font-weight:700;cursor:pointer}
    .inventario-reason-cancel{border:1px solid #e3e6ea;background:#fff;color:#444}
    .inventario-reason-cancel:hover{background:#f4f5f7}
    .inventario-reason-ok{border:0;background:#2f66dd;color:#fff}
    .inventario-reason-ok:hover:not(:disabled){background:#2756c0}
    .inventario-reason-ok.is-danger{background:#c0391b}
    .inventario-reason-ok.is-danger:hover:not(:disabled){background:#a22f16}
    .inventario-reason-ok:disabled{opacity:.45;cursor:not-allowed}
  `;

  let reasonStyleReady = false;

  // Abre la ventana del motivo. Devuelve una promesa con el texto, o null si se cancela.
  function askReason(options = {}) {
    const { title = 'Motivo del cambio', message = '', confirmLabel = 'Continuar', danger = false } = options;
    if (!reasonStyleReady) {
      reasonStyleReady = true;
      try {
        // Hoja construida por CSSOM: la CSP (style-src 'self') no la bloquea.
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(REASON_CSS);
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      } catch {
        // Navegador sin hojas construibles: solo funciona si la CSP permite estilos en línea.
        const style = document.createElement('style');
        style.id = 'inventario-reason-style';
        style.textContent = REASON_CSS;
        document.head.append(style);
      }
    }
    return new Promise(resolve => {
      const previousFocus = document.activeElement;
      const overlay = document.createElement('div');
      overlay.className = 'inventario-reason';
      const box = document.createElement('div');
      box.className = 'inventario-reason-box';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-labelledby', 'inventario-reason-title');

      const head = document.createElement('div');
      head.className = 'inventario-reason-head';
      const heading = document.createElement('h2');
      heading.id = 'inventario-reason-title';
      heading.textContent = title;
      head.append(heading);
      if (message) {
        const note = document.createElement('p');
        note.textContent = message;
        head.append(note);
      }

      const body = document.createElement('div');
      body.className = 'inventario-reason-body';
      const label = document.createElement('label');
      label.htmlFor = 'inventario-reason-text';
      label.textContent = 'Motivo (obligatorio)';
      const area = document.createElement('textarea');
      area.id = 'inventario-reason-text';
      area.maxLength = REASON_MAX;
      area.placeholder = 'Explica por qué se hace este cambio. Quedará guardado en el historial con tu usuario.';
      const meta = document.createElement('div');
      meta.className = 'inventario-reason-meta';
      const hint = document.createElement('span');
      const counter = document.createElement('span');
      meta.append(hint, counter);
      body.append(label, area, meta);

      const foot = document.createElement('div');
      foot.className = 'inventario-reason-foot';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'inventario-reason-cancel';
      cancel.textContent = 'Cancelar';
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = `inventario-reason-ok${danger ? ' is-danger' : ''}`;
      ok.textContent = confirmLabel;
      foot.append(cancel, ok);
      box.append(head, body, foot);
      overlay.append(box);

      const clean = () => area.value.replace(/\s+/g, ' ').trim();
      const refresh = () => {
        const length = clean().length;
        const valid = length >= REASON_MIN;
        ok.disabled = !valid;
        hint.textContent = valid ? '' : `Escribe al menos ${REASON_MIN} caracteres.`;
        hint.classList.toggle('is-error', !valid && length > 0);
        counter.textContent = `${length}/${REASON_MAX}`;
      };

      let closed = false;
      const finish = value => {
        if (closed) return;
        closed = true;
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
        if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
        resolve(value);
      };
      const submit = () => { if (clean().length >= REASON_MIN) finish(clean()); };
      // En fase de captura, para que Escape cierre solo esta ventana y no el formulario de atrás.
      function onKey(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation();
          finish(null);
        } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          submit();
        } else if (event.key === 'Tab') {
          const items = [area, cancel, ok].filter(node => !node.disabled);
          const first = items[0];
          const last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }

      area.addEventListener('input', refresh);
      cancel.addEventListener('click', () => finish(null));
      ok.addEventListener('click', submit);
      overlay.addEventListener('mousedown', event => { if (event.target === overlay) finish(null); });
      document.addEventListener('keydown', onKey, true);
      document.body.append(overlay);
      refresh();
      area.focus();
    });
  }

  function cancelledError() {
    const error = new Error('Operación cancelada: no se guardó ningún cambio.');
    error.cancelled = true;
    return error;
  }

  window.inventarioApi = Object.freeze({
    get(resource) {
      return request(`?resource=${encodeURIComponent(resource)}`);
    },
    // Si la acción modifica o elimina y aún no trae motivo, lo pide aquí antes de enviar.
    // Si la persona cancela, lanza un error con `cancelled = true` (no es un fallo: no se hizo nada).
    async post(action, payload = {}) {
      let body = payload;
      const kind = reasonKind(action, payload);
      if (kind && !String(payload.justification || '').trim()) {
        const reason = await askReason(kind === 'delete'
          ? { title: 'Motivo de la eliminación', message: 'Esta acción no se puede deshacer. Explica por qué se elimina este registro.', confirmLabel: 'Eliminar', danger: true }
          : { title: 'Motivo de la modificación', message: 'Explica por qué se modifica este registro antes de guardar los cambios.', confirmLabel: 'Guardar cambios' });
        if (reason === null) throw cancelledError();
        body = { ...payload, justification: reason };
      }
      return request(`?action=${encodeURIComponent(action)}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    askReason,
    session: sessionReady,
    can,
    saveSession: account => cache.set(account),
    async logout() {
      try { await request('?action=auth.logout', { method: 'POST', body: '{}' }); } catch { /* ya sin sesión */ }
      cache.clear();
      location.replace(`${root}pages/login.html`);
    },
  });
})();