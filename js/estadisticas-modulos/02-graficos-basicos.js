// Panel de Estadísticas - Módulo 2: Gráficos SVG básicos

/*  Torta / Rosquilla  */

function pie(data, hole, all, hid) {
  const cx = 170, cy = 125, r = 100, r2 = hole ? 62 : 0, total = sum(data.map(d => d.value));
  let a0 = 0;
  const out = data.map((d, i) => {
    const s = a0, a1 = s + d.value / total * Math.PI * 2, m = (s + a1) / 2;
    a0 = a1;
    const [x0, y0] = pt(cx, cy, r, s), [x1, y1] = pt(cx, cy, r, a1);
    const [ex, ey] = pt(cx, cy, r, m), [lx, ly] = pt(cx, cy, r + 14, m);
    const right = Math.sin(m) >= 0, tx = lx + (right ? 12 : -12);
    const [dx, dy] = pt(0, 0, 9, m);
    const big = a1 - s > Math.PI ? 1 : 0;
    const [ix0, iy0] = pt(cx, cy, r2, s), [ix1, iy1] = pt(cx, cy, r2, a1);
    const shape = d.value === total
      ? `<circle class="sh" data-s="--i:${i}" cx="${cx}" cy="${cy}" r="${(r + r2) / 2}" fill="none" stroke="${d.color}" stroke-width="${r - r2}"/>`
      : `<path class="sh" data-s="--i:${i}" d="M${x0} ${y0}A${r} ${r} 0 ${big} 1 ${x1} ${y1}L${ix1} ${iy1}A${r2} ${r2} 0 ${big} 0 ${ix0} ${iy0}Z" fill="${d.color}" stroke="#fff" stroke-width="1.5"/>`;
    const otherLabelsAttr = d.otherLabels ? ` data-other-labels="${esc(JSON.stringify(d.otherLabels))}"` : '';
    return `<g class="slice" data-s="--dx:${dx}px;--dy:${dy}px" data-tip="${esc(d.label)} : ${d.value}" data-c="${d.color}" data-label="${esc(d.label)}" data-value="${d.value}" data-clickable="pie"${otherLabelsAttr}>${shape}</g>
      <polyline class="fd" points="${ex},${ey} ${lx},${ly} ${tx},${ly}" fill="none" stroke="${d.color}"/>
      <text class="fd" x="${tx + (right ? 4 : -4)}" y="${ly + 4}" text-anchor="${right ? 'start' : 'end'}">${d.value}</text>`;
  }).join('');
  const items = (all || data).map(d => [d.label, d.color, !!hid && hid.has(d.label)]);
  return `<div class="pie-wrap"><svg class="chart" viewBox="0 0 340 250">${out}</svg>${legend(items, 0, 1)}</div>`;
}

/*  Barras (apiladas)  */

function bars({ labels, series, lab = 'in', dataLabels }) {
  const W = 600, H = 250, L = 44, R = 12, T = 14, B = 30, pw = W - L - R, ph = H - T - B;
  const max = Math.max(...labels.map((_, i) => sum(series.map(s => s.values[i]))));
  const step = max ? Math.max(1, nice(max / 6)) : 1;
  const top = max ? (Math.floor(max / step) + 1) * step : 1;
  const ticks = max ? Array.from({ length: top / step + 1 }, (_, i) => i * step) : [0];
  const y = v => T + ph - v / top * ph;
  const band = pw / labels.length, bw = Math.min(band * (labels.length > 10 ? .8 : .5), 64);

  const grid = ticks.map(t =>
    `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('');

  const body = labels.map((lb, i) => {
    const x = L + band * i + (band - bw) / 2, mid = x + bw / 2;
    const dataLabel = dataLabels ? dataLabels[i] : lb;
    let acc = 0;
    const segs = series.map(s => {
      const v = s.values[i];
      if (!v) return '';
      const yb = y(acc), yt = y(acc + v);
      acc += v;
      const tip = esc(s.colors ? lb : s.name.replace(/\s*\(.*\)$/, ''));
      const col = s.colors ? s.colors[i] : s.color;
      const text = lab === 'out'
        ? `<text class="fd" x="${mid}" y="${yt - 5}" text-anchor="middle">${v}</text>`
        : (yb - yt >= 14 ? `<text class="in fd" x="${mid}" y="${yt + 13}" text-anchor="middle">${v}</text>` : '');
      const geo = `data-s="--i:${i}" x="${x}" y="${yt}" width="${bw}" height="${yb - yt}"`;
      return `<g data-tip="${tip} : ${v}" data-c="${col}" data-label="${esc(dataLabel)}" data-series="${esc(s.name)}" data-clickable="bar"><rect class="bar" ${geo} fill="${col}"/><rect class="bar hatch" ${geo} fill="url(#hatch)"/>${text}</g>`;
    }).join('');
    return segs + `<text x="${mid}" y="${H - 8}" text-anchor="middle">${lb}</text>`;
  }).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}"><g class="grid">${grid}</g>${body}</svg>
    ${series[0].name ? legend(series.map(s => [s.name, s.color]), true) : ''}`;
}

/*  Líneas / Área  */

function line(data, area) {
  const W = 600, H = 250, L = 44, R = 12, T = 24, B = 30, pw = W - L - R, ph = H - T - B;
  const max = Math.max(...data.map(d => d.value));
  const step = max ? Math.max(1, nice(max / 5)) : 1;
  const top = max ? Math.ceil(max / step) * step : 1;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const band = pw / data.length;
  const x = i => L + band * (i + .5);
  const y = v => T + ph - v / top * ph;

  const grid = ticks.map(t =>
    `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('');

  const path = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');

  const dots = data.map((d, i) => {
    const xl = x(i) - band / 2, xr = x(i) + band / 2, base = y(0);
    const yl = i ? (y(data[i - 1].value) + y(d.value)) / 2 : y(d.value);
    const yr = i < data.length - 1 ? (y(d.value) + y(data[i + 1].value)) / 2 : y(d.value);
    const hat = area ? `<polygon class="hatch" fill="url(#hatch)" points="${xl},${base} ${xl},${yl} ${x(i)},${y(d.value)} ${xr},${yr} ${xr},${base}"/>` : '';
    return `
    <g data-tip="${esc(d.label)} : ${d.value}" data-c="${d.color || C.green}" data-label="${esc(d.label)}" data-value="${d.value}" data-clickable="line">
      <rect class="hit" x="${xl}" y="${T}" width="${band}" height="${ph}"/>
      ${hat}
      <circle class="dot" cx="${x(i)}" cy="${y(d.value)}" r="5.5"/>
      <text x="${x(i)}" y="${y(d.value) - 11}" text-anchor="middle">${d.value}</text>
    </g>
    <text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(d.label)}</text>`;
  }).join('');

  const fill = area ? `<polygon class="ar" points="${x(0)},${y(0)} ${path} ${x(data.length - 1)},${y(0)}" fill="#06c167" fill-opacity=".25"/>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}"><g class="grid">${grid}</g>${fill}<polyline class="ln" pathLength="1" points="${path}"/>${dots}</svg>`;
}

/*  Embudo 3D  */

function funnel(data) {
  const cx = 300, top = 14, H = 232, gap = 12, e = 5, maxW = 250, minW = 40;
  const total = sum(data.map(d => d.value)) || 1;
  const hs = data.map(d => Math.max(12, d.value / total * H));
  const k = (H - gap * (data.length - 1)) / sum(hs);
  const w = y => maxW - (maxW - minW) * (y - top) / H;
  const half = Math.ceil(data.length / 2), last = [0, 0];
  let y = top;

  const out = data.map((d, i) => {
    const y0 = y, y1 = y0 + hs[i] * k, ym = (y0 + y1) / 2;
    y = y1 + gap;
    const rt = w(y0) / 2, rb = w(y1) / 2;
    const left = i < half, side = left ? 0 : 1, sg = left ? -1 : 1;
    const xe = cx + sg * (rt + rb) / 2;
    const ly = Math.max(ym, last[side] + 16);
    last[side] = ly;
    const x2 = cx + sg * (maxW / 2 + 12), xt = cx + sg * (maxW / 2 + 18);
    const pct = (d.value / total * 100).toFixed(1) + '%';

    return `<g class="seg" data-s="--i:${i}" data-tip="${esc(d.label)} : ${d.value}" data-c="${d.color}" data-label="${esc(d.label)}" data-value="${d.value}" data-clickable="funnel">
        <path d="M${cx - rt},${y0}L${cx - rb},${y1}A${rb},${e} 0 0 0 ${cx + rb},${y1}L${cx + rt},${y0}A${rt},${e} 0 0 1 ${cx - rt},${y0}Z" fill="${d.color}"/>
        <ellipse cx="${cx}" cy="${y0}" rx="${rt}" ry="${e}" fill="${d.color}"/>
        <ellipse cx="${cx}" cy="${y0}" rx="${rt}" ry="${e}" fill="#000" fill-opacity=".18"/>
        ${(y1 - y0) >= 22 ? `<text x="${cx}" y="${ym + 8}" text-anchor="middle" data-s="fill:#222;font-size:11px">${pct}</text>` : ''}
      </g>
      <polyline class="fd" points="${xe},${ym} ${x2},${ly} ${xt},${ly}" fill="none" stroke="#ccc"/>
      <text class="fd" x="${xt + sg * 4}" y="${ly + 4}" text-anchor="${left ? 'end' : 'start'}">${esc(d.label)}: ${d.value}</text>`;
  }).join('');

  return `<svg class="chart" viewBox="0 0 600 260">${out}</svg>`;
}

/*  Pirámide 3D  */

function pyramid(data, all, hid) {
  const A = [142, 12], Lp = [20, 245], Fp = [200, 243], Rp = [265, 200];
  const total = sum(data.map(d => d.value)) || 1;
  const at = (P, t) => [A[0] + (P[0] - A[0]) * t, A[1] + (P[1] - A[1]) * t];
  const pts = a => a.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ');
  let acc = 0, last = 0;

  const out = data.map((d, i) => {
    const t0 = acc / total; acc += d.value; const t1 = acc / total;
    const lf = pts([at(Lp, t0), at(Fp, t0), at(Fp, t1), at(Lp, t1)]);
    const rt = pts([at(Fp, t0), at(Rp, t0), at(Rp, t1), at(Fp, t1)]);
    const [ex, ey] = at(Rp, (t0 + t1) / 2);
    const ly = Math.max(ey, last + 16);
    last = ly;
    const st = 'stroke="#222" stroke-width=".8" stroke-linejoin="round"';

    return `<g class="seg" data-s="--i:${i}" data-tip="${esc(d.label)} : ${d.value}" data-c="${d.color}" data-label="${esc(d.label)}" data-value="${d.value}" data-clickable="pyramid">
        <polygon points="${lf}" fill="${d.color}" fill-opacity=".9" ${st}/>
        <polygon points="${rt}" fill="${d.color}" fill-opacity=".9" ${st}/>
        <polygon points="${rt}" fill="#000" fill-opacity=".12"/>
      </g>
      <polyline class="fd" points="${ex},${ey} ${ex + 22},${ly} 300,${ly}" fill="none" stroke="#ccc"/>
      <text class="fd" x="304" y="${ly + 4}">${d.value}</text>`;
  }).join('');

  const items = (all || data).map(d => [d.label, d.color, !!hid && hid.has(d.label)]);
  return `<div class="pie-wrap"><svg class="chart" viewBox="0 0 340 250">${out}</svg>${legend(items, 0, 1)}</div>`;
}

/*  Barra horizontal  */

function hbar(data) {
  const W = 600, H = 250, L = 96, R = 16, T = 10, B = 28, pw = W - L - R, ph = H - T - B;
  const n = data.length, max = Math.max(...data.map(d => d.value)) || 1;
  const step = Math.max(1, nice(max / 10)), top = (Math.floor(max / step) + 1) * step;
  const x = v => L + v / top * pw;
  const band = ph / n, bh = Math.min(band * .7, 30);

  const grid = Array.from({ length: top / step + 1 }, (_, i) => i * step).map(t =>
    `<line x1="${x(t)}" x2="${x(t)}" y1="${T}" y2="${T + ph}"/><text x="${x(t)}" y="${H - 8}" text-anchor="middle">${t}</text>`).join('');

  const body = data.map((d, i) => {
    const yy = T + band * (n - 1 - i) + (band - bh) / 2, wd = x(d.value) - L;
    const geo = `data-s="--i:${i}" x="${L}" y="${yy}" width="${wd}" height="${bh}"`;
    const otherLabelsAttr = d.otherLabels ? ` data-other-labels="${esc(JSON.stringify(d.otherLabels))}"` : '';
    return `<g data-tip="${esc(d.label)} : ${d.value}" data-c="${d.color}" data-label="${esc(d.label)}" data-value="${d.value}" data-clickable="hbar"${otherLabelsAttr}>
        <rect class="hb" ${geo} fill="${d.color}"/><rect class="hb hatch" ${geo} fill="url(#hatch)"/>
        <text class="fd" x="${L + wd + 6}" y="${yy + bh / 2 + 4}">${d.value}</text></g>
      <text x="${L - 8}" y="${yy + bh / 2 + 4}" text-anchor="end">${esc(d.label)}</text>`;
  }).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}"><g class="grid">${grid}</g>${body}</svg>`;
}
