// Tablero libre de Inicio: arrastrar, redimensionar, agregar y quitar widgets.
(() => {
  const root = document.getElementById('dash');
  if (!root) return;
  const KEY = 'home-board-v1';
  const COLS = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--board-cols')) || 12;
  const ROWS = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--board-rows')) || 18;
  const GAP = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--board-gap')) || 10;
  let ROW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--board-row-height')) || 40;
  const CHART_COLORS = window.INVENTARIO_CONSTANTS?.CHART_COLORS || ['#130a74', '#2f66dd', '#06c167', '#e0a800', '#e63b4a', '#8e44ad', '#16a2b8', '#7f8c8d', '#d35400', '#34495e'];
  const h = (t, a = {}) => Object.assign(document.createElement(t), a);
  const esc = s => {
    const fn = window.INVENTARIO_CONSTANTS?.escapeHtml;
    if (fn) return fn(s);
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const uid = () => 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const toast = m => { const t = h('div', { className: 'bw-toast', textContent: m }); document.body.append(t); setTimeout(() => t.remove(), 3000); };

  /* ---------- datos ---------- */
  let cache = null;
  const data = () => cache ||= window.inventarioApi.get('all').catch(e => { cache = null; throw e; });
  const bucket = s => {
    s = String(s || '').toUpperCase();
    return ['ASIGNADO', 'ALQUILADO', 'PRESTADO'].includes(s) ? 'inUse' : s === 'DISPONIBLE' ? 'inStore' : s === 'EN REPARACIÓN' ? 'inRepair' : 'others';
  };
  const METRICS = {
    assets: 'Activos', inUse: 'En uso', inStore: 'Disponibles', inRepair: 'En reparación', others: 'Otros estados', assetsValue: 'Valor del inventario',
    supplies: 'Insumos', lowStock: 'Insumos con stock bajo',
    tools: 'Herramientas', toolUnits: 'Unidades de herramientas', audits: 'Auditorías de herramientas', auditIssues: 'Auditorías con novedades',
    loans: 'Préstamos activos', purchasesMonth: 'Compras del mes', movementsMonth: 'Movimientos del mes',
    users: 'Usuarios', usersActive: 'Usuarios activos', contacts: 'Clientes y proveedores', categories: 'Categorías', brands: 'Marcas',
  };
  const money = n => '$ ' + Math.round(n).toLocaleString('es-CO');
  const FMT = { assetsValue: money };
  const sum = (a, f) => a.reduce((t, x) => t + (Number(f(x)) || 0), 0);
  const thisMonth = v => { const n = new Date(); return String(v || '').slice(0, 7) === `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; };
  const stats = d => {
    const A = k => d[k] || [];
    const s = { assets: d.assets.length, inUse: 0, inStore: 0, inRepair: 0, others: 0 };
    d.assets.forEach(a => s[bucket(a.status)]++);
    return { ...s,
      assetsValue: sum(d.assets, a => a.cost),
      supplies: d.supplies.length, lowStock: d.supplies.filter(x => x.stock <= x.minimum).length,
      tools: A('tools').length, toolUnits: sum(A('tools'), t => t.quantity || 1), audits: A('toolAudits').length, auditIssues: A('toolAudits').filter(a => a.novelties > 0).length,
      loans: d.loans.filter(l => !l.supplyOnly && !l.returnedAt && l.type !== 'Venta').length,
      purchasesMonth: A('purchases').filter(x => thisMonth(x.date)).length, movementsMonth: A('movements').filter(x => thisMonth(x.date)).length,
      users: d.users.length, usersActive: d.users.filter(u => String(u.estado || '').toLowerCase() === 'activo').length,
      contacts: A('contacts').length, categories: A('categories').length, brands: A('brands').length };
  };
  // Datos para gráficos: cada fuente devuelve una etiqueta por elemento y se cuentan.
  const GROUPS = {
    category: { l: 'Activos por categoría', empty: 'Sin categoría', rows: d => d.assets.map(a => a.category) },
    status: { l: 'Activos por estado', empty: 'Sin estado', rows: d => d.assets.map(a => a.status) },
    brand: { l: 'Activos por marca', empty: 'Sin marca', rows: d => d.assets.map(a => a.brand) },
    supplier: { l: 'Activos por proveedor', empty: 'Sin proveedor', rows: d => d.assets.map(a => a.supplier) },
    assignedTo: { l: 'Activos por responsable', empty: 'Sin asignar', rows: d => d.assets.map(a => a.assignedTo) },
    year: { l: 'Activos por año de compra', empty: 'Sin fecha', rows: d => d.assets.map(a => String(a.purchaseDate || '').slice(0, 4)) },
    supplyBrand: { l: 'Insumos por marca', empty: 'Sin marca', rows: d => d.supplies.map(x => x.brand) },
    toolStatus: { l: 'Herramientas por estado', empty: 'Sin estado', rows: d => (d.tools || []).map(t => t.status) },
    toolBrand: { l: 'Herramientas por marca', empty: 'Sin marca', rows: d => (d.tools || []).map(t => t.brand) },
    toolResp: { l: 'Herramientas por responsable', empty: 'Sin responsable', rows: d => (d.tools || []).map(t => t.responsible) },
    userArea: { l: 'Usuarios por área', empty: 'Sin área', rows: d => d.users.map(u => u.area) },
    userSede: { l: 'Usuarios por sede', empty: 'Sin sede', rows: d => d.users.map(u => u.sede) },
    purchSupplier: { l: 'Compras por proveedor', empty: 'Sin proveedor', rows: d => (d.purchases || []).map(x => x.supplier) },
    purchType: { l: 'Compras: activos e insumos', empty: 'Sin tipo', rows: d => (d.purchases || []).map(x => x.type) },
    moveAction: { l: 'Movimientos por tipo', empty: 'Sin tipo', rows: d => (d.movements || []).map(x => x.action) },
    auditResult: { l: 'Auditorías por resultado', empty: 'Sin resultado', rows: d => (d.toolAudits || []).map(x => x.result) },
  };
  const GROUP_OPTS = Object.fromEntries(Object.entries(GROUPS).map(([k, g]) => [k, g.l]));
  // Listas: cada fuente devuelve filas [texto, detalle].
  const LISTS = {
    recent: { l: 'Activos recientes', rows: d => d.assets.slice().sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || '')).map(a => [a.name, a.code || '—']) },
    alerts: { l: 'Alertas de stock', rows: d => d.supplies.filter(x => x.stock <= x.minimum).map(x => [x.name, `${x.stock} / mín ${x.minimum}`]) },
    loans: { l: 'Préstamos activos', rows: d => d.loans.filter(l => !l.supplyOnly && !l.returnedAt && l.type !== 'Venta').map(l => [l.assetName, l.person || l.client || '—']) },
    repair: { l: 'Activos en reparación', rows: d => d.assets.filter(a => bucket(a.status) === 'inRepair').map(a => [a.name, a.code || '—']) },
    available: { l: 'Activos disponibles', rows: d => d.assets.filter(a => bucket(a.status) === 'inStore').map(a => [a.name, a.code || '—']) },
    valuable: { l: 'Activos de mayor valor', rows: d => d.assets.filter(a => Number(a.cost) > 0).sort((a, b) => Number(b.cost) - Number(a.cost)).map(a => [a.name, money(Number(a.cost))]) },
    purchases: { l: 'Compras recientes', rows: d => (d.purchases || []).map(x => [x.description || x.code || '—', String(x.date || '').slice(0, 10)]) },
    movements: { l: 'Movimientos recientes', rows: d => (d.movements || []).map(x => [`${x.action || x.kind} · ${x.description || x.code || ''}`, String(x.date || '').slice(0, 10)]) },
    audits: { l: 'Últimas auditorías de herramientas', rows: d => (d.toolAudits || []).map(x => [x.technician, `${String(x.date || '').slice(0, 10)} · ${x.novelties} nov.`]) },
    toolsRepair: { l: 'Herramientas en reparación', rows: d => (d.tools || []).filter(t => /repar/i.test(t.status || '')).map(t => [t.name, t.responsible || '—']) },
    users: { l: 'Usuarios', rows: d => d.users.map(u => [u.nombre, u.cargo || u.area || '—']) },
  };
  const LIST_OPTS = Object.fromEntries(Object.entries(LISTS).map(([k, g]) => [k, g.l]));
  const STATUS_METRICS = { inUse: 'En uso', inStore: 'Disponibles', inRepair: 'En reparación', others: 'Otros estados' };

  /* ---------- tipos de widget ---------- */
  const T = {
    note: { w: 3, h: 5, min: [2, 3], body(el, w) {
      const t = h('textarea', { placeholder: 'Escribe aquí…', value: w.p.text || '' });
      t.oninput = () => { w.p.text = t.value; save(); };
      el.append(t);
    } },

    todo: { w: 3, h: 6, min: [2, 3], body(el, w) {
      w.p.items ||= [];
      const ul = h('ul'), inp = h('input', { placeholder: 'Nueva tarea y Enter' });
      const draw = () => ul.replaceChildren(...w.p.items.map((it, i) => {
        const li = h('li');
        li.innerHTML = `<label><input type="checkbox" ${it.d ? 'checked' : ''}><span class="${it.d ? 'done' : ''}">${esc(it.t)}</span></label><button type="button" aria-label="Quitar">×</button>`;
        li.querySelector('input').onchange = e => { it.d = e.target.checked; save(); draw(); };
        li.querySelector('button').onclick = () => { w.p.items.splice(i, 1); save(); draw(); };
        return li;
      }));
      inp.onkeydown = e => { if (e.key === 'Enter' && inp.value.trim()) { w.p.items.push({ t: inp.value.trim(), d: 0 }); inp.value = ''; save(); draw(); } };
      draw(); el.append(inp, ul);
    } },

    draw: { w: 4, h: 7, min: [3, 4], body(el, w) {
      const bar = h('div', { className: 'dr-bar' }), wrap = h('div', { className: 'dr-wrap' }), cv = h('canvas'), ctx = cv.getContext('2d');
      let color = '#130a74', size = 3, erase = false, last = null, ready = false;
      const colorClasses = {
        '#130a74': 'sw-color-1',
        '#e63b4a': 'sw-color-2',
        '#06c167': 'sw-color-3',
        '#e0a800': 'sw-color-4',
        '#111111': 'sw-color-5'
      };
      ['#130a74', '#e63b4a', '#06c167', '#e0a800', '#111111'].forEach(c => {
        const b = h('button', { type: 'button', className: `sw ${colorClasses[c]}`, title: c });
        b.onclick = () => { color = c; erase = false; }; bar.append(b);
      });
      const eb = h('button', { type: 'button', textContent: 'Borrador' }); eb.onclick = () => { erase = true; };
      const sz = h('input', { type: 'range', min: 1, max: 20, value: size }); sz.oninput = () => { size = +sz.value; };
      const cl = h('button', { type: 'button', textContent: 'Limpiar' }); cl.onclick = () => { ctx.clearRect(0, 0, cv.width, cv.height); keep(); };
      bar.append(eb, sz, cl); wrap.append(cv); el.append(bar, wrap);
      const keep = () => { w.p.img = cv.toDataURL(); save(); };
      const fit = () => {
        const r = wrap.getBoundingClientRect(); if (!r.width || !r.height) return;
        const old = ready ? h('canvas', { width: cv.width, height: cv.height }) : null;
        old?.getContext('2d').drawImage(cv, 0, 0);
        cv.width = r.width; cv.height = r.height;
        if (old) ctx.drawImage(old, 0, 0);
        else if (w.p.img) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0); im.src = w.p.img; }
        ready = true;
      };
      new ResizeObserver(fit).observe(wrap);
      const pt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      const line = (a, b) => {
        ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
        ctx.strokeStyle = color; ctx.lineWidth = erase ? size * 4 : size; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
      };
      cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); last = pt(e); line(last, last); };
      cv.onpointermove = e => { if (!last) return; const p = pt(e); line(last, p); last = p; };
      cv.onpointerup = cv.onpointercancel = () => { if (last) { last = null; keep(); } };
    } },

    kpi: { w: 3, h: 3, min: [2, 2], p: { metric: 'assets' }, fields: [{ k: 'metric', l: 'Dato a mostrar', o: METRICS }],
      async body(el, w) { const s = stats(await data()); const v = s[w.p.metric] ?? 0; el.innerHTML = `<b class="kpi">${(FMT[w.p.metric] || (x => x))(v)}</b><span class="kpi-l">${METRICS[w.p.metric]}</span>`; } },

    gauge: { w: 3, h: 3, min: [2, 2], p: { metric: 'inUse' }, fields: [{ k: 'metric', l: 'Estado a medir', o: STATUS_METRICS }],
      async body(el, w) {
        const s = stats(await data()), n = s[w.p.metric] ?? 0, pct = s.assets ? Math.round(n / s.assets * 100) : 0;
        el.innerHTML = `<b class="kpi">${pct}%</b><div class="gauge"><i data-s="width:${pct}%"></i></div><span class="kpi-l">${esc(STATUS_METRICS[w.p.metric] || '')} · ${n} de ${s.assets}</span>`;
      } },

    links: { w: 3, h: 5, min: [2, 3], body(el) {
      const base = document.body.dataset.root || '';
      const items = [['Activos', 'activos'], ['Insumos', 'insumos'], ['Herramientas', 'herramientas'], ['Alquiler / Venta', 'prestamos'], ['Compras', 'compras'], ['Estadísticas', 'estadisticas'], ['Movimientos', 'movimientos'], ['Historial', 'historial']];
      el.innerHTML = `<nav class="quick">${items.map(([t, u]) => `<a href="${esc(base)}pages/${u}.html">${esc(t)}</a>`).join('')}</nav>`;
    } },

    bars: { w: 6, h: 7, min: [3, 4], p: { limit: 8, src: 'category', kind: 'hbar' },
      fields: [
        { k: 'src', l: 'Datos', o: GROUP_OPTS },
        { k: 'kind', l: 'Tipo de gráfico', o: { hbar: 'Barras horizontales', col: 'Columnas', line: 'Líneas', pie: 'Torta', donut: 'Dona' } },
        { k: 'limit', l: 'Máximo de elementos', n: 1 }],
      async body(el, w) {
        const src = w.p.src || 'category', kind = w.p.kind || 'hbar', m = {}, G = GROUPS[src] || GROUPS.category;
        G.rows(await data()).forEach(k => { k = k || G.empty; m[k] = (m[k] || 0) + 1; });
        const r = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, w.p.limit || 8);
        if (!r.length) { el.innerHTML = '<p class="empty">Sin datos</p>'; return; }
        const mx = Math.max(1, ...r.map(x => x[1])), tot = r.reduce((a, x) => a + x[1], 0);
        const cut = (t, n) => esc(t.length > n ? t.slice(0, n - 1) + '…' : t);
        if (kind === 'hbar') {
          el.innerHTML = r.map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><i data-s="--v:${v / mx * 100}%"></i><b>${v}</b></div>`).join('');
        } else if (kind === 'col' || kind === 'line') {
          const W = 320, H = 190, top = 18, bot = 34, n = r.length, step = W / n, ch = H - top - bot;
          const xs = r.map((_, i) => step * i + step / 2), ys = r.map(([, v]) => top + ch - v / mx * ch);
          let g = `<line x1="0" x2="${W}" y1="${top + ch}" y2="${top + ch}" stroke="#ccd" />`;
          if (kind === 'col') g += r.map(([, v], i) => `<rect x="${xs[i] - step * .32}" y="${ys[i]}" width="${step * .64}" height="${top + ch - ys[i]}" rx="3" fill="var(--ac,#130a74)" />`).join('');
          else g += `<polyline points="${xs.map((x, i) => x + ',' + ys[i]).join(' ')}" fill="none" stroke="var(--ac,#130a74)" stroke-width="2.5" />` + xs.map((x, i) => `<circle cx="${x}" cy="${ys[i]}" r="4" fill="var(--ac,#130a74)" />`).join('');
          g += r.map(([k, v], i) => `<text x="${xs[i]}" y="${ys[i] - 6}" text-anchor="middle" font-size="11" font-weight="700">${v}</text><text x="${xs[i]}" y="${H - 14}" text-anchor="middle" font-size="10" fill="#666">${cut(k, n > 6 ? 6 : 10)}</text>`).join('');
          el.innerHTML = `<svg class="ch" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
        } else {
          const R = 80, cx = 90, cy = 90, inner = kind === 'donut' ? 48 : 0;
          let a0 = -Math.PI / 2, paths = '';
          r.forEach(([, v], i) => {
            const a1 = a0 + v / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, c = CHART_COLORS[i % CHART_COLORS.length];
            if (r.length === 1) paths += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${c}" />`;
            else {
              const P = (rad, a) => `${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`;
              paths += `<path d="M ${P(R, a0)} A ${R} ${R} 0 ${big} 1 ${P(R, a1)} ${inner ? `L ${P(inner, a1)} A ${inner} ${inner} 0 ${big} 0 ${P(inner, a0)}` : `L ${cx} ${cy}`} Z" fill="${c}" stroke="#fff" stroke-width="1.5" />`;
            }
            a0 = a1;
          });
          if (inner) paths += `<circle cx="${cx}" cy="${cy}" r="${inner}" fill="#fff" /><text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="20" font-weight="700">${tot}</text>`;
          el.innerHTML = `<div class="pie"><svg viewBox="0 0 180 180">${paths}</svg><ul>${r.map(([k, v], i) => `<li><i data-s="background:${CHART_COLORS[i % CHART_COLORS.length]}"></i><span>${esc(k)}</span><b>${v}</b></li>`).join('')}</ul></div>`;
        }
      } },

    list: { w: 3, h: 6, min: [2, 3], p: { src: 'recent', limit: 6 },
      fields: [{ k: 'src', l: 'Mostrar', o: LIST_OPTS }, { k: 'limit', l: 'Cantidad', n: 1 }],
      async body(el, w) {
        const d = await data(), n = w.p.limit || 6;
        const rows = (LISTS[w.p.src] || LISTS.recent).rows(d).slice(0, n);
        el.innerHTML = rows.length ? `<ul class="rows">${rows.map(([a, b]) => `<li><span>${esc(a)}</span><small>${esc(b)}</small></li>`).join('')}</ul>` : '<p class="empty">Sin elementos</p>';
      } },

    clock: { w: 3, h: 3, min: [2, 2], body(el) {
      const tick = () => { const n = new Date(); el.innerHTML = `<b class="kpi">${n.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</b><span class="kpi-l">${n.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</span>`; };
      tick(); const t = setInterval(() => el.isConnected ? tick() : clearInterval(t), 15000);
    } },


    cal: { w: 4, h: 6, min: [3, 4], body(el) {
      let off = 0;
      const draw = () => {
        const now = new Date(), d = new Date(now.getFullYear(), now.getMonth() + off, 1);
        const first = (d.getDay() + 6) % 7, days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const cells = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => `<b>${x}</b>`);
        for (let i = 0; i < first; i++) cells.push('<span></span>');
        for (let n = 1; n <= days; n++) cells.push(`<span class="${off === 0 && n === now.getDate() ? 'today' : ''}">${n}</span>`);
        el.innerHTML = `<div class="cal-h"><button type="button" data-d="-1" aria-label="Mes anterior">‹</button><strong>${esc(d.toLocaleDateString('es', { month: 'long', year: 'numeric' }))}</strong><button type="button" data-d="1" aria-label="Mes siguiente">›</button></div><div class="cal-g">${cells.join('')}</div>`;
        el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { off += +b.dataset.d; draw(); });
      };
      draw();
    } },
  };

  const PALETTE = ['#130a74', '#e63b4a', '#06c167', '#e0a800', '#111111'];
  // Selector de color: 5 colores + uno libre. value = '' equivale al azul de marca.
  const colorField = (init, onChange) => {
    const el = h('div', { className: 'bw-colors' });
    let val = init || '';
    const norm = c => (c === '#130a74' ? '' : c);
    const custom = h('input', { type: 'color', value: val || '#130a74', title: 'Otro color' });
    const sync = () => el.querySelectorAll('button').forEach(b => b.classList.toggle('on', norm(b.dataset.c) === val));
    PALETTE.forEach(c => {
      const b = h('button', { type: 'button', title: c }); b.dataset.c = c; b.style.background = c;
      b.onclick = () => { val = norm(c); custom.value = c; sync(); onChange?.(val); };
      el.append(b);
    });
    custom.oninput = () => { val = norm(custom.value); sync(); onChange?.(val); };
    el.append(custom); sync();
    Object.defineProperty(el, 'value', { get: () => val, set: v => { val = v || ''; custom.value = val || '#130a74'; sync(); } });
    return el;
  };

  // Vistas previas (100 x 56) para las tarjetas del catálogo.
  const NAVY = '#130a74', GREEN = '#06c167', AMBER = '#e0a800', RED = '#e63b4a';
  const ring = (r, sw, parts) => { const C = 2 * Math.PI * r; let off = 0; return parts.map(([pc, col]) => { const len = C * pc; const o = `<circle cx="50" cy="28" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-dasharray="${len.toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 50 28)"/>`; off += len; return o; }).join(''); };
  const lines = (n, x = 14, y = 12, gap = 11) => Array.from({ length: n }, (_, k) => `<rect x="${x}" y="${y + k * gap}" width="${k % 2 ? 56 : 72}" height="4" rx="2" fill="#cfd5e2"/>`).join('');
  const PREV = {
    kpi: `<text x="50" y="38" text-anchor="middle" font-size="30" font-weight="700" fill="${NAVY}">286</text>`,
    gauge: `<text x="50" y="24" text-anchor="middle" font-size="16" font-weight="700" fill="${NAVY}">70%</text><rect x="12" y="32" width="76" height="9" rx="4.5" fill="#e5e7eb"/><rect x="12" y="32" width="53" height="9" rx="4.5" fill="${GREEN}"/>`,
    hbar: [[72, NAVY], [52, NAVY], [34, NAVY], [18, NAVY]].map(([w, c], k) => `<rect x="12" y="${8 + k * 12}" width="${w}" height="8" rx="3" fill="${c}"/>`).join(''),
    col: [[20, NAVY], [34, NAVY], [26, NAVY], [42, NAVY], [14, NAVY]].map(([hh, c], k) => `<rect x="${12 + k * 16}" y="${50 - hh}" width="11" height="${hh}" rx="2" fill="${c}"/>`).join(''),
    line: `<polyline points="10,42 30,26 50,34 70,14 90,22" fill="none" stroke="${NAVY}" stroke-width="3"/>` + [[10, 42], [30, 26], [50, 34], [70, 14], [90, 22]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="${NAVY}"/>`).join(''),
    pie: ring(11, 22, [[.45, NAVY], [.3, GREEN], [.25, AMBER]]),
    donut: ring(17, 10, [[.45, NAVY], [.3, GREEN], [.25, AMBER]]),
    list: [0, 1, 2, 3].map(k => `<circle cx="16" cy="${12 + k * 11}" r="2.5" fill="${NAVY}"/><rect x="24" y="${10 + k * 11}" width="${k % 2 ? 44 : 58}" height="4" rx="2" fill="#cfd5e2"/><rect x="78" y="${10 + k * 11}" width="12" height="4" rx="2" fill="#e5e7eb"/>`).join(''),
    alert: [0, 1, 2, 3].map(k => `<circle cx="16" cy="${12 + k * 11}" r="2.5" fill="${RED}"/><rect x="24" y="${10 + k * 11}" width="${k % 2 ? 40 : 52}" height="4" rx="2" fill="#cfd5e2"/><rect x="72" y="${10 + k * 11}" width="18" height="4" rx="2" fill="${RED}" opacity=".35"/>`).join(''),
    note: lines(4),
    todo: [0, 1, 2].map(k => `<rect x="14" y="${9 + k * 14}" width="9" height="9" rx="2" fill="none" stroke="${NAVY}" stroke-width="1.6"/>${k === 0 ? `<path d="M16 13.5l2.2 2.2 3.6-4.4" fill="none" stroke="${GREEN}" stroke-width="1.8"/>` : ''}<rect x="30" y="${11 + k * 14}" width="${k === 0 ? 40 : 56}" height="4" rx="2" fill="#cfd5e2"/>`).join(''),
    draw: `<path d="M12 40 C22 8, 32 8, 40 30 S58 52, 66 24 S84 10, 90 18" fill="none" stroke="${NAVY}" stroke-width="3" stroke-linecap="round"/>`,
    clock: `<circle cx="50" cy="28" r="20" fill="none" stroke="${NAVY}" stroke-width="3"/><path d="M50 28V15M50 28l9 6" stroke="${NAVY}" stroke-width="3" stroke-linecap="round"/>`,
    cal: `<rect x="18" y="6" width="64" height="44" rx="5" fill="none" stroke="#cfd5e2" stroke-width="2"/><rect x="18" y="6" width="64" height="11" rx="5" fill="${NAVY}"/>` + Array.from({ length: 12 }, (_, k) => `<circle cx="${28 + (k % 4) * 15}" cy="${26 + Math.floor(k / 4) * 9}" r="2" fill="${k === 6 ? RED : '#cfd5e2'}"/>`).join(''),
    links: [0, 1, 2].map(k => `<rect x="14" y="${8 + k * 14}" width="72" height="10" rx="5" fill="none" stroke="${NAVY}" stroke-width="1.6"/><rect x="22" y="${11.5 + k * 14}" width="${[30, 40, 24][k]}" height="3" rx="1.5" fill="#cfd5e2"/>`).join(''),
  };

  const TABS = ['Todos', 'Cifras', 'Gráficos', 'Listas', 'Utilidades'];
  const CAT = [
    { cat: 'Cifras', name: 'Cifra clave', title: 'Activos', type: 'kpi', p: { metric: 'assets' }, prev: 'kpi', kw: 'numero total contador cantidad', desc: 'Un número grande: activos, en uso, insumos, préstamos, usuarios…' },
    { cat: 'Cifras', name: 'Valor del inventario', title: 'Valor del inventario', type: 'kpi', p: { metric: 'assetsValue' }, prev: 'kpi', kw: 'dinero costo total plata', desc: 'Suma del costo de todos los activos' },
    { cat: 'Cifras', name: 'Porcentaje', title: 'En uso', type: 'gauge', p: { metric: 'inUse' }, prev: 'gauge', kw: 'barra progreso proporcion', desc: 'Qué parte de los activos está en uso, disponible o en reparación' },
    { cat: 'Gráficos', name: 'Barras horizontales', title: 'Activos por categoría', type: 'bars', p: { kind: 'hbar' }, prev: 'hbar', kw: 'grafico comparar', desc: 'Compara categorías, estados o marcas' },
    { cat: 'Gráficos', name: 'Columnas', title: 'Activos por categoría', type: 'bars', p: { kind: 'col' }, prev: 'col', kw: 'grafico barras verticales', desc: 'Barras verticales con el valor encima' },
    { cat: 'Gráficos', name: 'Líneas', title: 'Activos por categoría', type: 'bars', p: { kind: 'line' }, prev: 'line', kw: 'grafico tendencia', desc: 'Une los valores con una línea' },
    { cat: 'Gráficos', name: 'Torta', title: 'Activos por estado', type: 'bars', p: { kind: 'pie', src: 'status' }, prev: 'pie', kw: 'grafico circular proporcion', desc: 'Reparto del total entre elementos' },
    { cat: 'Gráficos', name: 'Dona', title: 'Activos por estado', type: 'bars', p: { kind: 'donut', src: 'status' }, prev: 'donut', kw: 'grafico circular proporcion', desc: 'Como la torta, con el total en el centro' },
    { cat: 'Listas', name: 'Activos recientes', title: 'Activos recientes', type: 'list', p: { src: 'recent' }, prev: 'list', desc: 'Últimos activos registrados' },
    { cat: 'Listas', name: 'Alertas de stock', title: 'Alertas de stock', type: 'list', p: { src: 'alerts' }, prev: 'alert', kw: 'insumos minimo bajo', desc: 'Insumos por debajo del mínimo' },
    { cat: 'Listas', name: 'Préstamos activos', title: 'Préstamos activos', type: 'list', p: { src: 'loans' }, prev: 'list', kw: 'alquiler prestado', desc: 'Equipos prestados o alquilados' },
    { cat: 'Listas', name: 'Activos en reparación', title: 'Activos en reparación', type: 'list', p: { src: 'repair' }, prev: 'alert', kw: 'taller dañado', desc: 'Equipos que están en reparación' },
    { cat: 'Listas', name: 'Activos disponibles', title: 'Activos disponibles', type: 'list', p: { src: 'available' }, prev: 'list', kw: 'bodega libre', desc: 'Equipos listos para asignar' },
    { cat: 'Listas', name: 'Activos de mayor valor', title: 'Activos de mayor valor', type: 'list', p: { src: 'valuable' }, prev: 'list', kw: 'costo caro precio', desc: 'Los equipos que más valen' },
    { cat: 'Listas', name: 'Compras recientes', title: 'Compras recientes', type: 'list', p: { src: 'purchases' }, prev: 'list', kw: 'factura proveedor', desc: 'Últimas compras de activos e insumos' },
    { cat: 'Listas', name: 'Movimientos recientes', title: 'Movimientos recientes', type: 'list', p: { src: 'movements' }, prev: 'list', kw: 'entradas salidas', desc: 'Últimos movimientos de inventario' },
    { cat: 'Listas', name: 'Auditorías de herramientas', title: 'Auditorías de herramientas', type: 'list', p: { src: 'audits' }, prev: 'list', kw: 'tecnico revision novedades', desc: 'Últimas auditorías y sus novedades' },
    { cat: 'Listas', name: 'Herramientas en reparación', title: 'Herramientas en reparación', type: 'list', p: { src: 'toolsRepair' }, prev: 'alert', kw: 'taller', desc: 'Herramientas que no están disponibles' },
    { cat: 'Utilidades', name: 'Nota', title: 'Nota', type: 'note', prev: 'note', kw: 'texto apuntes', desc: 'Texto libre que se guarda solo' },
    { cat: 'Utilidades', name: 'Tareas', title: 'Tareas', type: 'todo', prev: 'todo', kw: 'pendientes checklist lista', desc: 'Lista de pendientes con casillas' },
    { cat: 'Utilidades', name: 'Dibujo', title: 'Dibujo', type: 'draw', prev: 'draw', kw: 'lienzo pizarra', desc: 'Lienzo para dibujar a mano' },
    { cat: 'Utilidades', name: 'Fecha y hora', title: 'Fecha y hora', type: 'clock', prev: 'clock', kw: 'reloj', desc: 'Reloj con la fecha de hoy' },
    { cat: 'Utilidades', name: 'Calendario', title: 'Calendario', type: 'cal', prev: 'cal', kw: 'mes dias', desc: 'Calendario mensual con el día de hoy' },
    { cat: 'Utilidades', name: 'Accesos rápidos', title: 'Accesos rápidos', type: 'links', prev: 'links', kw: 'atajos enlaces paginas', desc: 'Atajos a las páginas más usadas' },
  ];

  /* ---------- estado y diseño ---------- */
  const mk = (type, title, x, y, w, hh, p = {}) => { const o = { id: uid(), type, title, c: '', x, y, w, h: hh, p: { ...T[type].p, ...p } }; o.c = AUTO_COLOR(o); return o; };
  // Color por significado (solo si el widget no tiene uno elegido): en uso ámbar, disponibles verde, reparación rojo, alertas rojo.
  const AUTO_COLOR = w => (w.type === 'kpi' || w.type === 'gauge' ? { inUse: '#e0a800', inStore: '#06c167', inRepair: '#e63b4a', lowStock: '#e0a800', auditIssues: '#e63b4a' }[w.p?.metric] : w.type === 'list' ? { alerts: '#e63b4a', repair: '#e63b4a', toolsRepair: '#e63b4a', available: '#06c167' }[w.p?.src] : '') || '';
  const defaults = () => [
    mk('kpi', 'Activos', 0, 0, 3, 3, { metric: 'assets' }), mk('kpi', 'En uso', 3, 0, 3, 3, { metric: 'inUse' }),
    mk('kpi', 'Disponibles', 6, 0, 3, 3, { metric: 'inStore' }), mk('kpi', 'En reparación', 9, 0, 3, 3, { metric: 'inRepair' }),
    mk('bars', 'Activos por categoría', 0, 3, 6, 6), mk('list', 'Activos recientes', 6, 3, 3, 6, { src: 'recent' }),
    mk('list', 'Alertas de stock', 9, 3, 3, 6, { src: 'alerts' }), mk('note', 'Notas', 0, 9, 4, 6),
    mk('list', 'Préstamos activos', 4, 9, 4, 6, { src: 'loans' }),
  ];
  let ws; try { const s = JSON.parse(localStorage.getItem(KEY)); ws = Array.isArray(s) ? s.filter(w => T[w.type]) : null; } catch { ws = null; }
  ws ||= defaults();
  if (ws.every(w => !w.c)) ws.forEach(w => { w.c = AUTO_COLOR(w); }); // tablero sin personalizar: aplica los colores por defecto
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ws)); } catch { toast('No se pudo guardar: almacenamiento lleno (prueba con un dibujo más pequeño).'); } };

  const els = new Map();
  let editing = false, snapshot = '', colW = 0, stack = false;
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const pack = fixed => {
    const placed = fixed ? [fixed] : [];
    ws.filter(w => w !== fixed).sort((a, b) => a.y - b.y || a.x - b.x).forEach(w => {
      w.y = 0; while (placed.some(p => hit(p, w))) w.y++; placed.push(w);
    });
  };
  const fits = () => Math.max(0, ...ws.map(w => w.y + w.h)) <= ROWS;
  const restore = prev => prev.forEach(([x, a, b, c, d]) => Object.assign(x, { x: a, y: b, w: c, h: d }));
  function layout() {
    const W = root.clientWidth; colW = (W - GAP * (COLS - 1)) / COLS; stack = W < 640;
    root.classList.toggle('stack', stack);
    document.body.classList.toggle('no-scroll', !stack);
    ROW = clamp((window.innerHeight - (root.getBoundingClientRect().top + window.scrollY) - 24 - GAP * (ROWS - 1)) / ROWS, 12, 60);
    const px = n => n * ROW + (n - 1) * GAP;
    [...ws].sort((a, b) => a.y - b.y || a.x - b.x).forEach(w => {
      const { el } = els.get(w.id), s = el.style;
      if (el.parentNode !== root || stack) root.append(el);
      if (stack) { s.left = s.top = s.width = ''; s.height = px(w.h) + 'px'; return; }
      s.left = w.x * (colW + GAP) + 'px'; s.top = w.y * (ROW + GAP) + 'px';
      s.width = w.w * colW + (w.w - 1) * GAP + 'px'; s.height = px(w.h) + 'px';
    });
    if (stack) {
      root.classList.remove('board-fixed-height');
      root.style.height = '';
    } else {
      root.classList.add('board-fixed-height');
      root.style.height = px(ROWS) + 'px';
    }
  }

  /* ---------- construir widgets ---------- */
  async function fill(w) {
    const { bodyEl } = els.get(w.id);
    bodyEl.replaceChildren(); bodyEl.className = 'bw-b b-' + w.type;
    try {
      // Widgets que dependen de la API: skeleton hasta que llegan los datos.
      if (['kpi', 'gauge', 'bars', 'list'].includes(w.type) && window.inventarioSkeleton) {
        const placeholder = window.inventarioSkeleton.block('100%');
        bodyEl.append(placeholder);
        try { await data(); } catch { /* el error lo muestra el propio widget */ }
        placeholder.remove();
      }
      await T[w.type].body(bodyEl, w);
    }
    catch (e) { bodyEl.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }
  const look = w => {
    const { el, titleEl } = els.get(w.id);
    titleEl.textContent = w.title || '';
    // Cualquier color: se aplica por CSSOM (permitido por la CSP, a diferencia del atributo style).
    if (w.c) el.style.setProperty('--ac', w.c); else el.style.removeProperty('--ac');
    el.classList.toggle('tinted', !!w.c);
  };
  function build(w) {
    const el = h('article', { className: 'bw' + (T[w.type].bare ? ' bare' : '') });
    el.dataset.id = w.id;
    el.innerHTML = '<header class="bw-h"><h3></h3><span class="bw-t"><button type="button" data-a="cfg" aria-label="Ajustes">⚙</button><button type="button" data-a="del" aria-label="Quitar">×</button></span></header><div class="bw-b"></div><i class="bw-r" title="Cambiar tamaño"></i>';
    els.set(w.id, { el, titleEl: el.querySelector('h3'), bodyEl: el.querySelector('.bw-b') });
    root.append(el); look(w); fill(w);
  }
  const rebuild = () => { els.forEach(v => v.el.remove()); els.clear(); ws.forEach(build); pack(null); layout(); };

  /* ---------- arrastrar y redimensionar ---------- */
  root.addEventListener('pointerdown', e => {
    if (!editing || stack || e.target.closest('button')) return;
    const handle = e.target.closest('.bw-r') ? 'size' : e.target.closest('.bw-h') ? 'move' : null;
    const el = e.target.closest('.bw'); if (!handle || !el) return;
    const w = ws.find(x => x.id === el.dataset.id), o = { ...w }, sx = e.clientX, sy = e.clientY, min = T[w.type].min;
    e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('moving');
    const move = ev => {
      const prev = ws.map(x => [x, x.x, x.y, x.w, x.h]);
      const dx = ev.clientX - sx, dy = ev.clientY - sy, cw = colW + GAP, rh = ROW + GAP;
      if (handle === 'size') { w.w = clamp(Math.round(o.w + dx / cw), min[0], COLS - o.x); w.h = clamp(Math.round(o.h + dy / rh), min[1], ROWS - w.y); }
      else { w.x = clamp(Math.round(o.x + dx / cw), 0, COLS - w.w); w.y = clamp(Math.round(o.y + dy / rh), 0, ROWS - w.h); }
      pack(w);
      if (!fits()) { restore(prev); pack(w); }
      layout();
      if (handle === 'move') {
        const moveX = dx - (w.x - o.x) * cw;
        const moveY = dy - (w.y - o.y) * rh;
        el.style.transform = `translate(${moveX}px, ${moveY}px)`;
      }
    };
    const up = () => {
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      el.style.transform = ''; el.classList.remove('moving'); pack(null); layout(); save();
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });

  /* ---------- ajustes, quitar ---------- */
  const dialog = (title, build, onOk) => {
    const d = h('dialog', { className: 'bw-dlg' }), f = h('form', { method: 'dialog' });
    f.append(h('h3', { textContent: title }));
    build(f, d);
    if (onOk) {
      const ok = h('button', { type: 'submit', className: 'btn-save', textContent: 'Aplicar' });
      const no = h('button', { type: 'button', className: 'btn-cancel', textContent: 'Cancelar' }); no.onclick = () => d.close();
      f.append(ok, no); f.onsubmit = () => onOk();
    }
    d.append(f); d.onclose = () => d.remove(); document.body.append(d); d.showModal();
  };

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || !editing) return;
    const w = ws.find(x => x.id === b.closest('.bw').dataset.id);
    if (b.dataset.a === 'del') {
      ws = ws.filter(x => x !== w); els.get(w.id).el.remove(); els.delete(w.id); pack(null); layout(); save();
    } else {
      const t = T[w.type], inputs = {};
      let ti, co;
      dialog('Ajustes del widget', f => {
        const row = (l, i) => { const L = h('label'); L.append(h('span', { textContent: l }), i); f.append(L); return i; };
        ti = row('Título', h('input', { value: w.title || '' }));
        const cf = h('div', { className: 'bw-field' });
        co = colorField(w.c);
        cf.append(h('span', { textContent: 'Color de acento' }), co); f.append(cf);
        (t.fields || []).forEach(x => {
          let i;
          if (x.o) { i = h('select'); Object.entries(x.o).forEach(([k, v]) => i.add(new Option(v, k))); i.value = w.p[x.k] ?? t.p?.[x.k]; }
          else i = h('input', x.n ? { type: 'number', min: 1, value: w.p[x.k] } : { value: w.p[x.k] || '' });
          inputs[x.k] = [row(x.l, i), x];
        });
      }, () => {
        w.title = ti.value; w.c = co.value === '#130a74' ? '' : co.value;
        Object.entries(inputs).forEach(([k, [i, x]]) => { w.p[k] = x.n ? Math.max(1, +i.value || 1) : i.value; });
        look(w); fill(w); save();
      });
    }
  });

  /* ---------- barra de edición ---------- */
  const bar = document.getElementById('org-bar'), actions = document.querySelector('.head-actions');
  const setEdit = on => {
    editing = on; root.classList.toggle('editing', on);
    if (bar) bar.hidden = !on; if (actions) actions.hidden = on;
    layout();
  };
  const start = () => { snapshot = JSON.stringify(ws); setEdit(true); };
  const cancel = () => { ws = JSON.parse(snapshot); rebuild(); save(); setEdit(false); };
  const on = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);

  on('organize-widgets', start);
  on('org-save', () => { save(); setEdit(false); });
  on('org-cancel', cancel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && editing && !document.querySelector('dialog[open]')) cancel(); });
  on('refresh-widgets', () => { cache = null; ws.forEach(w => ['kpi', 'gauge', 'bars', 'list'].includes(w.type) && fill(w)); });

  on('org-add', () => { if (!editing) start(); dialog('Agregar widget', (f, d) => {
    d.classList.add('bw-dlg-wide');
    f.onsubmit = e => e.preventDefault();
    const search = h('input', { type: 'search', placeholder: 'Buscar widget (gráfico, lista, reloj…)', className: 'bw-search' });
    search.onkeydown = e => { if (e.key === 'Enter') e.preventDefault(); };
    const tabs = h('div', { className: 'bw-tabs' }), g = h('div', { className: 'bw-cat' }), cfg = h('div', { className: 'bw-cfg' });
    cfg.hidden = true;
    const ok = h('button', { type: 'button', className: 'btn-save', textContent: 'Agregar', disabled: true });
    const no = h('button', { type: 'button', className: 'btn-cancel', textContent: 'Cancelar' }); no.onclick = () => d.close();
    let tab = 'Todos', sel = null, cur = null;

    const draw = () => {
      const q = search.value.trim().toLowerCase();
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.textContent === tab));
      g.textContent = '';
      const shown = CAT.filter(c => (tab === 'Todos' || c.cat === tab) && (!q || `${c.name} ${c.desc} ${c.kw || ''}`.toLowerCase().includes(q)));
      if (!shown.length) g.append(h('p', { className: 'empty', textContent: 'Ningún widget coincide con la búsqueda.' }));
      shown.forEach(c => {
        const b = h('button', { type: 'button', className: c === sel ? 'on' : '' });
        b.innerHTML = `<span class="bw-prev"><svg viewBox="0 0 100 56" aria-hidden="true">${PREV[c.prev]}</svg></span><b>${esc(c.name)}</b><small>${esc(c.desc)}</small>`;
        b.onclick = () => { pick(c); draw(); };
        g.append(b);
      });
    };
    TABS.forEach(n => { const b = h('button', { type: 'button', textContent: n }); b.onclick = () => { tab = n; draw(); }; tabs.append(b); });
    search.oninput = draw;

    const lab = (l, i) => { const L = h('label'); L.append(h('span', { textContent: l }), i); return L; };
    const pick = c => {
      sel = c; const t = T[c.type], vals = {};
      let manual = false, edited = false;
      cfg.hidden = false; cfg.textContent = '';
      cfg.append(h('h4', { textContent: `Configurar: ${c.name}` }));
      const ti = h('input', { value: c.title }); ti.oninput = () => { edited = true; };
      cfg.append(lab('Título', ti));
      const colors = colorField(AUTO_COLOR({ type: c.type, p: { ...t.p, ...c.p } }), () => { manual = true; });
      const cf = h('div', { className: 'bw-field' }); cf.append(h('span', { textContent: 'Color de acento' }), colors); cfg.append(cf);
      const grid = h('div', { className: 'bw-size' });
      (t.fields || []).forEach(x => {
        const v = c.p?.[x.k] ?? t.p?.[x.k];
        let i;
        if (x.o) { i = h('select'); Object.entries(x.o).forEach(([k, lbl]) => i.add(new Option(lbl, k))); i.value = v; }
        else i = h('input', x.n ? { type: 'number', min: 1, value: v } : { value: v || '' });
        if (x.o && (x.k === 'metric' || x.k === 'src')) i.onchange = () => {
          if (!edited) ti.value = x.o[i.value];
          if (!manual) colors.value = AUTO_COLOR({ type: c.type, p: { ...t.p, ...c.p, [x.k]: i.value } });
        };
        vals[x.k] = [i, x]; grid.append(lab(x.l, i));
      });
      const iw = h('input', { type: 'number', min: 1, max: COLS, value: t.w }), ih = h('input', { type: 'number', min: 1, max: ROWS, value: t.h });
      grid.append(lab(`Ancho (1–${COLS} columnas)`, iw), lab(`Alto (1–${ROWS} filas)`, ih));
      cfg.append(grid);
      cur = { c, ti, colors, vals, iw, ih };
      ok.disabled = false;
      g.classList.add('short');
    };

    ok.onclick = () => {
      if (!cur) return;
      const { c, ti, colors, vals, iw, ih } = cur, t = T[c.type];
      const p = { ...c.p };
      Object.entries(vals).forEach(([k, [i, x]]) => { p[k] = x.n ? Math.max(1, +i.value || 1) : i.value; });
      const w = mk(c.type, ti.value.trim() || c.title, 0, 1e3, clamp(+iw.value || t.w, t.min[0], COLS), clamp(+ih.value || t.h, t.min[1], ROWS), p);
      w.c = colors.value;
      // Busca el primer hueco libre (fila por fila, de izquierda a derecha) dentro del tablero.
      pack(null);
      let spot = null;
      for (let y = 0; y <= ROWS - w.h && !spot; y++)
        for (let x = 0; x <= COLS - w.w && !spot; x++)
          if (!ws.some(o => hit({ x, y, w: w.w, h: w.h }, o))) spot = { x, y };
      if (!spot) { toast('No hay espacio con ese tamaño: elige uno menor o quita otro widget.'); return; }
      Object.assign(w, spot); ws.push(w); pack(null);
      if (!fits()) { ws.pop(); pack(null); layout(); toast('No hay espacio con ese tamaño: elige uno menor o quita otro widget.'); return; }
      build(w); layout(); save(); d.close();
    };
    draw();
    f.append(search, tabs, g, cfg, ok, no);
  }); });

  /* ---------- inicio ---------- */
  root.classList.add('board');
  if (!window.inventarioApi) window.inventarioApi = { get: () => Promise.reject(new Error('API no disponible.')) };
  ws.forEach(w => { w.h = Math.min(w.h, ROWS); }); pack(null); if (!fits()) { ws = defaults(); pack(null); }
  ws.forEach(build); layout();
  window.addEventListener('resize', layout);
  window.addEventListener('load', layout);
  new ResizeObserver(layout).observe(root.parentElement);
})();