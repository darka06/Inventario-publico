// Panel de Estadísticas - Módulo 9b: Handlers de clicks en tablas del root

// Función para manejar clicks en table-row
function handleRootTableRowClick(w, rowLabel) {
  let content = '';
  let title = rowLabel;

  if (w.t.includes('categoría')) {
    const assets = D.assets.filter(a => (a.category || 'Sin categoría') === rowLabel);
    content = `
      <table class="tbl">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Estado</th>
            <th>Responsable</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          ${assets.map(a => `
            <tr>
              <td>${esc(a.code || '—')}</td>
              <td>${esc(a.name)}</td>
              <td>${esc(a.status || '—')}</td>
              <td>${esc(a.assignedTo || '—')}</td>
              <td>${money(a.cost)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else if (w.t.includes('stock bajo')) {
    const supply = D.supplies.find(s => s.name === rowLabel);
    if (supply) {
      content = `
        <div class="detail-fields">
          <div class="field">
            <span class="field-label">Código:</span>
            <span class="field-value">${esc(supply.code || '—')}</span>
          </div>
          <div class="field">
            <span class="field-label">Marca:</span>
            <span class="field-value">${esc(supply.brand || '—')}</span>
          </div>
          <div class="field">
            <span class="field-label">Unidad:</span>
            <span class="field-value">${esc(supply.unit || '—')}</span>
          </div>
          <div class="field">
            <span class="field-label">Stock actual:</span>
            <span class="field-value bad">${supply.stock}</span>
          </div>
          <div class="field">
            <span class="field-label">Stock mínimo:</span>
            <span class="field-value">${supply.minimum}</span>
          </div>
          <div class="field">
            <span class="field-label">Faltante:</span>
            <span class="field-value bad">${supply.minimum - supply.stock}</span>
          </div>
          <div class="field">
            <span class="field-label">Costo unitario:</span>
            <span class="field-value">${money(supply.unitCost)}</span>
          </div>
          <div class="field">
            <span class="field-label">Valor total:</span>
            <span class="field-value">${money(supply.stock * supply.unitCost)}</span>
          </div>
        </div>
      `;
    }
  } else if (w.t.includes('responsable')) {
    const assets = D.assets.filter(a => a.assignedTo === rowLabel);
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
  }

  openDetailModal(title, content);
}

// Función para manejar clicks en table-cell
function handleRootTableCellClick(w, rowLabel, colKey) {
  let content = '';
  let title = '';

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
