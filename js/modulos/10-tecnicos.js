  const normalizeName = value => String(value || '').trim().toLocaleLowerCase('es');

  // Técnicos = funcionarios del área TECNICA, con las herramientas que tienen asignadas.
  function getTechnicians() {
    return data.users
      .filter(user => normalizeSearch(user.area) === 'tecnica')
      .map(user => {
        const equipment = data.tools.filter(tool => String(tool.responsibleId) === String(user.id));
        return {
          ...user,
          equipment,
          equipmentCount: equipment.reduce((sum, tool) => sum + (Number(tool.quantity) || 0), 0),
          inUseCount: equipment.filter(tool => tool.status === 'En uso').length,
          repairCount: equipment.filter(tool => tool.status === 'En reparación').length,
          lastAudit: toolAuditsOf(user.id)[0] || null,
        };
      })
      .sort((a, b) => (a.estado === 'Inactivo') - (b.estado === 'Inactivo') || String(a.nombre).localeCompare(String(b.nombre), 'es'));
  }

  // Detalle del técnico: ficha + tarjetas compactas por herramienta.
  // Al pulsar una tarjeta se expande (animación FLIP) con todos sus datos.
  function technicianDetail(user) {
    const content = document.createElement('div');
    content.className = 'detail-content tech-detail';

    const initials = String(user.nombre || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const profile = document.createElement('section');
    profile.className = 'tech-profile';
    const avatar = text('span', initials, 'tech-avatar');
    const who = document.createElement('div');
    who.className = 'tech-who';
    who.append(text('strong', user.nombre, 'tech-name'), text('span', user.cargo || 'Técnico', 'tech-role'));
    profile.append(avatar, who);
    if (user.estado) profile.append(badge(user.estado));
    content.append(profile);

    const stat = (label, value, tone) => {
      const item = document.createElement('div');
      item.className = `tech-stat${tone ? ` is-${tone}` : ''}`;
      item.append(text('strong', Number(value || 0).toLocaleString('es-CO')), text('span', label));
      return item;
    };
    const stats = document.createElement('section');
    stats.className = 'tech-stats';
    stats.append(
      stat('Unidades en total', user.equipmentCount, 'ok'),
      stat('Herramientas', user.equipment.length),
      stat('En uso', user.inUseCount),
      stat('En reparación', user.repairCount, user.repairCount ? 'warn' : ''),
    );
    content.append(stats);
    content.append(toolAuditPanel(user));
    content.append(toolDeliveryPanel(user));

    if (!user.equipment.length) {
      content.append(text('p', 'Este técnico no tiene herramientas asignadas.', 'module-card-empty'));
      showDetail(user.nombre, content, { wide: true });
      return;
    }

    content.append(text('h3', 'Herramientas', 'tech-section-title'));
    const grid = document.createElement('div');
    grid.className = 'tool-grid';
    user.equipment.forEach(tool => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'tool-card';
      const tile = document.createElement('span');
      tile.className = 'tool-card-icon';
      const img = document.createElement('img');
      img.src = getCardIcon(tool.name, 'Herramienta');
      img.alt = '';
      tile.append(img);
      const copy = document.createElement('span');
      copy.className = 'tool-card-copy';
      copy.append(
        text('span', tool.name, 'tool-card-title'),
        text('span', tool.description || tool.brand || 'Sin descripción', 'tool-card-sub'),
      );
      card.append(tile, copy);
      if (Number(tool.quantity) > 1) card.append(text('span', `×${tool.quantity}`, 'tool-card-qty'));
      card.append(Object.assign(document.createElement('i'), { className: `tool-card-dot ${statusClass(tool.status)}`, title: tool.status || '' }));
      card.addEventListener('click', () => openToolCard(card, tool));
      grid.append(card);
    });
    content.append(grid);
    showDetail(user.nombre, content, { wide: true });
  }

  // Tarjeta expandida: crece desde la tarjeta pulsada hasta el centro de la ventana.
  function openToolCard(card, tool) {
    const box = card.closest('.modal-box');
    if (!box || box.querySelector('.tool-expanded-layer')) return;
    const layer = document.createElement('div');
    layer.className = 'tool-expanded-layer';
    const panel = document.createElement('article');
    panel.className = 'tool-expanded';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', tool.name);

    const top = document.createElement('div');
    top.className = 'tool-expanded-top';
    const img = document.createElement('img');
    img.src = getCardIcon(tool.name, 'Herramienta');
    img.alt = '';
    top.append(img);
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'tool-expanded-close';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.textContent = '✕';
    top.append(closeBtn);

    const body = document.createElement('div');
    body.className = 'tool-expanded-body';
    const heading = document.createElement('div');
    heading.className = 'tool-expanded-heading';
    const titles = document.createElement('div');
    titles.append(text('h3', tool.name), text('p', tool.brand ? `Marca: ${tool.brand}` : 'Herramienta'));
    heading.append(titles, badge(tool.status));
    body.append(heading);
    if (tool.description) body.append(text('p', tool.description, 'tool-expanded-desc'));
    const facts = document.createElement('dl');
    facts.className = 'tool-expanded-facts';
    [['Marca', tool.brand], ['Serial', tool.serial], ['Cantidad', tool.quantity], ['Precio de compra', money(tool.cost)], ['Estado', tool.status]].forEach(([label, value]) => {
      if (value == null || value === '') return;
      const item = document.createElement('div');
      const term = document.createElement('dt');
      term.append(detailIcon(label), text('span', label));
      item.append(term, text('dd', value));
      facts.append(item);
    });
    body.append(facts);
    panel.append(top, body);
    layer.append(panel);
    box.append(layer);

    const from = card.getBoundingClientRect();
    const animated = !!panel.animate && !reducedMotion();
    if (animated) {
      const to = panel.getBoundingClientRect();
      panel.style.transformOrigin = '0 0';
      const start = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
      layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'both' });
      panel.animate([{ transform: start, borderRadius: '12px' }, { transform: 'none', borderRadius: '16px' }], { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
      body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: 150, fill: 'both' });
    }

    let closing = false;
    const close = () => {
      if (closing) return;
      closing = true;
      document.removeEventListener('keydown', onKey, true);
      card.focus({ preventScroll: true });
      if (!animated || !card.isConnected) { layer.remove(); return; }
      const now = panel.getBoundingClientRect();
      const back = card.getBoundingClientRect();
      const end = `translate(${back.left - now.left}px, ${back.top - now.top}px) scale(${back.width / now.width}, ${back.height / now.height})`;
      layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
      panel.animate([{ transform: 'none' }, { transform: end }], { duration: 240, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).onfinish = () => layer.remove();
    };
    // Escape cierra primero la tarjeta, no la ventana del técnico.
    const onKey = event => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', onKey, true);
    layer.addEventListener('click', event => { if (event.target === layer) close(); });
    closeBtn.addEventListener('click', close);
    closeBtn.focus({ preventScroll: true });
  }

