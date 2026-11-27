// Panel de Estadísticas - Módulo 9: Handlers del root (panel principal)

root.addEventListener('click', e => {
  const li = e.target.closest('.legend [data-k]');
  if (li) return toggleLegend(li);
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const wd = b.closest('.wd'), w = W[wd.dataset.i];

  if (b.dataset.act === 'refresh') refresh(b, $('.wd-body', wd), w);
  if (b.dataset.act === 'view')    openMenu(b, $('.wd-body', wd), w);
  if (b.dataset.act === 'table')   openCols(b, wd, w);
  if (b.dataset.act === 'expand') {
    current = w;
    $('h2', modal).innerHTML = w.t;
    $('.tools', modal).innerHTML = ['refresh', ...(w.views ? ['view'] : w.cat ? ['table'] : []), 'collapse'].map(k => icon(k, w)).join('');
    $('.wd-body', modal).innerHTML = show(w);
    modal.hidden = false;
    document.body.classList.add('overflow-hidden');
  }
});

/*  Click en elementos interactivos del panel principal  */

root.addEventListener('click', e => {
  const clickable = e.target.closest('[data-clickable]');
  if (!clickable) return;

  const label = clickable.dataset.label;
  const type = clickable.dataset.clickable;
  const wd = clickable.closest('.wd');
  const w = wd ? W[wd.dataset.i] : null;

  if (type === 'bar') {
    // Mostrar información según el tipo de widget
    let content = '';
    let title = label;
    const seriesName = clickable.dataset.series || '';

    if (w.field === 'status' || w.field === 'category' || w.field === 'brand') {
      content = getDetailContentByField(w.field, label, clickable.dataset.value, w, type);
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

  if (type === 'pie') {
    const value = clickable.dataset.value;
    let content = '';
    let title = '';

    if (w.field === 'status' || w.field === 'category' || w.field === 'brand') {
      content = getDetailContentByField(w.field, label, value, w, type);
      if (w.field === 'brand') title = `Marca: ${label}`;
      else title = `${label} (${value})`;
    } else {
      const assets = D.assets.filter(a => (a.status || 'Sin estado') === label);
      content = `
        <div class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Responsable</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              ${assets.map(a => `
                <tr>
                  <td>${esc(a.code || '—')}</td>
                  <td>${esc(a.name)}</td>
                  <td>${esc(a.category || '—')}</td>
                  <td>${esc(a.assignedTo || '—')}</td>
                  <td>${money(a.cost)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      title = `Estado: ${label} (${value})`;
    }
    openDetailModal(title, content);
  }

  if (type === 'table-row' && w) {
    handleRootTableRowClick(w, label);
  }

  if (type === 'table-cell' && w) {
    handleRootTableCellClick(w, label, clickable.dataset.col);
  }

  if (type === 'line') {
    const value = clickable.dataset.value;
    let content = '';
    let title = label;

    if (w.field === 'status' || w.field === 'category' || w.field === 'brand') {
      content = getDetailContentByField(w.field, label, value, w, type);
    } else if (w.t && w.t.toLowerCase().includes('movimientos')) {
      content = getMovementsContent(label, '');
    } else {
      content = `
        <div class="detail-fields">
          <div class="field">
            <span class="field-label">Fecha:</span>
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

  if (type === 'funnel' || type === 'pyramid' || type === 'hbar') {
    const value = clickable.dataset.value;
    let content = '';
    let title = label;

    if (w.field === 'status' || w.field === 'category' || w.field === 'brand') {
      content = getDetailContentByField(w.field, label, value, w, type);
      if (w.field === 'brand') title = `Marca: ${label}`;
    } else {
      content = `
        <div class="detail-fields">
          <div class="field">
            <span class="field-label">${type === 'funnel' ? 'Etapa:' : type === 'pyramid' ? 'Nivel:' : 'Etiqueta:'}</span>
            <span class="field-value">${esc(label)}</span>
          </div>
          <div class="field">
            <span class="field-label">Cantidad:</span>
            <span class="field-value">${value}</span>
          </div>
        </div>
      `;
    }

    openDetailModal(title, content);
  }
});

// Función auxiliar para manejar clicks de tipos complejos (line, funnel, pyramid, hbar)
function handleRootComplexClick(clickable, w) {
  const label = clickable.dataset.label;
  const type = clickable.dataset.clickable;
  const value = clickable.dataset.value;

  let content = '';
  let title = label;

  if (type === 'line') {
    if (w.field === 'status' || w.field === 'category' || w.field === 'brand') {
      content = getDetailContentByField(w.field, label, value, w, type);
    } else if (w.t && w.t.toLowerCase().includes('movimientos')) {
      content = getMovementsContent(label, '');
    } else {
      content = `
        <div class="detail-fields">
          <div class="field">
            <span class="field-label">Fecha:</span>
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

  if (type === 'funnel' || type === 'pyramid' || type === 'hbar') {
    if (w.field === 'status' || w.field === 'category' || w.field === 'brand') {
      content = getDetailContentByField(w.field, label, value, w, type);
      if (w.field === 'brand') title = `Marca: ${label}`;
    } else {
      content = `
        <div class="detail-fields">
          <div class="field">
            <span class="field-label">${type === 'funnel' ? 'Etapa:' : type === 'pyramid' ? 'Nivel:' : 'Etiqueta:'}</span>
            <span class="field-value">${esc(label)}</span>
          </div>
          <div class="field">
            <span class="field-label">Cantidad:</span>
            <span class="field-value">${value}</span>
          </div>
        </div>
      `;
    }
    openDetailModal(title, content);
  }
}
