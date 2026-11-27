// Usuarios (login) y roles con permisos, al estilo de los roles de Discord.
(() => {
  const $ = id => document.getElementById(id);
  const panelUsers = $('panel-users');
  const panelRoles = $('panel-roles');

  let catalog = [];
  let roles = [];
  let accounts = [];
  let me = null;
  let selectedRole = null;      // id numérico o 'new'
  let draft = null;             // copia editable del rol seleccionado
  let roleTab = 'permisos';
  let editingAccountId = null;

  // ---------- utilidades ----------
  function h(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === false || value == null) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'style') node.style.cssText = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : value);
    });
    node.append(...children.flat().filter(child => child != null && child !== false));
    return node;
  }
  // Indicador de rol local; no envía identificadores a servicios externos.
  function roleFace(_seed, color, size = 24) {
    const roleColor = color || '#64748b';
    return h('span', {
      class: 'ac-role-face',
      'aria-hidden': 'true',
      style: `display:inline-block;flex:none;width:${size}px;height:${size}px;border-radius:50%;background:${roleColor};box-shadow:0 0 0 2px ${roleColor}`,
    });
  }
  const can = permission => !!me && me.permissions.includes(permission);

  function toast(message, isError = false) {
    const node = h('p', { class: `module-notice module-toast${isError ? ' error' : ''}`, role: 'status', text: message });
    document.body.append(node);
    setTimeout(() => node.remove(), 4000);
  }

  const formatDate = value => {
    if (!value) return 'Nunca';
    const date = new Date(value.replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? value
      : date.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const initials = name => name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  const snapshot = role => JSON.stringify({ n: role.name, d: role.description || '', c: role.color, p: [...role.permissions].sort() });

  async function reload() {
    const [r, a] = await Promise.all([window.inventarioApi.get('roles'), window.inventarioApi.get('accounts')]);
    roles = r.roles;
    // Más nuevo primero (por fecha de creación; en empate, por id)
    accounts = [...a.accounts].sort((x, y) => String(y.createdAt || '').localeCompare(String(x.createdAt || '')) || Number(y.id) - Number(x.id));
  }

  // ---------- pestañas principales ----------
  function showTab(name) {
    const users = name === 'users';
    $('tab-users').setAttribute('aria-selected', String(users));
    $('tab-roles').setAttribute('aria-selected', String(!users));
    panelUsers.hidden = !users;
    panelRoles.hidden = users;
  }
  $('tab-users').addEventListener('click', () => showTab('users'));
  $('tab-roles').addEventListener('click', () => showTab('roles'));

  // ---------- USUARIOS ----------
  function renderUsers() {
    const head = h('div', { class: 'ac-toolbar' },
      h('p', { class: 'ac-count', text: `${accounts.length} usuario${accounts.length === 1 ? '' : 's'}` }),
      can('accesos.crear') && h('button', { type: 'button', class: 'ac-btn primary', onclick: () => openUserModal(null), text: 'Nuevo usuario' }));

    const rows = accounts.map(account => h('tr', { class: account.status === 'Inactivo' ? 'inactive' : '' },
      h('td', {},
        h('div', { class: 'ac-user' },
          h('span', { class: 'ac-avatar', style: `background:${account.roleColor}`, text: initials(account.name) }),
          h('div', {}, h('b', { text: account.name }), h('small', { text: `@${account.username}` })))),
      h('td', {}, h('span', { class: 'ac-pill' }, roleFace(`rol-${account.roleId}`, account.roleColor, 18), account.roleName)),
      h('td', {}, h('span', { class: `ac-status ${account.status === 'Activo' ? 'on' : 'off'}`, text: account.status })),
      h('td', { text: formatDate(account.lastAccess) }),
      h('td', { class: 'ac-actions' },
        can('accesos.editar') && h('button', { type: 'button', class: 'ac-btn small', onclick: () => openUserModal(account), text: 'Editar' }),
        can('accesos.eliminar') && account.id !== me.id && h('button', { type: 'button', class: 'ac-btn small danger', onclick: () => removeUser(account), text: 'Eliminar' }))));

    const table = h('div', { class: 'ac-table-wrap' },
      h('table', { class: 'ac-table' },
        h('thead', {}, h('tr', {}, ['Usuario', 'Rol', 'Estado', 'Último acceso', ''].map(label => h('th', { scope: 'col', text: label })))),
        h('tbody', {}, rows)));
    panelUsers.replaceChildren(head, table);
  }

  const userModal = $('user-modal');
  const userError = $('user-form-error');

  function openUserModal(account) {
    editingAccountId = account ? account.id : null;
    $('user-modal-title').textContent = account ? 'Editar usuario' : 'Nuevo usuario';
    $('uf-name').value = account ? account.name : '';
    $('uf-username').value = account ? account.username : '';
    $('uf-password').value = '';
    $('uf-pass-label').textContent = account ? 'Nueva contraseña (opcional)' : 'Contraseña';
    $('uf-pass-help').textContent = account ? 'Déjala vacía para conservar la actual.' : 'Mínimo 12 caracteres.';
    const select = $('uf-role');
    select.replaceChildren(...roles
      .filter(role => !role.isAdmin || me.isAdmin)
      .map(role => h('option', { value: role.id, text: role.name })));
    if (account) select.value = String(account.roleId);
    $('uf-status').value = account ? account.status : 'Activo';
    userError.hidden = true;
    userModal.hidden = false;
    document.body.classList.add('modal-open');
    $('uf-name').focus();
  }

  function closeUserModal() {
    userModal.hidden = true;
    document.body.classList.remove('modal-open');
  }
  userModal.addEventListener('click', event => {
    if (event.target === userModal || event.target.closest('[data-close]')) closeUserModal();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !userModal.hidden) closeUserModal(); });

  $('user-form').addEventListener('submit', async event => {
    event.preventDefault();
    userError.hidden = true;
    $('uf-submit').disabled = true;
    try {
      await window.inventarioApi.post('account.save', {
        ...(editingAccountId ? { id: editingAccountId } : {}),
        name: $('uf-name').value.trim(),
        username: $('uf-username').value.trim(),
        password: $('uf-password').value,
        roleId: Number($('uf-role').value),
        status: $('uf-status').value,
      });
      closeUserModal();
      await reload();
      renderUsers();
      renderRoles();
      toast(editingAccountId ? 'Usuario actualizado.' : 'Usuario creado.');
    } catch (error) {
      if (!error.cancelled) {
        userError.textContent = error.message;
        userError.hidden = false;
      }
    } finally {
      $('uf-submit').disabled = false;
    }
  });

  async function removeUser(account) {
    const reason = await window.inventarioApi.askReason({
      title: `Eliminar al usuario @${account.username}`,
      message: 'No podrá volver a entrar y esta acción no se puede deshacer. Explica por qué se elimina.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (reason === null) return;
    try {
      await window.inventarioApi.post('account.delete', { id: account.id, justification: reason });
      await reload();
      renderUsers();
      renderRoles();
      toast('Usuario eliminado.');
    } catch (error) {
      toast(error.message, true);
    }
  }

  // ---------- ROLES ----------
  const isDirty = () => {
    if (!draft) return false;
    if (selectedRole === 'new') return true;
    const original = roles.find(role => role.id === selectedRole);
    return !!original && snapshot(original) !== snapshot(draft);
  };

  function selectRole(id) {
    if (id === selectedRole) return;
    if (isDirty() && !confirm('Tienes cambios sin guardar en este rol. ¿Descartarlos?')) return;
    selectedRole = id;
    draft = null;
    roleTab = 'permisos';
    if (id !== null) {
      const role = roles.find(item => item.id === id);
      draft = { ...role, permissions: new Set(role.permissions) };
    }
    renderRoles();
  }

  function startNewRole() {
    if (isDirty() && !confirm('Tienes cambios sin guardar en este rol. ¿Descartarlos?')) return;
    selectedRole = 'new';
    roleTab = 'pantalla';
    draft = { id: null, name: 'Nuevo rol', description: '', color: '#3b92ea', isAdmin: false, members: 0, permissions: new Set() };
    renderRoles();
  }

  function resetDraft() {
    if (selectedRole === 'new') { selectedRole = null; draft = null; }
    else {
      const role = roles.find(item => item.id === selectedRole);
      draft = { ...role, permissions: new Set(role.permissions) };
    }
    renderRoles();
  }

  async function saveDraft() {
    if (!draft.name.trim()) { toast('El rol necesita un nombre.', true); return; }
    try {
      const result = await window.inventarioApi.post('role.save', {
        ...(draft.id ? { id: draft.id } : {}),
        name: draft.name.trim(),
        description: draft.description || '',
        color: draft.color,
        permissions: draft.isAdmin ? [] : [...draft.permissions],
      });
      await reload();
      selectedRole = null;
      selectRole(Number(result.id));
      renderUsers();
      toast('Rol guardado.');
    } catch (error) {
      if (!error.cancelled) toast(error.message, true);
    }
  }

  async function deleteDraft() {
    const reason = await window.inventarioApi.askReason({
      title: `Eliminar el rol "${draft.name}"`,
      message: 'Esta acción no se puede deshacer. Explica por qué se elimina.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (reason === null) return;
    try {
      await window.inventarioApi.post('role.delete', { id: draft.id, justification: reason });
      await reload();
      selectedRole = null;
      draft = null;
      renderRoles();
      renderUsers();
      toast('Rol eliminado.');
    } catch (error) {
      toast(error.message, true);
    }
  }

  function roleList() {
    const items = roles.map(role => h('li', {},
      h('button', {
        type: 'button', class: `ac-role-item${role.id === selectedRole ? ' active' : ''}`,
        'aria-current': role.id === selectedRole ? 'true' : false,
        onclick: () => selectRole(role.id),
      }, roleFace(`rol-${role.id}`, role.color, 24), h('span', { text: role.name }), h('small', { text: String(role.members) }))));
    if (selectedRole === 'new') {
      items.push(h('li', {}, h('button', { type: 'button', class: 'ac-role-item active' },
        roleFace('rol-nuevo', draft.color, 24), h('span', { text: draft.name || 'Nuevo rol' }))));
    }
    return h('aside', { class: 'ac-role-list', 'aria-label': 'Roles' },
      h('div', { class: 'ac-role-list-head' },
        h('b', { text: `Roles — ${roles.length}` }),
        can('accesos.crear') && h('button', { type: 'button', class: 'ac-btn small primary', onclick: startNewRole, text: 'Crear rol' })),
      h('ul', {}, items));
  }

  function displayTab() {
    const name = h('input', { type: 'text', id: 'role-name', maxlength: '60', value: draft.name });
    name.addEventListener('input', () => { draft.name = name.value; markDirty(); });
    const description = h('input', { type: 'text', id: 'role-desc', maxlength: '255', value: draft.description || '' });
    description.addEventListener('input', () => { draft.description = description.value; markDirty(); });
    const color = h('input', { type: 'color', id: 'role-color', value: draft.color });
    color.addEventListener('input', () => { draft.color = color.value; markDirty(); });
    return h('div', { class: 'ac-card' },
      h('label', { class: 'ac-field' }, h('span', { text: 'Nombre del rol' }), name),
      h('label', { class: 'ac-field' }, h('span', { text: 'Descripción' }), description),
      h('label', { class: 'ac-field ac-color' }, h('span', { text: 'Color del rol' }), color),
      draft.id && !draft.isAdmin && can('accesos.eliminar') && h('div', { class: 'ac-danger' },
        h('div', {}, h('b', { text: 'Eliminar rol' }), h('small', { text: 'Solo se puede si ningún usuario lo tiene asignado.' })),
        h('button', { type: 'button', class: 'ac-btn danger', onclick: deleteDraft, text: 'Eliminar rol' })));
  }

  function permissionsTab() {
    const locked = draft.isAdmin || !can('accesos.editar') && draft.id !== null || (selectedRole === 'new' && !can('accesos.crear'));
    const groups = [...new Set(catalog.map(module => module.group))];
    const blocks = groups.map(group => h('section', { class: 'ac-group' },
      h('h3', { text: group }),
      catalog.filter(module => module.group === group).map(module => {
        const keys = module.permissions.map(permission => permission.key);
        const all = keys.every(key => draft.permissions.has(key));
        const master = h('button', {
          type: 'button', class: 'ac-link', disabled: locked,
          onclick: () => {
            keys.forEach(key => (all ? draft.permissions.delete(key) : draft.permissions.add(key)));
            renderRoles();
          },
          text: all ? 'Quitar todo' : 'Marcar todo',
        });
        return h('div', { class: 'ac-module' },
          h('div', { class: 'ac-module-head' }, h('b', { text: module.label }), master),
          module.permissions.map(permission => switchRow(permission, locked)));
      })));
    return h('div', { class: 'ac-card' },
      draft.isAdmin && h('p', { class: 'ac-note', text: 'El rol Administrador tiene todos los permisos, incluidos los que se agreguen en el futuro. No se puede restringir.' }),
      blocks);
  }

  function switchRow(permission, locked) {
    const checked = draft.isAdmin || draft.permissions.has(permission.key);
    const input = h('input', { type: 'checkbox', role: 'switch', id: `perm-${permission.key}`, checked, disabled: locked });
    input.addEventListener('change', () => {
      if (input.checked) draft.permissions.add(permission.key); else draft.permissions.delete(permission.key);
      markDirty();
    });
    return h('label', { class: 'ac-switch-row', for: `perm-${permission.key}` },
      h('span', { text: permission.label }),
      h('span', { class: 'ac-switch' }, input, h('i', { 'aria-hidden': 'true' })));
  }

  function membersTab() {
    const members = accounts.filter(account => account.roleId === draft.id);
    return h('div', { class: 'ac-card' }, members.length
      ? h('ul', { class: 'ac-members' }, members.map(account => h('li', {},
        h('span', { class: 'ac-avatar', style: `background:${draft.color}`, text: initials(account.name) }),
        h('div', {}, h('b', { text: account.name }), h('small', { text: `@${account.username}` })))))
      : h('p', { class: 'ac-note', text: 'Ningún usuario tiene este rol todavía. Asígnalo desde la pestaña Usuarios.' }));
  }

  let saveBar = null;
  function markDirty() {
    if (saveBar) saveBar.hidden = !isDirty();
  }

  function renderRoles() {
    let editor;
    if (!draft) {
      editor = h('div', { class: 'ac-empty' }, h('p', { text: 'Selecciona un rol para ver y editar sus permisos, o crea uno nuevo.' }));
    } else {
      const tabs = [['pantalla', 'Pantalla'], ['permisos', 'Permisos'], ['miembros', `Miembros (${draft.members})`]]
        .filter(([key]) => key !== 'miembros' || draft.id !== null);
      const body = roleTab === 'pantalla' ? displayTab() : roleTab === 'miembros' ? membersTab() : permissionsTab();
      saveBar = h('div', { class: 'ac-savebar', role: 'status' },
        h('span', { text: 'Cuidado: tienes cambios sin guardar.' }),
        h('div', {},
          h('button', { type: 'button', class: 'ac-btn ghost', onclick: resetDraft, text: 'Restablecer' }),
          h('button', { type: 'button', class: 'ac-btn primary', onclick: saveDraft, text: 'Guardar cambios' })));
      saveBar.hidden = !isDirty();
      editor = h('div', { class: 'ac-editor' },
        h('div', { class: 'ac-editor-head' },
          h('h2', {}, roleFace(`rol-${draft.id ?? 'nuevo'}`, draft.color, 28), 'Editar rol — ', h('span', { text: draft.name || 'Sin nombre' })),
          h('div', { class: 'ac-subtabs', role: 'tablist' }, tabs.map(([key, label]) => h('button', {
            type: 'button', role: 'tab', 'aria-selected': String(key === roleTab),
            onclick: () => { roleTab = key; renderRoles(); }, text: label,
          })))),
        body, saveBar);
    }
    panelRoles.replaceChildren(h('div', { class: 'ac-roles' }, roleList(), editor));
  }

  window.addEventListener('beforeunload', event => {
    if (isDirty()) { event.preventDefault(); event.returnValue = ''; }
  });

  // ---------- arranque ----------
  panelUsers.replaceChildren(window.inventarioSkeleton.table(5, 6));
  panelRoles.replaceChildren(window.inventarioSkeleton.list(4));
  window.inventarioApi.session.then(async account => {
    if (!account) return;
    me = account;
    try {
      const [{ catalog: list }] = await Promise.all([window.inventarioApi.get('permissions'), reload()]);
      catalog = list;
      renderUsers();
      renderRoles();
    } catch (error) {
      panelRoles.replaceChildren();
      panelUsers.replaceChildren(h('p', { class: 'module-notice error', text: error.message }));
    }
  });
})();