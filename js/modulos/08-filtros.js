function filterFields() {
    const records = filterRecords();
    const dynamicOptions = key => distinctFilterOptions(records, key);
    const definitions = {
      assets: [
        ['code', 'Código', 'text'], ['name', 'Activo', 'text'],
        ['category', 'Categoría', 'select', dynamicOptions('category')],
        ['status', 'Estado', 'select', STATUSES],
        ['brand', 'Marca', 'text'], ['model', 'Modelo', 'text'], ['serial', 'Número de serie', 'text'],
        ['assignedTo', 'Responsable', 'text'], ['client', 'Cliente', 'text'],
        ['cost', 'Costo de compra', 'number'], ['purchaseDate', 'Fecha de compra', 'date'],
      ],
      categories: [['name', 'Categoría', 'text'], ['assetCount', 'Activos asociados', 'number']],
      brands: [['name', 'Marca', 'text'], ['assetCount', 'Activos asociados', 'number'], ['supplyCount', 'Insumos asociados', 'number']],
      consumables: [
        ['code', 'Código', 'text'], ['name', 'Insumo', 'text'], ['brand', 'Marca', 'text'],
        ['unit', 'Unidad', 'text'], ['entries', 'Entradas', 'number'], ['exits', 'Salidas', 'number'], ['stock', 'Stock', 'number'], ['minimum', 'Stock mínimo', 'number'],
        ['unitCost', 'Costo unitario', 'number'], ['notes', 'Notas', 'text'],
      ],
      tools: [
        ['name', 'Herramienta', 'text'], ['description', 'Descripción', 'text'], ['brand', 'Marca', 'text'],
        ['serial', 'Serial', 'text'], ['quantity', 'Cantidad', 'number'], ['cost', 'Precio de compra', 'number'],
        ['status', 'Estado', 'select', TOOL_STATUSES], ['responsible', 'Responsable', 'text'],
      ],
      purchases: [
        ['date', 'Fecha', 'date'], ['type', 'Tipo', 'select', dynamicOptions('type')],
        ['code', 'Código', 'text'], ['description', 'Descripción', 'text'], ['quantity', 'Cantidad', 'number'],
        ['supplier', 'Proveedor', 'text'], ['invoice', 'Factura', 'text'], ['total', 'Total', 'number'],
      ],
      movements: [
        ['date', 'Fecha', 'date'], ['kind', 'Tipo', 'select', dynamicOptions('kind')],
        ['action', 'Movimiento', 'select', dynamicOptions('action')], ['code', 'Código', 'text'],
        ['description', 'Descripción', 'text'], ['quantity', 'Cantidad', 'number'],
        ['person', 'Responsable', 'text'], ['destination', 'Destino', 'text'], ['note', 'Observaciones', 'text'],
      ],
      history: [
        ['action', 'Acción', 'select', ['Creó', 'Modificó', 'Eliminó', 'Movimiento']],
        ['module', 'Módulo', 'select', dynamicOptions('module')], ['operation', 'Operación', 'text'],
        ['record', 'Registro', 'text'], ['date', 'Fecha', 'date'], ['user', 'Usuario', 'text'],
        ['justification', 'Motivo', 'text'],
      ],
      contacts: [
        ['name', 'Razón social / nombre', 'text'], ['nit', 'NIT / documento', 'text'],
        ['email', 'Correo', 'text'], ['phone', 'Teléfono', 'text'],
      ],
      funcionarios: [
        ['nombre', 'Nombre', 'text'], ['cargo', 'Cargo', 'text'], ['documento', 'Documento', 'text'],
        ['area', 'Área / Departamento', 'select', dynamicOptions('area')],
        ['correo', 'Correo', 'text'], ['telefono', 'Teléfono', 'text'],
        ['estado', 'Estado', 'select', ['Activo', 'Inactivo']],
      ],
      inventario: [
        ['nombre', 'Técnico', 'text'], ['cargo', 'Cargo', 'text'],
        ['equipmentCount', 'Herramientas asignadas', 'number'], ['inUseCount', 'En uso', 'number'],
        ['repairCount', 'En reparación', 'number'], ['estado', 'Estado', 'select', ['Activo', 'Inactivo']],
      ],
      'asset-loan': [
        ['loanStatus', 'Estado', 'select', ['Vigente', 'Devuelto', 'Vendido']],
        ['type', 'Tipo', 'select', dynamicOptions('type')], ['code', 'Código', 'text'],
        ['assetName', 'Activo', 'text'], ['person', 'Responsable', 'text'], ['client', 'Cliente', 'text'],
        ['date', 'Fecha de entrega', 'date'], ['dueDate', 'Devolución prevista', 'date'],
      ],
    };
    return (definitions[page] || []).map(([key, label, type, options]) => ({ key, label, type, options: options || [] }));
  }

  function filterOperators(type) {
    const common = [['empty', 'está vacío'], ['notEmpty', 'no está vacío']];
    if (type === 'text') {
      return [['contains', 'contiene'], ['notContains', 'no contiene'], ['is', 'es'], ['isNot', 'no es'],
        ['startsWith', 'empieza por'], ['endsWith', 'termina en'], ...common];
    }
    if (type === 'number') {
      return [['is', 'es'], ['isNot', 'no es'], ['gt', 'es mayor que'], ['gte', 'es al menos'],
        ['lt', 'es menor que'], ['lte', 'es como máximo'], ...common];
    }
    if (type === 'date') {
      return [['is', 'es'], ['before', 'es anterior a'], ['after', 'es posterior a'],
        ['onOrBefore', 'es hasta'], ['onOrAfter', 'es desde'], ...common];
    }
    return [['is', 'es'], ['isNot', 'no es'], ...common];
  }

  function createFilterCondition() {
    const field = filterFields()[0];
    return { id: makeId('filter-condition'), type: 'condition', field: field.key,
      operator: field.type === 'text' ? 'contains' : 'is', value: '' };
  }

  function appendSelectOptions(select, options, selectedValue, placeholder) {
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = placeholder;
    select.append(empty);
    options.forEach(value => {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = String(value);
      select.append(option);
    });
    select.value = selectedValue == null ? '' : String(selectedValue);
  }

  function rerenderFilters(focusControl, selectionStart) {
    currentPage = 1;
    renderShell();
    if (!focusControl) return;
    const control = root.querySelector(`[data-filter-control="${focusControl}"]`);
    if (!control) return;
    control.focus();
    if (selectionStart != null && control instanceof HTMLInputElement && ['text', 'search'].includes(control.type)) {
      control.setSelectionRange(selectionStart, selectionStart);
    }
  }

  function activeFilterCount(node = filterTree) {
    return node.children.reduce((count, child) => {
      if (child.type === 'group') return count + activeFilterCount(child);
      return count + (filterNodeIsActive(child) ? 1 : 0);
    }, 0);
  }

  function removeFilterNode(parent, id) {
    const index = parent.children.findIndex(child => child.id === id);
    if (index >= 0) {
      parent.children.splice(index, 1);
      return true;
    }
    return parent.children.some(child => child.type === 'group' && removeFilterNode(child, id));
  }

  function renderFilterBuilder() {
    const builder = document.createElement('section');
    builder.className = 'module-filter-builder';
    builder.setAttribute('aria-label', 'Filtros avanzados');
    const header = document.createElement('div');
    header.className = 'filter-builder-header';
    header.append(text('strong', 'Filtros avanzados'));
    header.append(text('span', 'Combina condiciones con Y / O y agrúpalas como necesites.', 'filter-builder-help'));

    const renderGroup = (group, isRoot = false) => {
      const container = document.createElement('div');
      container.className = `filter-group${isRoot ? ' filter-group-root' : ''}`;
      container.setAttribute('role', 'group');
      container.setAttribute('aria-label', isRoot ? 'Grupo principal de filtros' : 'Subgrupo de filtros');

      const groupHeader = document.createElement('div');
      groupHeader.className = 'filter-group-header';
      groupHeader.append(text('span', isRoot ? 'Dónde' : 'Subgrupo'));
      const logic = document.createElement('select');
      logic.setAttribute('aria-label', 'Combinar condiciones del grupo');
      logic.dataset.filterControl = `${group.id}-logic`;
      [['all', 'todas (Y)'], ['any', 'cualquiera (O)']].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        logic.append(option);
      });
      logic.value = group.logic;
      logic.addEventListener('change', () => {
        group.logic = logic.value;
        rerenderFilters(logic.dataset.filterControl);
      });
      groupHeader.append(logic);
      if (!isRoot) {
        const removeGroup = text('button', '×', 'filter-remove');
        removeGroup.type = 'button';
        removeGroup.setAttribute('aria-label', 'Eliminar subgrupo');
        removeGroup.addEventListener('click', () => {
          removeFilterNode(filterTree, group.id);
          rerenderFilters();
        });
        groupHeader.append(removeGroup);
      }
      container.append(groupHeader);

      const children = document.createElement('div');
      children.className = 'filter-group-children';
      group.children.forEach(node => {
        if (node.type === 'group') {
          children.append(renderGroup(node));
          return;
        }
        const row = document.createElement('div');
        row.className = 'filter-condition-row';
        const fieldSelect = document.createElement('select');
        fieldSelect.setAttribute('aria-label', 'Campo del filtro');
        fieldSelect.dataset.filterControl = `${node.id}-field`;
        const fieldsForPage = filterFields();
        fieldsForPage.forEach(field => {
          const option = document.createElement('option');
          option.value = field.key;
          option.textContent = field.label;
          fieldSelect.append(option);
        });
        fieldSelect.value = node.field;
        fieldSelect.addEventListener('change', () => {
          const selected = fieldsForPage.find(field => field.key === fieldSelect.value);
          node.field = selected.key;
          node.operator = selected.type === 'text' ? 'contains' : 'is';
          node.value = '';
          rerenderFilters(fieldSelect.dataset.filterControl);
        });

        const selectedField = fieldsForPage.find(field => field.key === node.field) || fieldsForPage[0];
        const operators = filterOperators(selectedField.type);
        const operatorSelect = document.createElement('select');
        operatorSelect.setAttribute('aria-label', 'Operador del filtro');
        operatorSelect.dataset.filterControl = `${node.id}-operator`;
        operators.forEach(([value, label]) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label;
          operatorSelect.append(option);
        });
        if (!operators.some(([value]) => value === node.operator)) node.operator = operators[0][0];
        operatorSelect.value = node.operator;
        operatorSelect.addEventListener('change', () => {
          node.operator = operatorSelect.value;
          rerenderFilters(operatorSelect.dataset.filterControl);
        });
        row.append(fieldSelect, operatorSelect);

        if (!['empty', 'notEmpty'].includes(node.operator)) {
          let valueControl;
          if (selectedField.type === 'select') {
            valueControl = document.createElement('select');
            valueControl.className = 'filter-value-control';
            appendSelectOptions(valueControl, selectedField.options, node.value, 'Seleccionar…');
            valueControl.addEventListener('change', () => {
              node.value = valueControl.value;
              rerenderFilters(valueControl.dataset.filterControl);
            });
          } else {
            valueControl = document.createElement('input');
            valueControl.className = 'filter-value-control';
            valueControl.type = selectedField.type === 'number' ? 'number' : selectedField.type === 'date' ? 'date' : 'text';
            valueControl.placeholder = selectedField.type === 'text' ? 'Escribe un valor' : 'Valor';
            valueControl.value = node.value;
            valueControl.addEventListener('input', () => {
              node.value = valueControl.value;
              rerenderFilters(valueControl.dataset.filterControl, valueControl.selectionStart);
            });
          }
          valueControl.setAttribute('aria-label', 'Valor del filtro');
          valueControl.dataset.filterControl = `${node.id}-value`;
          row.append(valueControl);
        }

        const removeCondition = text('button', '×', 'filter-remove');
        removeCondition.type = 'button';
        removeCondition.setAttribute('aria-label', 'Eliminar condición');
        removeCondition.addEventListener('click', () => {
          removeFilterNode(filterTree, node.id);
          rerenderFilters();
        });
        row.append(removeCondition);
        children.append(row);
      });
      container.append(children);

      const actions = document.createElement('div');
      actions.className = 'filter-group-actions';
      const addCondition = text('button', '+ Añadir condición', 'filter-builder-action');
      addCondition.type = 'button';
      addCondition.addEventListener('click', () => {
        group.children.push(createFilterCondition());
        rerenderFilters();
      });
      const addGroup = text('button', '+ Añadir grupo', 'filter-builder-action');
      addGroup.type = 'button';
      addGroup.addEventListener('click', () => {
        const subgroup = { id: makeId('filter-group'), type: 'group', logic: 'all', children: [createFilterCondition()] };
        group.children.push(subgroup);
        rerenderFilters();
      });
      actions.append(addCondition, addGroup);
      container.append(actions);
      return container;
    };

    builder.append(header, renderGroup(filterTree, true));
    const footer = document.createElement('div');
    footer.className = 'filter-builder-footer';
    const clear = text('button', 'Limpiar filtros', 'filter-builder-clear');
    clear.type = 'button';
    clear.addEventListener('click', () => {
      filterTree.children = [];
      filterTree.logic = 'all';
      searchText = '';
      rerenderFilters();
    });
    footer.append(clear);
    builder.append(footer);
    return builder;
  }

  function filterConditionMatches(condition, record, fields) {
    const field = fields.find(candidate => candidate.key === condition.field);
    if (!field) return true;
    const rawValue = field.key === 'loanStatus' ? (record.type === 'Venta' ? 'Vendido' : record.returnedAt ? 'Devuelto' : 'Vigente') : record[field.key];
    const value = rawValue == null ? '' : String(rawValue).trim();
    if (condition.operator === 'empty') return value === '';
    if (condition.operator === 'notEmpty') return value !== '';
    if (condition.value == null || String(condition.value).trim() === '') return true;

    if (field.type === 'number') {
      if (rawValue == null || value === '') return false;
      const actual = Number(rawValue);
      const expected = Number(condition.value);
      if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
      if (condition.operator === 'gt') return actual > expected;
      if (condition.operator === 'gte') return actual >= expected;
      if (condition.operator === 'lt') return actual < expected;
      if (condition.operator === 'lte') return actual <= expected;
      if (condition.operator === 'isNot') return actual !== expected;
      return actual === expected;
    }
    if (field.type === 'date') {
      const actual = value.slice(0, 10);
      const expected = String(condition.value).slice(0, 10);
      if (!actual) return false;
      if (condition.operator === 'before') return actual < expected;
      if (condition.operator === 'after') return actual > expected;
      if (condition.operator === 'onOrBefore') return actual <= expected;
      if (condition.operator === 'onOrAfter') return actual >= expected;
      if (condition.operator === 'isNot') return actual !== expected;
      return actual === expected;
    }

    const actual = value.toLocaleLowerCase();
    const expected = String(condition.value).trim().toLocaleLowerCase();
    if (condition.operator === 'contains') return actual.includes(expected);
    if (condition.operator === 'notContains') return !actual.includes(expected);
    if (condition.operator === 'startsWith') return actual.startsWith(expected);
    if (condition.operator === 'endsWith') return actual.endsWith(expected);
    if (condition.operator === 'isNot') return actual !== expected;
    return actual === expected;
  }

  function filterNodeIsActive(node) {
    if (node.type === 'group') return node.children.some(filterNodeIsActive);
    return ['empty', 'notEmpty'].includes(node.operator) || String(node.value || '').trim() !== '';
  }

  function filterGroupMatches(group, record, fields) {
    const activeChildren = group.children.filter(filterNodeIsActive);
    if (!activeChildren.length) return true;
    const matches = node => node.type === 'group' ? filterGroupMatches(node, record, fields) : filterConditionMatches(node, record, fields);
    return group.logic === 'any' ? activeChildren.some(matches) : activeChildren.every(matches);
  }
