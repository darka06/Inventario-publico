function editAsset(id = null) {
    const existing = data.assets.find(asset => asset.id === id);
    const editableStatuses = ['Disponible', 'En reparación', 'Vendido'];
    if (existing && !editableStatuses.includes(existing.status)) editableStatuses.unshift(existing.status);
    openForm(existing ? 'Editar activo' : 'Nuevo activo', () => {
      fields.append(detailHero(getCardIcon(existing && existing.name, existing && existing.category),
        existing ? existing.code : 'Nuevo activo', existing && existing.category));
      const identityFields = createFormSection('Datos del activo');
      appendField('name', 'Nombre del activo', 'text', true, existing && existing.name, { container: identityFields });
      appendField('code', 'Código de inventario', 'text', true, existing && existing.code, { container: identityFields });
      const categoryOptions = [...data.categories];
      if (existing && existing.category && !categoryOptions.some(category => category.name === existing.category)) {
        categoryOptions.push({ name: existing.category });
      }
      appendField('category', 'Categoría', 'select', true, existing && existing.category, {
        options: categoryOptions.map(category => ({ value: category.name, label: category.name })),
        placeholder: 'Sin categoría',
        container: identityFields,
      });
      appendField('brand', 'Marca', 'text', false, existing && existing.brand, {
        list: getBrandRecords().map(brand => brand.name),
        container: identityFields,
      });
      appendField('model', 'Modelo', 'text', false, existing && existing.model, { container: identityFields });
      appendField('serial', 'Número de serie', 'text', false, existing && existing.serial, { container: identityFields });
      appendField('location', 'Ubicación', 'text', false, existing && existing.location, { container: identityFields });
      appendField('description', 'Descripción', 'textarea', false, existing && existing.description, {
        full: true,
        rows: 2,
        container: identityFields,
      });

      const purchaseFields = createFormSection('Estado y compra');
      appendField('status', 'Estado', 'select', true, existing && existing.status || 'Disponible', {
        options: editableStatuses,
        container: purchaseFields,
      });
      appendField('purchaseDate', 'Fecha de compra', 'date', false, existing && existing.purchaseDate, { container: purchaseFields });
      appendField('supplier', 'Proveedor', 'text', false, existing && existing.supplier, {
        list: getContactNames('Proveedor'),
        container: purchaseFields,
      });
      appendField('invoice', 'Factura', 'text', false, existing && existing.invoice, { container: purchaseFields });
      appendField('warrantyEnd', 'Fin de garantía', 'date', false, existing && existing.warrantyEnd, { container: purchaseFields });
      appendField('cost', 'Costo de compra (COP)', 'number', false, existing && existing.cost || '', {
        step: '1',
        container: purchaseFields,
      });
      const notesFields = createFormSection('Notas');
      appendField('notes', 'Observaciones adicionales', 'textarea', false, existing && existing.notes, {
        full: true,
        rows: 2,
        container: notesFields,
      });
    }, async values => {
      if (data.assets.some(asset => asset.id !== id && asset.code.toLocaleLowerCase() === values.code.toLocaleLowerCase())) {
        showNotice('Ya existe un activo con ese código de inventario.', true);
        return;
      }
      await window.inventarioApi.post('asset.save', {
        ...(existing ? { id: existing.id } : {}),
        ...values,
        cost: Number(values.cost || 0),
      });
      await reloadData();
      closeForm();
      renderShell();
    });
  }

  function assetDetail(asset) {
    const content = document.createElement('div');
    content.className = 'detail-content';
    const serial = String(asset.serial || '').trim();
    const code = String(asset.code || '').trim();
    const serialDetail = serial && serial.toLocaleLowerCase() !== code.toLocaleLowerCase() ? serial : null;
    const hero = detailHero(getCardIcon(asset.name, asset.category), asset.code, asset.category);
    const detailContent = [
      hero,
      detailMetrics([
        Number(asset.cost) > 0 ? { label: 'Costo de compra', value: Number(asset.cost).toLocaleString('es-CO'), unit: 'COP', tone: 'ok' } : null,
        warrantyMetric(asset.warrantyEnd),
        asset.lastMovement ? { label: 'Último movimiento', value: relativeDetailDate(asset.lastMovement) || formatDetailDate(asset.lastMovement) } : null,
      ]),
      detailSection('Detalles del activo', [
        ['Marca', asset.brand], ['Modelo', asset.model], ['Número de serie', serialDetail],
        ['Responsable', asset.assignedTo], ['Cliente', asset.client],
        ['Fecha de compra', formatDetailDate(asset.purchaseDate)],
        ['Proveedor / factura', [asset.supplier, asset.invoice && `Factura ${asset.invoice}`].filter(Boolean).join(' · ')],
        ['Ubicación', asset.location],
        ['Fin de garantía', formatDetailDate(asset.warrantyEnd)],
        ['Tipo', asset.type], ['Subtipo', asset.subtype],
        ['IVA', asset.tax != null && asset.tax !== '' ? `${Number(asset.tax)} %` : ''],
      ]),
      detailSection('Registro', [
        ['Fecha de registro de compra', formatDetailDate(asset.registeredAt)],
        ['Último movimiento', formatDetailDate(asset.lastMovement)],
      ]),
      detailSection('Notas', [['Descripción', asset.description], ['Observaciones', asset.notes]]),
    ];
    // Las acciones van en la cabecera del modal; Editar y Eliminar solo existen si el rol tiene el permiso.
    const assetActions = document.createElement('div');
    if (asset.status === 'Disponible') assetActions.append(button('Asignar', 'assign-asset', asset.id));
    assetActions.append(button('Historial', 'asset-history', asset.id, true));
    if (window.inventarioApi.can('activos.editar')) assetActions.append(button('Editar', 'edit-asset', asset.id, true));
    if (window.inventarioApi.can('activos.eliminar')) {
      const removeButton = button('Eliminar', 'delete-asset', asset.id);
      removeButton.className = 'btn-danger';
      assetActions.append(removeButton);
    }
    content.append(...detailContent);
    showDetail(asset.name, content, { wide: true, actions: assetActions, status: { label: asset.status, cls: statusClass(asset.status) } });
  }

  // Botones Editar / Eliminar de la cabecera de una ventana de detalle.
  // Solo aparecen si el rol del usuario tiene el permiso correspondiente.
  function recordActions(id, { history, edit, editPermission, remove, removePermission }) {
    const actions = document.createElement('div');
    if (history && window.inventarioApi.can('historial.ver')) actions.append(button('Historial', history, id, true));
    if (edit && window.inventarioApi.can(editPermission)) actions.append(button('Editar', edit, id, true));
    if (remove && window.inventarioApi.can(removePermission)) {
      const removeButton = button('Eliminar', remove, id);
      removeButton.className = 'btn-danger';
      actions.append(removeButton);
    }
    return actions;
  }

  function simpleDetail(title, sections, actions, status) {
    const content = document.createElement('div');
    content.className = 'detail-content';
    content.append(...sections);
    showDetail(title, content, { actions, status: status ? { label: status, cls: statusClass(status) } : null });
  }

  function categoryDetail(category) {
    simpleDetail(category.name, [
      detailMetrics([{ label: 'Activos asociados', value: Number(category.assetCount || 0).toLocaleString('es-CO'), tone: 'ok' }]),
    ], recordActions(category.id, { history: 'category-history', edit: 'edit-category', editPermission: 'categorias.editar', remove: 'delete-category', removePermission: 'categorias.eliminar' }));
  }

  function brandDetail(brand) {
    simpleDetail(brand.name, [
      detailMetrics([
        { label: 'Activos asociados', value: Number(brand.assetCount || 0).toLocaleString('es-CO') },
        { label: 'Insumos asociados', value: Number(brand.supplyCount || 0).toLocaleString('es-CO') },
        { label: 'Total de productos', value: (Number(brand.assetCount || 0) + Number(brand.supplyCount || 0)).toLocaleString('es-CO'), tone: 'ok' },
      ]),
    ], recordActions(brand.id, { history: 'brand-history', edit: 'rename-brand', editPermission: 'marcas.editar', remove: 'delete-brand', removePermission: 'marcas.eliminar' }));
  }

  function contactDetail(contact) {
    simpleDetail(contact.name, [
      detailSection(contact.type === 'Proveedor' ? 'Detalles del proveedor' : 'Detalles del cliente', [
        ['Razón social / nombre', contact.name], ['NIT / documento', contact.nit], ['Correo', contact.email],
        ['Teléfono', contact.phone], ['Dirección', contact.address],
      ]),
      detailSection('Notas', [['Observaciones', contact.notes]]),
    ], recordActions(contact.id, { history: 'contact-history', edit: 'edit-contact', editPermission: 'contactos.editar', remove: 'delete-contact', removePermission: 'contactos.eliminar' }));
  }

  function toolDetail(tool) {
    simpleDetail(tool.name, [
      detailMetrics([{ label: 'Cantidad', value: Number(tool.quantity || 0).toLocaleString('es-CO'), unit: Number(tool.quantity) === 1 ? 'unidad' : 'unidades', tone: 'ok' }]),
      detailSection('Detalles de la herramienta', [
        ['Marca', tool.brand], ['Descripción', tool.description], ['Serial', tool.serial], ['Responsable', tool.responsible],
      ]),
    ], recordActions(tool.id, { history: 'tool-history', edit: 'edit-tool', editPermission: 'herramientas.editar', remove: 'delete-tool', removePermission: 'herramientas.eliminar' }), tool.status);
  }

  function userDetail(user) {
    simpleDetail(user.nombre, [
      detailSection('Detalles del funcionario', [
        ['Cargo', user.cargo], ['Documento', user.documento], ['Área', user.area],
        ['Correo', user.correo], ['Teléfono', user.telefono],
      ]),
      detailSection('Notas', [['Observaciones', user.notas]]),
    ], recordActions(user.id, { history: 'user-history', edit: 'edit-user', editPermission: 'funcionarios.editar', remove: 'delete-user', removePermission: 'funcionarios.eliminar' }), user.estado);
  }

  function supplyDetail(supply) {
    const content = document.createElement('div');
    content.className = 'detail-content';
    const lowStock = Number(supply.stock || 0) <= Number(supply.minimum || 0);
    const hero = detailHero(getCardIcon(supply.name, ''), supply.code, supply.unit || 'Unidad', 'Unidad');
    const stockValue = Number(supply.stock || 0);
    const minimumValue = Number(supply.minimum || 0);
    const unitLabel = supply.unit || '';
    const progress = minimumValue > 0 ? Math.min(100, (stockValue / minimumValue) * 100) : stockValue > 0 ? 100 : 0;
    const progressTrack = document.createElement('div');
    progressTrack.className = `detail-stock-track${lowStock ? ' is-low' : ''}`;
    progressTrack.setAttribute('role', 'progressbar');
    progressTrack.setAttribute('aria-label', 'Stock en relación con el mínimo');
    progressTrack.setAttribute('aria-valuemin', '0');
    progressTrack.setAttribute('aria-valuemax', '100');
    progressTrack.setAttribute('aria-valuenow', String(Math.round(progress)));
    const progressBar = document.createElement('span');
    progressBar.className = 'progress-bar-fill';
    progressBar.style.width = `${progress}%`;
    progressTrack.append(progressBar);
    const stock = detailMetrics([
      { label: 'Stock actual', value: stockValue.toLocaleString('es-CO'), unit: unitLabel, tone: lowStock ? 'warn' : 'ok' },
      { label: 'Stock mínimo', value: minimumValue.toLocaleString('es-CO'), unit: unitLabel },
    ], progressTrack);
    const movementTotals = detailMetrics([
      { label: 'Entradas', value: Number(supply.entries || 0).toLocaleString('es-CO'), unit: unitLabel },
      { label: 'Salidas', value: Number(supply.exits || 0).toLocaleString('es-CO'), unit: unitLabel },
      { label: 'Valor en stock', value: (stockValue * Number(supply.unitCost || 0)).toLocaleString('es-CO'), unit: 'COP', tone: 'ok' },
    ]);

    content.append(
      hero,
      stock,
      movementTotals,
      detailSection('Producto', [
        ['Descripción', supply.name], ['Marca', supply.brand], ['Unidad de medida', supply.unit],
        ['Costo unitario', money(supply.unitCost)],
      ]),
      detailSection('Notas', [['Observaciones adicionales', supply.notes]]),
    );
    showDetail(supply.name, content, {
      actions: recordActions(supply.id, { history: 'supply-history', edit: 'edit-supply', editPermission: 'insumos.editar', remove: 'delete-supply', removePermission: 'insumos.eliminar' }),
      status: { label: lowStock ? 'Stock bajo' : 'Stock disponible', cls: lowStock ? 'st-repair' : 'st-use' },
    });
  }

  function assignAsset(id) {
    const asset = data.assets.find(item => item.id === id);
    if (!asset || asset.status !== 'Disponible') return;
    const people = getPeople();
    openForm('Asignar activo', () => {
      appendField('person', 'Asignar a (persona)', 'text', true, '', { list: people });
      appendField('client', 'Cliente / sede', 'text');
      appendField('date', 'Fecha de entrega', 'date', true, TODAY());
      appendField('note', 'Observaciones', 'textarea', false, '', { full: true });
    }, async values => {
      await window.inventarioApi.post('asset.assign', { assetId: id, ...values });
      await reloadData();
      closeForm();
      closeDetail();
      renderShell();
    });
  }

  function returnAsset(id) {
    const asset = data.assets.find(item => item.id === id);
    if (!asset || !confirm(`¿Registrar la devolución de ${asset.name}?`)) return;
    window.inventarioApi.post('asset.return', { assetId: id }).then(reloadData).then(() => {
      closeDetail();
      renderShell();
    }).catch(error => showNotice(error.message, true));
  }
