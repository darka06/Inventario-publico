// Constructor de widgets propios para Estadísticas: catálogo de datos, agrupación y diálogo de creación.
// Expone window.statsCustom; estadisticas.js lo usa para dibujar los widgets y organize.js para el menú Nuevo.

(() => {
  const KEY = 'dash-custom';
  const day = v => String(v || '').slice(0, 10);
  const num = v => Number(v) || 0;
  // clave de mes (AAAA-MM) o null si la fecha no existe
  const month = f => x => { const m = day(f(x)).slice(0, 7); return /^\d{4}-\d{2}$/.test(m) ? m : null; };

  // Fuentes de datos. by: clave → [nombre, función que devuelve el grupo, esFecha]
  const SRC = {
    assets: { name: 'Activos', noun: 'activos', list: D => D.assets, value: a => num(a.cost), valueName: 'Costo total', money: 1, by: {
      category:   ['Categoría',      a => a.category],
      status:     ['Estado',         a => a.status],
      brand:      ['Marca',          a => a.brand],
      assignedTo: ['Responsable',    a => a.assignedTo],
      location:   ['Ubicación',      a => a.location],
      supplier:   ['Proveedor',      a => a.supplier],
      client:     ['Cliente',        a => a.client],
      type:       ['Tipo',           a => a.type],
      month:      ['Mes de compra',  month(a => a.purchaseDate), 1] } },
    supplies: { name: 'Insumos', noun: 'insumos', list: D => D.supplies, value: x => x.stock * x.unitCost, valueName: 'Valor en stock', money: 1, by: {
      brand:      ['Marca',          x => x.brand],
      unit:       ['Unidad',         x => x.unit],
      level:      ['Nivel de stock', x => x.stock <= x.minimum ? 'Bajo el mínimo' : 'Suficiente'] } },
    movements: { name: 'Movimientos', noun: 'movimientos', list: D => D.movements, value: m => num(m.quantity), valueName: 'Unidades movidas', by: {
      kind:        ['Tipo (activo / insumo)', m => m.kind],
      action:      ['Acción',      m => m.action],
      person:      ['Responsable', m => m.person],
      destination: ['Destino',     m => m.destination],
      month:       ['Mes',         month(m => m.date), 1] } },
    purchases: { name: 'Compras', noun: 'compras', list: D => D.purchases, value: p => num(p.total), valueName: 'Total comprado', money: 1, by: {
      type:     ['Tipo (activo / insumo)', p => p.type],
      supplier: ['Proveedor',  p => p.supplier],
      brand:    ['Marca',      p => p.brand],
      category: ['Categoría',  p => p.category],
      month:    ['Mes',        month(p => p.date), 1] } },
  };

  const VIEWS = [['bar', 'Barras'], ['hbar', 'Barra horizontal'], ['pie', 'Circular'], ['donut', 'Rosquilla'],
                 ['line', 'Líneas'], ['area', 'Área'], ['funnel', 'Embudo'], ['pyramid', 'Pirámide']];

  /*  Guardado (localStorage)  */

  const valid = d => d && typeof d.id === 'string' && typeof d.title === 'string' && Number.isInteger(d.n) && d.n >= 0
    && SRC[d.src] && SRC[d.src].by[d.by];
  const load = () => {
    try {
      const a = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(a) ? a.filter(valid).map(d => ({
        ...d, title: d.title.slice(0, 60), kind: d.kind === 'table' ? 'table' : 'chart',
        metric: d.metric === 'sum' && SRC[d.src].value ? 'sum' : 'count', view: VIEWS.some(v => v[0] === d.view) ? d.view : 'bar',
      })) : [];
    } catch { return []; }
  };
  const save = list => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* sin almacenamiento */ } };

  /*  Datos agrupados: [{ label, n, sum }]  */

  const monthName = k => new Date(+k.slice(0, 4), +k.slice(5) - 1, 1).toLocaleDateString('es', { month: 'short', year: '2-digit' });

  function rows(def, D) {
    const S = SRC[def.src], by = S && S.by[def.by];
    if (!by) return [];
    const key = def.metric === 'sum' && S.value ? 'sum' : 'n';
    const m = new Map();
    (S.list(D) || []).forEach(x => {
      const k = by[2] ? by[1](x) : (by[1](x) || 'Sin dato');
      if (k == null) return;                                     // fecha inexistente: no se cuenta
      const r = m.get(k) || { k, label: k, n: 0, sum: 0 };
      r.n++; r.sum += S.value ? S.value(x) : 0;
      m.set(k, r);
    });
    let list = [...m.values()];
    if (by[2]) {
      list = list.sort((a, b) => a.k < b.k ? -1 : 1).slice(-12);   // últimos 12 meses en orden cronológico
      list.forEach(r => { r.label = monthName(r.k); });
    } else {
      list.sort((a, b) => b[key] - a[key]);
      const limit = def.kind === 'table' ? 50 : 8;                  // lo que exceda el límite se agrupa en "Otros"
      if (list.length > limit) {
        const rest = list.slice(limit - 1);
        list = [...list.slice(0, limit - 1), { label: 'Otros', n: rest.reduce((t, r) => t + r.n, 0), sum: rest.reduce((t, r) => t + r.sum, 0) }];
      }
    }
    return list.map(r => ({ label: r.label, n: r.n, sum: Math.round(r.sum * 100) / 100 }));
  }

  /*  Diálogo de creación  */

  function build(onCreate) {
    if (document.querySelector('dialog.wd-dialog')) return;
    const d = document.createElement('dialog');
    d.className = 'wd-dialog';
    d.setAttribute('aria-labelledby', 'wd-dlg-title');
    const f = document.createElement('form');
    f.innerHTML = `
      <h3 id="wd-dlg-title">Crear widget</h3>
      <label><span>Título</span><input name="title" maxlength="60" autocomplete="off" placeholder="Opcional: se genera solo"></label>
      <label><span>Datos</span><select name="src"></select></label>
      <label><span>Agrupar por</span><select name="by"></select></label>
      <label><span>Valor</span><select name="metric"></select></label>
      <label><span>Mostrar como</span><select name="kind"><option value="chart">Gráfico</option><option value="table">Tabla</option></select></label>
      <label data-chart><span>Tipo de gráfico</span><select name="view"></select></label>
      <div class="wd-dialog-actions">
        <button type="submit" class="btn-save">Crear widget</button>
        <button type="button" class="btn-cancel">Cancelar</button>
      </div>`;
    d.append(f);

    const q = n => f.elements[n];
    const fill = (sel, pairs) => sel.replaceChildren(...pairs.map(([v, l]) => new Option(l, v)));
    fill(q('src'), Object.entries(SRC).map(([k, S]) => [k, S.name]));
    fill(q('view'), VIEWS);

    const onSource = () => {
      const S = SRC[q('src').value];
      fill(q('by'), Object.entries(S.by).map(([k, v]) => [k, v[0]]));
      fill(q('metric'), [['count', `Cantidad de ${S.noun}`], ...(S.value ? [['sum', S.valueName]] : [])]);
    };
    const onKind = () => { f.querySelector('[data-chart]').hidden = q('kind').value === 'table'; };
    q('src').addEventListener('change', onSource);
    q('kind').addEventListener('change', onKind);
    onSource(); onKind();

    f.querySelector('.btn-cancel').addEventListener('click', () => d.close());
    f.addEventListener('submit', e => {
      e.preventDefault();
      const S = SRC[q('src').value], by = q('by').value, metric = q('metric').value;
      const title = q('title').value.trim()
        || `${metric === 'sum' ? S.valueName : S.name} por ${S.by[by][0].toLowerCase()}`;
      onCreate({ id: 'u' + Date.now().toString(36), title, src: q('src').value, by, metric, kind: q('kind').value, view: q('view').value });
      d.close();
    });

    d.addEventListener('close', () => d.remove());
    document.body.append(d);
    d.showModal();
  }

  window.statsCustom = { SRC, load, save, rows, build };
})();
