// Panel de Estadísticas - Módulo 8c: Handlers de clicks en el modal (bar, pie, line, etc.)

// Esta función se llama desde 08-handlers-modal.js para manejar clicks en elementos interactivos
function handleModalClick(clickable, w) {
  const label = clickable.dataset.label;
  const type = clickable.dataset.clickable;
  const seriesName = clickable.dataset.series || '';
  const value = clickable.dataset.value;

  let content = '';
  let title = label;

  if (type === 'bar') {
    if (w.field === 'status' || w.field === 'category' || w.field === 'brand') {
      content = getDetailContentByField(w.field, label, value, w, type);
      if (w.field === 'brand') title = `Marca: ${label}`;
    } else if (w.t && w.t.toLowerCase().includes('compras de los últimos')) {
      content = getPurchasesContent(label, seriesName);
      if (seriesName.includes('Activos')) title = `Activos: ${label}`;
      else if (seriesName.includes('Insumos')) title = `Insumos: ${label}`;
      else title = `Compras: ${label}`;
    } else if (w.t && w.t.toLowerCase().includes('movimientos')) {
      content = getMovementsContent(label, seriesName);
      if (seriesName.includes('Activos')) title = `Activos: ${label}`;
      else if (seriesName.includes('Insumos')) title = `Insumos: ${label}`;
      else title = `Movimientos: ${label}`;
    }
    openDetailModal(title, content);
  }

  if (type === 'pie' || type === 'funnel' || type === 'pyramid' || type === 'hbar' || type === 'line') {
    if (w.field === 'status' || w.field === 'category' || w.field === 'brand') {
      content = getDetailContentByField(w.field, label, value, w, type);
      if (w.field === 'brand') title = `Marca: ${label}`;
      else if (type === 'pie' || type === 'funnel' || type === 'pyramid' || type === 'hbar') title = `${label} (${value})`;
    } else if (w.t && w.t.toLowerCase().includes('movimientos')) {
      content = getMovementsContent(label, '');
    } else {
      content = `
        <div class="detail-fields">
          <div class="field">
            <span class="field-label">${type === 'line' ? 'Fecha:' : type === 'funnel' ? 'Etapa:' : type === 'pyramid' ? 'Nivel:' : 'Etiqueta:'}</span>
            <span class="field-value">${esc(label)}</span>
          </div>
          <div class="field">
            <span class="field-label">Valor:</span>
            <span class="field-value">${value}</span>
          </div>
        </div>
      `;
    }
    openDetailModal(title, content);
  }

  if (type === 'table-cell' && w) {
    const rowLabel = label;
    const colKey = clickable.dataset.col;

    if (w.t.includes('categoría y estado')) {
      const category = rowLabel;
      let assets = D.assets.filter(a => (a.category || 'Sin categoría') === category);

      if (colKey === 'inUse') {
        assets = assets.filter(a => bucket(a.status) === 'inUse');
        title = `${category} - En uso`;
      } else if (colKey === 'inStore') {
        assets = assets.filter(a => bucket(a.status) === 'inStore');
        title = `${category} - Disponible`;
      } else if (colKey === 'inRepair') {
        assets = assets.filter(a => bucket(a.status) === 'inRepair');
        title = `${category} - En reparación`;
      } else if (colKey === 'others') {
        assets = assets.filter(a => bucket(a.status) === 'others');
        title = `${category} - Otros estados`;
      } else if (colKey === 'ASIGNADO') {
        assets = assets.filter(a => String(a.status || '').toUpperCase() === 'ASIGNADO');
        title = `${category} - Asignado`;
      } else if (colKey === 'ALQUILADO') {
        assets = assets.filter(a => String(a.status || '').toUpperCase() === 'ALQUILADO');
        title = `${category} - Alquilado`;
      } else if (colKey === 'PRESTADO') {
        assets = assets.filter(a => String(a.status || '').toUpperCase() === 'PRESTADO');
        title = `${category} - Prestado`;
      } else {
        title = `${category} - Todos`;
      }

      content = `
        <table class="tbl">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Responsable</th>
            </tr>
          </thead>
          <tbody>
            ${assets.map(a => `
              <tr>
                <td>${esc(a.code || '—')}</td>
                <td>${esc(a.name)}</td>
                <td>${esc(a.type || '—')}</td>
                <td>${esc(a.status || '—')}</td>
                <td>${esc(a.assignedTo || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (w.t.includes('responsable')) {
      const person = rowLabel;
      let assets = D.assets.filter(a => a.assignedTo === person);

      if (colKey === 'n') {
        title = `${person} - Activos`;
      } else if (colKey === 'cost') {
        title = `${person} - Valor`;
      } else if (colKey === 'cats') {
        title = `${person} - Categorías`;
        const categories = [...new Set(assets.map(a => a.category || 'Sin categoría'))];
        content = `
          <table class="tbl">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              ${categories.map(cat => {
                const count = assets.filter(a => (a.category || 'Sin categoría') === cat).length;
                return `
                  <tr>
                    <td>${esc(cat)}</td>
                    <td>${count}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;
        openDetailModal(title, content);
        return;
      } else {
        title = person;
      }

      content = `
        <table class="tbl">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Estado</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            ${assets.map(a => `
              <tr>
                <td>${esc(a.code || '—')}</td>
                <td>${esc(a.name)}</td>
                <td>${esc(a.category || '—')}</td>
                <td>${esc(a.status || '—')}</td>
                <td>${money(a.cost)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (w.t.includes('Valor del inventario')) {
      const category = rowLabel;
      const assets = D.assets.filter(a => (a.category || 'Sin categoría') === category);

      if (colKey === 'cost') {
        title = `${category} - Valor`;
      } else if (colKey === 'n') {
        title = `${category} - Cantidad`;
      } else {
        title = category;
      }

      content = `
        <table class="tbl">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            ${assets.map(a => `
              <tr>
                <td>${esc(a.code || '—')}</td>
                <td>${esc(a.name)}</td>
                <td>${esc(a.status || '—')}</td>
                <td>${money(a.cost)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    openDetailModal(title, content);
  }
}
