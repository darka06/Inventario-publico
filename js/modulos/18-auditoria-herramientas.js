  // ===== Auditoría de herramientas por técnico =====
  // Una auditoría es una revisión física: por cada herramienta asignada al técnico se anota la cantidad y el
  // estado que se encontraron y una nota. El historial guarda lo registrado vs. lo encontrado (ver api/lib/tool_audits.php).
  // Este archivo solo declara funciones (no hay código suelto), por eso puede ir después del arranque.

  // Estados que se pueden encontrar al auditar. "Disponible" se toma como "En uso" y "Baja" solo se da desde aquí.
  const AUDIT_STATUSES = ['En uso', 'En reparación', 'Dañada', 'No encontrada'];
  const auditBaseStatus = status => (status === 'Disponible' ? 'En uso' : status);
  const auditResultTone = result => (result === 'Conforme' ? 'is-ok' : ['No encontrada', 'Dada de baja'].includes(result) ? 'is-bad' : 'is-warn');

  function auditBadge(result) {
    return text('span', result, `badge audit-badge ${auditResultTone(result)}`);
  }

  // Auditorías de un técnico (la API ya las entrega de la más reciente a la más antigua).
  function toolAuditsOf(techId) {
    return (data.toolAudits || []).filter(audit => String(audit.technicianId) === String(techId));
  }

  // Franja del detalle del técnico: última auditoría y botones para auditar o ver el historial.
  function toolAuditPanel(tech) {
    const audits = toolAuditsOf(tech.id);
    const panel = document.createElement('section');
    panel.className = 'audit-panel';
    const info = document.createElement('div');
    info.className = 'audit-panel-info';
    info.append(text('strong', 'Auditoría de herramientas'));
    if (audits.length) {
      const last = audits[0];
      const line = document.createElement('span');
      line.append(`Última: ${formatChangeDate(last.date)} · `, auditBadge(last.result), ` · ${last.auditor || 'sin auditor'}`);
      info.append(line);
    } else {
      info.append(text('span', 'Este técnico aún no ha sido auditado.'));
    }
    const actions = document.createElement('div');
    actions.className = 'audit-panel-actions';
    if (tech.equipment.some(tool => tool.status !== 'Baja') && window.inventarioApi.can('auditorias.crear')) actions.append(button('Auditar herramientas', 'audit-tech', tech.id));
    if (audits.length) actions.append(button(`Historial (${audits.length})`, 'audit-history', tech.id, true));
    panel.append(info, actions);
    return panel;
  }

  function toolDeliveriesOf(techId) {
    return data.tools.flatMap(tool => (tool.assignmentHistory || [])
      .filter(entry => String(entry.technicianId) === String(techId))
      .map(entry => ({ ...entry, tool: entry.tool || tool.name })))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function toolDeliveryPanel(tech) {
    const deliveries = toolDeliveriesOf(tech.id);
    const panel = document.createElement('section');
    panel.className = 'audit-panel';
    const info = document.createElement('div');
    info.className = 'audit-panel-info';
    info.append(text('strong', 'Entrega de herramientas'));
    info.append(text('span', deliveries.length
      ? `Última: ${deliveries[0].tool} · ${formatChangeDate(deliveries[0].date)}`
      : 'Este técnico aún no tiene entregas registradas.'));
    const actions = document.createElement('div');
    actions.className = 'audit-panel-actions';
    if (deliveries.length) actions.append(button(`Historial (${deliveries.length})`, 'tool-delivery-history', tech.id, true));
    panel.append(info, actions);
    return panel;
  }

  function openToolDeliveryHistory(techId) {
    const tech = data.users.find(item => String(item.id) === String(techId));
    if (!tech) return;
    const deliveries = toolDeliveriesOf(techId);
    const list = document.createElement('div');
    list.className = 'audit-list';
    const items = document.createElement('div');
    items.className = 'audit-items';
    if (!deliveries.length) items.append(text('p', 'No hay entregas registradas.', 'module-card-empty'));
    deliveries.forEach(entry => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'audit-item';
      const head = document.createElement('span');
      head.className = 'audit-item-head';
      head.append(text('strong', entry.tool), text('span', formatChangeDate(entry.date), 'audit-item-meta'));
      item.append(head, text('span', entry.by ? `Registró: ${entry.by}` : 'Entrega registrada', 'audit-item-meta'));
      item.addEventListener('click', () => {
        const content = document.createElement('div');
        content.className = 'detail-content delivery-detail';
        content.append(detailSection('Datos de la entrega', [
          ['Herramienta', entry.tool], ['Técnico', entry.technician],
          ['Fecha y hora', formatChangeDate(entry.date)], ['Registró', entry.by],
        ]));
        showDetail(`Entrega · ${entry.tool}`, content, { wide: true });
      });
      items.append(item);
    });
    list.append(items);
    openHistoryWindow(`tool-delivery-history:${techId}`, `Historial de entregas · ${tech.nombre}`, list);
  }

  // ---- Formulario de auditoría ----
  function toolAuditForm(techId) {
    const tech = getTechnicians().find(item => String(item.id) === String(techId));
    if (!window.inventarioApi.can('auditorias.crear')) return showNotice('No tienes permiso para realizar auditorías.', true);
    const tools = tech ? tech.equipment.filter(tool => tool.status !== 'Baja') : [];
    if (!tools.length) return showNotice('Este técnico no tiene herramientas para auditar.', true);
    openForm(`Auditoría · ${tech.nombre}`, () => {
      formModal.querySelector('.modal-box').classList.add('audit-form-box');
      fields.append(text('p', 'Revisa cada herramienta. Si lo encontrado no coincide con lo registrado, la nota es obligatoria.', 'audit-form-intro'));
      tools.forEach(tool => {
        const base = auditBaseStatus(tool.status);
        const section = createFormSection(tool.name);
        const ref = [`Registrado: ${tool.quantity} und`, base, tool.brand, tool.serial && `Serial ${tool.serial}`].filter(Boolean).join(' · ');
        section.append(text('p', ref, 'audit-ref'));
        const qty = appendField(`qty-${tool.id}`, 'Cantidad encontrada', 'number', true, tool.quantity, { container: section });
        qty.min = 0;
        qty.step = 1;
        const status = appendField(`status-${tool.id}`, 'Estado encontrado', 'select', true, AUDIT_STATUSES.includes(base) ? base : 'En uso', { options: AUDIT_STATUSES, placeholder: false, container: section });
        // Solo una herramienta dañada se puede dar de baja (queda en estado Baja en el inventario).
        const bajaRow = document.createElement('label');
        bajaRow.className = 'f audit-baja';
        bajaRow.hidden = true;
        const baja = document.createElement('input');
        baja.type = 'checkbox';
        baja.name = `baja-${tool.id}`;
        bajaRow.append(text('span', 'Dar de baja esta herramienta', 'f-label'), baja);
        section.append(bajaRow);
        const note = appendField(`note-${tool.id}`, 'Nota', 'text', false, '', { full: true, container: section });
        note.maxLength = 500;
        note.placeholder = 'Observaciones de esta herramienta';
        // Si hay diferencia, se resalta la herramienta y la nota pasa a ser obligatoria.
        let wasMissing = false;
        const sync = () => {
          const missing = status.value === 'No encontrada';
          if (missing) qty.value = 0;
          else if (wasMissing) qty.value = tool.quantity;
          wasMissing = missing;
          qty.readOnly = missing;
          bajaRow.hidden = status.value !== 'Dañada';
          if (bajaRow.hidden) baja.checked = false;
          const differs = qty.value === '' || Number(qty.value) !== Number(tool.quantity) || status.value !== (AUDIT_STATUSES.includes(base) ? base : 'En uso') || baja.checked;
          section.parentElement.classList.toggle('has-diff', differs);
          note.required = differs;
        };
        qty.addEventListener('input', sync);
        status.addEventListener('change', sync);
        baja.addEventListener('change', sync);
      });
      const general = createFormSection('Nota general');
      const generalNote = appendField('generalNote', 'Observaciones de la auditoría', 'textarea', false, '', { full: true, rows: 2, container: general });
      generalNote.maxLength = 1000;
    }, async values => {
      const items = tools.map(tool => ({
        toolId: tool.id,
        quantity: values[`qty-${tool.id}`],
        status: values[`status-${tool.id}`],
        note: values[`note-${tool.id}`],
        writeOff: values[`baja-${tool.id}`] === 'on',
      }));
      const result = await window.inventarioApi.post('toolaudit.save', { technicianId: tech.id, items, generalNote: values.generalNote });
      await reloadData();
      closeForm();
      renderShell();
      const extra = result.writtenOff ? ` ${result.writtenOff} ${result.writtenOff === 1 ? 'herramienta dada de baja' : 'herramientas dadas de baja'}.` : '';
      showNotice((result.novelties ? `Auditoría guardada: ${result.novelties} ${result.novelties === 1 ? 'novedad' : 'novedades'}.` : 'Auditoría guardada: todo conforme.') + extra);
      refreshAuditHistoryWindows();
    });
  }

  // ---- Historial ----
  // techId = null abre el historial de todos los técnicos.
  function openToolAuditHistory(techId = null) {
    const tech = techId == null ? null : data.users.find(item => String(item.id) === String(techId));
    const title = tech ? `Historial de auditorías · ${tech.nombre}` : 'Historial de auditorías';
    openHistoryWindow(`audit-history:${techId == null ? 'all' : techId}`, title, toolAuditList(techId == null ? (data.toolAudits || []) : toolAuditsOf(techId), techId == null));
  }

  // Si ya hay un historial abierto, se vuelve a dibujar con la auditoría nueva.
  function refreshAuditHistoryWindows() {
    wins.filter(win => win.kind === 'history' && /^audit-history:/.test(win.key || '')).forEach(win => {
      const id = win.key.split(':')[1];
      openToolAuditHistory(id === 'all' ? null : id);
    });
  }

  function toolAuditList(audits, showTechnician) {
    const wrap = document.createElement('div');
    wrap.className = 'audit-list';
    const list = document.createElement('div');
    list.className = 'audit-items';
    let onlyIssues = false;
    const draw = () => {
      list.replaceChildren();
      const visible = audits.filter(audit => !onlyIssues || audit.novelties > 0);
      if (!visible.length) {
        list.append(text('p', audits.length ? 'No hay auditorías con novedades.' : 'No hay auditorías registradas.', 'module-card-empty'));
        return;
      }
      visible.forEach(audit => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'audit-item';
        const head = document.createElement('span');
        head.className = 'audit-item-head';
        head.append(text('strong', showTechnician ? audit.technician : formatChangeDate(audit.date)), auditBadge(audit.result));
        const meta = [
          showTechnician && formatChangeDate(audit.date),
          `${audit.toolCount} ${audit.toolCount === 1 ? 'herramienta' : 'herramientas'}`,
          `${audit.novelties} ${audit.novelties === 1 ? 'novedad' : 'novedades'}`,
          audit.auditor && `Auditor: ${audit.auditor}`,
        ].filter(Boolean).join(' · ');
        item.append(head, text('span', meta, 'audit-item-meta'));
        if (audit.note) item.append(text('span', audit.note, 'audit-item-note'));
        item.addEventListener('click', () => toolAuditDetail(audit));
        list.append(item);
      });
    };
    if (audits.some(audit => audit.novelties > 0)) {
      const filter = document.createElement('label');
      filter.className = 'audit-filter';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.addEventListener('change', () => { onlyIssues = box.checked; draw(); });
      filter.append(box, text('span', 'Mostrar solo las que tuvieron novedades'));
      wrap.append(filter);
    }
    draw();
    wrap.append(list);
    return wrap;
  }

  // ---- Detalle de una auditoría ----
  function toolAuditDetail(audit) {
    const content = document.createElement('div');
    content.className = 'detail-content audit-detail';
    content.append(detailSection('Resumen', [
      ['Fecha', formatChangeDate(audit.date)],
      ['Técnico', audit.technician],
      ['Auditor', audit.auditor],
      ['Resultado', audit.result],
      ['Herramientas revisadas', audit.toolCount],
      ['Unidades registradas', audit.unitsRegistered],
      ['Unidades encontradas', audit.unitsFound],
      ['Novedades', audit.novelties],
      ['Nota general', audit.note],
    ]));
    const table = document.createElement('table');
    table.className = 'audit-table';
    const head = table.createTHead().insertRow();
    ['Herramienta', 'Cantidad', 'Estado', 'Resultado', 'Nota'].forEach(label => head.append(text('th', label)));
    const body = table.createTBody();
    const change = (before, after) => (String(before) === String(after) ? String(after) : `${before || '—'} → ${after}`);
    audit.items.forEach(item => {
      const row = body.insertRow();
      const name = document.createElement('td');
      name.append(text('strong', item.name), text('small', [item.brand, item.serial && `Serial ${item.serial}`].filter(Boolean).join(' · ') || ' ', 'audit-cell-sub'));
      const qty = text('td', change(item.registeredQty, item.foundQty));
      const status = text('td', change(auditBaseStatus(item.registeredStatus), item.foundStatus));
      qty.classList.toggle('is-diff', item.registeredQty !== item.foundQty);
      status.classList.toggle('is-diff', auditBaseStatus(item.registeredStatus) !== item.foundStatus);
      const result = document.createElement('td');
      result.append(auditBadge(item.result));
      row.append(name, qty, status, result, text('td', item.note));
    });
    const section = document.createElement('section');
    section.className = 'detail-section';
    const wrapper = document.createElement('div');
    wrapper.className = 'audit-table-wrap';
    wrapper.append(table);
    section.append(text('h3', 'Herramientas revisadas', 'section-title'), wrapper);
    content.append(section);
    showDetail(`Auditoría · ${audit.technician}`, content, { wide: true, actions: auditActions(audit) });
  }

  // ---- Imprimir una auditoría (sin abrir otra pestaña: se imprime desde un marco oculto) ----
  function auditActions(audit) {
    const actions = document.createElement('div');
    actions.append(button('Imprimir', 'audit-print', audit.id, true));
    return actions;
  }

  function findToolAudit(id) {
    return (data.toolAudits || []).find(audit => String(audit.id) === String(id));
  }

  function auditRows(audit) {
    return audit.items.map(item => [
      item.name, item.brand, item.serial, item.registeredQty, item.foundQty,
      item.registeredStatus, item.foundStatus, item.result, item.note,
    ].map(value => (value == null ? '' : value)));
  }

  const AUDIT_COLUMNS = ['Herramienta', 'Marca', 'Serial', 'Cantidad registrada', 'Cantidad encontrada', 'Estado registrado', 'Estado encontrado', 'Resultado', 'Nota'];

  function printToolAudit(id) {
    const audit = findToolAudit(id);
    if (!audit) return;
    const esc = value => {
      const fn = window.INVENTARIO_CONSTANTS?.escapeHtml;
      if (fn) return fn(value);
      return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    };
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.className = 'iframe-hidden';
    document.body.append(frame);
    const cssUrl = new URL(`${document.body.dataset.root || '../'}css/print/auditoria.css`, location.href).href;
    const rows = auditRows(audit).map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Auditoría ${esc(audit.id)} · ${esc(audit.technician)}</title>
<link rel="stylesheet" href="${cssUrl}"></head><body>
<h1>Auditoría de herramientas · ${esc(audit.technician)}</h1>
<dl><dt>Fecha</dt><dd>${esc(formatChangeDate(audit.date))}</dd><dt>Auditor</dt><dd>${esc(audit.auditor || '—')}</dd><dt>Resultado</dt><dd>${esc(audit.result)} (${esc(audit.novelties)} novedades)</dd>
<dt>Unidades</dt><dd>${esc(audit.unitsRegistered)} registradas · ${esc(audit.unitsFound)} encontradas</dd>${audit.note ? `<dt>Nota general</dt><dd>${esc(audit.note)}</dd>` : ''}</dl>
<table><thead><tr>${AUDIT_COLUMNS.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
<div class="sign"><div>Firma del auditor</div><div>Firma del técnico</div></div></body></html>`;
    // srcdoc (no document.write): la hoja externa debe cargar antes de imprimir.
    frame.onload = () => {
      const win = frame.contentWindow;
      win.addEventListener('afterprint', () => frame.remove());
      win.focus();
      win.print();
    };
    frame.srcdoc = html;
    window.setTimeout(() => frame.remove(), 120000);
  }

  // Celda "Última auditoría" de la tabla de técnicos: fecha y resultado, o "Sin auditar".
  function lastAuditCell(audit) {
    if (!audit) return 'Sin auditar';
    const cell = document.createElement('span');
    cell.append(`${formatChangeDate(audit.date)} `, auditBadge(audit.result));
    return cell;
  }
