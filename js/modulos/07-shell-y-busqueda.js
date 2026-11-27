// Pestañas de la página Herramientas: solo aparecen las vistas que el rol puede ver.
  function toolsTabs() {
    const views = toolsViews();
    if (views.length < 2) return null;
    const bar = document.createElement('div');
    bar.className = 'module-tabs';
    bar.setAttribute('role', 'tablist');
    views.forEach(view => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = `module-tab${view.id === page ? ' is-active' : ''}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(view.id === page));
      tab.textContent = view.label;
      tab.addEventListener('click', () => setToolsView(view.id));
      bar.append(tab);
    });
    return bar;
  }

  function setToolsView(view) {
    if (view === page) return;
    page = view;
    try { localStorage.setItem(toolsViewKey, view); } catch { /* sin almacenamiento */ }
    // Los filtros y la búsqueda son de cada vista: se reinician al cambiar.
    searchText = '';
    currentPage = 1;
    filterBuilderOpen = false;
    filterTree.logic = 'all';
    filterTree.children = filterFields()[0] ? [createFilterCondition()] : [];
    renderShell();
  }

  function renderShell() {
    root.replaceChildren();
    setNoticeInPage();
    const heading = isToolsHub ? TITLES.tools : TITLES[page];
    const header = document.createElement('div');
    header.className = 'page-head';
    header.append(text('h1', heading));
    const hasFilterControls = ['assets', 'categories', 'brands', 'consumables', 'tools', 'purchases', 'movements', 'history', 'contacts', 'funcionarios', 'inventario', 'asset-loan'].includes(page);
    const actions = document.createElement('div');
    actions.className = 'module-actions';
    if (!hasFilterControls) actions.append(createViewMenu());
    let primaryAction = null;

    if (page === 'assets' && window.inventarioApi.can('activos.crear')) primaryAction = button('+ Nuevo activo', 'new-asset');
    if (page === 'categories' && window.inventarioApi.can('categorias.crear')) primaryAction = button('+ Nueva categoría', 'new-category');
    if (page === 'brands' && window.inventarioApi.can('marcas.crear')) primaryAction = button('+ Nueva marca', 'new-brand');
    if (page === 'consumables' && window.inventarioApi.can('insumos.crear')) primaryAction = button('+ Nuevo insumo', 'new-supply');
    if (page === 'tools' && window.inventarioApi.can('herramientas.crear')) primaryAction = button('+ Nueva herramienta', 'new-tool');
    if (page === 'inventario' && window.inventarioApi.can('funcionarios.crear')) primaryAction = button('+ Nuevo técnico', 'new-technician');
    if (page === 'purchases' && window.inventarioApi.can('compras.crear')) primaryAction = button('+ Registrar compra', 'new-purchase');
    if (page === 'movements' && window.inventarioApi.can('insumos.movimientos')) primaryAction = button('+ Registrar movimiento', 'new-stock-movement');
    if (page === 'contacts' && window.inventarioApi.can('contactos.crear')) {
      primaryAction = button(contactType === 'Proveedor' ? '+ Nuevo proveedor' : '+ Nuevo cliente', 'new-contact');
    }
    if (page === 'funcionarios' && window.inventarioApi.can('funcionarios.crear')) primaryAction = button('+ Nuevo funcionario', 'new-user');
    if (page === 'asset-loan' && window.inventarioApi.can('prestamos.crear')) primaryAction = button('+ Nuevo alquiler / venta', 'new-loan');
    header.append(actions);
    root.append(header);
    if (isToolsHub) {
      const tabs = toolsTabs();
      if (tabs) root.append(tabs);
    }
    if (hasFilterControls) {
      appendSearchAndFilters(primaryAction, createViewMenu());
    } else if (primaryAction) {
      actions.append(primaryAction);
    }
    if (!apiReady && !loadFailed) {
      // Primera carga: skeletons con la forma del resumen y de la tabla / tarjetas, en vez de "No hay registros".
      const columns = { assets: 7, categories: 2, brands: 4, consumables: 8, tools: 6, purchases: 7, movements: 7, history: 8, contacts: 6, funcionarios: 7, inventario: 7, 'asset-loan': 7 }[page] || 6;
      root.append(
        window.inventarioSkeleton.stats(page === 'history' ? 4 : 3),
        viewMode === 'cards' ? window.inventarioSkeleton.cards(6, cardColumns) : window.inventarioSkeleton.table(columns, 8),
      );
    } else {
      root.append(renderSummary(), renderTable());
    }
    if (!apiReady) {
      root.querySelectorAll('button[data-action]').forEach(control => { control.disabled = true; });
    }
  }

  function appendSearchAndFilters(primaryAction, viewMenu) {
    const filters = document.createElement('div');
    filters.className = 'module-filters';
    filters.append(searchInput());
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = `filter-builder-toggle${filterBuilderOpen ? ' is-open' : ''}`;
    toggle.setAttribute('aria-expanded', String(filterBuilderOpen));
    toggle.setAttribute('aria-controls', `${pageId}-filter-panel`);
    toggle.setAttribute('aria-label', `Filtros${activeFilterCount() ? `, ${activeFilterCount()} activos` : ''}`);
    toggle.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 4h14M5.5 9h9M8 14h4"/></svg><span>Filtros</span>';
    const count = activeFilterCount();
    if (count > 0) toggle.append(text('span', String(count), 'filter-builder-count'));
    toggle.addEventListener('click', event => {
      event.stopPropagation();
      filterBuilderOpen = !filterBuilderOpen;
      renderShell();
      root.querySelector('.filter-builder-toggle')?.focus();
    });
    filters.append(toggle);
    const actions = document.createElement('div');
    actions.className = 'module-filter-actions';
    if (viewMenu) actions.append(viewMenu);
    if (primaryAction) {
      primaryAction.classList.add('module-filter-primary-action');
      actions.append(primaryAction);
    }
    filters.append(actions);
    root.append(filters);
    const builder = renderFilterBuilder();
    builder.id = `${pageId}-filter-panel`;
    builder.hidden = !filterBuilderOpen;
    filters.append(builder);
    builder.addEventListener('click', event => event.stopPropagation());
  }

  function searchInput() {
    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'module-search';
    input.placeholder = 'Buscar…';
    input.setAttribute('aria-label', 'Buscar registros');
    input.value = searchText;
    input.addEventListener('input', () => {
      searchText = input.value;
      currentPage = 1;
      root.querySelector('.module-records')?.replaceWith(renderTable());
    });
    return input;
  }

  function normalizeSearch(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function filterRecords() {
    if (page === 'assets') return data.assets;
    if (page === 'categories') return data.categories;
    if (page === 'brands') return getBrandRecords();
    if (page === 'consumables') return data.supplies;
    if (page === 'tools') return data.tools;
    if (page === 'purchases') return data.purchases;
    if (page === 'movements') return data.movements;
    if (page === 'history') return data.changes;
    if (page === 'contacts') return data.contacts.filter(contact => !contactType || contact.type === contactType);
    if (page === 'funcionarios') return data.users;
    if (page === 'inventario') return getTechnicians();
    if (page === 'asset-loan') {
      return [...data.loans, ...activeLoans().filter(loan => loan.assetOnly)];
    }
    return [];
  }

  function distinctFilterOptions(records, key) {
    return [...new Set(records.map(record => record[key]).filter(value => value != null && value !== '').map(String))]
      .sort((a, b) => a.localeCompare(b));
  }