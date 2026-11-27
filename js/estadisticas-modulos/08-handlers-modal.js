// Panel de Estadísticas - Módulo 8: Handlers del modal principal

modal.addEventListener('click', e => {
  if (e.target === modal) return closeModal();     // clic en el fondo oscuro
  const li = e.target.closest('.legend [data-k]');
  if (li) return toggleLegend(li);

  // Manejo de botones de la toolbar
  const b = e.target.closest('button[data-act]');
  if (b) {
    if (b.dataset.act === 'collapse') closeModal();
    if (b.dataset.act === 'refresh')  refresh(b, $('.wd-body', modal), current);
    if (b.dataset.act === 'view')     openMenu(b, $('.wd-body', modal), current);
    if (b.dataset.act === 'table')    openCols(b, modal, current);
    return;
  }

  // Click en elementos interactivos (barras, torta, tabla, etc.)
  const clickable = e.target.closest('[data-clickable]');
  if (clickable) {
    const label = clickable.dataset.label;
    const type = clickable.dataset.clickable;
    const w = current;

    if (type === 'table-row') {
      // Mostrar detalle de esa fila específica
      const rowLabel = label;

      // Determinar qué información mostrar según el widget
      let content = '';
      let title = rowLabel;

      if (w.t.includes('categoría')) {
        // Activos por categoría y estado
        const assets = D.assets.filter(a => (a.category || 'Sin categoría') === rowLabel);
        content = `
          <div class="tbl-wrap">
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
          </div>
        `;
      } else if (w.t.includes('stock bajo')) {
        // Insumos con stock bajo
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
        // Activos por responsable
        const assets = D.assets.filter(a => a.assignedTo === rowLabel);
        content = `
          <div class="tbl-wrap">
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
          </div>
        `;
      } else {
        // Fallback genérico
        content = `<p class="empty">No hay detalles disponibles</p>`;
      }

      openDetailModal(title, content);
      return;
    }

    // Para otros tipos de clicks, usar la función auxiliar
    if (type !== 'table-row') {
      handleModalClick(clickable, w);
    }
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modal.hidden) closeModal();
});
