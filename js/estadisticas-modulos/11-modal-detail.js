// Panel de Estadísticas - Módulo 11: Modal de detalle

/*  Modal de detalle  */

const detailModal = document.createElement('div');
detailModal.className = 'modal detail-modal';
detailModal.hidden = true;
detailModal.innerHTML = `
  <div class="modal-box">
    <div class="modal-head">
      <h2 id="detail-title">Detalle</h2>
      <button type="button" class="modal-close" aria-label="Cerrar">×</button>
    </div>
    <div class="modal-body" id="detail-content"></div>
  </div>`;
document.body.appendChild(detailModal);

function openDetailModal(title, content) {
  document.getElementById('detail-title').textContent = title;
  // No envolver tablas que ya están en tbl-wrap
  document.getElementById('detail-content').innerHTML = content;
  detailModal.hidden = false;
  document.body.classList.add('modal-open');
}

function closeDetailModal() {
  detailModal.hidden = true;
  document.body.classList.remove('modal-open');
}

detailModal.querySelector('.modal-close').addEventListener('click', closeDetailModal);

// Manejo de clicks en filas de tabla dentro del modal de detalle
detailModal.addEventListener('click', e => {
  const clickable = e.target.closest('[data-clickable]');
  if (!clickable) return;

  const label = clickable.dataset.label;
  const type = clickable.dataset.clickable;

  if (type === 'table-row') {
    // Mostrar detalle de esa fila específica
    const rowLabel = label;

    // Determinar qué información mostrar según el widget
    let content = '';
    let title = rowLabel;

    // Buscar el widget actual basado en el título del modal
    const modalTitle = document.getElementById('detail-title').textContent;
    const w = W.find(widget => widget.t.includes('stock bajo'));

    if (w && w.t.includes('stock bajo')) {
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
    } else {
      // Fallback genérico
      content = `<p class="empty">No hay detalles disponibles</p>`;
    }

    openDetailModal(title, content);
  }
});
detailModal.addEventListener('click', e => {
  if (e.target === detailModal) closeDetailModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !detailModal.hidden) closeDetailModal();
});
