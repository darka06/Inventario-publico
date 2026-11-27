// Panel de Estadísticas - Módulo 3: Gráficos avanzados

/*  Selector de tipo de gráfico  */

const chart = (v, d, hid) => {
  if (!d.length || !sum(d.map(x => x.value))) return empty('Sin datos');
  const vis = hid ? d.filter(x => !hid.has(x.label)) : d;
  return ({
    bar:     () => bars({ labels: d.map(x => x.label), lab: 'out', series: [{ values: d.map(x => x.value), colors: d.map(x => x.color) }] }),
    pie:     () => pie(vis, false, d, hid),
    line:    () => line(d),
    area:    () => line(d, true),
    donut:   () => pie(vis, true, d, hid),
    funnel:  () => funnel(vis),
    pyramid: () => pyramid(vis, d, hid),
    hbar:    () => hbar(d),
  }[v]());
};

/*  Medidor  */

function gauge({ value, max, color, caption }) {
  const cx = 230, cy = 160, R = 120, r = 76, a = Math.PI * value / max;
  const p = (ang, rad) => [cx - rad * Math.cos(ang), cy - rad * Math.sin(ang)];
  const ring = (ang, fill, tip) => {
    const [x0, y0] = p(0, R), [x1, y1] = p(ang, R), [x2, y2] = p(ang, r), [x3, y3] = p(0, r);
    return `<path ${tip ? `data-tip="${tip}"` : ''} d="M${x0} ${y0}A${R} ${R} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 0 0 ${x3} ${y3}Z" fill="${fill}"/>`;
  };
  const [tx, ty] = p(a, r - 6), nx = Math.sin(a) * 7, ny = -Math.cos(a) * 7;
  const [vx, vy] = p(a, R + 12), [ax, ay] = p(a, R), [bx, by] = p(a, r);

  return `<svg class="chart gauge" viewBox="0 0 460 215">
    ${ring(Math.PI, C.gray)}
    ${value ? ring(a, color, `${esc(caption)} : ${value}`) : ''}
    ${value && value < max ? `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#333"/><text x="${vx}" y="${vy}" text-anchor="middle">${value}</text>` : ''}
    <polygon points="${tx},${ty} ${cx + nx},${cy + ny} ${cx - nx},${cy - ny}" fill="#777" stroke="#555"/>
    <circle cx="${cx}" cy="${cy}" r="7" fill="#777" stroke="#555"/>
    <text x="${cx - (R + r) / 2}" y="${cy + 18}" text-anchor="middle">0</text>
    <text x="${cx + (R + r) / 2}" y="${cy + 18}" text-anchor="middle">${max}</text>
    <text x="${cx}" y="${cy + 44}" text-anchor="middle">${esc(caption)}</text>
  </svg>`;
}
