// Comprueba el permiso, cierra la ventana de detalle y abre el formulario de edición.
  function guardedEdit(permission, label, open) {
    if (!window.inventarioApi.can(permission)) return showNotice(`No tienes permiso para modificar ${label}.`, true);
    closeDetail();
    return open();
  }

  // Abre la ventana de detalle de la fila pulsada (o con Enter / Espacio).
  // Si ese registro ya tiene su ventana abierta, solo la trae al frente.
  function openRecord(action, id) {
    const key = `${action}:${id}`;
    const open = wins.find(win => win.kind === 'detail' && win.key === key);
    if (open) {
      detailOrigin = null;
      raise(open);
      flash(open);
      return;
    }
    pendingSource = { key, action, id };
    try {
      dispatchRecord(action, id);
    } finally {
      pendingSource = null;
    }
  }

  function dispatchRecord(action, id) {
    if (action === 'detail' && page === 'assets') {
      const asset = data.assets.find(item => item.id === id);
      if (asset) assetDetail(asset);
    } else if (action === 'category-detail' && page === 'categories') {
      const category = data.categories.find(item => item.id === id);
      if (category) categoryDetail(category);
    } else if (action === 'brand-detail' && page === 'brands') {
      const brand = data.brands.find(item => item.id === id);
      if (brand) brandDetail(brand);
    } else if (action === 'contact-detail' && page === 'contacts') {
      const contact = data.contacts.find(item => item.id === id);
      if (contact) contactDetail(contact);
    } else if (action === 'tool-detail' && isToolsHub) {
      const tool = data.tools.find(item => item.id === id);
      if (tool) toolDetail(tool);
    } else if (action === 'user-detail' && page === 'funcionarios') {
      const user = data.users.find(item => item.id === id);
      if (user) userDetail(user);
    } else if (action === 'supply-detail' && page === 'consumables') {
      const supply = data.supplies.find(item => item.id === id);
      if (supply) supplyDetail(supply);
    } else if (action === 'change-detail' && page === 'history') {
      const change = data.changes.find(item => item.id === id);
      if (change) changeDetail(change);
    } else if (action === 'tech-detail' && isToolsHub) {
      const tech = getTechnicians().find(item => item.id === id);
      if (tech) technicianDetail(tech);
    } else if (action === 'loan-detail' && page === 'asset-loan') {
      const loan = findLoan(id);
      if (loan) loanDetail(loan);
    } else if (action === 'purchase-detail' && page === 'purchases') {
      const purchase = data.purchases.find(item => item.id === id);
      if (purchase) purchaseDetail(purchase);
    } else if (action === 'movement-detail' && page === 'movements') {
      const movement = data.movements.find(item => item.id === id);
      if (movement) movementDetail(movement);
    }
  }

  // `fromDetail` es la ventana de detalle donde se pulsó el botón (null si fue en la página).
  function handleAction(action, id, fromDetail = null) {
    ctxDetail = fromDetail;
    // Las acciones de editar / asignar sobre un registro no abren dos formularios iguales a la vez.
    formKeyHint = id && /^(edit|rename|assign|stock|audit)-/.test(action) ? `${action}:${id}` : null;
    try {
      return runAction(action, id);
    } finally {
      formKeyHint = null;
    }
  }

  function runAction(action, id) {
    if (action === 'new-asset') return editAsset();
    if (action === 'edit-asset') {
      if (!window.inventarioApi.can('activos.editar')) return showNotice('No tienes permiso para modificar activos.', true);
      closeDetail();
      return editAsset(id);
    }
    if (action === 'delete-asset') return deleteAsset(id);
    if (action === 'asset-history') return openAssetHistory(id);
    if (action === 'supply-history') return openSupplyHistory(id);
    if (RECORD_HISTORY[action]) return openRecordHistory(action, id);
    if (action === 'new-category') return editCategory();
    if (action === 'edit-category') return guardedEdit('categorias.editar', 'categorías', () => editCategory(id));
    if (action === 'delete-category') return deleteCategory(id);
    if (action === 'new-brand') return createBrand();
    if (action === 'rename-brand') return guardedEdit('marcas.editar', 'marcas', () => renameBrand(id));
    if (action === 'delete-brand') return deleteBrand(id);
    if (action === 'assign-asset') return assignAsset(id);
    if (action === 'return-asset') return returnAsset(id);
    if (action === 'new-supply') return editSupply();
    if (action === 'edit-supply') return guardedEdit('insumos.editar', 'insumos', () => editSupply(id));
    if (action === 'delete-supply') return deleteSupply(id);
    if (action === 'new-stock-movement' || action === 'stock-movement') return stockMovement(id || null);
    if (action === 'new-purchase') return purchaseForm();
    if (action === 'new-contact') return editContact();
    if (action === 'edit-contact') return guardedEdit('contactos.editar', 'contactos', () => editContact(id));
    if (action === 'delete-contact') return deleteContact(id);
    if (action === 'new-tool') return editTool();
    if (action === 'edit-tool') return guardedEdit('herramientas.editar', 'herramientas', () => editTool(id));
    if (action === 'delete-tool') return deleteTool(id);
    if (action === 'audit-tech') return toolAuditForm(id);
    if (action === 'audit-history') return openToolAuditHistory(id);
    if (action === 'tool-delivery-history') return openToolDeliveryHistory(id);
    if (action === 'audit-print') return printToolAudit(id);
    if (action === 'new-user') return editUser();
    if (action === 'new-technician') return editUser(null, { technician: true });
    if (action === 'edit-user') return guardedEdit('funcionarios.editar', 'funcionarios', () => editUser(id));
    if (action === 'delete-user') return deleteUser(id);
    if (action === 'new-loan') return createLoan();
    if (action === 'return-loan') return returnLoan(id);
    if (action === 'return-active-asset') return returnAsset(id);
  }

  document.addEventListener('click', event => {
    const viewMenu = root.querySelector('.module-view-menu-wrap');
    if (viewMenu && !viewMenu.contains(event.target)) {
      const menu = viewMenu.querySelector('.module-view-menu');
      const trigger = viewMenu.querySelector('.btn-list');
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }
    const filterBuilder = root.querySelector('.module-filter-builder');
    const filterToggle = root.querySelector('.filter-builder-toggle');
    if (filterBuilderOpen && filterBuilder && !filterBuilder.contains(event.target) && !filterToggle.contains(event.target)) {
      filterBuilderOpen = false;
      filterBuilder.hidden = true;
      filterToggle.classList.remove('is-open');
      filterToggle.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (document.querySelector('.inventario-reason')) return;   // el aviso de motivo gestiona su propio Escape
      const top = wins[wins.length - 1];
      if (top) { closeWindow(top, true); return; }
      const filterBuilder = root.querySelector('.module-filter-builder');
      const filterToggle = root.querySelector('.filter-builder-toggle');
      if (filterBuilderOpen && filterBuilder && filterToggle) {
        filterBuilderOpen = false;
        filterBuilder.hidden = true;
        filterToggle.classList.remove('is-open');
        filterToggle.setAttribute('aria-expanded', 'false');
        filterToggle.focus();
      }
    }
  });
  root.addEventListener('click', event => {
    if (!apiReady) {
      showNotice('La aplicación no está conectada a la API. Abre el sitio desde Apache/XAMPP y verifica MySQL.', true);
      return;
    }
    const actionButton = event.target.closest('button[data-action]');
    if (actionButton) {
      event.stopPropagation();
      handleAction(actionButton.dataset.action, actionButton.dataset.id, null);
      return;
    }
    const actionableRow = event.target.closest('tr[data-action], .module-record-card[data-action]');
    if (actionableRow) {
      detailOrigin = actionableRow;
      openRecord(actionableRow.dataset.action, actionableRow.dataset.id);
    }
  });
  root.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('tr[data-action], .module-record-card[data-action]')) {
      event.preventDefault();
      detailOrigin = event.target;
      openRecord(event.target.dataset.action, event.target.dataset.id);
    }
  });
  renderShell();
  reloadData().then(() => {
    renderShell();
    showNotice('Conectado a la base de datos.');
  }).catch(error => {
    apiReady = false;
    loadFailed = true;
    renderShell();
    showNotice(error.message, true);
  });
