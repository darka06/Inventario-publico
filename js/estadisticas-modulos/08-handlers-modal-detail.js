// Panel de Estadísticas - Módulo 8b: Funciones auxiliares para detalle del modal

// Función para generar contenido de detalle por campo (status, category, brand)
function getDetailContentByField(field, label, value, w, type) {
  let assets;
  let otherInfo = '';

  if (label === 'Otros' && field === 'brand') {
    const groupedData = w.getGroupedData();
    const otherItem = groupedData.find(d => d.label === 'Otros');
    if (otherItem && otherItem.otherLabels) {
      assets = D.assets.filter(a => otherItem.otherLabels.includes(a.brand));
    } else {
      assets = [];
    }
  } else if (field === 'status') {
    assets = D.assets.filter(a => (a.status || 'Sin estado') === label);
  } else if (field === 'category') {
    assets = D.assets.filter(a => (a.category || 'Sin categoría') === label);
  } else if (field === 'brand') {
    assets = D.assets.filter(a => (a.brand || 'Sin marca') === label);
  } else {
    assets = [];
  }

  const showBrandColumn = label === 'Otros' && field === 'brand';
  const showValueColumn = type === 'pie' || type === 'funnel' || type === 'pyramid' || type === 'hbar';

  return `
    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Categoría</th>
            ${field === 'status' ? '<th>Tipo</th>' : ''}
            <th>Estado</th>
            ${showBrandColumn ? '<th>Marca</th>' : ''}
            <th>Responsable</th>
            ${showValueColumn ? '<th>Valor</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${assets.map(a => `
            <tr>
              <td>${esc(a.code || '—')}</td>
              <td>${esc(a.name)}</td>
              <td>${esc(a.category || '—')}</td>
              ${field === 'status' ? `<td>${esc(a.type || '—')}</td>` : ''}
              <td>${esc(a.status || '—')}</td>
              ${showBrandColumn ? `<td>${esc(a.brand || '—')}</td>` : ''}
              <td>${esc(a.assignedTo || '—')}</td>
              ${showValueColumn ? `<td>${money(a.cost)}</td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Función para contenido de movimientos por día
function getMovementsContent(label, seriesName) {
  let movements = D.movements.filter(m => day(m.date) === label);

  if (seriesName.includes('Activos')) {
    movements = movements.filter(m => m.kind === 'Activo');
  } else if (seriesName.includes('Insumos')) {
    movements = movements.filter(m => m.kind === 'Insumo');
  }

  return `
    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Acción</th>
            <th>Responsable</th>
            <th>Destino</th>
            <th>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          ${movements.map(m => `
            <tr>
              <td>${esc(m.kind)}</td>
              <td>${esc(m.action)}</td>
              <td>${esc(m.person || '—')}</td>
              <td>${esc(m.destination || '—')}</td>
              <td>${m.quantity}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Función para contenido de compras por mes
function getPurchasesContent(label, seriesName) {
  const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const monthIndex = monthNames.indexOf(label.toLowerCase());
  if (monthIndex === -1) return '';

  const currentYear = new Date().getFullYear();
  const monthStr = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}`;
  let purchases = D.purchases.filter(p => day(p.date).slice(0, 7) === monthStr);

  if (seriesName.includes('Activos')) {
    purchases = purchases.filter(p => p.type === 'Activo');
  } else if (seriesName.includes('Insumos')) {
    purchases = purchases.filter(p => p.type === 'Insumo');
  }

  return `
    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Proveedor</th>
            <th>Marca</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${purchases.map(p => `
            <tr>
              <td>${day(p.date)}</td>
              <td>${esc(p.type)}</td>
              <td>${esc(p.supplier || '—')}</td>
              <td>${esc(p.brand || '—')}</td>
              <td>${money(p.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
