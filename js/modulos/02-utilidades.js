  // "Chrome en Windows" a partir del User-Agent guardado.
  function deviceName(agent) {
    if (!agent) return '';
    const browser = /Edg\//.test(agent) ? 'Edge' : /OPR\/|Opera/.test(agent) ? 'Opera' : /Firefox\//.test(agent) ? 'Firefox'
      : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : 'Navegador';
    const system = /Windows/.test(agent) ? 'Windows' : /Android/.test(agent) ? 'Android' : /iPhone|iPad/.test(agent) ? 'iOS'
      : /Mac OS/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : '';
    return system ? `${browser} en ${system}` : browser;
  }

  function formatChangeDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return value || '';
    return date.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function changeBadge(action) {
    const item = text('span', action, 'badge');
    if (CHANGE_BADGES[action]) item.classList.add(CHANGE_BADGES[action]);
    return item;
  }

  function changeDetail(change) {
    const content = document.createElement('div');
    content.className = 'detail-content';
    content.append(detailSection('Resumen', [
      ['Fecha', formatChangeDate(change.date)], ['Acción', change.action], ['Módulo', change.module],
      ['Operación', change.operation], ['Registro', change.record], ['Usuario', change.user],
      ['Equipo', deviceName(change.device)], ['Motivo del cambio', change.justification],
    ]));
    const asEntries = object => Object.entries(object || {})
      .filter(([, value]) => value !== null && value !== '')
      .map(([key, value]) => [CHANGE_LABELS[key] || key, typeof value === 'object' ? JSON.stringify(value) : String(value)]);
    const before = asEntries(change.before);
    if (before.length) content.append(detailSection(change.action === 'Eliminó' ? 'Datos que tenía el registro' : 'Datos antes del cambio', before));
    const sent = change.action === 'Eliminó' ? [] : asEntries(change.sent);
    if (sent.length) content.append(detailSection('Datos enviados', sent));
    showDetail(`${change.action}: ${change.record || change.operation}`, content);
  }

  function showNotice(message, isError = false) {
    notice.textContent = message;
    notice.classList.toggle('error', isError);
    notice.classList.add('is-visible');
    notice.setAttribute('role', isError ? 'alert' : 'status');
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => {
      notice.classList.remove('is-visible');
      notice.textContent = '';
    }, isError ? 6000 : 3500);
    const errorWin = pendingSubmit && pendingSubmit.open ? pendingSubmit : formWin;
    if (isError && errorWin) {
      let inlineNotice = errorWin.form.querySelector('.form-error');
      if (!inlineNotice) {
        inlineNotice = document.createElement('p');
        inlineNotice.className = 'module-notice error form-error';
        inlineNotice.setAttribute('role', 'alert');
        errorWin.form.insertBefore(inlineNotice, errorWin.fields);
      }
      inlineNotice.textContent = message;
    }
  }

  function isoDate(value = TODAY()) {
    return value || '—';
  }

  function money(value) {
    return Number(value || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  }

  function formatQuantity(value) {
    return Number(value || 0).toLocaleString('es-CO', { maximumFractionDigits: 3 });
  }

  function text(tag, value, className) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value == null || value === '' ? '—' : String(value);
    return element;
  }

  function button(label, action, id, secondary = false) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = secondary ? 'btn-cancel' : 'btn-save';
    item.textContent = label;
    item.dataset.action = action;
    if (id) item.dataset.id = id;
    return item;
  }

  function setNoticeInPage() {
    if (!document.body.contains(notice)) document.body.append(notice);
  }

  function getPeople() {
    return data.users.filter(person => person.estado !== 'Inactivo').map(person => person.nombre).filter(Boolean);
  }

