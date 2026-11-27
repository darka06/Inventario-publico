  function formatDetailDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return value || 'Fecha no disponible';
    return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function relativeDetailDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((today - date) / 86400000);
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    if (days === -1) return 'Mañana';
    return days > 1 ? `Hace ${days} días` : `En ${Math.abs(days)} días`;
  }

  function detailSection(title, entries) {
    const section = document.createElement('section');
    section.className = 'detail-section';
    section.append(text('h3', title, 'section-title'));
    const list = document.createElement('dl');
    list.className = 'detail-list';
    entries.forEach(([label, value]) => {
      if (value == null || value === '') return;
      const row = document.createElement('div');
      row.className = `detail-row${title === 'Notas' ? ' is-note' : ''}`;
      const term = document.createElement('dt');
      term.append(detailIcon(label), text('span', label));
      const description = document.createElement('dd');
      description.append(value instanceof Node ? value : text('span', value));
      row.append(term, description);
      list.append(row);
    });
    section.hidden = !list.childElementCount;
    section.append(list);
    return section;
  }

  // Métricas destacadas: etiqueta a la izquierda y cifra grande a la derecha.
  // items: [{ label, value, unit, tone }] con tone = ok | warn | danger | (vacío = neutro).
  function detailMetrics(items, extra) {
    const visible = items.filter(item => item && item.value != null && item.value !== '');
    const section = document.createElement('section');
    section.className = 'detail-metrics';
    visible.forEach(({ label, value, unit, tone }) => {
      const row = document.createElement('div');
      row.className = `detail-metric${tone ? ` is-${tone}` : ''}`;
      const figure = document.createElement('span');
      figure.className = 'detail-metric-figure';
      figure.append(text('strong', value, 'detail-metric-value'));
      if (unit) figure.append(text('small', unit, 'detail-metric-unit'));
      row.append(text('span', label, 'detail-metric-label'), figure);
      section.append(row);
    });
    if (extra) section.append(extra);
    section.hidden = !visible.length;
    return section;
  }

  function warrantyMetric(value) {
    if (!value) return null;
    const end = new Date(value);
    if (isNaN(end.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((end - today) / 86400000);
    if (days < 0) return { label: 'Garantía', value: 'Vencida', unit: `hace ${Math.abs(days).toLocaleString('es-CO')} d`, tone: 'danger' };
    return { label: 'Garantía', value: days.toLocaleString('es-CO'), unit: days === 1 ? 'día' : 'días', tone: days <= 60 ? 'warn' : 'ok' };
  }

  function statusClass(status) {
    return ['Asignado', 'Alquilado', 'Prestado', 'En uso', 'Activo'].includes(status) ? 'st-use'
      : ['En reparación', 'Dañada'].includes(status) ? 'st-repair' : 'st-store';
  }

  function detailIcon(label) {
    const paths = {
      Nombre: '<path d="M4 12V4h8l8 8-8 8z"/><circle cx="8.5" cy="8.5" r="1.2"/>',
      Marca: '<path d="M12 3 4.5 7v5c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V7L12 3z"/><path d="m9 12 2 2 4-4"/>',
      Modelo: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/>',
      'Número de serie': '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8v8M11 8v8M14 8v8M17 8v8"/>',
      Responsable: '<circle cx="12" cy="8" r="3"/><path d="M5 20c.5-4 3-6 7-6s6.5 2 7 6"/>',
      Cliente: '<path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/>',
      'Fecha de compra': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
      Proveedor: '<path d="M3 7h11v11H3zM14 11h4l3 3v4h-7z"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="17.5" cy="19" r="1.5"/>',
      Factura: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h7"/>',
      'Proveedor / factura': '<path d="M3 7h11v11H3zM14 11h4l3 3v4h-7z"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="17.5" cy="19" r="1.5"/>',
      Costo: '<circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.7-.8-1.7-1.2-3-1.2-1.6 0-2.7.8-2.7 2s1.1 1.8 2.8 2.2 2.8 1 2.8 2.3-1.1 2.2-2.9 2.2c-1.4 0-2.5-.5-3.3-1.5M12 5.5v13"/>',
      Observaciones: '<path d="M4 4h16v13H9l-5 4z"/><path d="M8 8h8M8 12h6"/>',
      Ubicación: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
      'Fin de garantía': '<path d="M12 3 4.5 7v5c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V7L12 3z"/>',
      Descripción: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
      'Unidad de medida': '<path d="m4 16 12-12 4 4L8 20z"/><path d="m13 7 4 4M10 10l2 2M7 13l2 2"/>',
      'Costo unitario': '<circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.7-.8-1.7-1.2-3-1.2-1.6 0-2.7.8-2.7 2s1.1 1.8 2.8 2.2 2.8 1 2.8 2.3-1.1 2.2-2.9 2.2c-1.4 0-2.5-.5-3.3-1.5M12 5.5v13"/>',
      'Cantidad': '<path d="m3 7 9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',
      Estado: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
      Cargo: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>',
      Documento: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h7"/>',
      Área: '<path d="M3 21V9l9-6 9 6v12M9 21v-6h6v6"/>',
      Correo: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
      Teléfono: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
      Dirección: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
      Tipo: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
      Subtipo: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
      'Fecha de registro de compra': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
      'Último movimiento': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      IVA: '<circle cx="12" cy="12" r="9"/><path d="m8.5 15.5 7-7M9 9h.01M15 15h.01"/>',
      Serial: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8v8M11 8v8M14 8v8M17 8v8"/>',
      'Valor en stock': '<path d="m3 7 9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',
    };
    const icon = document.createElement('span');
    icon.className = 'detail-field-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[label] || '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>'}</svg>`;
    return icon;
  }

  function detailHero(iconPath, code, category, categoryLabel = 'Categoría') {
    const hero = document.createElement('section');
    hero.className = 'detail-hero';
    const icon = document.createElement('span');
    icon.className = 'detail-product-icon';
    const image = document.createElement('img');
    image.src = iconPath;
    image.alt = '';
    icon.append(image);
    const identity = document.createElement('div');
    identity.className = 'detail-identity';
    identity.append(text('span', code, 'detail-code'));
    if (category) {
      const categoryInfo = document.createElement('span');
      categoryInfo.className = 'detail-category';
      categoryInfo.append(
        text('span', `${categoryLabel}:`, 'detail-category-label'),
        text('span', category, 'detail-category-value'),
      );
      identity.append(categoryInfo);
    }
    hero.append(icon, identity);
    return hero;
  }

  function detailTimeline(title, entries, emptyMessage, limit = 3) {
    const section = document.createElement('section');
    section.className = 'detail-section';
    section.append(text('h3', title, 'section-title'));
    const timeline = document.createElement('ol');
    timeline.className = 'module-timeline detail-timeline';
    const sortedEntries = [...entries].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    sortedEntries.slice(0, limit).forEach(entry => {
      const item = document.createElement('li');
      item.append(
        text('strong', entry.title),
        text('span', `${formatDetailDate(entry.date)}${relativeDetailDate(entry.date) ? ` · ${relativeDetailDate(entry.date)}` : ''}`, 'detail-timeline-date'),
      );
      if (entry.description) item.append(text('p', entry.description, 'detail-timeline-note'));
      timeline.append(item);
    });
    if (!timeline.childElementCount) timeline.append(text('li', emptyMessage));
    section.append(timeline);
    return section;
  }

  function addHistory(asset, to, note, from = asset.status, date = TODAY()) {
    asset.history = Array.isArray(asset.history) ? asset.history : [];
    asset.history.unshift({ date, from: from || '—', to, note: note || 'Actualización de activo' });
    asset.status = to;
  }

  function addMovement(record) {
    data.movements.unshift({ id: makeId('mov'), date: TODAY(), ...record });
  }

  function getContactNames(type) {
    return data.contacts.filter(contact => !type || contact.type === type).map(contact => contact.name);
  }

  function getBrandRecords() {
    return data.brands;
  }

