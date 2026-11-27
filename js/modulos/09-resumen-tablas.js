  function renderSummary() {
    const box = document.createElement('section');
    box.className = 'module-summary';
    const values = {
      assets: [['Total activos', data.assets.length], ['Disponibles', data.assets.filter(a => a.status === 'Disponible').length], ['Asignados / alquilados', data.assets.filter(a => ['Asignado', 'Alquilado', 'Prestado'].includes(a.status)).length]],
      categories: [['Categorías', data.categories.length], ['Activos categorizados', data.categories.reduce((sum, category) => sum + category.assetCount, 0)], ['Sin categoría', data.assets.filter(asset => !asset.category).length]],
      brands: [['Marcas registradas', data.brands.length], ['Activos con marca', data.assets.filter(asset => String(asset.brand || '').trim()).length], ['Insumos con marca', data.supplies.filter(supply => String(supply.brand || '').trim()).length]],
      consumables: [['Insumos', data.supplies.length], ['Unidades en stock', data.supplies.reduce((sum, supply) => sum + Number(supply.stock || 0), 0)], ['Bajo mínimo', data.supplies.filter(s => Number(s.stock || 0) <= Number(s.minimum || 0)).length]],
      tools: [['Herramientas', data.tools.length], ['Disponibles', data.tools.filter(t => t.status === 'Disponible').length], ['En uso', data.tools.filter(t => t.status === 'En uso').length]],
      purchases: [['Compras registradas', data.purchases.length], ['Activos comprados', data.purchases.filter(p => p.type === 'Activo').reduce((sum, purchase) => sum + Number(purchase.quantity || 0), 0)], ['Unidades de insumo', data.purchases.filter(p => p.type === 'Insumo').reduce((sum, purchase) => sum + Number(purchase.quantity || 0), 0)]],
      movements: [['Movimientos', data.movements.length], ['Activos', data.movements.filter(m => m.kind === 'Activo').length], ['Insumos', data.movements.filter(m => m.kind !== 'Activo').length]],
      history: [['Cambios registrados', data.changes.length], ['Creaciones', data.changes.filter(c => c.action === 'Creó').length], ['Modificaciones', data.changes.filter(c => c.action === 'Modificó').length], ['Eliminaciones', data.changes.filter(c => c.action === 'Eliminó').length]],
      contacts: contactType === 'Proveedor'
        ? [['Proveedores', data.contacts.filter(c => c.type === 'Proveedor').length], ['Con correo', data.contacts.filter(c => c.type === 'Proveedor' && c.email).length], ['Con teléfono', data.contacts.filter(c => c.type === 'Proveedor' && c.phone).length]]
        : [['Clientes', data.contacts.filter(c => c.type === 'Cliente').length], ['Con correo', data.contacts.filter(c => c.type === 'Cliente' && c.email).length], ['Con teléfono', data.contacts.filter(c => c.type === 'Cliente' && c.phone).length]],
      funcionarios: [['Funcionarios', data.users.length], ['Activos', data.users.filter(u => u.estado !== 'Inactivo').length], ['Inactivos', data.users.filter(u => u.estado === 'Inactivo').length]],
      inventario: [['Técnicos', getTechnicians().length], ['Herramientas asignadas', getTechnicians().reduce((sum, tech) => sum + tech.equipmentCount, 0)], ['En reparación', getTechnicians().reduce((sum, tech) => sum + tech.repairCount, 0)]],
      'asset-loan': [['Alquilados', activeLoans().filter(loan => loan.type === 'Alquiler').length], ['Prestados', activeLoans().filter(loan => loan.type === 'Préstamo').length], ['Ventas registradas', data.loans.filter(loan => loan.type === 'Venta').length]],
    }[page];
    values.forEach(([label, value]) => {
      const item = document.createElement('article');
      item.className = 'module-stat';
      item.append(text('span', label), text('strong', value));
      box.append(item);
    });
    return box;
  }

  function createViewMenu() {
    const wrap = document.createElement('div');
    wrap.className = 'btn-list-wrap module-view-menu-wrap';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'btn-list';
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', 'Cambiar vista');
    trigger.title = 'Cambiar vista';
    trigger.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>';

    const menu = document.createElement('ul');
    menu.className = 'new-menu module-view-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Formato de visualización');
    menu.hidden = true;

    const viewOptions = [
      ['table', 'Tabla', '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></svg>'],
      ['cards', 'Tarjetas', '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="3" y="13" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/></svg>'],
    ];
    viewOptions.forEach(([mode, label, icon]) => {
      const item = document.createElement('li');
      const option = document.createElement('button');
      option.type = 'button';
      option.setAttribute('role', 'menuitemradio');
      option.setAttribute('aria-checked', String(viewMode === mode));
      option.insertAdjacentHTML('beforeend', icon);
      option.append(document.createTextNode(label));
      if (viewMode === mode) option.classList.add('is-selected');
      option.addEventListener('click', () => {
        viewMode = mode;
        localStorage.setItem(viewModeKey, viewMode);
        renderShell();
      });
      item.append(option);
      menu.append(item);
    });

    const columnsItem = document.createElement('li');
    columnsItem.className = 'module-view-columns-item';
    const columnsLabel = document.createElement('label');
    columnsLabel.htmlFor = 'module-card-columns';
    columnsLabel.textContent = 'Columnas de tarjetas';
    const columnsSelect = document.createElement('select');
    columnsSelect.id = 'module-card-columns';
    columnsSelect.setAttribute('aria-label', 'Cantidad de columnas de tarjetas');
    [1, 2, 3, 4, 5].forEach(count => {
      const option = document.createElement('option');
      option.value = String(count);
      option.textContent = String(count);
      columnsSelect.append(option);
    });
    columnsSelect.value = String(cardColumns);
    columnsSelect.addEventListener('change', () => {
      cardColumns = Number(columnsSelect.value);
      localStorage.setItem(cardColumnsKey, String(cardColumns));
      const grid = root.querySelector('.module-card-grid');
      if (grid) {
        grid.classList.remove('card-cols-1', 'card-cols-2', 'card-cols-3', 'card-cols-4', 'card-cols-5');
        grid.classList.add(`card-cols-${cardColumns}`);
      }
    });
    columnsItem.append(columnsLabel, columnsSelect);
    menu.append(columnsItem);

    trigger.addEventListener('click', event => {
      event.stopPropagation();
      menu.hidden = !menu.hidden;
      trigger.setAttribute('aria-expanded', String(!menu.hidden));
    });
    wrap.append(trigger, menu);
    return wrap;
  }

  function getCardIcon(title, category) {
    const value = `${title || ''} ${category || ''}`.toLocaleLowerCase();
    const icons = [
      [/access.?point|\bap\b/, 'ap'],
      [/router/, 'router'],
      [/switch/, 'switch'],
      [/firewall/, 'firewall'],
      [/ipad|tablet/, 'ipad'],
      [/printer|impresora/, 'printer'],
      [/phone|tel[eé]fono/, 'phone'],
      [/computer|computador|laptop/, 'computer'],
      [/cooling|refrigeraci/, 'cooling'],
      [/rack/, 'rack'],
      [/network|red/, 'network'],
    ];
    const iconName = icons.find(([pattern]) => pattern.test(value))?.[1] || 'cube';
    return `${document.body.dataset.root || '../'}icons/cards/${iconName}.svg`;
  }

  function makePagination(totalRows, start, end, pageCount) {
    const toolbar = document.createElement('div');
    toolbar.className = 'module-pagination';

    const limit = document.createElement('label');
    limit.className = 'module-page-size';
    limit.append(document.createTextNode('Mostrar '));
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Cantidad de registros por página');
    [10, 20, 50, 100].forEach(size => {
      const option = document.createElement('option');
      option.value = String(size);
      option.textContent = String(size);
      select.append(option);
    });
    select.value = String(pageSize);
    select.addEventListener('change', () => {
      pageSize = Number(select.value);
      currentPage = 1;
      localStorage.setItem(pageSizeKey, String(pageSize));
      renderShell();
    });
    limit.append(select, document.createTextNode(' por página'));

    const range = text('span', totalRows ? `Mostrando ${start}–${end} de ${totalRows}` : 'Mostrando 0 registros', 'module-page-range');
    const navigation = document.createElement('div');
    navigation.className = 'module-page-navigation';
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'module-page-button';
    previous.textContent = 'Anterior';
    previous.disabled = currentPage <= 1;
    previous.setAttribute('aria-label', 'Página anterior');
    previous.addEventListener('click', () => {
      currentPage -= 1;
      renderShell();
    });
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'module-page-button';
    next.textContent = 'Siguiente';
    next.disabled = currentPage >= pageCount;
    next.setAttribute('aria-label', 'Página siguiente');
    next.addEventListener('click', () => {
      currentPage += 1;
      renderShell();
    });
    navigation.append(previous, next);
    toolbar.append(limit, range, navigation);
    return toolbar;
  }

  function makeTable(headers, rows, emptyMessage) {
    const records = document.createElement('section');
    records.className = 'module-records';
    records.setAttribute('aria-label', 'Registros');
    const totalRows = rows.length;
    const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
    currentPage = Math.min(currentPage, pageCount);
    const startIndex = (currentPage - 1) * pageSize;
    const pagedRows = rows.slice(startIndex, startIndex + pageSize);
    const pagination = makePagination(totalRows, totalRows ? startIndex + 1 : 0, Math.min(startIndex + pageSize, totalRows), pageCount);
    const noResultsMessage = searchText.trim() || activeFilterCount()
      ? 'No se encontraron registros que coincidan con la búsqueda o los filtros.'
      : emptyMessage;

    if (viewMode === 'cards') {
      const grid = document.createElement('div');
      grid.className = `module-card-grid card-cols-${cardColumns}`;
      if (!totalRows) {
        grid.append(text('p', noResultsMessage, 'module-card-empty'));
      } else {
        const titleIndex = ({ assets: 1, brands: 0, consumables: 1, tools: 0, purchases: 3, movements: 3, history: 4, contacts: 1, funcionarios: 0, inventario: 0, 'asset-loan': 2 })[page] || 0;
        const fallbackTitleIndex = ({ purchases: 2, movements: 2 })[page] ?? 0;
        pagedRows.forEach(sourceRow => {
          const cells = [...sourceRow.cells];
          const card = document.createElement('article');
          card.className = 'card module-record-card';
          if (sourceRow.dataset.action) {
            card.dataset.action = sourceRow.dataset.action;
            card.dataset.id = sourceRow.dataset.id;
            card.tabIndex = sourceRow.tabIndex;
          }

          let headingCell = cells[titleIndex];
          if (!headingCell || !headingCell.textContent.trim() || headingCell.textContent.trim() === '—') {
            headingCell = cells[fallbackTitleIndex] || headingCell;
          }
          const effectiveTitleIndex = cells.indexOf(headingCell);
          const summaries = {
            assets: [0, 2, 3],
            brands: [1, 2],
            consumables: [0, 2],
            tools: [1, 3],
            purchases: [0, 1],
            movements: [0, 1, 2],
            history: [1, 3],
            contacts: [0],
            funcionarios: [1, 3],
            inventario: [1],
            'asset-loan': [0, 1],
          }[page] || [];
          const highlights = {
            assets: 6,
            consumables: 3,
            tools: 2,
            purchases: 7,
            movements: 4,
            history: 0,
            inventario: 2,
            'asset-loan': 0,
          };
          const highlightIndex = highlights[page];

          const cover = document.createElement('div');
          cover.className = 'module-card-cover';
          const image = document.createElement('img');
          image.src = page === 'inventario'
            ? `${document.body.dataset.root || '../'}icons/cards/computer.svg`
            : getCardIcon(
              headingCell && headingCell.textContent,
              page === 'assets' ? cells[2]?.textContent : '',
            );
          image.alt = '';
          cover.append(image);

          const header = document.createElement('div');
          header.className = 'module-card-content';
          const heading = document.createElement('h2');
          if (headingCell) heading.append(...[...headingCell.childNodes].map(node => node.cloneNode(true)));
          heading.className = 'module-record-card-title';
          header.append(heading);

          const summary = document.createElement('p');
          summary.className = 'module-card-summary';
          summaries.filter(index => index !== effectiveTitleIndex && cells[index]?.textContent.trim())
            .forEach((index, position) => {
              if (position) summary.append(document.createTextNode(' · '));
              const value = document.createElement('span');
              value.append(...[...cells[index].childNodes].map(node => node.cloneNode(true)));
              summary.append(value);
            });
          if (summary.childNodes.length) header.append(summary);

          const details = document.createElement('ul');
          details.className = 'module-card-fields';
          cells.forEach((cell, index) => {
            if (index === effectiveTitleIndex || summaries.includes(index) || index === highlightIndex) return;
            const actions = cell.querySelector('.row-actions');
            if (actions) return;
            const field = document.createElement('li');
            field.append(text('span', headers[index] || 'Dato'));
            const value = document.createElement('b');
            value.append(...[...cell.childNodes].map(node => node.cloneNode(true)));
            field.append(value);
            details.append(field);
          });
          header.append(details);

          const footer = document.createElement('div');
          footer.className = 'module-card-footer';
          if (highlightIndex != null && cells[highlightIndex]) {
            const highlight = document.createElement('div');
            highlight.className = 'module-card-highlight';
            highlight.append(text('span', headers[highlightIndex] || 'Dato'));
            const value = document.createElement('strong');
            value.append(...[...cells[highlightIndex].childNodes].map(node => node.cloneNode(true)));
            highlight.append(value);
            footer.append(highlight);
          }
          cells.forEach(cell => {
            const actions = cell.querySelector('.row-actions');
            if (actions) footer.append(...[...actions.childNodes].map(node => node.cloneNode(true)));
          });

          card.append(cover, header);
          if (footer.childNodes.length) card.append(footer);
          grid.append(card);
        });
      }
      records.append(grid);
      records.append(pagination);
      return records;
    }

    const wrap = document.createElement('div');
    wrap.className = 'module-table-wrap';
    const table = document.createElement('table');
    table.className = 'module-table';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headers.forEach(label => headRow.append(text('th', label)));
    thead.append(headRow);
    const tbody = document.createElement('tbody');
    pagedRows.forEach(row => tbody.append(row));
    if (!totalRows) {
      const emptyRow = document.createElement('tr');
      const cell = text('td', noResultsMessage, 'module-empty');
      cell.colSpan = headers.length;
      emptyRow.append(cell);
      tbody.append(emptyRow);
    }
    table.append(thead, tbody);
    wrap.append(table);
    records.append(wrap);
    records.append(pagination);
    return records;
  }

  function row(values, id, action = 'detail') {
    const tr = document.createElement('tr');
    if (id) {
      tr.dataset.action = action;
      tr.dataset.id = id;
      tr.tabIndex = 0;
    }
    values.forEach(value => {
      const cell = document.createElement('td');
      if (value instanceof Node) cell.append(value);
      else cell.textContent = value == null || value === '' ? '—' : String(value);
      tr.append(cell);
    });
    return tr;
  }

  function badge(value) {
    const item = text('span', value, 'badge');
    const stateClass = value === 'Disponible' ? 'st-store' : ['Asignado', 'Alquilado', 'Prestado', 'En uso'].includes(value) ? 'st-use' : ['En reparación', 'Dañada'].includes(value) ? 'st-repair' : '';
    if (stateClass) item.classList.add(stateClass);
    return item;
  }

  function includesSearch(...values) {
    const query = normalizeSearch(searchText);
    return !query || values.some(value => normalizeSearch(value).includes(query));
  }

  function activeLoans() {
    const loans = data.loans.filter(loan => !loan.supplyOnly && !loan.returnedAt && loan.type !== 'Venta');
    const loanedAssetIds = new Set(loans.map(loan => loan.assetId));
    data.assets.filter(asset => ['Alquilado', 'Prestado'].includes(asset.status) && !loanedAssetIds.has(asset.id))
      .forEach(asset => loans.push({
        id: asset.id,
        assetId: asset.id,
        code: asset.code,
        assetName: asset.name,
        type: asset.status === 'Alquilado' ? 'Alquiler' : 'Préstamo',
        person: asset.assignedTo,
        client: asset.client,
        date: '',
        dueDate: '',
        returnedAt: '',
        assetOnly: true,
      }));
    return loans;
  }

