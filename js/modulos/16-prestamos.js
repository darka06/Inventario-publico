  function createLoan() {
    if (!window.inventarioApi.can('prestamos.crear')) return showNotice('No tienes permiso para registrar alquileres y ventas.', true);
    const available = data.assets.filter(asset => asset.status === 'Disponible');
    const canMoveSupplies = window.inventarioApi.can('insumos.movimientos');
    const availableSupplies = data.supplies.filter(supply => Number(supply.stock) > 0);
    if (!available.length && !availableSupplies.length) {
      showNotice('No hay activos ni insumos disponibles para registrar.', true);
      return;
    }
    const assetLabel = asset => `${asset.name} · ${asset.code}`;
    const sortedAvailable = [...available].sort((a, b) => a.name.localeCompare(b.name, 'es') || a.code.localeCompare(b.code, 'es'));
    const stripAccents = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normalize = value => stripAccents(value).toLocaleLowerCase();
    const selected = new Map();
    openForm('Nuevo alquiler / venta', () => {
      const itemFields = createFormSection('Activos e insumos');
      const itemInput = appendField('itemLabel', 'Activo o insumo disponible', 'text', true, '', { list: [], container: itemFields, full: true });
      itemInput.required = false;
      itemInput.placeholder = 'Buscar por nombre o código…';
      itemInput.autocomplete = 'off';
      const itemList = itemInput.list;
      const typeFields = createFormSection('Tipo de operación');
      const type = appendField('type', 'Tipo', 'select', true, 'Alquiler', { options: ['Alquiler', 'Préstamo', 'Venta'], placeholder: false, container: typeFields });
      const availableItems = () => [
        ...sortedAvailable.map(item => ({ kind: 'asset', item, label: assetLabel(item) })),
        ...availableSupplies.map(item => ({ kind: 'supply', item, label: `${item.name} · ${item.code}` })),
      ];
      const updateOptions = () => {
        if (!itemList) return;
        const plain = itemInput.value.length > 0 && stripAccents(itemInput.value) === itemInput.value;
        itemList.replaceChildren(...availableItems().map(({ label }) => text('option', plain ? stripAccents(label) : label)));
      };
      itemInput.addEventListener('input', updateOptions);
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'btn-cancel';
      add.textContent = 'Agregar';
      itemFields.append(add);
      itemInput.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        add.click();
      });
      const selectedList = document.createElement('div');
      selectedList.className = 'loan-selected-assets';
      itemFields.append(selectedList);
      const drawSelected = () => {
        selectedList.replaceChildren();
        selected.forEach(entry => {
          const row = document.createElement('div');
          row.className = 'loan-selected-asset';
          row.append(text('span', entry.kind === 'asset' ? assetLabel(entry.item) : `${entry.item.code} · ${entry.item.name} (stock: ${entry.item.stock})`));
          if (entry.kind === 'supply') {
            const quantity = document.createElement('input');
            quantity.type = 'number';
            quantity.min = '0.001';
            quantity.max = String(entry.item.stock);
            quantity.step = 'any';
            quantity.value = entry.quantity;
            quantity.className = 'input-narrow';
            quantity.setAttribute('aria-label', `Cantidad de ${entry.item.name}`);
            quantity.addEventListener('input', () => { entry.quantity = quantity.value; });
            row.append(quantity);
          }
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'btn-cancel';
          remove.textContent = 'Quitar';
          remove.addEventListener('click', () => { selected.delete(`${entry.kind}:${entry.item.id}`); drawSelected(); });
          row.append(remove);
          selectedList.append(row);
        });
      };
      add.addEventListener('click', () => {
        const typed = normalize(itemInput.value).trim();
        const match = availableItems().find(({ label }) => normalize(label) === typed)
          || availableItems().find(({ item }) => normalize(item.code) === typed);
        if (!match) return showNotice('Elige un activo o insumo disponible de la lista.', true);
        if (match.kind === 'supply' && !canMoveSupplies) return showNotice('Necesitas permiso para registrar movimientos de insumos.', true);
        selected.set(`${match.kind}:${match.item.id}`, selected.get(`${match.kind}:${match.item.id}`) || { ...match, quantity: '1' });
        itemInput.value = '';
        updateOptions();
        drawSelected();
      });

      const peopleFields = createFormSection('Responsable y cliente');
      appendField('person', 'Responsable / persona', 'text', true, '', { container: peopleFields });
      appendField('client', 'Cliente', 'text', false, '', { list: getContactNames('Cliente'), container: peopleFields });
      const dateFields = createFormSection('Fechas');
      const date = appendField('date', 'Fecha de entrega', 'date', true, TODAY(), { container: dateFields });
      const dueDate = appendField('dueDate', 'Fecha prevista de devolución', 'date', false, '', { container: dateFields });
      const dueDateField = dueDate.closest('.f');
      type.addEventListener('change', () => {
        dueDateField.hidden = type.value === 'Venta';
        date.closest('.f').querySelector('.f-label > span:last-child').textContent = `${type.value === 'Venta' ? 'Fecha de venta' : 'Fecha de entrega'} *`;
        updateOptions();
      });
      const notesFields = createFormSection('Notas');
      appendField('note', 'Observaciones', 'textarea', false, '', { full: true, rows: 2, container: notesFields });
    }, async values => {
      const selectedAssets = [...selected.values()].filter(entry => entry.kind === 'asset');
      const supplyItems = [...selected.values()].filter(entry => entry.kind === 'supply')
        .map(({ item, quantity }) => ({ id: item.id, quantity: Number(quantity) }));
      if (!selected.size) return showNotice('Agrega al menos un activo o insumo disponible.', true);
      if (selectedAssets.some(({ item }) => data.assets.find(asset => asset.id === item.id)?.status !== 'Disponible')) {
        return showNotice('Uno de los activos ya no está disponible. Actualiza la página y vuelve a intentarlo.', true);
      }
      if (supplyItems.some(item => !Number.isFinite(item.quantity) || item.quantity <= 0
        || item.quantity > Number(data.supplies.find(supply => supply.id === item.id)?.stock || 0))) {
        return showNotice('Revisa las cantidades: deben ser mayores que cero y no superar el stock disponible.', true);
      }
      const { itemLabel: _label, ...rest } = values;
      const assetIds = selectedAssets.map(({ item }) => item.id);
      await window.inventarioApi.post('asset.loan', { ...rest, assetIds, ...(assetIds.length ? { assetId: assetIds[0] } : {}), supplyItems });
      await reloadData();
      closeForm();
      renderShell();
    });
  }

  function findLoan(id) {
    return [...data.loans, ...activeLoans().filter(loan => loan.assetOnly)].find(loan => String(loan.id) === String(id));
  }

  function formatPrintDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '');
  }



  function loanDetail(loan) {
    const relatedItems = loan.operationId
      ? data.loans.filter(item => item.operationId === loan.operationId)
      : [loan];
    const itemSummary = document.createElement('ul');
    itemSummary.className = 'detail-operation-items';
    relatedItems.forEach(item => {
      const description = item.supplyOnly ? ` (${formatQuantity(item.quantity)} ${item.unit || ''})` : '';
      itemSummary.append(text('li', `${item.code} · ${item.assetName}${description}`));
    });
    const content = document.createElement('div');
    content.className = 'detail-content';
    const consecutive = /^prestamo:(\d+)$/.exec(String(loan.id)) ? String(loan.id).replace('prestamo:', '') : '';
    if (loan.supplyOnly) {
      content.append(detailSection('Resumen de operación', [
        ['Estado', loan.type === 'Venta' ? 'Vendido' : 'Consumido'], ['Tipo', loan.type], ['Activos e insumos', itemSummary],
        ['Responsable', loan.person], ['Cliente', loan.client],
        [loan.type === 'Venta' ? 'Fecha de venta' : 'Fecha de salida', formatPrintDate(loan.date)], ['Observaciones', loan.note],
      ]));
    } else {
      content.append(detailSection('Resumen', [
        ['Estado', loan.type === 'Venta' ? 'Vendido' : loan.returnedAt ? 'Devuelto' : 'Vigente'], ['Tipo', loan.type],
        ['Activos e insumos', itemSummary], ['Responsable', loan.person], ['Cliente', loan.client],
        ['Fecha', formatPrintDate(loan.date)], ...(loan.type === 'Venta' ? [] : [['Devolución prevista', formatPrintDate(loan.dueDate)]]),
      ]));
    }

    const actions = document.createElement('div');
    actions.className = 'detail-actions d-flex-end';
    const printButton = document.createElement('button');
    printButton.type = 'button';
    printButton.className = 'btn-save';
    printButton.textContent = 'Imprimir entrega';
    printButton.addEventListener('click', () => openDeliveryForm(loan, relatedItems, consecutive));
    actions.append(printButton);
    if (loan.operationId && window.inventarioApi.can('prestamos.editar')) {
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'btn-cancel';
      editButton.textContent = 'Editar';
      editButton.addEventListener('click', () => editLoanOperation(loan));
      actions.append(editButton);
    }
    if (loan.operationId && window.inventarioApi.can('prestamos.eliminar')) {
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'btn-danger';
      deleteButton.textContent = 'Eliminar';
      deleteButton.addEventListener('click', () => deleteLoanOperation(loan));
      actions.append(deleteButton);
    }
    if (actions.childElementCount) content.append(actions);

    function openDeliveryForm(loan, relatedItems, consecutive) {
      closeDetail(false, winOf(printButton));
      const inputs = {};
      const items = relatedItems.map(item => {
        const asset = item.supplyOnly ? {} : data.assets.find(record => String(record.id) === String(item.assetId)) || {};
        return {
          reference: item.supplyOnly ? item.code : asset.model || asset.code || item.code,
          description: item.supplyOnly ? `${item.assetName} (${item.unit || 'unidad'})` : [item.assetName, asset.brand, asset.code ? `(${asset.code})` : ''].filter(Boolean).join(' '),
          serial: item.supplyOnly ? 'No aplica' : asset.serial && String(asset.serial).trim().toLowerCase() !== String(asset.code || '').trim().toLowerCase() ? asset.serial : '',
          quantity: item.supplyOnly ? formatQuantity(item.quantity) : '1',
        };
      });
      openForm('Formato de entrega de activos e insumos', () => {
        const addInput = (key, label, value, full = false, container = fields, readOnly = false) => {
          const wrapper = document.createElement('label');
          wrapper.className = `f${full ? ' full' : ''}`;
          wrapper.append(document.createTextNode(label));
          const control = document.createElement('input');
          control.type = 'text';
          control.value = value || '';
          if (readOnly) {
            control.readOnly = true;
            control.className = 'input-readonly';
          }
          wrapper.append(control);
          container.append(wrapper);
          inputs[key] = control;
        };

        // Sección de información general
        const infoSection = createFormSection('Información de entrega');
        addInput('consecutive', 'Consecutivo No.', consecutive, false, infoSection);
        addInput('date', 'Fecha (dd/mm/aaaa)', formatPrintDate(loan.date || TODAY()), false, infoSection);
        addInput('sender', 'Nombre quien entrega o envía', 'Nombre de la organización', false, infoSection);
        addInput('person', 'Quién entrega o envía', loan.person, false, infoSection);
        addInput('deliveredTo', 'Entregado a', '', false, infoSection);
        addInput('client', 'Cliente', loan.client, false, infoSection);
        addInput('site', 'Sede y/o ciudad', '', false, infoSection);
        addInput('modality', 'Modalidad', String(loan.type || '').toUpperCase(), false, infoSection, true);
        addInput('activity', 'Actividad', '', true, infoSection);

        // Sección de observaciones
        const notesSection = createFormSection('Observaciones');
        addInput('notes', 'Notas adicionales', loan.note || '', true, notesSection);
        formModal.querySelector('.btn-save').textContent = 'Imprimir';
      }, () => {
        const values = Object.fromEntries(Object.entries(inputs).map(([key, control]) => [key, control.value.trim()]));
        printDeliveryForm(values, items.filter(item => Object.values(item).some(value => String(value).trim())));
        closeForm();
      });
    }

    function editLoanOperation(loan) {
      openForm('Editar operación', () => {
        const people = createFormSection('Responsable y cliente');
        appendField('person', 'Responsable / persona', 'text', true, loan.person || '', { container: people });
        appendField('client', 'Cliente', 'text', false, loan.client || '', { container: people });
        const dates = createFormSection('Fechas');
        appendField('date', loan.type === 'Venta' ? 'Fecha de venta' : 'Fecha de entrega', 'date', true, loan.date || TODAY(), { container: dates });
        if (!loan.supplyOnly && loan.type !== 'Venta') appendField('dueDate', 'Fecha prevista de devolución', 'date', false, loan.dueDate || '', { container: dates });
        const notes = createFormSection('Notas');
        appendField('note', 'Observaciones', 'textarea', false, loan.note || '', { full: true, rows: 2, container: notes });
      }, async values => {
        const justification = await window.inventarioApi.askReason({
          title: 'Motivo de la modificación', message: 'Explica por qué se modifican los datos de esta operación.', confirmLabel: 'Guardar',
        });
        if (justification === null) return;
        await window.inventarioApi.post('loan.update', { ...values, dueDate: values.dueDate || '', operationId: loan.operationId, justification });
        await reloadData();
        closeForm();
        closeDetail(false);
        renderShell();
        showNotice('Operación actualizada.');
      });
    }

    function deleteLoanOperation(loan) {
      return window.inventarioApi.askReason({
        title: 'Eliminar operación completa',
        message: 'Se eliminarán todos sus artículos, se restaurará el stock de insumos y los activos volverán a disponibles. Explica el motivo.',
        confirmLabel: 'Eliminar operación', danger: true,
      }).then(async justification => {
        if (justification === null) return;
        await window.inventarioApi.post('loan.delete', { operationId: loan.operationId, justification });
        await reloadData();
        closeDetail(false);
        renderShell();
        showNotice('Operación eliminada y existencias restauradas.');
      }).catch(error => { if (!error.cancelled) showNotice(error.message, true); });
    }
    showDetail(`${loan.type} · ${loan.code}`, content);
  }

  function printDeliveryForm(values, items) {
    const esc = s => {
      const fn = window.INVENTARIO_CONSTANTS?.escapeHtml;
      if (fn) return fn(s);
      return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    };
    const rows = [];
    const rowCount = Math.max(28, items.length);
    for (let index = 0; index < rowCount; index += 1) {
      const item = items[index] || {};
      rows.push(`<tr><td class="c">${index + 1}</td><td class="c">${esc(item.reference)}</td><td>${esc(item.description)}</td><td class="c">${esc(item.serial)}</td><td class="c">${esc(item.quantity)}</td></tr>`);
    }
    const info = (label, value) => `<tr><td class="lbl">${label}</td><td colspan="2">${esc(value)}</td></tr>`;
    const cssUrl = new URL(`${document.body.dataset.root || '../'}css/print/entrega.css`, location.href).href;
    const logoUrl = new URL(`${document.body.dataset.root || '../'}icons/logo.svg`, location.href).href;
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Entrega de activos e insumos ${esc(values.consecutive)}</title>
<link rel="stylesheet" href="${cssUrl}"></head><body><div class="sheet">
<table class="head"><tr>
  <td class="logo" rowspan="2"><img src="${logoUrl}" alt=""><b>INVENTARIO</b></td>
  <td class="title" colspan="2">ENTREGA DE ACTIVOS E INSUMOS</td></tr>
  <tr><td class="c"><b>Versión:0</b></td><td class="c"><b>Fecha de Vigencia:30/07/2025</b></td></tr></table>
<div class="center box-top0">INVENTARIO</div>
<table class="mt6"><tr><td class="lbl">Fecha:</td><td>${esc(values.date)}</td><td class="w30">Consecutivo No. <b class="fr">${esc(values.consecutive)}</b></td></tr></table>
<table class="info mt6">
  ${info('Nombre quien entrega o envía:', values.sender)}
  ${info('Quién entrega o envía', values.person)}
  ${info('Entregado a:', values.deliveredTo)}
  ${info('Cliente:', values.client)}
  ${info('Sede y/o ciudad:', values.site)}
  ${info('Modalidad:', values.modality)}
  ${info('Actividad', values.activity)}
</table>
<div class="center box-bottom0">Elementos Ingresados</div>
<table class="items"><thead><tr><th>Item</th><th>Referencia</th><th>Descripción</th><th>SERIAL</th><th>Cantidad</th></tr></thead><tbody>${rows.join('')}</tbody></table>
<div class="center box-top0">Observaciones</div>
<table><tr><td class="notes">${esc(values.notes)}</td></tr></table>
<p class="legal">Aviso: La información contenida en el presente documento se presume auténtica. En caso de presentarse alguna inconsistencia entre los elementos efectivamente ingresados y los datos plasmados en el registro, el colaborador encargado de la recepción y diligenciamiento del presente formato será responsable de la cantidad y calidad de los artículos.</p>
<table class="sign">
  <tr>
    <td class="col-l">
      <table>
        <tr><td colspan="2"><b>Entrega:</b></td></tr>
        <tr><td class="w20">Firma</td><td class="line"></td></tr>
        <tr><td>Nombre</td><td class="line"></td></tr>
        <tr><td>C.C.</td><td class="line"></td></tr>
      </table>
    </td>
    <td class="col-r">
      <table>
        <tr><td colspan="2"><b>Recibe:</b></td></tr>
        <tr><td class="w20">Firma</td><td class="line"></td></tr>
        <tr><td>Nombre</td><td class="line"></td></tr>
        <tr><td>C.C.</td><td class="line"></td></tr>
      </table>
    </td>
  </tr>
</table>
</div></body></html>`;

    const frame = document.createElement('iframe');
    frame.className = 'iframe-hidden';
    frame.setAttribute('aria-hidden', 'true');
    document.body.append(frame);
    frame.onload = () => {
      const win = frame.contentWindow;
      const finish = () => setTimeout(() => frame.remove(), 1000);
      win.onafterprint = finish;
      const logo = win.document.querySelector('.logo img');
      const fitToOnePage = () => {
        // Hoja carta: ajuste para llenar toda la página
        const sheet = win.document.querySelector('.sheet');
        const available = 1800; // Espacio máximo disponible en px para contenido
        const height = sheet.offsetHeight;
        if (height < available) {
          // Sobra espacio: se reparte entre las filas para que el formato llene toda la hoja.
          const cells = [...win.document.querySelectorAll('.items tbody td')];
          const rowsCount = cells.length / 5;
          const extra = (available - height) / rowsCount;
          const base = cells[0] ? cells[0].offsetHeight : 25;
          cells.forEach(cell => { cell.style.setProperty('--cell-height', `${base + extra}px`); });
        }
        if (sheet.offsetHeight > available) sheet.style.setProperty('--sheet-zoom', String((available / sheet.offsetHeight) * 0.99));
      };
      const go = () => { fitToOnePage(); win.focus(); win.print(); };
      if (logo && !logo.complete) { logo.onload = go; logo.onerror = go; } else go();
    };
    frame.srcdoc = html;
  }

  function returnLoan(id) {
    const loan = data.loans.find(item => item.id === id);
    if (!loan || loan.returnedAt) return;
    if (!confirm(`¿Registrar la devolución de ${loan.assetName}?`)) return;
    const assignmentId = String(loan.id).replace(/^prestamo:/, '');
    window.inventarioApi.post('loan.return', { id: assignmentId, assetId: loan.assetId }).then(reloadData).then(renderShell)
      .catch(error => showNotice(error.message, true));
  }

