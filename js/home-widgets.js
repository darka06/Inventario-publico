// Sistema de widgets personalizable para la página de inicio
(() => {
  const dash = document.getElementById('dash');
  if (!dash || !window.inventarioApi) return;

  const COLS_KEY = 'home-widget-cols';
  const WIDGETS_KEY = 'home-widgets';
  let savedCols = localStorage.getItem(COLS_KEY) || '2';
  let savedWidgets = JSON.parse(localStorage.getItem(WIDGETS_KEY) || '[]');

  // Definición de tipos de widgets
  const widgetTypes = {
    summary: {
      title: 'Resumen de inventario',
      render: renderSummaryWidget,
    },
    chart: {
      title: 'Gráfico de categorías',
      render: renderChartWidget,
    },
    recent: {
      title: 'Activos recientes',
      render: renderRecentWidget,
    },
    alerts: {
      title: 'Alertas de stock',
      render: renderAlertsWidget,
    },
    loans: {
      title: 'Préstamos activos',
      render: renderLoansWidget,
    },
  };

  // Función para crear un widget
  function createWidget(type, data = {}) {
    const widgetConfig = widgetTypes[type];
    if (!widgetConfig) return null;

    const widget = document.createElement('article');
    widget.className = 'widget';
    widget.dataset.type = type;
    widget.dataset.id = data.id || makeId('widget');

    const head = document.createElement('div');
    head.className = 'widget-head';
    head.innerHTML = `
      <h3>${widgetConfig.title}</h3>
      <button type="button" class="widget-remove" aria-label="Eliminar widget">×</button>
    `;

    const body = document.createElement('div');
    body.className = 'widget-body';
    widgetConfig.render(body, data);

    widget.append(head, body);

    // Evento para eliminar widget
    widget.querySelector('.widget-remove').addEventListener('click', () => {
      widget.remove();
      saveWidgets();
    });

    return widget;
  }

  // Widget: Resumen de inventario
  async function renderSummaryWidget(container) {
    try {
      const data = await window.inventarioApi.get('all');
      const totalAssets = data.assets.length;
      const totalSupplies = data.supplies.length;
      const activeLoans = data.loans.filter(l => !l.supplyOnly && !l.returnedAt && l.type !== 'Venta').length;

      container.innerHTML = `
        <div class="summary-stats">
          <div class="summary-item">
            <span class="summary-label">Activos</span>
            <span class="summary-value">${totalAssets}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Insumos</span>
            <span class="summary-value">${totalSupplies}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Préstamos activos</span>
            <span class="summary-value">${activeLoans}</span>
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = '<p class="error">Error al cargar datos</p>';
    }
  }

  // Widget: Gráfico de categorías
  async function renderChartWidget(container) {
    try {
      const data = await window.inventarioApi.get('all');
      const categoryCount = {};
      data.assets.forEach(asset => {
        const cat = asset.category || 'Sin categoría';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      });

      const maxCount = Math.max(...Object.values(categoryCount), 1);
      container.innerHTML = `
        <div class="chart-container">
          ${Object.entries(categoryCount).map(([cat, count]) => `
            <div class="chart-bar">
              <span class="chart-label">${cat}</span>
              <div class="chart-bar-fill" data-s="width: ${(count / maxCount) * 100}%"></div>
              <span class="chart-value">${count}</span>
            </div>
          `).join('')}
        </div>
      `;
    } catch (error) {
      container.innerHTML = '<p class="error">Error al cargar datos</p>';
    }
  }

  // Widget: Activos recientes
  async function renderRecentWidget(container) {
    try {
      const data = await window.inventarioApi.get('all');
      const recentAssets = data.assets.slice(-5).reverse();

      container.innerHTML = `
        <ul class="recent-list">
          ${recentAssets.map(asset => `
            <li>
              <span class="recent-name">${asset.name}</span>
              <span class="recent-code">${asset.code || '—'}</span>
            </li>
          `).join('')}
        </ul>
      `;
    } catch (error) {
      container.innerHTML = '<p class="error">Error al cargar datos</p>';
    }
  }

  // Widget: Alertas de stock
  async function renderAlertsWidget(container) {
    try {
      const data = await window.inventarioApi.get('all');
      const lowStock = data.supplies.filter(s => s.stock <= s.minimum);

      container.innerHTML = `
        <ul class="alerts-list">
          ${lowStock.length === 0 ? '<li>Sin alertas</li>' : ''}
          ${lowStock.slice(0, 5).map(supply => `
            <li class="alert-item">
              <span class="alert-name">${supply.name}</span>
              <span class="alert-stock">Stock: ${supply.stock} (mín: ${supply.minimum})</span>
            </li>
          `).join('')}
        </ul>
      `;
    } catch (error) {
      container.innerHTML = '<p class="error">Error al cargar datos</p>';
    }
  }

  // Widget: Préstamos activos
  async function renderLoansWidget(container) {
    try {
      const data = await window.inventarioApi.get('all');
      const activeLoans = data.loans.filter(l => !l.supplyOnly && !l.returnedAt && l.type !== 'Venta').slice(0, 5);

      container.innerHTML = `
        <ul class="loans-list">
          ${activeLoans.length === 0 ? '<li>Sin préstamos activos</li>' : ''}
          ${activeLoans.map(loan => `
            <li>
              <span class="loan-asset">${loan.assetName}</span>
              <span class="loan-person">${loan.person}</span>
            </li>
          `).join('')}
        </ul>
      `;
    } catch (error) {
      container.innerHTML = '<p class="error">Error al cargar datos</p>';
    }
  }

  // Función para renderizar todos los widgets
  function renderWidgets() {
    dash.innerHTML = '';
    dash.classList.add('widget-grid');
    dash.classList.remove('widget-cols-1', 'widget-cols-2', 'widget-cols-3', 'widget-cols-4', 'widget-cols-5');
    dash.classList.add(`widget-cols-${savedCols}`);

    savedWidgets.forEach(widgetData => {
      const widget = createWidget(widgetData.type, widgetData);
      if (widget) dash.append(widget);
    });
  }

  // Función para guardar widgets
  function saveWidgets() {
    const widgets = [...dash.querySelectorAll('.widget')].map(widget => ({
      type: widget.dataset.type,
      id: widget.dataset.id,
    }));
    savedWidgets = widgets;
    localStorage.setItem(WIDGETS_KEY, JSON.stringify(widgets));
  }

  // Evento para agregar nuevo widget
  document.querySelectorAll('[data-widget]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const type = link.dataset.widget;
      const widget = createWidget(type);
      if (widget) {
        dash.append(widget);
        saveWidgets();
      }
      // Cerrar menú
      link.closest('.new-menu').hidden = true;
      document.getElementById('btn-new').setAttribute('aria-expanded', 'false');
    });
  });

  // Función de ayuda para generar IDs
  function makeId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  // Renderizar widgets guardados
  renderWidgets();

  // Configurar columnas desde localStorage
  document.getElementById('org-cols').value = savedCols;
})();
