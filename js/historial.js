// Historial de cambios: muestra quién/cuándo/qué se creó, modificó o eliminó (tabla registro_cambios).
(() => {
  const root = document.getElementById('history-app');
  if (!root) return;

  const modal = document.getElementById('detail-modal');
  const ACTIONS = ['Creó', 'Modificó', 'Eliminó', 'Movimiento'];
  const BADGE = { 'Creó': 'st-use', 'Modificó': 'st-store', 'Eliminó': 'st-repair', 'Movimiento': '' };
  const LABELS = {
    id: 'ID', code: 'Código', name: 'Nombre', description: 'Descripción', brand: 'Marca', serial: 'Serial',
    quantity: 'Cantidad', status: 'Estado', responsibleId: 'Responsable (ID)', category: 'Categoría', model: 'Modelo',
    purchaseDate: 'Fecha de compra', cost: 'Costo', assignedTo: 'Asignado a', client: 'Cliente', notes: 'Observaciones',
    note: 'Observaciones', unit: 'Unidad', stock: 'Stock', minimum: 'Stock mínimo', unitCost: 'Costo unitario',
    person: 'Persona', date: 'Fecha', dueDate: 'Fecha de devolución', type: 'Tipo', assetId: 'Activo (ID)',
    supplyId: 'Insumo (ID)', supplier: 'Proveedor', invoice: 'Factura', total: 'Total', nit: 'NIT / documento',
    email: 'Correo', phone: 'Teléfono', address: 'Dirección', cargo: 'Cargo', area: 'Área',
  };

  let changes = [];
  let search = '';
  let action = '';
  let module = '';
  let from = '';
  let to = '';
  let page = 1;
  let pageSize = 20;
  let message = 'Cargando historial…';
  let failed = false;

  const norm = value => String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

  function el(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content != null) node.textContent = content;
    return node;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (isNaN(date.getTime())) return value || '—';
    return date.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // "Chrome en Windows" a partir del User-Agent, para que sea legible.
  function deviceName(agent) {
    if (!agent) return '';
    const browser = /Edg\//.test(agent) ? 'Edge' : /OPR\/|Opera/.test(agent) ? 'Opera' : /Firefox\//.test(agent) ? 'Firefox'
      : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : 'Navegador';
    const system = /Windows/.test(agent) ? 'Windows' : /Android/.test(agent) ? 'Android' : /iPhone|iPad/.test(agent) ? 'iOS'
      : /Mac OS/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : '';
    return system ? `${browser} en ${system}` : browser;
  }

  function filtered() {
    return changes.filter(change => {
      if (action && change.action !== action) return false;
      if (module && change.module !== module) return false;
      const day = String(change.date || '').slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      const query = norm(search);
      return !query || [change.action, change.module, change.operation, change.record, change.ip, deviceName(change.device)]
        .some(value => norm(value).includes(query));
    });
  }

  function select(label, value, options, onChange) {
    const control = el('select');
    control.setAttribute('aria-label', label);
    const first = el('option', '', label);
    first.value = '';
    control.append(first);
    options.forEach(option => {
      const item = el('option', '', option);
      item.value = option;
      control.append(item);
    });
    control.value = value;
    control.addEventListener('change', () => { onChange(control.value); page = 1; render(); });
    return control;
  }

  function dateInput(label, value, onChange) {
    const wrap = el('label', 'history-date', `${label} `);
    const input = el('input');
    input.type = 'date';
    input.value = value;
    input.addEventListener('change', () => { onChange(input.value); page = 1; render(); });
    wrap.append(input);
    return wrap;
  }

  function fieldRows(parent, title, object) {
    const entries = Object.entries(object || {}).filter(([, value]) => value !== null && value !== '');
    if (!entries.length) return;
    const section = el('section', 'detail-section');
    section.append(el('h3', 'section-title', title));
    const grid = el('div', 'detail-grid');
    entries.forEach(([key, value]) => {
      const item = el('div', 'eq-field');
      const copy = el('div', 'detail-field-copy');
      copy.append(el('span', 'eq-label', LABELS[key] || key), el('span', 'eq-value', typeof value === 'object' ? JSON.stringify(value) : String(value)));
      item.append(copy);
      grid.append(item);
    });
    section.append(grid);
    parent.append(section);
  }

  function openDetail(change) {
    const content = el('div', 'detail-content');
    const info = {
      Fecha: formatDate(change.date), Acción: change.action, Módulo: change.module, Operación: change.operation,
      Registro: change.record, 'Dirección IP': change.ip, Equipo: deviceName(change.device),
    };
    const section = el('section', 'detail-section');
    section.append(el('h3', 'section-title', 'Resumen'));
    const grid = el('div', 'detail-grid');
    Object.entries(info).forEach(([label, value]) => {
      if (!value) return;
      const item = el('div', 'eq-field');
      const copy = el('div', 'detail-field-copy');
      copy.append(el('span', 'eq-label', label), el('span', 'eq-value', value));
      item.append(copy);
      grid.append(item);
    });
    section.append(grid);
    content.append(section);

    if (change.reason) {
      const reasonSection = el('section', 'detail-section');
      reasonSection.append(el('h3', 'section-title', 'Justificación'));
      const reasonContent = el('div', 'detail-grid');
      const reasonItem = el('div', 'eq-field');
      const reasonCopy = el('div', 'detail-field-copy');
      reasonCopy.append(el('span', 'eq-label', 'Motivo'), el('span', 'eq-value', change.reason));
      reasonItem.append(reasonCopy);
      reasonContent.append(reasonItem);
      reasonSection.append(reasonContent);
      content.append(reasonSection);
    }

    fieldRows(content, change.action === 'Eliminó' ? 'Datos que tenía el registro' : 'Datos antes del cambio', change.before);
    if (change.action !== 'Eliminó') fieldRows(content, 'Datos enviados', change.sent);
    document.getElementById('detail-title').textContent = `${change.action}: ${change.record || change.operation}`;
    document.getElementById('detail-body').replaceChildren(content);
    modal.hidden = false;
    document.body.classList.add('modal-open');
  }

  function closeDetail() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function table(rows) {
    const records = el('section', 'module-records');
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    page = Math.min(page, pages);
    const start = (page - 1) * pageSize;

    const wrap = el('div', 'module-table-wrap');
    const tbl = el('table', 'module-table');
    const head = el('tr');
    ['Fecha y hora', 'Acción', 'Módulo', 'Operación', 'Registro', 'Equipo', 'IP'].forEach(title => head.append(el('th', '', title)));
    const thead = el('thead');
    thead.append(head);
    const tbody = el('tbody');

    rows.slice(start, start + pageSize).forEach(change => {
      const tr = el('tr');
      tr.dataset.action = 'detail';
      tr.tabIndex = 0;
      const badge = el('span', `badge ${BADGE[change.action] || ''}`.trim(), change.action);
      [formatDate(change.date), badge, change.module, change.operation, change.record || '—', deviceName(change.device) || '—', change.ip || '—']
        .forEach(value => {
          const cell = el('td');
          if (value instanceof Node) cell.append(value); else cell.textContent = value;
          tr.append(cell);
        });
      tr.addEventListener('click', () => openDetail(change));
      tr.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetail(change); }
      });
      tbody.append(tr);
    });

    if (!total) {
      const empty = el('tr');
      const cell = el('td', 'module-empty', failed ? message : (changes.length ? 'Ningún cambio coincide con los filtros.' : 'Aún no hay cambios registrados. Aparecerán aquí cuando alguien cree, modifique o elimine datos.'));
      cell.colSpan = 7;
      empty.append(cell);
      tbody.append(empty);
    }
    tbl.append(thead, tbody);
    wrap.append(tbl);

    const bar = el('div', 'module-pagination');
    const limit = el('label', 'module-page-size', 'Mostrar ');
    const size = el('select');
    [10, 20, 50, 100].forEach(option => { const item = el('option', '', String(option)); item.value = String(option); size.append(item); });
    size.value = String(pageSize);
    size.setAttribute('aria-label', 'Cantidad de registros por página');
    size.addEventListener('change', () => { pageSize = Number(size.value); page = 1; render(); });
    limit.append(size, document.createTextNode(' por página'));
    const range = el('span', 'module-page-range', total ? `Mostrando ${start + 1}–${Math.min(start + pageSize, total)} de ${total}` : 'Mostrando 0 registros');
    const nav = el('div', 'module-page-navigation');
    const prev = el('button', 'module-page-button', 'Anterior');
    prev.type = 'button';
    prev.disabled = page <= 1;
    prev.addEventListener('click', () => { page -= 1; render(); });
    const next = el('button', 'module-page-button', 'Siguiente');
    next.type = 'button';
    next.disabled = page >= pages;
    next.addEventListener('click', () => { page += 1; render(); });
    nav.append(prev, next);
    bar.append(limit, range, nav);

    records.append(wrap, bar);
    return records;
  }

  function render() {
    const focused = document.activeElement && document.activeElement.classList.contains('module-search');
    root.replaceChildren();
    const crumb = el('div', 'breadcrumb', 'Historial de cambios');
    const header = el('div', 'page-head');
    header.append(el('h1', '', 'Historial de cambios'));

    const filters = el('div', 'module-filters history-filters');
    const box = el('input', 'module-search');
    box.type = 'search';
    box.placeholder = 'Buscar…';
    box.setAttribute('aria-label', 'Buscar en el historial');
    box.value = search;
    box.addEventListener('input', () => { search = box.value; page = 1; render(); });
    const modules = [...new Set(changes.map(change => change.module))].sort((a, b) => a.localeCompare(b, 'es'));
    filters.append(
      box,
      select('Todas las acciones', action, ACTIONS, value => { action = value; }),
      select('Todos los módulos', module, modules, value => { module = value; }),
      dateInput('Desde', from, value => { from = value; }),
      dateInput('Hasta', to, value => { to = value; }),
    );

    root.append(crumb, header, filters);
    if (failed) root.append(el('p', 'module-notice error', message));
    root.append(table(filtered()));
    if (focused) { const input = root.querySelector('.module-search'); input.focus(); input.setSelectionRange(search.length, search.length); }
  }

  modal.querySelector('.modal-close').addEventListener('click', closeDetail);
  modal.addEventListener('click', event => { if (event.target === modal) closeDetail(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) closeDetail(); });

  render();
  window.inventarioApi.get('changes').then(result => {
    changes = result.changes || [];
    render();
  }).catch(error => {
    failed = true;
    message = error.message;
    render();
  });
})();