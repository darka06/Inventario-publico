// Técnicos y los equipos que tienen asignados, consultado desde la API MySQL.
// Solo aparecen usuarios del área TECNICA; los funcionarios se gestionan en Funcionarios.
(() => {
  const list = document.getElementById('users-list');
  const modal = document.getElementById('user-modal');
  if (!list || !modal) return;

  const notice = document.getElementById('user-notice');
  const counter = document.getElementById('user-count');
  const $avatar = document.getElementById('um-avatar');
  const $name = document.getElementById('um-name');
  const $role = document.getElementById('um-role');
  const $rows = document.getElementById('um-rows');
  const $close = document.getElementById('um-close');
  const COLORS = ['#06c167', '#3b92ea', '#d4568a', '#ff7a5c', '#8e6bd8', '#e0a800'];
  const COLOR_MAP = { '#06c167': '1', '#3b92ea': '2', '#d4568a': '3', '#ff7a5c': '4', '#8e6bd8': '5', '#e0a800': '6' };
  function getColorClass(color) { return COLOR_MAP[color] || '1'; }
  const IN_USE = ['asignado', 'alquilado', 'prestado'];
  const REPAIR = 'en reparación';

  let technicians = [];
  let assets = [];
  let lastFocus = null;

  const normalize = value => (value || '').trim().toLocaleLowerCase('es');
  const stateClass = status => {
    const key = normalize(status);
    if (IN_USE.includes(key)) return 'st-use';
    if (key === REPAIR || key === 'en reparacion') return 'st-repair';
    if (key === 'disponible') return 'st-store';
    return '';
  };
  const initials = name => name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  const assignedAssets = user => assets.filter(asset => normalize(asset.assignedTo) === normalize(user.nombre));

  // Un técnico es quien pertenece al área TECNICA.
  function isTechnician(user) {
    const area = normalize(user.area).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return area === 'tecnica';
  }

  const formatDate = value => {
    if (!value) return '—';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  function stat(label, value) {
    const item = document.createElement('li');
    const bold = document.createElement('b');
    bold.textContent = String(value);
    item.append(document.createTextNode(`${label} `), bold);
    return item;
  }

  function appendDetailField(parent, label, value, className = '') {
    const item = document.createElement('div');
    item.className = `eq-field${className ? ` ${className}` : ''}`;
    const title = document.createElement('span');
    title.className = 'eq-label';
    title.textContent = label;
    const content = document.createElement('span');
    content.className = 'eq-value';
    content.textContent = value || '—';
    item.append(title, content);
    parent.append(item);
  }

  function openModal(user, card) {
    const items = assignedAssets(user);
    const avatar = card.querySelector('.uavatar');
    $avatar.textContent = avatar.textContent;
    const colorClass = Array.from(avatar.classList).find(c => c.startsWith('uavatar-')) || 'uavatar-1';
    $avatar.className = `uavatar ${colorClass}`;
    $name.textContent = user.nombre;
    $role.textContent = [user.cargo, user.rol].filter(Boolean).join(' · ') || 'Técnico';
    $rows.replaceChildren();

    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'eq-empty';
      empty.textContent = 'Este técnico no tiene equipos asignados';
      $rows.append(empty);
    } else {
      items.forEach(asset => {
        const cardItem = document.createElement('article');
        cardItem.className = 'eq-card';
        const head = document.createElement('header');
        head.className = 'eq-card-head';
        const title = document.createElement('h3');
        title.textContent = asset.name;
        const status = document.createElement('span');
        status.className = `badge ${stateClass(asset.status)}`.trim();
        status.textContent = asset.status;
        head.append(title, status);
        const grid = document.createElement('div');
        grid.className = 'eq-fields';
        appendDetailField(grid, 'Código', asset.code, 'serial');
        appendDetailField(grid, 'Categoría', asset.category);
        appendDetailField(grid, 'Marca / Modelo', [asset.brand, asset.model].filter(Boolean).join(' '));
        appendDetailField(grid, 'Número de serie', asset.serial, 'serial');
        appendDetailField(grid, 'Fecha de compra', formatDate(asset.purchaseDate));
        appendDetailField(grid, 'Descripción', asset.notes, 'full');
        cardItem.append(head, grid);
        $rows.append(cardItem);
      });
    }

    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    $close.focus();
  }

  function render() {
    list.replaceChildren();
    if (!technicians.length) {
      const empty = document.createElement('p');
      empty.className = 'eq-empty';
      empty.textContent = 'No hay técnicos registrados. Asigna el área TECNICA a un funcionario para verlo aquí.';
      list.append(empty);
      counter.textContent = '';
      return;
    }

    technicians.forEach((user, index) => {
      const equipment = assignedAssets(user);
      const card = document.createElement('article');
      card.className = `ucard${normalize(user.estado) === 'inactivo' ? ' inactive' : ''}`;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Ver equipos de ${user.nombre}`);
      const avatar = document.createElement('span');
      avatar.className = `uavatar uavatar-${getColorClass(user.color || COLORS[index % COLORS.length])}`;
      avatar.textContent = initials(user.nombre);
      const heading = document.createElement('h2');
      heading.textContent = user.nombre;
      const role = document.createElement('p');
      role.className = 'urole';
      role.textContent = user.cargo || 'Técnico';
      const stats = document.createElement('ul');
      stats.className = 'ustats';
      stats.append(
        stat('Equipos asignados', equipment.length),
        stat('En uso', equipment.filter(asset => IN_USE.includes(normalize(asset.status))).length),
        stat('En reparación', equipment.filter(asset => normalize(asset.status) === REPAIR).length),
      );
      card.append(avatar, heading, role, stats);
      card.addEventListener('click', () => openModal(user, card));
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openModal(user, card);
        }
      });
      list.append(card);
    });

    const activos = technicians.filter(user => normalize(user.estado) !== 'inactivo').length;
    counter.textContent = `${technicians.length} técnico${technicians.length === 1 ? '' : 's'} · ${activos} activo${activos === 1 ? '' : 's'}`;
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    if (lastFocus) lastFocus.focus();
  }

  $close.addEventListener('click', closeModal);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) closeModal(); });

  list.replaceChildren(window.inventarioSkeleton.list(6));
  window.inventarioApi.get('all').then(result => {
    const users = result.users || [];
    assets = result.assets || [];
    technicians = users
      .filter(isTechnician)
      .sort((a, b) => {
        const estadoA = normalize(a.estado) === 'inactivo' ? 1 : 0;
        const estadoB = normalize(b.estado) === 'inactivo' ? 1 : 0;
        return estadoA - estadoB || a.nombre.localeCompare(b.nombre, 'es');
      });
    render();
    notice.textContent = 'Conectado a la base de datos.';
  }).catch(error => {
    list.replaceChildren();
    notice.textContent = error.message;
    notice.classList.add('error');
  });
})();