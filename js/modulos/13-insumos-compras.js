function editSupply(id = null) {
    const existing = data.supplies.find(supply => supply.id === id);
    openForm(existing ? 'Editar insumo' : 'Nuevo insumo', () => {
      fields.append(detailHero(getCardIcon(existing && existing.name, ''),
        existing ? existing.code : 'Nuevo insumo', existing ? (existing.unit || 'Unidad') : '', 'Unidad'));
      const identityFields = createFormSection('Datos del insumo');
      appendField('code', 'Código', 'text', true, existing && existing.code, { container: identityFields });
      appendField('name', 'Descripción del insumo', 'text', true, existing && existing.name, { container: identityFields });
      appendField('brand', 'Marca', 'text', false, existing && existing.brand, {
        list: getBrandRecords().map(brand => brand.name),
        container: identityFields,
      });
      appendField('unit', 'Unidad de medida', 'select', true, existing && existing.unit || 'Unidad', { options: ['Unidad', 'Metro'], container: identityFields });

      const inventoryFields = createFormSection('Inventario y costo');
      appendField('minimum', 'Stock mínimo', 'number', false, existing && existing.minimum || '0', {
        step: 'any',
        container: inventoryFields,
      });
      if (!existing) {
        appendField('stock', 'Stock inicial', 'number', false, '0', {
          step: 'any',
          container: inventoryFields,
        });
      }
      appendField('unitCost', 'Costo unitario (COP)', 'number', false, existing && existing.unitCost || '0', {
        step: '1',
        container: inventoryFields,
      });

      const notesFields = createFormSection('Notas');
      appendField('notes', 'Observaciones adicionales', 'textarea', false, existing && existing.notes, {
        full: true,
        rows: 2,
        container: notesFields,
      });
    }, async values => {
      if (values.code.length < 3 || values.code.length > 80) {
        showNotice('El código debe tener entre 3 y 80 caracteres.', true);
        return;
      }
      if (values.name.length < 3 || values.name.length > 255) {
        showNotice('La descripción debe tener entre 3 y 255 caracteres.', true);
        return;
      }
      if (values.unit.length < 2 || values.unit.length > 80) {
        showNotice('La unidad debe tener entre 2 y 80 caracteres.', true);
        return;
      }
      if (data.supplies.some(supply => supply.id !== id && supply.code.toLocaleLowerCase() === values.code.toLocaleLowerCase())) {
        showNotice('Ya existe un insumo con ese código.', true);
        return;
      }
      await window.inventarioApi.post('supply.save', { ...(existing ? { id: existing.id } : {}), ...values });
      await reloadData();
      closeForm();
      renderShell();
    });
  }

  // Entradas, compras y entregas de un insumo. Las usan el detalle (últimos 3) y el historial (todos).
  function supplyMovementEntries(supply) {
    return data.movements
      .filter(movement => movement.kind === 'Insumo' && movement.code === supply.code)
      .map(movement => ({
        date: movement.date,
        title: `${movement.action} · ${Number(movement.quantity || 0).toLocaleString('es-CO')} ${supply.unit || ''}`.trim(),
        description: [movement.person, movement.destination, movement.note].filter(Boolean).join(' · '),
      }));
  }

  function openSupplyHistory(id) {
    const supply = data.supplies.find(item => item.id === id);
    if (!supply) return;
    openHistoryWindow(`supply-history:${id}`, `Historial · ${supply.code || supply.name}`,
      detailTimeline('Movimientos', supplyMovementEntries(supply), 'Sin entradas ni salidas registradas para este insumo.', 500));
  }

  function deleteSupply(id) {
    const supply = data.supplies.find(item => item.id === id);
    if (!window.inventarioApi.can('insumos.eliminar')) return showNotice('No tienes permiso para eliminar insumos.', true);
    if (!supply) return;
    deleteWithReason({
      title: `Eliminar el insumo ${supply.code} - ${supply.name}`,
      message: 'Esta acción no se puede deshacer. Los movimientos y compras ya registrados se conservan. Explica por qué se elimina.',
      action: 'supply.delete',
      id,
      done: () => { closeDetail(); renderShell(); showNotice('Insumo eliminado.'); },
    });
  }

  function stockMovement(supplyId = null) {
    if (!data.supplies.length) {
      showNotice('Crea un insumo o registra una compra antes de mover stock.', true);
      return;
    }
    openForm('Registrar movimiento de insumo', () => {
      const movementFields = createFormSection('Datos del movimiento');
      appendField('type', 'Movimiento', 'select', true, 'Salida', { options: ['Entrada', 'Salida'], placeholder: false, container: movementFields });
      const supplyLabel = supply => `${supply.code} · ${supply.name} (stock: ${supply.stock})`;
      const preselected = data.supplies.find(supply => supply.id === supplyId);
      appendField('supplyId', 'Insumo', 'text', true, preselected ? supplyLabel(preselected) : '', {
        list: data.supplies.map(supplyLabel),
        container: movementFields,
      }).placeholder = 'Escribe para buscar por código o nombre…';
      appendField('quantity', 'Cantidad', 'number', true, '', { min: 0.001, step: 'any', container: movementFields });
      appendField('date', 'Fecha', 'date', true, TODAY(), { container: movementFields });

      const destinationFields = createFormSection('Responsable y destino');
      appendField('person', 'Entregado a / responsable', 'text', false, '', { list: getPeople(), container: destinationFields });
      appendField('destination', 'Destino / origen', 'text', false, '', { container: destinationFields });

      const notesFields = createFormSection('Notas');
      appendField('note', 'Observaciones adicionales', 'textarea', false, '', {
        full: true,
        rows: 2,
        container: notesFields,
      });
    }, async values => {
      const typed = String(values.supplyId || '').trim().toLocaleLowerCase();
      const supply = data.supplies.find(item => `${item.code} · ${item.name} (stock: ${item.stock})`.toLocaleLowerCase() === typed)
        || data.supplies.find(item => item.code.toLocaleLowerCase() === typed);
      const quantity = Number(values.quantity);
      if (!supply || !Number.isFinite(quantity) || quantity <= 0) {
        showNotice('Selecciona un insumo de la lista e indica una cantidad mayor que cero.', true);
        return;
      }
      await window.inventarioApi.post('supply.move', {
        supplyId: supply.id,
        type: values.type,
        quantity,
        date: values.date,
        person: values.person,
        destination: values.destination,
        note: values.note,
      });
      await reloadData();
      closeForm();
      renderShell();
    });
  }

  function purchaseDetail(purchase) {
    const content = document.createElement('div');
    content.className = 'detail-content';
    content.append(detailSection('Compra', [
      ['Tipo', purchase.type], ['Código', purchase.code], ['Descripción', purchase.description],
      ['Cantidad', `${formatQuantity(purchase.quantity)} ${purchase.unit || ''}`.trim()],
      ['Costo unitario', money(purchase.unitCost)], ['IVA', `${formatQuantity(purchase.tax)} %`],
      ['Total', money(purchase.total)], ['Proveedor', purchase.supplier], ['Factura', purchase.invoice],
      ['Fecha de compra', formatPrintDate(purchase.date)],
      ...(purchase.brand ? [['Marca', purchase.brand]] : []),
      ...(purchase.model ? [['Modelo', purchase.model]] : []),
      ...(purchase.serial ? [['Número de serie', purchase.serial]] : []),
    ]));
    const actions = document.createElement('div');
    actions.className = 'detail-actions';
    if (window.inventarioApi.can('compras.editar')) {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn-cancel';
      edit.textContent = 'Editar';
      edit.addEventListener('click', () => editPurchase(purchase.id));
      actions.append(edit);
    }
    if (window.inventarioApi.can('compras.eliminar')) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn-danger';
      remove.textContent = 'Eliminar';
      remove.addEventListener('click', () => deletePurchaseRecord(purchase.id));
      actions.append(remove);
    }
    if (actions.childElementCount) content.append(actions);
    showDetail(`Compra · ${purchase.code}`, content);
  }

  function movementDetail(movement) {
    const content = document.createElement('div');
    content.className = 'detail-content';
    content.append(detailSection('Detalle del movimiento', [
      ['Fecha', formatPrintDate(movement.date)], ['Tipo de producto', movement.kind], ['Movimiento', movement.action],
      ['Código', movement.code], ['Descripción', movement.description],
      ['Cantidad', `${formatQuantity(movement.quantity)} ${movement.unit || ''}`.trim()],
      ['Responsable', movement.person], ['Destino / origen', movement.destination], ['Observaciones', movement.note],
    ]));
    const actions = document.createElement('div');
    actions.className = 'detail-actions';
    if (window.inventarioApi.can('movimientos.eliminar')) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn-danger';
      remove.textContent = 'Eliminar movimiento';
      remove.addEventListener('click', () => deleteMovementRecord(movement));
      actions.append(remove);
    }
    if (actions.childElementCount) content.append(actions);
    showDetail(`Movimiento · ${movement.code || movement.kind}`, content);
  }

  function deleteMovementRecord(movement) {
    const message = movement.kind === 'Activo'
      ? 'Solo se pueden borrar movimientos de activos que ya fueron eliminados. El historial del activo se conserva mientras exista.'
      : movement.action === 'Compra / entrada' || movement.action === 'COMPRA'
        ? 'Este movimiento debe eliminarse desde Compras para conservar el inventario y su registro sincronizados.'
        : 'Si es una salida, se devolverá esa cantidad al stock; si es una entrada, se descontará. Explica por qué se elimina.';
    return window.inventarioApi.askReason({ title: `Eliminar movimiento · ${movement.code || movement.kind}`, message, confirmLabel: 'Eliminar', danger: true })
      .then(async justification => {
        if (justification === null) return;
        await window.inventarioApi.post('movement.delete', { id: movement.id, justification });
        await reloadData();
        closeDetail(false);
        renderShell();
        showNotice('Movimiento eliminado.');
      }).catch(error => { if (!error.cancelled) showNotice(error.message, true); });
  }

  function editPurchase(id) {
    const purchase = data.purchases.find(item => item.id === id);
    if (!purchase) return;
    openForm('Editar compra', () => {
      const info = createFormSection('Datos de la compra');
      appendField('date', 'Fecha de compra', 'date', true, purchase.date, { container: info });
      appendField('description', 'Descripción', 'text', true, purchase.description, { container: info, full: true });
      if (purchase.type === 'Insumo') {
        appendField('quantity', 'Cantidad', 'number', true, purchase.quantity, { min: 0.001, step: 'any', container: info });
        appendField('unit', 'Unidad de medida', 'select', true, purchase.unit || 'Unidad', { options: ['Unidad', 'Metro'], container: info });
        appendField('brand', 'Marca', 'text', false, purchase.brand || '', { container: info });
      } else {
        appendField('brand', 'Marca', 'text', false, purchase.brand || '', { container: info });
        appendField('model', 'Modelo', 'text', false, purchase.model || '', { container: info });
        appendField('serial', 'Número de serie', 'text', false, purchase.serial || '', { container: info });
      }
      const cost = createFormSection('Costo');
      appendField('unitCost', 'Costo unitario (COP)', 'number', true, purchase.unitCost || '0', { min: 0, step: '1', container: cost });
      appendField('tax', 'IVA (%)', 'number', false, purchase.tax || '0', { min: 0, max: 100, step: '0.01', container: cost });
      const supplier = createFormSection('Proveedor y factura');
      appendField('supplier', 'Proveedor', 'text', false, purchase.supplier || '', { list: getContactNames('Proveedor'), container: supplier });
      appendField('invoice', 'Factura', 'text', false, purchase.invoice || '', { container: supplier });
    }, async values => {
      const quantity = purchase.type === 'Insumo' ? Number(values.quantity) : 1;
      const unitCost = Number(values.unitCost);
      const tax = Number(values.tax || 0);
      if (!Number.isFinite(quantity) || quantity <= 0 || Math.round(quantity * 1000) !== quantity * 1000 || !Number.isFinite(unitCost) || unitCost < 0 || !Number.isFinite(tax) || tax < 0 || tax > 100) {
        return showNotice('Revisa cantidad, costo e IVA.', true);
      }
      const justification = await window.inventarioApi.askReason({ title: 'Motivo de la modificación', message: 'Explica por qué se modifica esta compra.', confirmLabel: 'Guardar' });
      if (justification === null) return;
      await window.inventarioApi.post('purchase.update', { ...values, id: purchase.id, quantity, unitCost, tax, justification });
      await reloadData();
      closeForm();
      closeDetail(false);
      renderShell();
      showNotice('Compra actualizada.');
    });
  }

  function deletePurchaseRecord(id) {
    const purchase = data.purchases.find(item => item.id === id);
    if (!purchase) return;
    const message = purchase.type === 'Insumo'
      ? 'Se descontará del stock la cantidad de esta compra. Solo se puede eliminar si esa cantidad aún está disponible. Explica el motivo.'
      : 'También se eliminará el activo comprado si sigue disponible y no tiene asignaciones. Explica el motivo.';
    return window.inventarioApi.askReason({ title: `Eliminar compra · ${purchase.code}`, message, confirmLabel: 'Eliminar', danger: true })
      .then(async justification => {
        if (justification === null) return;
        await window.inventarioApi.post('purchase.delete', { id: purchase.id, justification });
        await reloadData();
        closeDetail(false);
        renderShell();
        showNotice('Compra eliminada.');
      }).catch(error => { if (!error.cancelled) showNotice(error.message, true); });
  }

  function purchaseForm() {
    openForm('Registrar compra', () => {
      const purchaseFields = createFormSection('Datos de la compra');
      const kind = appendField('type', 'Tipo de compra', 'select', true, 'Activo', { options: ['Activo', 'Insumo'], placeholder: false, container: purchaseFields });
      appendField('date', 'Fecha de compra', 'date', true, TODAY(), { container: purchaseFields });
      appendField('description', 'Descripción', 'text', true, '', { container: purchaseFields });
      appendField('code', 'Código / referencia', 'text', false, '', { container: purchaseFields });
      appendField('category', 'Categoría del activo', 'text', false, '', {
        list: data.categories.map(category => category.name),
        kindField: 'asset',
        container: purchaseFields,
      });
      appendField('serial', 'Número de serie', 'text', false, '', { kindField: 'asset', container: purchaseFields });
      appendField('unit', 'Unidad de medida', 'select', false, 'Unidad', { options: ['Unidad', 'Metro'], placeholder: false, kindField: 'supply', container: purchaseFields });

      const costFields = createFormSection('Cantidad y costo');
      appendField('quantity', 'Cantidad', 'number', true, '1', { min: 1, step: '1', container: costFields });
      appendField('unitCost', 'Costo unitario (COP)', 'number', true, '0', { step: '1', container: costFields });
      appendField('tax', 'IVA (%)', 'number', false, '0', { step: '0.01', container: costFields });

      const supplierFields = createFormSection('Proveedor y factura');
      appendField('supplier', 'Proveedor', 'text', false, '', { list: getContactNames('Proveedor'), container: supplierFields });
      appendField('invoice', 'Factura', 'text', false, '', { container: supplierFields });

      const syncKind = () => {
        fields.querySelectorAll('[data-kind-field]').forEach(label => {
          label.hidden = label.dataset.kindField !== (kind.value === 'Activo' ? 'asset' : 'supply');
        });
      };
      kind.addEventListener('change', syncKind);
      syncKind();
    }, async values => {
      const quantity = Number(values.quantity);
      const unitCost = Number(values.unitCost);
      const tax = Number(values.tax || 0);
      if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitCost) || unitCost < 0 || !Number.isFinite(tax) || tax < 0 || tax > 100) {
        showNotice('Revisa la cantidad, el costo unitario y el IVA.', true);
        return;
      }
      await window.inventarioApi.post('purchase.create', { ...values, quantity, unitCost, tax });
      await reloadData();
      closeForm();
      renderShell();
    });
  }
