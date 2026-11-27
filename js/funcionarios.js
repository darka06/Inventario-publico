// Crear, editar y eliminar funcionarios (funcionarios.html)

(() => {
  const list   = document.getElementById('users-list');
  const modal  = document.getElementById('form-modal');
  if (!list || !modal) return;

  const form    = document.getElementById('user-form');
  const $title  = document.getElementById('fm-title');
  const $delete = document.getElementById('fm-delete');
  const $add    = document.getElementById('btn-add-user');

  const COLORS = ['#06c167', '#3b92ea', '#d4568a', '#ff7a5c', '#8e6bd8', '#e0a800'];
  const COLOR_MAP = { '#06c167': '1', '#3b92ea': '2', '#d4568a': '3', '#ff7a5c': '4', '#8e6bd8': '5', '#e0a800': '6' };
  function getColorClass(color) { return COLOR_MAP[color] || '1'; }
  let users = [];
  let editingId = null;
  let lastFocus = null;
  const apiNotice = document.createElement('p');
  apiNotice.className = 'module-notice';
  apiNotice.setAttribute('role', 'status');
  list.before(apiNotice);

  const initials = name => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const fmtDate = iso => iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  const stat = (label, value) => {
    const li = document.createElement('li');
    li.append(label + ' ');
    const b = document.createElement('b');
    b.textContent = value || '—';
    li.append(b);
    return li;
  };

  /*  Pintar tarjetas  */

  function render() {
    list.replaceChildren();

    if (!users.length) {
      const p = document.createElement('p');
      p.className = 'eq-empty';
      p.textContent = 'Aún no hay funcionarios. Usa "Nuevo funcionario" para crear el primero.';
      list.append(p);
      return;
    }

    users.forEach(u => {
      const card = document.createElement('article');
      card.className = 'ucard' + (u.estado === 'Inactivo' ? ' inactive' : '');
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', 'Editar ' + u.nombre);

      const av = document.createElement('span');
      av.className = `uavatar uavatar-${getColorClass(u.color)}`;
      av.textContent = initials(u.nombre);

      const h2 = document.createElement('h2');
      h2.textContent = u.nombre;

      const role = document.createElement('p');
      role.className = 'urole';
      role.textContent = u.cargo || 'Sin cargo';

      const ul = document.createElement('ul');
      ul.className = 'ustats';
      ul.append(
        stat('Área', u.area),
        stat('Correo', u.correo),
        stat('Teléfono', u.telefono),
        stat('Ingreso', fmtDate(u.ingreso)),
        stat('Estado', u.estado)
      );

      card.append(av, h2, role, ul);
      card.addEventListener('click', () => openForm(u.id));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openForm(u.id); }
      });
      list.append(card);
    });
  }

  /*  Modal  */

  function openForm(id = null) {
    editingId = id;
    form.reset();
    modal.querySelector('.modal-box').classList.add('module-form-modal');

    if (id) {
      const u = users.find(x => x.id === id);
      if (!u) return;
      Object.keys(u).forEach(k => { if (form.elements[k]) form.elements[k].value = u[k]; });
      $title.textContent = 'Editar funcionario';
      $delete.hidden = false;
    } else {
      $title.textContent = 'Nuevo funcionario';
      $delete.hidden = true;
    }

    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    form.elements.nombre.focus();
  }

  function closeForm() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    if (lastFocus) lastFocus.focus();
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const data = {};
    ['nombre', 'cargo', 'documento', 'correo', 'telefono', 'area', 'ingreso', 'estado', 'notas']
      .forEach(k => { data[k] = form.elements[k].value.trim(); });

    try {
      await window.inventarioApi.post(editingId ? 'user.update' : 'user.create', {
        ...(editingId ? { id: editingId } : {}),
        ...data,
      });
      users = (await window.inventarioApi.get('users')).users;
      render();
      apiNotice.textContent = 'Cambios guardados en la base de datos.';
      apiNotice.classList.remove('error');
      closeForm();
    } catch (error) {
      apiNotice.textContent = error.message;
      apiNotice.classList.add('error');
    }
  });

  $delete.addEventListener('click', async () => {
    const u = users.find(x => x.id === editingId);
    if (!u || !confirm('¿Eliminar al funcionario ' + u.nombre + '?')) return;
    try {
      await window.inventarioApi.post('user.delete', { id: editingId });
      users = (await window.inventarioApi.get('users')).users;
      render();
      apiNotice.textContent = 'Funcionario eliminado de la base de datos.';
      apiNotice.classList.remove('error');
      closeForm();
    } catch (error) {
      apiNotice.textContent = error.message;
      apiNotice.classList.add('error');
    }
  });

  $add.addEventListener('click', () => openForm());
  document.getElementById('fm-close').addEventListener('click', closeForm);
  document.getElementById('fm-cancel').addEventListener('click', closeForm);
  modal.addEventListener('click', e => { if (e.target === modal) closeForm(); });   // clic en el fondo
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeForm(); });

  list.replaceChildren(window.inventarioSkeleton.list(6));
  window.inventarioApi.get('users').then(result => {
    users = result.users;
    render();
    apiNotice.textContent = 'Conectado a la base de datos.';
  }).catch(error => {
    render();
    apiNotice.textContent = error.message;
    apiNotice.classList.add('error');
  });
})();