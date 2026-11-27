// Panel de Estadísticas - Módulo 10: Definición de widgets por defecto

W.push(
  tw('Activos por categoría y estado', [
    { k: 'inUse',    t: 'En uso',        c: 1, on: 1 },
    { k: 'inStore',  t: 'Disponible',    c: 1, on: 1 },
    { k: 'inRepair', t: 'En reparación', c: 1, on: 1, bad: 1 },
    { k: 'others',   t: 'Otros',         c: 1, on: 1 },
    { k: 'total',    t: 'Total activos', c: 1 },
    { k: 'ASIGNADO', t: 'Asignado',      c: 1 },
    { k: 'ALQUILADO', t: 'Alquilado',    c: 1 },
    { k: 'PRESTADO', t: 'Prestado',      c: 1 },
    { k: 'pctUse',   t: '% en uso',      c: 1, fmt: pct, sum: false },
    { k: 'cost',     t: 'Valor',         c: 1, fmt: money },
  ], () => {
    const m = new Map();
    D.assets.forEach(a => {
      const k = a.category || 'Sin categoría', st = String(a.status || '').toUpperCase();
      const r = m.get(k) || { inUse: 0, inStore: 0, inRepair: 0, others: 0, total: 0, ASIGNADO: 0, ALQUILADO: 0, PRESTADO: 0, cost: 0 };
      r[bucket(a.status)]++; r.total++; r.cost += num(a.cost);
      if (['ASIGNADO', 'ALQUILADO', 'PRESTADO'].includes(st)) r[st]++;
      m.set(k, r);
    });
    const rows = [...m].sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(([k, r]) => ({ label: k, v: { ...r, pctUse: r.total ? r.inUse / r.total * 100 : 0 } }));
    return { rows, total: 1, none: 'Sin activos registrados' };
  }),

  cw('Activos por estado', () => group(D.assets, a => a.status || 'Sin estado'), 'pie', 'status'),

  tw('Insumos con stock bajo', [
    { k: 'code',    t: 'Código',   sum: false },
    { k: 'brand',   t: 'Marca',    sum: false },
    { k: 'unit',    t: 'Unidad',   sum: false },
    { k: 'stock',   t: 'Stock',    c: 1, on: 1, bad: 1 },
    { k: 'minimum', t: 'Mínimo',   c: 1, on: 1 },
    { k: 'missing', t: 'Faltante', c: 1, bad: 1 },
    { k: 'entries', t: 'Entradas', c: 1 },
    { k: 'exits',   t: 'Salidas',  c: 1 },
  ], () => ({
    rows: D.supplies.filter(x => x.stock <= x.minimum).sort((a, b) => (a.stock - a.minimum) - (b.stock - b.minimum))
      .map(x => ({ label: x.name, v: { ...x, missing: x.minimum - x.stock } })),
    none: 'Ningún insumo está por debajo del mínimo',
  }), 'insumos-stock-bajo', false),

  cw('Activos por categoría', () => group(D.assets, a => a.category || 'Sin categoría'), 'bar', 'category'),

  { t: 'Activos en reparación', body: () => gauge({ value: D.assets.filter(a => bucket(a.status) === 'inRepair').length, max: Math.max(1, D.assets.length), color: C.red, caption: 'En reparación' }) },

  { t: 'Movimientos por día', period: 1, week: 0, body: w => {
      const days = weekDays(w.week), a = movesPerDay(days, 'Activo'), i = movesPerDay(days, 'Insumo');
      const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      return bars({ labels: dayNames, dataLabels: days.map(d => fmt(d)), series: [
        { name: `Activos (${sum(a)})`, color: C.blue, values: a }, { name: `Insumos (${sum(i)})`, color: C.green, values: i }] });
    } },

  cw('Activos por marca', () => group(D.assets, a => a.brand || 'Sin marca', 8).slice().reverse(), 'hbar', 'brand'),

  { t: 'Insumos bajo el mínimo', body: () => gauge({ value: D.supplies.filter(x => x.stock <= x.minimum).length, max: Math.max(1, D.supplies.length), color: C.yellow, caption: 'Bajo el mínimo' }) },

  { t: 'Movimientos de los últimos 20 días', body: () => {
      const days = lastDays(20), a = movesPerDay(days, 'Activo'), i = movesPerDay(days, 'Insumo');
      return bars({ labels: days.map(d => d.getDate()), dataLabels: days.map(d => fmt(d)), series: [{ name: 'Activos', color: C.blue, values: a }, { name: 'Insumos', color: C.green, values: i }] });
    } },

  { t: 'Compras de los últimos 6 meses', body: () => {
      const t = new Date(), months = Array.from({ length: 6 }, (_, i) => new Date(t.getFullYear(), t.getMonth() - 5 + i, 1));
      const cnt = kind => months.map(m => D.purchases.filter(p => p.type === kind && day(p.date).slice(0, 7) === fmt(m).slice(0, 7)).length);
      return bars({ labels: months.map(m => m.toLocaleDateString('es', { month: 'short' })), series: [
        { name: 'Activos', color: C.blue, values: cnt('Activo') }, { name: 'Insumos', color: C.green, values: cnt('Insumo') }] });
    } },

  { t: 'Activos en uso', body: () => gauge({ value: D.assets.filter(a => bucket(a.status) === 'inUse').length, max: Math.max(1, D.assets.length), color: C.green, caption: 'En uso (asignados, prestados o alquilados)' }) },

  tw('Activos por responsable', [
    { k: 'n',    t: 'Activos',         c: 1, on: 1 },
    { k: 'cost', t: 'Valor',           c: 1, fmt: money },
    { k: 'pct',  t: '% de asignados',  c: 1, fmt: pct },
    { k: 'cats', t: 'Categorías',      c: 1 },
  ], () => {
    const m = new Map();
    D.assets.filter(a => a.assignedTo).forEach(a => {
      const r = m.get(a.assignedTo) || { n: 0, cost: 0, cats: new Set() };
      r.n++; r.cost += num(a.cost); r.cats.add(a.category || 'Sin categoría');
      m.set(a.assignedTo, r);
    });
    let list = [...m].sort((a, b) => b[1].n - a[1].n);
    const all = sum(list.map(x => x[1].n));
    if (list.length > 50) {                       // lo que exceda 50 personas se agrupa en "Otros"
      const rest = list.slice(49).map(x => x[1]);
      list = [...list.slice(0, 49), ['Otros', { n: sum(rest.map(r => r.n)), cost: sum(rest.map(r => r.cost)), cats: new Set(rest.flatMap(r => [...r.cats])) }]];
    }
    return { rows: list.map(([k, r]) => ({ label: k, v: { n: r.n, cost: r.cost, pct: r.n / all * 100, cats: r.cats.size } })), none: 'Ningún activo asignado' };
  }),

  tw('Valor del inventario por categoría', [
    { k: 'cost', t: 'Valor',               c: 1, on: 1, fmt: money },
    { k: 'n',    t: 'Activos',             c: 1 },
    { k: 'pct',  t: '% del valor',         c: 1, fmt: pct },
    { k: 'avg',  t: 'Promedio por activo', c: 1, fmt: money, sum: false },
  ], () => {
    const m = new Map();
    D.assets.forEach(a => { const k = a.category || 'Sin categoría', r = m.get(k) || { cost: 0, n: 0 }; r.cost += num(a.cost); r.n++; m.set(k, r); });
    const list = [...m].sort((a, b) => b[1].cost - a[1].cost), all = sum(list.map(x => x[1].cost));
    return { rows: list.map(([k, r]) => ({ label: k, v: { ...r, pct: all ? r.cost / all * 100 : 0, avg: r.n ? r.cost / r.n : 0 } })), total: 1, none: 'Sin datos' };
  })
);

// Definir BASE después de llenar W
const BASE = W.length;

// Cargar widgets personalizados
SC.load().forEach(def => { W[BASE + def.n] = mine(def); });
