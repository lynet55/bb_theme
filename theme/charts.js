/* Physical Intuitions (Quiet Report framework) charts: small dependency-free SVG renderers. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  let W = 656;
  const el = (tag, attrs, parent, text) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  const uniq = a => [...new Set(a)];
  const fmt = v => {
    if (typeof v !== 'number') return String(v);
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(0).replace('e+', 'e');
    return String(+v.toPrecision(3));
  };
  function ticks(lo, hi, n) {
    const span = hi - lo || 1;
    let step = Math.pow(10, Math.floor(Math.log10(span / n)));
    const err = span / n / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    const out = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
    return out;
  }
  function domain(vals, log, zero, lo0, hi0) {
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (log) {
      lo = Math.pow(10, Math.floor(Math.log10(lo) + 1e-9)); hi = Math.pow(10, Math.ceil(Math.log10(hi) - 1e-9));
      if (lo === hi) hi = lo * 10;
    } else {
      if (zero) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
      if (lo === hi) hi = lo + 1;
      const t = ticks(lo, hi, 5), step = t.length > 1 ? t[1] - t[0] : 1;
      lo = Math.floor(lo / step + 1e-9) * step; hi = Math.ceil(hi / step - 1e-9) * step;
    }
    return [lo0 != null ? lo0 : lo, hi0 != null ? hi0 : hi];
  }
  const scale = (d, r, log) => log
    ? v => r[0] + (Math.log10(v) - Math.log10(d[0])) / (Math.log10(d[1]) - Math.log10(d[0])) * (r[1] - r[0])
    : v => r[0] + (v - d[0]) / (d[1] - d[0]) * (r[1] - r[0]);
  const axisTicks = (d, log, n) => {
    if (!log) return ticks(d[0], d[1], n);
    const o = [];
    for (let e = Math.round(Math.log10(d[0])); e <= Math.round(Math.log10(d[1])); e++) o.push(Math.pow(10, e));
    return o;
  };
  const tickLabel = (v, log) => log ? (v >= 1e4 || v < 1e-3 ? '1e' + Math.round(Math.log10(v)) : fmt(v)) : fmt(v);
  const label = (tpl, key) => tpl ? String(tpl).replace('{}', key) : key;

  /* ---------- line ---------- */
  function drawLine(spec, host, st) {
    const all = spec.rows || [];
    let rows = all;
    if (spec.slider) rows = all.filter(r => r[spec.slider] === st.sliderValues[st.slider]);
    const ycols = Array.isArray(spec.y) ? spec.y : [spec.y];
    const groups = [], idx = {};
    const add = (k, x, y, r) => { if (!(k in idx)) { idx[k] = { key: k, pts: [] }; groups.push(idx[k]); } idx[k].pts.push({ x, y, r }); };
    rows.forEach(r => ycols.forEach(c => {
      if (typeof r[c] !== 'number' || typeof r[spec.x] !== 'number') return;
      add(spec.series ? String(r[spec.series]) : (ycols.length > 1 ? c : ''), r[spec.x], r[c], r);
    }));
    const multi = groups.length > 1, hasLabels = (multi || spec.name) && !spec.legend;
    const H = spec.height || 300, m = { l: 50, r: hasLabels ? 104 : 16, t: 26, b: spec.xlabel ? 52 : 32 };
    const allY = [];
    all.forEach(r => { ycols.forEach(c => typeof r[c] === 'number' && allY.push(r[c])); (spec.band || []).forEach(c => typeof r[c] === 'number' && allY.push(r[c])); });
    (spec.hlines || []).forEach(h => allY.push(h.y));
    const xd = domain(all.map(r => r[spec.x]).filter(v => typeof v === 'number'), spec.xlog, false, spec.xmin, spec.xmax);
    const yd = domain(allY, spec.ylog, spec.yzero !== false, spec.ymin, spec.ymax);
    const X = scale(xd, [m.l, W - m.r], spec.xlog), Y = scale(yd, [H - m.b, m.t], spec.ylog);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' }, host);
    if (spec.ylabel) el('text', { x: 0, y: 10, class: 'g-axis' }, svg, spec.ylabel);
    axisTicks(yd, spec.ylog, 5).forEach(v => {
      if (v !== yd[0]) el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'g-grid' }, svg);
      el('line', { x1: m.l - 4, x2: m.l, y1: Y(v), y2: Y(v), class: 'g-tk' }, svg); el('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end', class: 'g-tick' }, svg, tickLabel(v, spec.ylog));
    });
    axisTicks(xd, spec.xlog, 6).forEach(v =>
      el('line', { x1: X(v), x2: X(v), y1: H - m.b, y2: H - m.b + 4, class: 'g-tk' }, svg) && el('text', { x: X(v), y: H - m.b + 18, 'text-anchor': 'middle', class: 'g-tick' }, svg, tickLabel(v, spec.xlog)));
    if (spec.xlabel) el('text', { x: W - m.r, y: H - 6, 'text-anchor': 'end', class: 'g-axis' }, svg, spec.xlabel);
    const hl = spec.highlight != null ? String(spec.highlight) : (groups.length === 1 ? groups[0].key : null);
    const others = groups.filter(g => g.key !== hl);
    groups.forEach(g => { g.cls = g.key === hl ? 'hl' : (others.length <= 2 ? ['s2', 's3'][others.indexOf(g)] : 'cx'); });
    if (spec.legend) { legend(host, groups.map(g => ({ label: label(spec.series_label, g.key || spec.name || ''), cls: g.cls, shape: 'ln' }))); host.appendChild(svg); }
    if (spec.band) groups.filter(g => g.key === hl || !multi).forEach(g => {
      const up = g.pts.map(p => `${X(p.x).toFixed(1)},${Y(p.r[spec.band[1]]).toFixed(1)}`);
      const dn = g.pts.map(p => `${X(p.x).toFixed(1)},${Y(p.r[spec.band[0]]).toFixed(1)}`).reverse();
      el('polygon', { points: up.concat(dn).join(' '), class: 'g-band' }, svg);
    });
    (spec.hlines || []).forEach(h => {
      el('line', { x1: m.l, x2: W - m.r, y1: Y(h.y), y2: Y(h.y), class: 'g-dash' }, svg);
      if (h.label) el('text', { x: m.l + 4, y: Y(h.y) - 6, class: 'g-tick' }, svg, h.label);
    });
    groups.slice().sort((a, b) => (a.key === hl) - (b.key === hl)).forEach(g =>
      el('polyline', { points: g.pts.map(p => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' '), class: 'ln ' + g.cls }, svg));
    el('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'g-base' }, svg); el('line', { x1: m.l, x2: m.l, y1: m.t, y2: Y(yd[0]), class: 'g-spine' }, svg);
    if (hasLabels) {
      const ends = groups.map(g => ({ g, y: Y(g.pts[g.pts.length - 1].y) })).sort((a, b) => a.y - b.y);
      for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
      ends.forEach(e => el('text', { x: W - m.r + 8, y: e.y + 4, class: 'g-lab t-' + e.g.cls }, svg, label(spec.series_label, e.g.key || spec.name)));
    }
    (spec.annotations || []).forEach(a => {
      const ax = X(a.x), ay = Y(a.y), left = ax > W * 0.6;
      el('line', { x1: ax + (left ? -5 : 5), y1: ay, x2: ax + (left ? -34 : 34), y2: ay, class: 'g-lead' }, svg);
      el('text', { x: ax + (left ? -40 : 40), y: ay + 4, 'text-anchor': left ? 'end' : 'start', class: 'g-note' }, svg, a.text);
    });
    // hover readout
    const guide = el('g', { visibility: 'hidden' }, svg);
    const gl = el('line', { y1: m.t, y2: H - m.b, class: 'g-lead' }, guide);
    const dots = groups.map(g => el('circle', { r: 4, class: 'hover-dot f-' + g.cls }, guide));
    const read = el('text', { x: W - m.r, y: 10, 'text-anchor': 'end', class: 'g-tick' }, guide);
    const ref = (groups.find(g => g.key === hl) || groups[0] || { pts: [] }).pts;
    const hit = el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'none', 'pointer-events': 'all' }, svg);
    hit.addEventListener('mousemove', ev => {
      const box = svg.getBoundingClientRect(), px = (ev.clientX - box.left) * W / box.width;
      let best = null, bd = 1e9;
      ref.forEach(p => { const d = Math.abs(X(p.x) - px); if (d < bd) { bd = d; best = p; } });
      if (!best) return;
      gl.setAttribute('x1', X(best.x)); gl.setAttribute('x2', X(best.x));
      const parts = [];
      groups.forEach((g, i) => {
        let q = g.pts[0], qd = 1e9;
        g.pts.forEach(p => { const d = Math.abs(p.x - best.x); if (d < qd) { qd = d; q = p; } });
        dots[i].setAttribute('cx', X(q.x)); dots[i].setAttribute('cy', Y(q.y));
        parts.push((g.key ? label(spec.series_label, g.key) + ': ' : '') + fmt(q.y));
      });
      read.textContent = `${spec.x} = ${fmt(best.x)} · ${parts.join(' · ')}`;
      guide.setAttribute('visibility', 'visible');
    });
    hit.addEventListener('mouseleave', () => guide.setAttribute('visibility', 'hidden'));
  }

  /* ---------- bar ---------- */
  function wilson(k, n) {
    const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), s = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
    return [100 * (c - s) / d, 100 * (c + s) / d];
  }
  function drawBar(spec, host) {
    const rows = spec.rows || [], stacked = spec._stacked, rate = spec.successes && spec.trials;
    const hasSub = !!spec.sub, pitch = hasSub ? 54 : 42, bh = 26;
    const labW = Math.min(W * 0.38, Math.max(60, ...rows.map(r => Math.max(String(r[spec.label]).length * 7, hasSub ? String(r[spec.sub] ?? '').length * 6.5 : 0))) + 14);
    const m = { l: labW, r: rate && !stacked ? 104 : 56, t: stacked ? 34 : 6, b: 30 };
    const H = m.t + rows.length * pitch + m.b;
    const val = r => rate ? 100 * r[spec.successes] / r[spec.trials] : r[spec.value];
    const unit = rate ? '%' : (spec.unit || '');
    const xd = (rate || stacked) ? [0, 100] : domain(rows.map(val).concat(spec.max != null ? [spec.max] : []), false, true);
    const X = scale(xd, [m.l, W - m.r]);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' }, host);
    const cut = (t, w) => { t = String(t); const n = Math.floor((labW - 14) / w); return t.length > n ? t.slice(0, Math.max(1, n - 1)) + '…' : t; };
    ticks(xd[0], xd[1], W < 480 ? 2 : 5).forEach(v => {
      if (v !== 0) el('line', { x1: X(v), x2: X(v), y1: m.t, y2: H - m.b, class: 'g-grid' }, svg);
      el('line', { x1: X(v), x2: X(v), y1: H - m.b, y2: H - m.b + 4, class: 'g-tk' }, svg) && el('text', { x: X(v), y: H - m.b + 18, 'text-anchor': 'middle', class: 'g-tick' }, svg, fmt(v) + ((rate || stacked) ? '%' : ''));
    });
    const stages = spec.stages || [];
    const q = i => 'q' + (stages.length > 1 ? Math.round(i * 4 / (stages.length - 1)) : 3);
    if (stacked) {
      let lx = m.l;
      stages.forEach((s, i) => {
        el('rect', { x: lx, y: 4, width: 10, height: 10, class: q(i) }, svg);
        el('text', { x: lx + 15, y: 13, class: 'g-tick' }, svg, s);
        lx += 15 + s.length * 6.7 + 16;
      });
    }
    rows.forEach((r, i) => {
      const y = m.t + i * pitch + (pitch - bh) / 2 - (hasSub ? 2 : 0), isHl = spec.highlight != null && String(r[spec.label]) === String(spec.highlight);
      el('text', { x: m.l - 10, y: y + (hasSub ? 11 : 17), 'text-anchor': 'end', class: 'g-lab' }, svg, cut(r[spec.label], 7));
      if (hasSub) el('text', { x: m.l - 10, y: y + 25, 'text-anchor': 'end', class: 'g-sub' }, svg, cut(r[spec.sub] ?? '', 6.5));
      if (stacked) {
        const tot = stages.reduce((a, s) => a + (r[s] || 0), 0) || 1;
        let acc = 0;
        stages.forEach((s, j) => {
          const w = (r[s] || 0) / tot * 100;
          if (w > 0) {
            const rc = el('rect', { x: X(acc) + (j ? 1 : 0), y: y + 6, width: Math.max(0, X(acc + w) - X(acc) - (j ? 1 : 0)), height: bh - 12, class: q(j) }, svg);
            el('title', {}, rc, `${s}: ${r[s]} of ${tot} (${fmt(w)}%)`);
          }
          acc += w;
        });
        el('text', { x: X(100) + 8, y: y + 17, class: 'g-sub' }, svg, 'n = ' + tot);
      } else {
        const v = val(r);
        el('title', {}, el('rect', { x: X(0), y: y + 6, width: Math.max(0, X(v) - X(0)), height: bh - 12, class: isHl || spec.highlight == null ? 'f-hl' : 'f-cx' }, svg), `${r[spec.label]}: ${fmt(v)}${unit}`);
        let tx = X(v) + 8;
        if (rate && spec.ci !== false) {
          const [lo, hi] = wilson(r[spec.successes], r[spec.trials]);
          el('line', { x1: X(lo), x2: X(hi), y1: y + bh / 2, y2: y + bh / 2, stroke: 'var(--ink)', 'stroke-width': 1.5 }, svg);
          tx = X(hi) + 8;
        }
        const t = el('text', { x: tx, y: y + 17, class: 'g-lab' + (isHl ? ' t-hl' : '') }, svg, fmt(v) + unit);
        if (rate) el('tspan', { dx: 6, class: 'g-sub' }, t, `${r[spec.successes]}/${r[spec.trials]}`);
      }
    });
    el('line', { x1: X(0), x2: X(0), y1: m.t, y2: H - m.b, class: 'g-base' }, svg);
  }

  /* ---------- scatter ---------- */
  function drawScatter(spec, host) {
    const rows = (spec.rows || []).filter(r => typeof r[spec.x] === 'number' && typeof r[spec.y] === 'number');
    const H = spec.height || 320, m = { l: 50, r: 24, t: 26, b: spec.xlabel ? 52 : 32 };
    const xd = domain(rows.map(r => r[spec.x]), spec.xlog, false, spec.xmin, spec.xmax);
    const yd = domain(rows.map(r => r[spec.y]), spec.ylog, spec.yzero === true, spec.ymin, spec.ymax);
    const X = scale(xd, [m.l, W - m.r], spec.xlog), Y = scale(yd, [H - m.b, m.t], spec.ylog);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' }, host);
    if (spec.ylabel) el('text', { x: 0, y: 10, class: 'g-axis' }, svg, spec.ylabel);
    axisTicks(yd, spec.ylog, 5).forEach(v => {
      if (v !== yd[0]) el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'g-grid' }, svg);
      el('line', { x1: m.l - 4, x2: m.l, y1: Y(v), y2: Y(v), class: 'g-tk' }, svg); el('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end', class: 'g-tick' }, svg, tickLabel(v, spec.ylog));
    });
    axisTicks(xd, spec.xlog, 6).forEach(v =>
      el('line', { x1: X(v), x2: X(v), y1: H - m.b, y2: H - m.b + 4, class: 'g-tk' }, svg) && el('text', { x: X(v), y: H - m.b + 18, 'text-anchor': 'middle', class: 'g-tick' }, svg, tickLabel(v, spec.xlog)));
    if (spec.xlabel) el('text', { x: W - m.r, y: H - 6, 'text-anchor': 'end', class: 'g-axis' }, svg, spec.xlabel);
    el('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'g-base' }, svg); el('line', { x1: m.l, x2: m.l, y1: m.t, y2: Y(yd[0]), class: 'g-spine' }, svg);
    if (spec.fit && rows.length > 2) {
      const tx = v => spec.xlog ? Math.log10(v) : v, ty = v => spec.ylog ? Math.log10(v) : v;
      const n = rows.length, mx = rows.reduce((a, r) => a + tx(r[spec.x]), 0) / n, my = rows.reduce((a, r) => a + ty(r[spec.y]), 0) / n;
      let sxx = 0, sxy = 0, syy = 0;
      rows.forEach(r => { const dx = tx(r[spec.x]) - mx, dy = ty(r[spec.y]) - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; });
      const b = sxy / sxx, a = my - b * mx, r2 = sxy * sxy / (sxx * syy);
      const xs = rows.map(r => r[spec.x]), x0 = Math.min(...xs), x1 = Math.max(...xs);
      const fy = x => spec.ylog ? Math.pow(10, a + b * tx(x)) : a + b * tx(x);
      el('line', { x1: X(x0), y1: Y(fy(x0)), x2: X(x1), y2: Y(fy(x1)), class: 'ln hl' }, svg);
      el('text', { x: W - m.r, y: 10, 'text-anchor': 'end', class: 'g-tick' }, svg, `OLS fit · R² = ${r2.toFixed(2)} · slope = ${fmt(b)} · n = ${n}`);
    }
    rows.forEach(r => {
      const isHl = spec.highlight != null && spec.label && String(r[spec.label]) === String(spec.highlight);
      const c = el('circle', { cx: X(r[spec.x]), cy: Y(r[spec.y]), r: 4.5, class: 'pt' + (isHl ? ' hl' : '') }, svg);
      el('title', {}, c, `${spec.label ? r[spec.label] + ': ' : ''}${fmt(r[spec.x])}, ${fmt(r[spec.y])}`);
      if (spec.label && rows.length <= 8) el('text', { x: X(r[spec.x]) + 8, y: Y(r[spec.y]) - 7, class: 'g-sub' }, svg, r[spec.label]);
    });
  }

  /* ---------- feedback loop block diagram ---------- */
  const mathCache = {};
  function mathNode(parent, tex, cx, cy, size, cls, anchor) {
    if (window.MathJax && MathJax.tex2svg) {
      try {
        const key = size + '|' + tex;
        if (!mathCache[key]) {
          const t = MathJax.tex2svg(tex, { display: false, em: size, ex: size / 2 }).querySelector('svg');
          t.removeAttribute('style');
          mathCache[key] = { node: t, w: parseFloat(t.getAttribute('width')) * size / 2, h: parseFloat(t.getAttribute('height')) * size / 2 };
        }
        const s = mathCache[key].node.cloneNode(true), w = mathCache[key].w, h = mathCache[key].h;
        const a = { width: w, height: h, x: anchor === 'start' ? cx : anchor === 'end' ? cx - w : cx - w / 2, y: cy - h / 2, class: 'mth ' + (cls || '') };
        for (const k in a) s.setAttribute(k, a[k]);
        parent.appendChild(s);
        return;
      } catch (e) { /* fall through to plain text */ }
    }
    const G = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', theta: 'θ', phi: 'φ', psi: 'ψ', omega: 'ω', zeta: 'ζ', kappa: 'κ', lambda: 'λ', mu: 'μ', sigma: 'σ', tau: 'τ', rho: 'ρ', epsilon: 'ε', varepsilon: 'ε', eta: 'η', xi: 'ξ', pi: 'π' };
    el('text', { x: cx, y: cy + 5, 'text-anchor': anchor || 'middle', class: 'mtxt ' + (cls || '') }, parent, tex.replace(/\\([a-zA-Z]+)\s?/g, (m, w) => G[w] || '').replace(/[{}\\_]/g, ''));
  }
  function drawLoop(spec, host) {
    const parse = s => { const [tex, name] = String(s).split('|'); return { tex: tex.trim(), name: (name || '').trim() }; };
    const blocks = (spec.blocks || []).map(parse), sig = spec.signals || {}, hl = spec.highlight;
    const closed = spec.feedback !== false, fb = closed && spec.feedback && spec.feedback !== true ? parse(spec.feedback) : null;
    const dist = spec.disturbance, y0 = dist ? 84 : 44, y1 = y0 + 104, gap = 58, bw = spec.block_width || 104, bh = 48, R = 12;
    const items = []; let x = 64;
    if (closed) { items.push({ t: 'sum', l: x, r: x + 2 * R }); x += 2 * R; } else x = 0;
    blocks.forEach((b, i) => {
      if (dist && dist.before === i + 1 && (closed || i > 0)) { x += gap; items.push({ t: 'dsum', l: x, r: x + 2 * R }); x += 2 * R; }
      x += gap; items.push({ t: 'blk', l: x, r: x + bw, b }); x += bw;
    });
    const bx = x + 60, end = bx + 76, VW = Math.max(656, end + 4), off = (VW - end) / 2;
    const H = closed ? y1 + (fb ? 56 : 14) : y0 + 62;
    const svg = el('svg', { viewBox: `${-off} 0 ${VW} ${H}`, role: 'img' }, host);
    const defs = el('defs', {}, svg), uid = 'a' + Math.random().toString(36).slice(2, 8);
    ['', 'hl', 'aux'].forEach(c => {
      const mk = el('marker', { id: uid + c, viewBox: '0 0 8 8', refX: 7.5, refY: 4, markerWidth: 8, markerHeight: 8, orient: 'auto', markerUnits: 'userSpaceOnUse' }, defs);
      el('path', { d: 'M0,0 L8,4 L0,8 z', class: 'ah ' + c }, mk);
    });
    const wire = (pts, name, cls) => {
      const isHl = name != null && name === hl;
      el('polyline', { points: pts.map(p => p.join(',')).join(' '), class: cls || ('w' + (isHl ? ' hl' : '')), 'marker-end': `url(#${uid}${cls ? 'aux' : isHl ? 'hl' : ''})` }, svg);
      return isHl ? 'hl' : '';
    };
    const names = [closed ? (sig.ref || 'r') : null, closed ? (sig.error || 'e') : (sig.ref || 'r')].concat(sig.between || []);
    let prev = 0, wi = closed ? 0 : 1;
    items.forEach(it => {
      const nm = names[wi++], c = wire([[prev, y0], [it.l, y0]], nm);
      if (nm) mathNode(svg, nm, (prev + it.l) / 2, y0 - 14, 15, c);
      prev = it.r;
    });
    const out = sig.out || 'y', oc = wire([[prev, y0], [end, y0]], out);
    mathNode(svg, out, bx + 40, y0 - 14, 15, oc);
    items.forEach(it => {
      const cx = (it.l + it.r) / 2;
      if (it.t === 'blk') {
        el('rect', { x: it.l, y: y0 - bh / 2, width: bw, height: bh, rx: 4, class: 'b-box' }, svg);
        mathNode(svg, it.b.tex, cx, y0, 16);
        if (it.b.name) el('text', { x: cx, y: y0 + bh / 2 + 18, 'text-anchor': 'middle', class: 'g-lab', style: 'fill:var(--ink-2)' }, svg, it.b.name);
      } else {
        el('circle', { cx, cy: y0, r: R, class: 'b-box' }, svg);
        el('text', { x: cx - R - 12, y: y0 - 8, class: 'sgn' }, svg, '+');
        if (it.t === 'sum') el('text', { x: cx + 7, y: y0 + R + 17, class: 'sgn' }, svg, '−');
        else {
          el('text', { x: cx + 7, y: y0 - R - 8, class: 'sgn' }, svg, '+');
          wire([[cx, y0 - 70], [cx, y0 - R]], null, 'g-dash');
          mathNode(svg, dist.label || 'd', cx - 16, y0 - 60, 15, 'aux');
        }
      }
    });
    if (closed) {
      el('circle', { cx: bx, cy: y0, r: 3.5, class: 'ah' }, svg);
      const sx = items[0].l + R, meas = sig.meas || (fb ? 'y_m' : null);
      if (fb) {
        const fl = (sx + bx) / 2 - bw / 2;
        wire([[bx, y0], [bx, y1], [fl + bw, y1]], out === hl ? out : null);
        el('rect', { x: fl, y: y1 - bh / 2, width: bw, height: bh, rx: 4, class: 'b-box' }, svg);
        mathNode(svg, fb.tex, fl + bw / 2, y1, 16);
        if (fb.name) el('text', { x: fl + bw / 2, y: y1 + bh / 2 + 18, 'text-anchor': 'middle', class: 'g-lab', style: 'fill:var(--ink-2)' }, svg, fb.name);
        const c = wire([[fl, y1], [sx, y1], [sx, y0 + R]], meas);
        if (meas) mathNode(svg, meas, (sx + fl) / 2, y1 - 14, 15, c);
      } else {
        const c = wire([[bx, y0], [bx, y1], [sx, y1], [sx, y0 + R]], meas);
        if (meas) mathNode(svg, meas, (sx + bx) / 2, y1 - 14, 15, c);
      }
    }
  }

  /* ---------- frames: coordinate frames, rotations, vectors, angles ---------- */
  function drawFrames(spec, host) {
    const rad = d => d * Math.PI / 180, defs = {}, cache = {};
    (spec.frames || []).forEach(f => { defs[f.name] = f; });
    const pose = name => {
      if (!name) return { x: 0, y: 0, a: 0 };
      if (cache[name]) return cache[name];
      const f = defs[name];
      if (!f) throw new Error('frames: unknown frame "' + name + '"');
      const p = pose(f.parent), at = f.at || [0, 0], c = Math.cos(rad(p.a)), s = Math.sin(rad(p.a));
      return (cache[name] = { x: p.x + c * at[0] - s * at[1], y: p.y + s * at[0] + c * at[1], a: p.a + (f.angle || 0) });
    };
    const pt = (e, at) => { const p = pose(e.in), c = Math.cos(rad(p.a)), s = Math.sin(rad(p.a)); at = at || [0, 0]; return [p.x + c * at[0] - s * at[1], p.y + s * at[0] + c * at[1]]; };
    const ang = (e, a) => pose(e.in).a + (a || 0);
    const polar = (o, a, l) => [o[0] + l * Math.cos(rad(a)), o[1] + l * Math.sin(rad(a))];
    const ends = e => { const a = pt(e, e.from); return [a, e.to ? pt(e, e.to) : polar(a, ang(e, e.angle), e.length != null ? e.length : 1)]; };
    const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
    const ops = [];                      // world-space drawing list
    const math = (p, dir, tex, cls, e, gap) => tex && ops.push({ k: 'math', p, dir, tex: String(tex), cls, off: e && e.label_offset, gap: gap || 15 });
    (spec.bodies || []).forEach(e => {
      const c = pt(e, e.at), a = ang(e, e.angle), [w, h] = e.size || [1, 0.4];
      const cs = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(q => [c[0] + q[0] * Math.cos(rad(a)) - q[1] * Math.sin(rad(a)), c[1] + q[0] * Math.sin(rad(a)) + q[1] * Math.cos(rad(a))]);
      ops.push({ k: 'polygon', pts: cs, cls: 'fr-body' });
      math(c, [-Math.sin(rad(a)), Math.cos(rad(a))], e.label, '', e, 20);
    });
    (spec.lines || []).forEach(e => {
      const [a, b] = ends(e), u = unit(a, b);
      ops.push({ k: 'seg', a, b, cls: e.dashed ? 'g-dash' : e.heavy ? 'fr-heavy' : 'fr-line' });
      math([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], [-u[1], u[0]], e.label, 'aux', e);
    });
    (spec.dims || []).forEach(e => {
      const a = pt(e, e.from), b = pt(e, e.to), u = unit(a, b), n = [-u[1], u[0]], d = e.offset != null ? e.offset : -0.5;
      const a2 = [a[0] + n[0] * d, a[1] + n[1] * d], b2 = [b[0] + n[0] * d, b[1] + n[1] * d], t = 0.07 * Math.sign(d || 1);
      ops.push({ k: 'seg', a, b: a2, cls: 'fr-dim' }, { k: 'seg', a: b, b: b2, cls: 'fr-dim' }, { k: 'seg', a: a2, b: b2, cls: 'fr-dim', arrow: 'aux', both: true });
      ops.push({ k: 'seg', a: a2, b: [a2[0] + n[0] * t, a2[1] + n[1] * t], cls: 'fr-dim' }, { k: 'seg', a: b2, b: [b2[0] + n[0] * t, b2[1] + n[1] * t], cls: 'fr-dim' });
      math([(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2], [n[0] * Math.sign(d || 1), n[1] * Math.sign(d || 1)], e.label, '', e);
    });
    (spec.frames || []).forEach(f => {
      if (f.axes === false) return;
      const p = pose(f.name), o = [p.x, p.y], L = f.length != null ? f.length : 1, cls = f.highlight ? 'hl' : '', lab = f.labels || [];
      [0, 90].forEach((da, i) => {
        const tip = polar(o, p.a + da, L);
        ops.push({ k: 'seg', a: o, b: tip, cls: 'fr-ax ' + cls, arrow: cls });
        math(tip, unit(o, tip), lab[i], cls, f, 13);
      });
      ops.push({ k: 'dot', p: o, cls: cls ? 'f-hl' : 'ah' });
      math(o, [-0.7, -0.7], f.origin, cls, null, 14);
    });
    (spec.angles || []).forEach(e => {
      const o = pt(e, e.at), a0 = ang(e, e.from), a1 = ang(e, e.to), r = e.radius != null ? e.radius : 0.6, cls = e.highlight ? 'hl' : '', pts = [];
      for (let i = 0; i <= 28; i++) pts.push(polar(o, a0 + (a1 - a0) * i / 28, r));
      ops.push({ k: 'poly', pts, cls: 'fr-arc ' + cls, arrow: e.arrow === false ? null : cls });
      const mid = polar(o, (a0 + a1) / 2, r);
      math(mid, unit(o, mid), e.label, cls, e, 14);
    });
    (spec.vectors || []).forEach(e => {
      const [a, b] = ends(e), cls = e.highlight ? 'hl' : '';
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.04) return;
      ops.push({ k: 'seg', a, b, cls: 'fr-vec ' + cls, arrow: cls });
      math(b, unit(a, b), e.label, cls, e, 14);
    });
    (spec.points || []).forEach(e => {
      const p = pt(e, e.at);
      ops.push({ k: 'dot', p, cls: e.highlight ? 'f-hl' : 'ah', r: 4 });
      math(p, [0.6, 0.8], e.label, e.highlight ? 'hl' : '', e, 16);
    });
    // fit the world into the plate
    const all = [];
    ops.forEach(o => { if (o.pts) all.push(...o.pts); if (o.a) all.push(o.a, o.b); if (o.p) all.push(o.p); });
    const xs = all.map(q => q[0]), ys = all.map(q => q[1]), pad = 34;
    const bd = spec.bounds;              // optional fixed view: [x0, y0, x1, y1]
    const x0 = bd ? bd[0] : Math.min(...xs), x1 = bd ? bd[2] : Math.max(...xs), y0 = bd ? bd[1] : Math.min(...ys), y1 = bd ? bd[3] : Math.max(...ys);
    const sc = Math.min((W - 2 * pad) / ((x1 - x0) || 1), ((spec.height || 420) - 2 * pad) / ((y1 - y0) || 1));
    const H = (y1 - y0) * sc + 2 * pad, ox = (W - (x1 - x0) * sc) / 2;
    const P = q => [ox + (q[0] - x0) * sc, pad + (y1 - q[1]) * sc], S = q => P(q).map(v => v.toFixed(1)).join(',');
    const svg = el('svg', { viewBox: `0 0 ${W} ${H.toFixed(0)}`, role: 'img' }, host);
    const mdefs = el('defs', {}, svg), uid = 'f' + Math.random().toString(36).slice(2, 8);
    ['', 'hl', 'aux'].forEach(c => ['', 's'].forEach(rev => {
      const mk = el('marker', { id: uid + c + rev, viewBox: '0 0 8 8', refX: rev ? 0.5 : 7.5, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto', markerUnits: 'userSpaceOnUse' }, mdefs);
      el('path', { d: rev ? 'M8,0 L0,4 L8,8 z' : 'M0,0 L8,4 L0,8 z', class: 'ah ' + c }, mk);
    }));
    ops.forEach(o => {
      const mark = o.arrow != null ? { 'marker-end': `url(#${uid}${o.arrow})` } : {};
      if (o.both) mark['marker-start'] = `url(#${uid}${o.arrow}s)`;
      if (o.k === 'polygon') el('polygon', { points: o.pts.map(S).join(' '), class: o.cls }, svg);
      else if (o.k === 'seg') el('polyline', Object.assign({ points: S(o.a) + ' ' + S(o.b), class: o.cls }, mark), svg);
      else if (o.k === 'poly') {
        const a = P(o.pts[0]), b = P(o.pts[o.pts.length - 1]);   // drop the arrowhead on very short arcs
        el('polyline', Object.assign({ points: o.pts.map(S).join(' '), class: o.cls }, Math.hypot(a[0] - b[0], a[1] - b[1]) > 22 ? mark : {}), svg);
      }
      else if (o.k === 'dot') { const c = P(o.p); el('circle', { cx: c[0], cy: c[1], r: o.r || 3, class: o.cls }, svg); }
    });
    ops.filter(o => o.k === 'math').forEach(o => {
      const c = P(o.p), off = o.off || [o.dir[0] * o.gap, -o.dir[1] * o.gap];
      mathNode(svg, o.tex, c[0] + off[0], c[1] + (o.off ? -off[1] : off[1]), 15, o.cls);
    });
  }

  /* ---------- expressions: a small safe formula language ---------- */
  const FN = {
    min: Math.min, max: Math.max, abs: Math.abs, sign: Math.sign, sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2, exp: Math.exp, log: Math.log, hypot: Math.hypot, pow: Math.pow,
    floor: Math.floor, clamp: (v, a, b) => Math.min(Math.max(v, a), b), deg: r => r * 180 / Math.PI, rad: d => d * Math.PI / 180,
    if: (c, a, b) => (c ? a : b), wrap: a => Math.atan2(Math.sin(a), Math.cos(a))
  };
  function compile(src, fns) {
    const re = /\s*(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+|[A-Za-z_]\w*|<=|>=|[-+*\/^(),<>])/y, toks = [];
    const text = String(src); let m, pos = 0;
    while ((re.lastIndex = pos, m = re.exec(text))) { toks.push(m[1]); pos = re.lastIndex; }
    if (text.slice(pos).trim()) throw new Error(`cannot read formula "${text}" near "${text.slice(pos, pos + 12)}"`);
    let i = 0;
    const peek = () => toks[i], take = t => { if (toks[i] !== t) throw new Error(`formula "${text}": expected ${t}`); i++; };
    const bin = (next, table) => () => { let a = next(); while (peek() in table) { const op = table[toks[i++]], x = a, y = next(); a = S => op(x(S), y(S)); } return a; };
    const atom = () => {
      const t = toks[i++];
      if (t === undefined) throw new Error(`formula "${text}" ends too early`);
      if (t === '(') { const e = cmp(); take(')'); return e; }
      if (/^[\d.]/.test(t)) { const v = parseFloat(t); return () => v; }
      if (!/^[A-Za-z_]/.test(t)) throw new Error(`formula "${text}": unexpected ${t}`);
      if (peek() === '(') {
        i++; const args = [];
        if (peek() !== ')') { args.push(cmp()); while (peek() === ',') { i++; args.push(cmp()); } }
        take(')');
        const fn = fns[t]; if (!fn) throw new Error(`formula "${text}": unknown function ${t}()`);
        return S => fn(...args.map(a => a(S)));
      }
      return S => S[t];
    };
    const pow = () => { const a = atom(); if (peek() === '^') { i++; const b = unary(); return S => Math.pow(a(S), b(S)); } return a; };
    const unary = () => { if (peek() === '-') { i++; const a = unary(); return S => -a(S); } return pow(); };
    const mul = bin(unary, { '*': (a, b) => a * b, '/': (a, b) => a / b });
    const add = bin(mul, { '+': (a, b) => a + b, '-': (a, b) => a - b });
    const cmp = bin(add, { '<': (a, b) => +(a < b), '>': (a, b) => +(a > b), '<=': (a, b) => +(a <= b), '>=': (a, b) => +(a >= b) });
    const out = cmp();
    if (i < toks.length) throw new Error(`formula "${text}": unexpected ${toks[i]}`);
    return out;
  }

  /* ---------- track: smooth closed centre line with helper functions ---------- */
  function buildTrack(t) {
    const P = t.points, n = P.length, closed = t.closed !== false, pts = [];
    const at = k => closed ? P[(k % n + n) % n] : P[Math.min(n - 1, Math.max(0, k))];
    for (let k = 0; k < (closed ? n : n - 1); k++) {
      const p0 = at(k - 1), p1 = at(k), p2 = at(k + 1), p3 = at(k + 2), m = Math.max(4, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.5));
      for (let j = 0; j < m; j++) {
        const u = j / m, u2 = u * u, u3 = u2 * u;
        pts.push([0, 1].map(d => 0.5 * (2 * p1[d] + (p2[d] - p0[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * u3)));
      }
    }
    const N = pts.length, w = k => (k % N + N) % N, len = [], th = [], raw = [];
    for (let k = 0; k < N; k++) {
      const a = pts[w(k - 1)], b = pts[k], c = pts[w(k + 1)];
      len.push(Math.hypot(c[0] - b[0], c[1] - b[1])); th.push(Math.atan2(c[1] - a[1], c[0] - a[0]));
      const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      raw.push(2 * cr / ((Math.hypot(b[0] - a[0], b[1] - a[1]) * len[k] * Math.hypot(c[0] - a[0], c[1] - a[1])) || 1));
    }
    const kap = raw.map((_, k) => { let s = 0; for (let d = -3; d <= 3; d++) s += raw[w(k + d)]; return s / 7; });
    return { pts, N, w, len, th, kap, width: t.width || 8, total: len.reduce((a, b) => a + b, 0) };
  }
  function trackFns(T, ctx) {
    const d2 = k => { const p = T.pts[k]; return (p[0] - ctx.S.x) ** 2 + (p[1] - ctx.S.y) ** 2; };
    ctx.near = all => {
      let best = ctx.i, bd = Infinity;
      for (let j = all ? 0 : -12; j < (all ? T.N : 48); j++) { const k = T.w(ctx.i + j), d = d2(k); if (d < bd) { bd = d; best = k; } }
      return best;
    };
    const ahead = (dist, visit) => { let k = ctx.near(), acc = 0, guard = 0; while (acc < dist && guard++ < T.N) { if (visit) visit(k); acc += T.len[k]; k = T.w(k + 1); } return k; };
    return {
      // steering angle that aims the car at a point `look` metres ahead on the centre line (pure pursuit)
      pursuit: (look, wheelbase) => {
        const p = T.pts[ahead(look)], dx = p[0] - ctx.S.x, dy = p[1] - ctx.S.y;
        ctx.target = p;
        return Math.atan(2 * wheelbase * Math.sin(FN.wrap(Math.atan2(dy, dx) - ctx.S.psi)) / Math.max(Math.hypot(dx, dy), 0.5));
      },
      kappa: dist => T.kap[ahead(dist || 0)],                                  // signed curvature (1/m) `dist` metres ahead
      kappa_max: dist => { let m = 0; ahead(dist, k => { m = Math.max(m, Math.abs(T.kap[k])); }); return m; },   // tightest curvature within `dist`
      offset: () => { const k = ctx.near(), p = T.pts[k]; return -Math.sin(T.th[k]) * (ctx.S.x - p[0]) + Math.cos(T.th[k]) * (ctx.S.y - p[1]); },
      progress: () => ctx.near() / T.N
    };
  }

  /* ---------- sim: equations integrated live, with a linked track view, diagram and gauges ---------- */
  function drawSim(spec, host, st) {
    if (st.stop) st.stop();
    const model = spec.model || {}, T = spec.track ? buildTrack(spec.track) : null, ctx = { S: null, i: 0, target: null };
    const fns = Object.assign({}, FN, T ? trackFns(T, ctx) : {});
    const comp = o => Object.entries(o || {}).map(([k, e]) => [k, compile(e, fns), String(e)]);
    const derived = comp(model.derived), derivs = comp(model.derivatives), keys = derivs.map(d => d[0]);
    const ctrl = st.ctrl || (st.ctrl = {});
    (model.controls || []).forEach(c => { if (!(c.name in ctrl)) ctrl[c.name] = c.value; });
    const init = () => { const s = Object.assign({}, model.state); if (T && spec.track.start !== false) { s.x = T.pts[0][0]; s.y = T.pts[0][1]; s.psi = T.th[0]; } return s; };
    const state = st.simState || (st.simState = init());
    const S = Object.assign({ pi: Math.PI, t: st.simT || 0 }, model.params); ctx.S = S;
    const load = v => { keys.forEach((k, j) => { S[k] = v[j]; }); Object.assign(S, ctrl); derived.forEach(d => { S[d[0]] = d[1](S); }); };
    const f = v => { load(v); return derivs.map(d => d[1](S)); };
    const h = spec.dt || 1 / 120;
    const step = () => {                   // classic fourth-order Runge-Kutta
      const y = keys.map(k => state[k]), k1 = f(y), k2 = f(y.map((v, j) => v + h / 2 * k1[j])), k3 = f(y.map((v, j) => v + h / 2 * k2[j])), k4 = f(y.map((v, j) => v + h * k3[j]));
      keys.forEach((k, j) => { state[k] = y[j] + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]); });
      load(keys.map(k => state[k]));
      if (T) ctx.i = ctx.near();
      S.t += h; st.simT = S.t;
    };
    load(keys.map(k => state[k])); if (T) ctx.i = ctx.near(true);

    // ----- page structure
    const div = (cls, parent, text) => { const d = document.createElement('div'); d.className = cls; if (text != null) d.textContent = text; (parent || host).appendChild(d); return d; };
    const root = div('sim'), bar = div('sim-bar', root);
    const btn = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sim-btn'; b.textContent = label; b.onclick = fn; bar.appendChild(b); return b; };
    let playing = st.playing != null ? st.playing : !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const playBtn = btn(playing ? 'Pause' : 'Play', () => { playing = st.playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play'; });
    btn('Reset', () => { Object.assign(state, init()); S.t = 0; trail.length = 0; laps.last = laps.best = null; laps.start = 0; laps.first = true; traces.forEach(t => { t.buf.length = 0; }); load(keys.map(k => state[k])); if (T) ctx.i = ctx.near(true); draw(true); });
    const sliders = div('sim-sliders', root);
    (model.controls || []).forEach(c => {
      const lab = document.createElement('label'); lab.className = 'sim-slider';
      const nm = document.createElement('span'); nm.textContent = c.label || c.name;
      const inp = document.createElement('input'); inp.type = 'range'; inp.min = c.min; inp.max = c.max; inp.step = c.step || (c.max - c.min) / 100; inp.value = ctrl[c.name];
      const out = document.createElement('output'), show = () => { out.textContent = fmt(+ctrl[c.name]) + (c.unit ? ' ' + c.unit : ''); };
      inp.oninput = () => { ctrl[c.name] = +inp.value; show(); if (!playing) { load(keys.map(k => state[k])); draw(true); } };
      show(); lab.append(nm, inp, out); sliders.appendChild(lab);
    });
    const warnEl = div('sim-warn', root);
    const warns = (spec.warnings || []).map(w => ({ when: compile(w.when, fns), text: w.text }));

    // ----- track view
    const trail = [], laps = st.laps || (st.laps = { start: 0, last: null, best: null, first: true });
    let tv = null;
    if (T) {
      const xs = T.pts.map(p => p[0]), ys = T.pts.map(p => p[1]), mg = T.width / 2 + 4;
      const x0 = Math.min(...xs) - mg, x1 = Math.max(...xs) + mg, y0 = Math.min(...ys) - mg, y1 = Math.max(...ys) + mg;
      const sc = W / (x1 - x0), H = (y1 - y0) * sc, P = p => [(p[0] - x0) * sc, (y1 - p[1]) * sc];
      const svg = el('svg', { viewBox: `0 0 ${W} ${H.toFixed(0)}`, role: 'img', 'aria-label': 'Top view of the car driving the track' }, div('sim-track', root));
      const line = T.pts.concat([T.pts[0]]).map(p => P(p).map(v => v.toFixed(1)).join(',')).join(' ');
      el('polyline', { points: line, class: 'trk-edge', 'stroke-width': T.width * sc + 2 }, svg);
      el('polyline', { points: line, class: 'trk-road', 'stroke-width': T.width * sc }, svg);
      el('polyline', { points: line, class: 'trk-mid' }, svg);
      const s0 = P(T.pts[0]), nx = -Math.sin(T.th[0]) * T.width / 2 * sc, ny = -Math.cos(T.th[0]) * T.width / 2 * sc;
      el('line', { x1: s0[0] - nx, y1: s0[1] - ny, x2: s0[0] + nx, y2: s0[1] + ny, class: 'trk-start' }, svg);
      const tr = el('polyline', { class: 'sim-trail' }, svg), ov = el('path', { class: 'sim-over' }, svg), tg = el('circle', { r: 3, class: 'sim-target' }, svg);
      const k = (spec.car_scale || 1.6) * sc, lf = S.lf || 1.2, lr = S.lr || 1.4, cw = 1.9 * k, car = el('g', {}, svg), wheels = [];
      [[lf, 1], [lf, -1], [-lr, 1], [-lr, -1]].forEach(([wx, side]) => {
        const g = el('g', { transform: `translate(${(wx * k).toFixed(1)},${(side * cw / 2).toFixed(1)})` }, car);
        wheels.push(el('rect', { x: -0.42 * k, y: -0.16 * k, width: 0.84 * k, height: 0.32 * k, class: 'car-wheel' }, g));
      });
      const body = el('rect', { x: -(lr + 0.75) * k, y: -cw / 2 + 0.12 * k, width: (lf + lr + 1.5) * k, height: cw - 0.24 * k, rx: 0.3 * k, class: 'car-body' }, car);
      tv = { P, tr, ov, tg, car, wheels, body };
    }

    // ----- linked diagram, readouts, traces, equations
    const row = div('sim-row', root), dia = spec.diagram ? div('sim-diagram', row) : null, side = div('sim-side', row);
    const exprCache = {};
    const resolve = node => {
      if (Array.isArray(node)) return node.map(resolve);
      if (node && typeof node === 'object') { const o = {}; for (const k in node) o[k] = resolve(node[k]); return o; }
      if (typeof node === 'string' && node[0] === '=') return (exprCache[node] || (exprCache[node] = compile(node.slice(1), fns)))(S);
      return node;
    };
    const readouts = (spec.readouts || []).map(r => {
      const line = div('sim-read', side), top = div('sim-read-top', line);
      div('sim-read-name', top, r.label); const val = div('sim-read-val', top);
      const o = { r, val, f: compile(r.expr, fns), limit: r.limit != null ? compile(r.limit, fns) : null };
      if (o.limit || r.max) { const m = div('sim-meter', line); o.fill = div('sim-meter-fill', m); if (o.limit) o.tick = div('sim-meter-tick', m); }
      return o;
    });
    const lapEl = T ? div('sim-lap', side) : null;
    const traces = (spec.traces || []).map(t => {
      const wrap = div('sim-trace', side); div('sim-read-name', wrap, t.label);
      const svg = el('svg', { viewBox: '0 0 300 64', preserveAspectRatio: 'none' }, wrap);
      el('line', { x1: 0, x2: 300, y1: 63, y2: 63, class: 'g-grid' }, svg);
      return { t, f: compile(t.expr, fns), limit: t.limit != null ? compile(t.limit, fns) : null, buf: st['buf' + t.label] || (st['buf' + t.label] = []),
               lim: el('line', { x1: 0, x2: 300, class: 'g-dash' }, svg), line: el('polyline', { class: 'ln hl', 'vector-effect': 'non-scaling-stroke' }, svg) };
    });
    let eqVals = [];
    if (spec.equations !== false) {
      const det = document.createElement('details'); det.className = 'sim-eq'; det.open = spec.equations !== 'closed';
      const sum = document.createElement('summary'); sum.textContent = 'The equations being integrated, with their current values'; det.appendChild(sum);
      const add = (lhs, src, get) => { const r = div('sim-eq-row', det); div('sim-eq-lhs', r, lhs); div('sim-eq-rhs', r, '= ' + src); eqVals.push([div('sim-eq-val', r), get]); };
      derived.forEach(d => add(d[0], d[2], () => S[d[0]]));
      derivs.forEach(d => add(`d${d[0]}/dt`, d[2], () => d[1](S)));
      root.appendChild(det);
    }

    // ----- drawing
    let frame = 0, lastI = ctx.i, sampleT = S.t, trailT = S.t;
    const sample = () => {
      if (T) {
        const over = warns.length ? !!warns[0].when(S) : false;
        if (S.t - trailT >= 0.04) { trailT = S.t; trail.push([state.x, state.y, over]); if (trail.length > 1200) trail.shift(); }
        if (lastI > T.N * 0.8 && ctx.i < T.N * 0.2) { const lt = S.t - laps.start; if (!laps.first) { laps.last = lt; laps.best = laps.best == null ? lt : Math.min(laps.best, lt); } laps.first = false; laps.start = S.t; }
        lastI = ctx.i;
      }
      if (S.t - sampleT >= 0.05) { sampleT = S.t; traces.forEach(t => { t.buf.push(t.f(S)); if (t.buf.length > 400) t.buf.shift(); }); }
    };
    const draw = force => {
      frame++;
      if (tv) {
        const c = tv.P([state.x, state.y]);
        tv.car.setAttribute('transform', `translate(${c[0].toFixed(1)},${c[1].toFixed(1)}) rotate(${(-FN.deg(state.psi)).toFixed(1)})`);
        tv.wheels.slice(0, 2).forEach(wh => wh.setAttribute('transform', `rotate(${(-FN.deg(S.delta || 0)).toFixed(1)})`));
        if (ctx.target) { const q = tv.P(ctx.target); tv.tg.setAttribute('cx', q[0]); tv.tg.setAttribute('cy', q[1]); }
        let pl = '', ovd = '';
        trail.forEach((p, j) => { const q = tv.P(p), s = q[0].toFixed(1) + ',' + q[1].toFixed(1); pl += s + ' '; if (p[2] && j) { const a = tv.P(trail[j - 1]); ovd += `M${a[0].toFixed(1)},${a[1].toFixed(1)}L${s}`; } });
        tv.tr.setAttribute('points', pl); tv.ov.setAttribute('d', ovd);
      }
      const hot = warns.find(w => w.when(S));
      warnEl.textContent = hot ? hot.text : (spec.ok_text || '');
      warnEl.classList.toggle('on', !!hot);
      if (tv) tv.body.classList.toggle('hot', !!hot);
      if (force || frame % 3 === 0) {
        readouts.forEach(o => {
          const v = o.f(S), lim = o.limit ? o.limit(S) : null, max = o.r.max || lim * 1.8;
          o.val.textContent = v.toFixed(o.r.digits != null ? o.r.digits : 1) + (o.r.unit ? ' ' + o.r.unit : '');
          if (o.fill) { o.fill.style.width = Math.min(100, Math.abs(v) / max * 100) + '%'; const hotv = lim != null && Math.abs(v) > lim; o.fill.classList.toggle('hot', hotv); o.val.classList.toggle('hot', hotv); if (o.tick) o.tick.style.left = Math.min(100, lim / max * 100) + '%'; }
        });
        if (lapEl) lapEl.textContent = 'Lap time: ' + (laps.last == null ? 'timing starts at the line…' : `${laps.last.toFixed(1)} s (best ${laps.best.toFixed(1)} s)`);
        traces.forEach(t => {
          const lim = t.limit ? t.limit(S) : null, max = t.t.max || Math.max(1e-6, ...t.buf, lim || 0) * 1.15, y = v => 63 - Math.min(1, Math.max(0, v / max)) * 60;
          t.line.setAttribute('points', t.buf.map((v, j) => `${(j / 399 * 300).toFixed(1)},${y(v).toFixed(1)}`).join(' '));
          if (lim != null) { t.lim.setAttribute('y1', y(lim)); t.lim.setAttribute('y2', y(lim)); } else t.lim.setAttribute('visibility', 'hidden');
        });
        eqVals.forEach(([node, get]) => { const v = get(); node.textContent = Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(3); });
      }
      if (dia && (force || frame % 2 === 0)) { const keep = W; W = Math.max(240, dia.clientWidth || 300); dia.textContent = ''; drawFrames(resolve(spec.diagram), dia); W = keep; }
    };
    let raf = 0, last = 0, acc = 0, visible = true;
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { visible = es[0].isIntersecting; }) : null;
    if (io) io.observe(host);
    const tick = now => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
      if (!playing || !visible) return;
      acc += dt * (spec.speed || 1);
      while (acc >= h) { step(); acc -= h; sample(); }
      draw();
    };
    st.stop = () => { cancelAnimationFrame(raf); if (io) io.disconnect(); };
    draw(true); raf = requestAnimationFrame(tick);
  }

  /* ---------- shared legend (sits above the chart) ---------- */
  function legend(host, entries) {
    if (!entries.length) return;
    const box = document.createElement('div'); box.className = 'legend';
    entries.forEach(e => {
      const it = document.createElement('span'); it.className = 'legend-item';
      const sw = document.createElement('i'); sw.className = 'legend-sw ' + (e.shape || 'sq') + ' k-' + e.cls;
      it.append(sw, document.createTextNode(e.label)); box.appendChild(it);
    });
    host.appendChild(box);
  }
  const seriesClasses = (keys, hl) => {
    const others = keys.filter(k => String(k) !== String(hl)), out = {};
    keys.forEach(k => { out[k] = String(k) === String(hl) || (hl == null && keys.length === 1) ? 'hl' : (others.length <= 2 ? ['s2', 's3'][others.indexOf(k)] : (others.indexOf(k) < 2 ? ['s2', 's3'][others.indexOf(k)] : 'cx')); });
    return out;
  };

  /* ---------- vbar: grouped vertical bars, optionally as small panels sharing one legend ---------- */
  function drawVbar(spec, host) {
    const rows = spec.rows || [], series = spec.series ? uniq(rows.map(r => String(r[spec.series]))) : [''];
    const hl = spec.highlight != null ? String(spec.highlight) : (spec.series ? series[0] : null), cls = seriesClasses(series, hl);
    if (spec.series) legend(host, series.map(k => ({ label: label(spec.series_label, k), cls: cls[k] })));
    const facets = spec.facet ? uniq(rows.map(r => String(r[spec.facet]))) : [null];
    const cols = Math.max(1, Math.min(spec.columns || 4, facets.length, W < 480 ? 2 : 9));
    const grid = document.createElement('div'); grid.className = 'panels'; grid.style.gridTemplateColumns = `repeat(${cols},minmax(0,1fr))`; host.appendChild(grid);
    const pw = Math.max(150, (W - (cols - 1) * 20) / cols), ph = spec.height || 230;
    const shared = spec.share_y ? domain(rows.map(r => r[spec.y]).concat([0]), false, true, null, spec.ymax) : null;
    facets.forEach(fv => {
      const sub = fv == null ? rows : rows.filter(r => String(r[spec.facet]) === fv), cell = document.createElement('div'); grid.appendChild(cell);
      if (fv != null) { const t = document.createElement('p'); t.className = 'panel-title'; t.textContent = fv; cell.appendChild(t); }
      const yl = spec.ylabel_column && sub[0] ? sub[0][spec.ylabel_column] : spec.ylabel;
      const m = { l: 34, r: 4, t: yl ? 26 : 12, b: spec.x ? 26 : 8 }, svg = el('svg', { viewBox: `0 0 ${pw} ${ph}`, role: 'img' }, cell);
      const hi = r => (r[spec.y] + (spec.err ? (r[spec.err] || 0) : 0)) * 1.08;
      const yd = shared || domain(sub.map(hi).concat([0]), false, true, null, spec.ymax), Y = scale(yd, [ph - m.b, m.t]);
      if (yl) el('text', { x: 0, y: 10, class: 'g-axis' }, svg, yl);
      ticks(yd[0], yd[1], 5).forEach(v => {
        if (v !== 0) el('line', { x1: m.l, x2: pw - m.r, y1: Y(v), y2: Y(v), class: 'g-grid' }, svg);
        el('line', { x1: m.l - 4, x2: m.l, y1: Y(v), y2: Y(v), class: 'g-tk' }, svg); el('text', { x: m.l - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'g-tick' }, svg, fmt(v));
      });
      const cats = spec.x ? uniq(sub.map(r => String(r[spec.x]))) : [''], band = (pw - m.l - m.r) / cats.length;
      const bw = Math.min(22, band * 0.6 / series.length);
      cats.forEach((c, ci) => {
        const cx = m.l + band * (ci + 0.5);
        if (spec.x) el('text', { x: cx, y: ph - m.b + 16, 'text-anchor': 'middle', class: 'g-tick' }, svg, c);
        series.forEach((k, si) => {
          const r = sub.find(q => (!spec.x || String(q[spec.x]) === c) && (!spec.series || String(q[spec.series]) === k));
          if (!r || typeof r[spec.y] !== 'number') return;
          const x = cx + (si - series.length / 2) * (bw + 3) + 1.5, v = r[spec.y];
          const rc = el('rect', { x, y: Math.min(Y(v), Y(0)), width: bw, height: Math.abs(Y(v) - Y(0)), class: 'f-' + cls[k] }, svg);
          el('title', {}, rc, `${k ? label(spec.series_label, k) + ': ' : ''}${fmt(v)}${spec.unit || ''}`);
          let top = Y(v);
          if (spec.err && r[spec.err]) { el('line', { x1: x + bw / 2, x2: x + bw / 2, y1: Y(v - r[spec.err]), y2: Y(v + r[spec.err]), stroke: 'var(--ink)', 'stroke-width': 1.5 }, svg); top = Y(v + r[spec.err]); }
          if (spec.labels !== false) el('text', { x: x + bw / 2, y: top - 5, 'text-anchor': 'middle', class: 'g-lab' + (cls[k] === 'hl' ? ' t-hl' : '') }, svg, fmt(v) + (spec.unit || ''));
        });
      });
      el('line', { x1: m.l, x2: pw - m.r, y1: Y(0), y2: Y(0), class: 'g-base' }, svg); el('line', { x1: m.l, x2: m.l, y1: m.t, y2: Y(yd[0]), class: 'g-spine' }, svg);
    });
  }

  /* ---------- plane: 2-D geometry from formulas and data, with sliders ----------
     Marks are drawn in order in data coordinates. Plain-string formulas see the slider values,
     plus t (curves), x and y (fields) or the row's columns (data marks). */
  function drawPlane(spec, host, st, S) {
    const VW = spec.width || 656, xr = spec.xrange || [0, 1], yr = spec.yrange || [0, 1], ax = spec.axes !== false;
    const m = Object.assign({ l: ax ? 46 : 8, r: 12, t: ax ? (spec.flip_y ? 44 : (spec.ylabel ? 30 : 12)) : 8, b: ax ? (spec.flip_y ? 14 : 40) : 8 }, spec.margin || {});
    const H = spec.equal ? m.t + m.b + (VW - m.l - m.r) * (yr[1] - yr[0]) / (xr[1] - xr[0]) : (spec.height || 340);
    const X = v => m.l + (v - xr[0]) / (xr[1] - xr[0]) * (VW - m.l - m.r);
    const Y = v => spec.flip_y ? m.t + (v - yr[0]) / (yr[1] - yr[0]) * (H - m.t - m.b) : H - m.b - (v - yr[0]) / (yr[1] - yr[0]) * (H - m.t - m.b);
    const cc = {}, F = src => cc[src] || (cc[src] = compile(String(src), FN));
    const val = (v, sc) => typeof v === 'number' ? v : (v == null ? v : F(v)(sc || S));
    const row = r => Object.assign(Object.create(S), r);
    const cls = (c, base) => (base || '') + ' ' + String(c || 'ink').split(/\s+/).map(k => 'pl-' + k).join(' ');
    const pick = (mk, sc) => mk.cls_if ? (val(mk.cls_if.expr, sc) ? mk.cls_if.true : mk.cls_if.false) : mk.cls;
    const tip = (tpl, sc) => tpl ? String(tpl).replace(/\{([^}]+)\}/g, (_, e) => { const v = val(e, sc); return typeof v === 'number' ? fmt(v) : v; }) : null;
    (spec.sums || []).forEach(q => { let a = 0; (q.rows || []).forEach(r => { const sc = row(r); if (q.filter == null || val(q.filter, sc)) a += val(q.expr, sc); }); S[q.name] = a; });
    Object.entries(spec.after || {}).forEach(([k2, e]) => { S[k2] = F(e)(S); });
    if (spec.legend) legend(host, spec.legend);
    const svg = el('svg', { viewBox: `0 0 ${VW} ${H}`, role: 'img', class: 'plane' }, host);
    if (spec.max_width) { svg.style.maxWidth = spec.max_width + 'px'; svg.style.display = 'block'; svg.style.margin = '0 auto'; }
    const id = 'pc' + Math.random().toString(36).slice(2, 8), cp = el('clipPath', { id }, el('defs', {}, svg));
    el('rect', { x: m.l, y: m.t, width: VW - m.l - m.r, height: H - m.t - m.b }, cp);
    const mk = el('defs', {}, svg); ['ink', 'hl', 'muted'].forEach(c => { const q = el('marker', { id: id + c, viewBox: '0 0 8 8', refX: 7.5, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto', markerUnits: 'userSpaceOnUse' }, mk); el('path', { d: 'M0,0 L8,4 L0,8 z', class: 'pl-ah pl-' + c }, q); });
    if (ax) {
      const tx = ticks(xr[0], xr[1], spec.xticks || 6), ty = ticks(yr[0], yr[1], spec.yticks || 5);
      if (spec.grid !== false) { tx.forEach(v => el('line', { x1: X(v), x2: X(v), y1: m.t, y2: H - m.b, class: 'g-grid' }, svg)); ty.forEach(v => el('line', { x1: m.l, x2: VW - m.r, y1: Y(v), y2: Y(v), class: 'g-grid' }, svg)); }
      const yb = spec.flip_y ? m.t : H - m.b;
      el('line', { x1: m.l, x2: VW - m.r, y1: yb, y2: yb, class: 'g-base' }, svg); el('line', { x1: m.l, x2: m.l, y1: m.t, y2: H - m.b, class: 'g-spine' }, svg);
      tx.forEach(v => { el('line', { x1: X(v), x2: X(v), y1: yb, y2: yb + (spec.flip_y ? -4 : 4), class: 'g-tk' }, svg); el('text', { x: X(v), y: spec.flip_y ? yb - 7 : yb + 15, 'text-anchor': 'middle', class: 'g-tick' }, svg, fmt(v)); });
      ty.forEach(v => { el('line', { x1: m.l - 4, x2: m.l, y1: Y(v), y2: Y(v), class: 'g-tk' }, svg); el('text', { x: m.l - 7, y: Y(v) + 4, 'text-anchor': 'end', class: 'g-tick' }, svg, fmt(v)); });
      if (spec.xlabel) mathNode(svg, spec.xlabel, (m.l + VW - m.r) / 2, spec.flip_y ? 11 : H - 9, 14);
      if (spec.ylabel) mathNode(svg, spec.ylabel, 6, spec.flip_y ? H - 8 : 12, 14, '', 'start');
    }
    const g = el('g', { 'clip-path': spec.clip === false ? null : `url(#${id})` }, svg), top = el('g', {}, svg);
    const pathOf = pts => pts.filter(p => isFinite(p[0]) && isFinite(p[1])).map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join('');
    const label = (q, px, py, sc) => {
      if (!q.label) return;
      const o = q.label_off || [10, -10];
      mathNode(top, String(q.label), px + o[0], py + o[1], q.label_size || 14, q.label_cls || (String(pick(q, sc) || '').includes('hl') ? 'hl' : ''), q.label_anchor);
    };
    const dot = (q, x, y, sc, tg) => { const G = tg || g;
      const px = X(x), py = Y(y), sz = val(q.size, sc) || 3.2, sh = q.shape || 'dot', c = cls(pick(q, sc), 'pt sh-' + sh), t = tip(q.tip, sc), a = t ? { 'data-tip': t } : {};
      if (!isFinite(px) || !isFinite(py)) return;
      if (sh === 'cross') el('path', Object.assign({ d: `M${px - sz},${py - sz}L${px + sz},${py + sz}M${px - sz},${py + sz}L${px + sz},${py - sz}`, class: c }, a), G);
      else if (sh === 'square') el('rect', Object.assign({ x: px - sz, y: py - sz, width: 2 * sz, height: 2 * sz, class: c }, a), G);
      else el('circle', Object.assign({ cx: px, cy: py, r: sz, class: c }, a), G);
      label(q, px, py, sc);
    };
    (spec.marks || []).forEach(q0 => {
      const q = q0; let gg = g;
      if (q.clip_box) { const cid = id + 'b' + Math.random().toString(36).slice(2, 6), b2 = q.clip_box.map(v => val(v)), cpp = el('clipPath', { id: cid }, el('defs', {}, svg));
        el('rect', { x: Math.min(X(b2[0]), X(b2[2])), y: Math.min(Y(b2[1]), Y(b2[3])), width: Math.abs(X(b2[2]) - X(b2[0])), height: Math.abs(Y(b2[3]) - Y(b2[1])) }, cpp); gg = el('g', { 'clip-path': `url(#${cid})` }, gg); }
      const k = q.kind, rows = q.rows || [];
      if (k === 'field') {
        const n = q.res || 64, fz = F(q.f), sc = Object.create(S), vals = [];
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { sc.x = xr[0] + (i + 0.5) / n * (xr[1] - xr[0]); sc.y = yr[0] + (j + 0.5) / n * (yr[1] - yr[0]); let v = fz(sc); if (q.log) v = Math.log(1e-9 + Math.max(0, v)); vals.push([i, j, v]); }
        const vs = vals.map(v => v[2]).filter(isFinite).sort((a, b) => a - b), L = q.levels || 9, lo = vs[0], hi = q.clip_quantile ? vs[Math.floor(vs.length * q.clip_quantile)] : vs[vs.length - 1];
        const cv = document.createElement('canvas'); cv.width = n; cv.height = n; const cx2 = cv.getContext('2d'), im = cx2.createImageData(n, n);
        vals.forEach(([i, j, v]) => { const bnd = Math.max(0, Math.min(L - 1, Math.floor((v - lo) / (hi - lo + 1e-12) * L))), row2 = spec.flip_y ? j : n - 1 - j, o = (row2 * n + i) * 4;
          im.data[o] = 29; im.data[o + 1] = 95; im.data[o + 2] = 209; im.data[o + 3] = Math.round(255 * (0.46 * Math.pow(1 - bnd / (L - 1), 1.3) + 0.02)); });
        cx2.putImageData(im, 0, 0);
        el('image', { href: cv.toDataURL(), x: m.l, y: m.t, width: VW - m.l - m.r, height: H - m.t - m.b, preserveAspectRatio: 'none', class: 'pl-fieldimg' }, gg);
      } else if (k === 'curve') {
        const n = q.n || 160, t0 = val(q.t[0]), t1 = val(q.t[1]), sc = Object.create(S), pts = [];
        for (let i = 0; i <= n; i++) { sc.t = t0 + (t1 - t0) * i / n; pts.push([F(q.x)(sc), F(q.y)(sc)]); }
        el('path', { d: pathOf(pts) + (q.closed ? 'Z' : ''), class: cls(q.cls, 'ln-p'), 'marker-end': q.arrow ? `url(#${id}${String(q.cls || 'ink').split(' ')[0]})` : null }, gg);
      } else if (k === 'path') {
        const upto = q.upto != null ? val(q.upto) : Infinity;
        el('path', { d: pathOf(rows.filter((r, i) => i <= upto).map(r => { const sc = row(r); return [val(q.x, sc), val(q.y, sc)]; })), class: cls(q.cls, 'ln-p') }, gg);
      } else if (k === 'line') {
        const a = [val(q.from[0]), val(q.from[1])], b = [val(q.to[0]), val(q.to[1])], c = String(q.cls || 'ink').split(' ')[0];
        el('line', Object.assign({ x1: X(a[0]), y1: Y(a[1]), x2: X(b[0]), y2: Y(b[1]), class: cls(q.cls, 'ln-p'), 'marker-end': q.arrow ? `url(#${id}${c})` : null }, q.tip ? { 'data-tip': q.tip } : {}), gg);
        const tpos = q.label_pos != null ? q.label_pos : 0.5; label(q, X(a[0] + (b[0] - a[0]) * tpos), Y(a[1] + (b[1] - a[1]) * tpos), S);
      } else if (k === 'segments') {
        rows.forEach(r => { const sc = row(r); if (q.filter != null && !val(q.filter, sc)) return; const t = tip(q.tip, sc); el('line', Object.assign({ x1: X(val(q.x1, sc)), y1: Y(val(q.y1, sc)), x2: X(val(q.x2, sc)), y2: Y(val(q.y2, sc)), class: cls(pick(q, sc), 'ln-p') }, t ? { 'data-tip': t } : {}), gg); });
      } else if (k === 'point') {
        dot(q, val(q.at[0]), val(q.at[1]), S, gg);
      } else if (k === 'points') {
        rows.forEach(r => { const sc = row(r); if (q.filter != null && !val(q.filter, sc)) return; dot(Object.assign({}, q, { label: q.label_col ? r[q.label_col] : q.label }), val(q.x, sc), val(q.y, sc), sc, gg); });
      } else if (k === 'poses') {
        const len = q.len || 0.3;
        rows.forEach(r => { const sc = row(r), x = val(q.x, sc), y = val(q.y, sc), th = val(q.th, sc); el('line', { x1: X(x), y1: Y(y), x2: X(x + len * Math.cos(th)), y2: Y(y + len * Math.sin(th)), class: cls(pick(q, sc), 'ln-p') }, gg); el('circle', { cx: X(x), cy: Y(y), r: q.dot || 1.7, class: cls(pick(q, sc), 'pt sh-dot') }, gg); });
      } else if (k === 'ellipse') {
        const cx = val(q.at[0]), cy = val(q.at[1]), rx = Math.abs(X(val(q.rx)) - X(0)), ry = Math.abs(Y(val(q.ry)) - Y(0)), an = -(val(q.angle) || 0);
        el('ellipse', { cx: X(cx), cy: Y(cy), rx, ry, transform: `rotate(${an} ${X(cx)} ${Y(cy)})`, class: cls(q.cls, 'pg') }, gg);
      } else if (k === 'polygon') {
        el('path', { d: pathOf(q.points.map(p => [val(p[0]), val(p[1])])) + 'Z', class: cls(q.cls, 'pg') }, gg);
      } else if (k === 'rects') {
        rows.forEach(r => { const sc = row(r), x = val(q.x, sc), y = val(q.y, sc), w = val(q.w, sc), h = val(q.h, sc), t = tip(q.tip, sc);
          el('rect', Object.assign({ x: Math.min(X(x), X(x + w)), y: Math.min(Y(y), Y(y + h)), width: Math.abs(X(x + w) - X(x)), height: Math.abs(Y(y + h) - Y(y)), class: cls(q.cls_col ? r[q.cls_col] : pick(q, sc), 'pg') }, t ? { 'data-tip': t } : {}), gg); });
      } else if (k === 'text') {
        const px = X(val(q.at[0])), py = Y(val(q.at[1]));
        if (q.tex) mathNode(top, String(q.tex), px, py, q.size || 14, q.cls || '', q.anchor);
        else el('text', { x: px, y: py + 4, 'text-anchor': q.anchor || 'middle', class: 'pl-text ' + (q.cls ? 'pl-' + q.cls : '') }, top, tip(q.text, S));
      } else if (k === 'solver') {
        // nonlinear least squares in two unknowns: Gauss-Newton or Levenberg-Marquardt, numeric Jacobian
        const rs = q.residuals.map(F), sc = Object.create(S), res = (x, y) => { sc.x = x; sc.y = y; return rs.map(f => f(sc)); };
        const cost = r => r.reduce((a, v) => a + v * v, 0);
        let p = [val(q.start[0]), val(q.start[1])], lam = q.lambda || 1e-2, pts = [p.slice()], it = 0;
        for (; it < (q.iters || 12); it++) {
          const r = res(p[0], p[1]), h = 1e-6, J = r.map(() => [0, 0]);
          [0, 1].forEach(d => { const a = p.slice(), b = p.slice(); a[d] += h; b[d] -= h; const ra = res(a[0], a[1]), rb = res(b[0], b[1]); r.forEach((_, i) => { J[i][d] = (ra[i] - rb[i]) / (2 * h); }); });
          let A = [[0, 0], [0, 0]], gv = [0, 0];
          J.forEach((j, i) => { A[0][0] += j[0] * j[0]; A[0][1] += j[0] * j[1]; A[1][1] += j[1] * j[1]; gv[0] += j[0] * r[i]; gv[1] += j[1] * r[i]; }); A[1][0] = A[0][1];
          const step = l => { const a = A[0][0] * (1 + l), d = A[1][1] * (1 + l), b = A[0][1], det = a * d - b * b; return det === 0 ? [0, 0] : [-(d * gv[0] - b * gv[1]) / det, -(-b * gv[0] + a * gv[1]) / det]; };
          if (q.method === 'lm') {
            let ok = false;
            for (let tries = 0; tries < 12 && !ok; tries++) { const s2 = step(lam), np = [p[0] + s2[0], p[1] + s2[1]]; if (cost(res(np[0], np[1])) < cost(r)) { p = np; lam = Math.max(lam / 10, 1e-9); ok = true; } else lam *= 10; }
            if (!ok) break;
          } else { const s2 = step(0); p = [p[0] + s2[0], p[1] + s2[1]]; }
          pts.push(p.slice());
          if (!isFinite(p[0]) || Math.hypot(pts[pts.length - 1][0] - pts[pts.length - 2][0], pts[pts.length - 1][1] - pts[pts.length - 2][1]) < 1e-7) break;
        }
        el('path', { d: pathOf(pts), class: cls(q.cls, 'ln-p') }, gg);
        pts.forEach((pp, i) => { if (isFinite(X(pp[0]))) el('circle', { cx: X(pp[0]), cy: Y(pp[1]), r: i === pts.length - 1 ? 4 : 2.4, class: cls(q.cls, 'pt sh-' + (i ? 'dot' : 'ring')) }, gg); });
        const nm = q.as || 'sol', fin = pts[pts.length - 1];
        S[nm + '_x'] = fin[0]; S[nm + '_y'] = fin[1]; S[nm + '_cost'] = isFinite(fin[0]) ? cost(res(fin[0], fin[1])) : NaN; S[nm + '_n'] = pts.length - 1;
      }
    });
  }

  /* ---------- sliders + live formulas for frames, scene and warp figures ---------- */
  function interactive(drawFn) {
    return (spec, host, st) => {
      const ctrl = (st.ctl || (st.ctl = {}))[st.view] || (st.ctl[st.view] = {});
      (spec.controls || []).forEach(c => { if (!(c.name in ctrl)) ctrl[c.name] = c.value; });
      const S = { pi: Math.PI }, cache = {}, derived = Object.entries(spec.derived || {}).map(([k, e]) => [k, compile(e, FN)]);
      const refresh = () => { Object.assign(S, spec.params, ctrl); derived.forEach(d => { S[d[0]] = d[1](S); }); };
      const resolve = (node, key) => {
        if (key === 'rows' || key === 'controls' || key === 'derived' || key === 'map' || key === 'readouts' || key === 'after') return node;
        if (Array.isArray(node)) return node.map(n => resolve(n));
        if (node && typeof node === 'object') { const o = {}; for (const k in node) o[k] = resolve(node[k], k); return o; }
        if (typeof node === 'string' && node[0] === '=') return (cache[node] || (cache[node] = compile(node.slice(1), FN)))(S);
        return node;
      };
      const top = document.createElement('div'), canvas = document.createElement('div'), reads = document.createElement('div');
      reads.className = 'fig-reads'; host.append(top, canvas, reads);
      const outs = (spec.readouts || []).map(r => { const d = document.createElement('span'); reads.appendChild(d); return [d, r, compile(r.expr, FN)]; });
      const redraw = () => {
        refresh(); canvas.textContent = '';
        drawFn(resolve(spec), canvas, st, S, redraw);
        outs.forEach(([d, r, f]) => { { const v = f(S); d.textContent = `${r.label}: ${isFinite(v) ? v.toFixed(r.digits != null ? r.digits : 2) : '—'}${r.unit ? ' ' + r.unit : ''}`; } });
      };
      if ((spec.controls || []).length) {
        top.className = 'sim-sliders';
        spec.controls.forEach(c => {
          const lab = document.createElement('label'); lab.className = 'sim-slider';
          const nm = document.createElement('span'); nm.textContent = c.label || c.name;
          const inp = document.createElement('input'); inp.type = 'range'; inp.min = c.min; inp.max = c.max; inp.step = c.step || (c.max - c.min) / 100; inp.value = ctrl[c.name];
          const out = document.createElement('output'), show = () => { out.textContent = fmt(+ctrl[c.name]) + (c.unit ? ' ' + c.unit : ''); };
          inp.oninput = () => { ctrl[c.name] = +inp.value; show(); redraw(); };
          show(); lab.append(nm, inp, out); top.appendChild(lab);
        });
      }
      redraw();
    };
  }

  /* ---------- scene: 3-D frames, cameras, trajectories and landmarks (drag to rotate) ---------- */
  const R3 = {
    mul: (A, B) => A.map((r, i) => B[0].map((_, j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j])),
    vec: (A, v) => A.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]),
    rpy: (r, p, y) => {                      // degrees; R = Rz(yaw) Ry(pitch) Rx(roll)
      const d = Math.PI / 180, cr = Math.cos(r * d), sr = Math.sin(r * d), cp = Math.cos(p * d), sp = Math.sin(p * d), cy = Math.cos(y * d), sy = Math.sin(y * d);
      return [[cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr], [sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr], [-sp, cp * sr, cp * cr]];
    },
    quat: (x, y, z, w) => [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]],
    I: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    B2C: [[0, 0, 1], [-1, 0, 0], [0, -1, 0]]   // body (x forward, z up) to camera (z forward, y down)
  };
  function drawScene(spec, host, st, S, redraw) {
    const defs = {}, cache = {};
    (spec.frames || []).forEach(f => { defs[f.name] = f; });
    const pose = name => {
      if (!name) return { R: R3.I, t: [0, 0, 0] };
      if (cache[name]) return cache[name];
      const f = defs[name]; if (!f) throw new Error('scene: unknown frame "' + name + '"');
      const p = pose(f.parent), rp = f.rpy || [0, 0, 0], at = f.at || [0, 0, 0], tv = R3.vec(p.R, at);
      return (cache[name] = { R: R3.mul(p.R, R3.rpy(rp[0], rp[1], rp[2])), t: [p.t[0] + tv[0], p.t[1] + tv[1], p.t[2] + tv[2]] });
    };
    const local = e => {                    // pose of an item: a named frame, or `in` + `at` + `rpy`
      if (e.frame) return pose(e.frame);
      const p = pose(e.in), rp = e.rpy || [0, 0, 0], tv = R3.vec(p.R, e.at || [0, 0, 0]);
      return { R: R3.mul(p.R, R3.rpy(rp[0], rp[1], rp[2])), t: [p.t[0] + tv[0], p.t[1] + tv[1], p.t[2] + tv[2]] };
    };
    const tf = (p, v) => { const q = R3.vec(p.R, v); return [q[0] + p.t[0], q[1] + p.t[1], q[2] + p.t[2]]; };
    const pt = (e, v) => tf(pose(e.in), v || [0, 0, 0]);
    const ops = [], leg = [];
    const math = (p, tex, cls, off) => tex != null && tex !== '' && ops.push({ k: 'math', p, tex: String(tex), cls, off: off || [10, -10] });
    const frustum = (p, size, fov, cls) => {
      const w = size * Math.tan((fov || 60) * Math.PI / 360), hgt = w * 0.75, c = [[-w, -hgt, size], [w, -hgt, size], [w, hgt, size], [-w, hgt, size]].map(v => tf(p, v));
      c.forEach((q, j) => { ops.push({ k: 'seg', a: p.t, b: q, cls: 'cam ' + cls }, { k: 'seg', a: q, b: c[(j + 1) % 4], cls: 'cam ' + cls }); });
      ops.push({ k: 'dot', p: p.t, cls: cls === 'hl' ? 'f-hl' : 'ah', r: 2.5 });
    };
    if (spec.ground) {
      const g = spec.ground, n = g.size || 4, stp = g.step || 1, z = g.z || 0, c = g.center || [0, 0];
      for (let v = -n; v <= n + 1e-9; v += stp) ops.push({ k: 'seg', a: [c[0] + v, c[1] - n, z], b: [c[0] + v, c[1] + n, z], cls: 'g-grid' }, { k: 'seg', a: [c[0] - n, c[1] + v, z], b: [c[0] + n, c[1] + v, z], cls: 'g-grid' });
    }
    (spec.meshes || []).forEach(e => {
      // a curved surface drawn as a grid of its own coordinate lines
      const p = local(e), T = 2 * Math.PI, sh = e.shape || (e.z && !e.x ? 'surface' : 'param');
      const r = e.radius != null ? e.radius : 1, rr = e.radii || [r, r, r], L = e.length != null ? e.length : 2;
      let f, ur, vr, closed = true, nl = [12, 10];
      if (sh === 'sphere' || sh === 'ellipsoid') { ur = [0, T]; vr = [-Math.PI / 2, Math.PI / 2]; f = (u, v) => [rr[0] * Math.cos(v) * Math.cos(u), rr[1] * Math.cos(v) * Math.sin(u), rr[2] * Math.sin(v)]; nl = [16, 9]; }
      else if (sh === 'cylinder') { ur = [0, T]; vr = [0, L]; f = (u, v) => [r * Math.cos(u), r * Math.sin(u), v]; nl = [16, 7]; }
      else if (sh === 'cone') { ur = [0, T]; vr = [0, L]; f = (u, v) => [r * (1 - v / L) * Math.cos(u), r * (1 - v / L) * Math.sin(u), v]; nl = [16, 7]; }
      else if (sh === 'torus') { const t = e.tube != null ? e.tube : 0.3; ur = [0, T]; vr = [0, T]; f = (u, v) => [(r + t * Math.cos(v)) * Math.cos(u), (r + t * Math.cos(v)) * Math.sin(u), t * Math.sin(v)]; nl = [20, 10]; }
      else if (sh === 'cap') { const ap = (e.aperture != null ? e.aperture : 50) * Math.PI / 180; ur = [0, T]; vr = [0, ap]; f = (u, v) => [r * Math.sin(v) * Math.cos(u), r * Math.sin(v) * Math.sin(u), r * Math.cos(v)]; nl = [16, 6]; closed = false; }
      else if (sh === 'surface') { const fz = compile(String(e.z), FN), sc = Object.assign({}, S); ur = e.x_range || [-1, 1]; vr = e.y_range || [-1, 1]; f = (u, v) => { sc.x = u; sc.y = v; return [u, v, fz(sc)]; }; closed = false; }
      else { const fx = compile(String(e.x), FN), fy = compile(String(e.y), FN), fz = compile(String(e.z), FN), sc = Object.assign({}, S); ur = e.u || [0, 1]; vr = e.v || [0, 1]; f = (u, v) => { sc.u = u; sc.v = v; return [fx(sc), fy(sc), fz(sc)]; }; closed = !!e.closed; }
      if (e.lines) nl = e.lines;
      const res = e.resolution || 40, du = (ur[1] - ur[0]) * 1e-3, dv = (vr[1] - vr[0]) * 1e-3, w = (u, v) => tf(p, f(u, v));
      const wrapU = ['sphere', 'ellipsoid', 'cylinder', 'cone', 'torus', 'cap'].includes(sh), wrapV = sh === 'torus';
      const vert = (u, v) => {
        const q = w(u, v), a = w(u + du, v), b = w(u, v + dv), c = w(u - du, v), d = w(u, v - dv);
        const A = [a[0] - c[0], a[1] - c[1], a[2] - c[2]], B = [b[0] - d[0], b[1] - d[1], b[2] - d[2]];
        return { q, n: [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]] };
      };
      const polys = [], line = (g) => { const vs = []; for (let j = 0; j <= res; j++) vs.push(g(j / res)); polys.push(vs); };
      const nu = nl[0], nv = nl[1];
      for (let i = 0; i < (wrapU ? nu : nu + 1); i++) { const u = ur[0] + (ur[1] - ur[0]) * i / nu; line(t => vert(u, vr[0] + (vr[1] - vr[0]) * t)); }
      for (let i = (sh === 'sphere' || sh === 'ellipsoid' || sh === 'cap') ? 1 : 0; i < (wrapV ? nv : nv + ((sh === 'sphere' || sh === 'ellipsoid' || sh === 'cone') ? 0 : 1)); i++) { const v = vr[0] + (vr[1] - vr[0]) * i / nv; line(t => vert(ur[0] + (ur[1] - ur[0]) * t, v)); }
      ops.push({ k: 'mesh', polys, closed: closed && e.fade !== false, cls: 'mesh' + (e.highlight ? ' hl' : '') + (e.ink ? ' ink' : '') });
      math(tf(p, e.label_at || [0, 0, 0]), e.label, e.highlight ? 'hl' : '', e.label_offset);
    });
    (spec.quads || []).forEach(e => {
      const pts = e.corners.map(v => pt(e, v));
      ops.push({ k: 'polygon', pts, cls: 'sc-quad' + (e.highlight ? ' hl' : '') });
      math(pts[e.label_corner || 0], e.label, '', e.label_offset || [-14, -10]);
    });
    (spec.points || []).forEach(e => {
      if (e.rows) {
        const kx = e.x || 'x', ky = e.y || 'y', kz = e.z || 'z';
        e._pts = e.rows.map(r => [r[kx], r[ky], r[kz] || 0]);
        e._pts.forEach(p => ops.push({ k: 'dot', p, cls: 'lm', r: e.size || 1.8 }));
        if (e.label) leg.push({ label: e.label, cls: 'cx', shape: 'dot' });
      } else {
        const p = pt(e, e.at);
        ops.push({ k: 'dot', p, cls: e.highlight ? 'f-hl' : 'ah', r: e.size || 3.5 });
        math(p, e.label, e.highlight ? 'hl' : '', e.label_offset);
      }
    });
    (spec.lines || []).forEach(e => {
      const a = pt(e, e.from), b = pt(e, e.to), cls = e.highlight ? 'hl' : '';
      ops.push({ k: 'seg', a, b, cls: e.dashed ? 'g-dash' : 'sc-line ' + cls, arrow: e.arrow ? (e.dashed ? 'aux' : cls) : null });
      math([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], e.label, e.dashed ? 'aux' : cls, e.label_offset || [8, -10]);
    });
    (spec.trajectories || []).forEach((e, ti) => {
      const kx = e.x || 'x', ky = e.y || 'y', kz = e.z || 'z', rows = e.rows || [];
      const cls = e.highlight ? 'hl' : (e.dashed ? 'dash' : 's2');
      e._poses = rows.map(r => {
        let R = 'qw' in r ? R3.quat(r.qx, r.qy, r.qz, r.qw) : R3.rpy(r.roll || 0, r.pitch || 0, r.yaw || 0);
        if ((e.forward || 'x') === 'x') R = R3.mul(R, R3.B2C);
        return { R, t: [r[kx], r[ky], r[kz] || 0] };
      });
      const upto = e.upto != null ? Math.max(1, Math.round(e.upto) + 1) : rows.length;
      ops.push({ k: 'poly', pts: e._poses.slice(0, upto).map(p => p.t), cls: cls === 'dash' ? 'g-dash' : 'ln ' + cls });
      if (e.cameras_every) e._poses.slice(0, upto).forEach((p, j) => { if (j % e.cameras_every === 0) frustum(p, e.camera_size || 0.3, e.fov, cls === 'hl' ? 'hl' : ''); });
      if (e.label) leg.push({ label: e.label, cls: cls === 'dash' ? 'ink' : cls, shape: cls === 'dash' ? 'dash' : 'ln' });
    });
    if (spec.observations) {
      const o = spec.observations, tr = (spec.trajectories || [])[o.trajectory || 0], cloud = (spec.points || []).filter(p => p._pts)[o.points || 0];
      const p = tr && tr._poses[Math.max(0, Math.min(tr._poses.length - 1, Math.round(o.index || 0)))];
      if (p && cloud) {
        const half = (o.fov || 70) * Math.PI / 360, zax = [p.R[0][2], p.R[1][2], p.R[2][2]];
        cloud._pts.forEach(q => {
          const d = [q[0] - p.t[0], q[1] - p.t[1], q[2] - p.t[2]], dist = Math.hypot(d[0], d[1], d[2]);
          if (dist < (o.range || 6) && Math.acos((d[0] * zax[0] + d[1] * zax[1] + d[2] * zax[2]) / (dist || 1)) < half) { ops.push({ k: 'seg', a: p.t, b: q, cls: 'obs' }, { k: 'dot', p: q, cls: 'f-hl', r: 2.6 }); }
        });
        frustum(p, o.camera_size || 0.55, o.fov, 'hl');
        if (o.label) leg.push({ label: o.label, cls: 'hl', shape: 'dot' });
      }
    }
    (spec.cameras || []).forEach(e => {
      const p = local(e), cls = e.highlight ? 'hl' : '';
      frustum(p, e.size || 0.6, e.fov, cls);
      math(p.t, e.label, cls, e.label_offset || [-14, 14]);
    });
    (spec.frames || []).forEach(f => {
      if (f.axes === false) return;
      const p = pose(f.name), L = f.length != null ? f.length : 1, cls = f.highlight ? 'hl' : '', lab = f.labels === false ? [] : (f.labels || ['x', 'y', 'z']);
      R3.I.forEach((ax, j) => {
        const tip = tf(p, ax.map(v => v * L));
        ops.push({ k: 'seg', a: p.t, b: tip, cls: 'fr-ax ' + cls, arrow: cls, labelTip: lab[j], lcls: cls });
      });
      ops.push({ k: 'dot', p: p.t, cls: cls ? 'f-hl' : 'ah', r: 3 });
      math(p.t, f.label, cls, f.label_offset || [-16, 16]);
    });
    (spec.arcs || []).forEach(e => {
      const p = local(e), r = e.radius || 0.5, ax = { x: 0, y: 1, z: 2 }[e.axis || 'z'], u = (ax + 1) % 3, v = (ax + 2) % 3, pts = [], cls = e.highlight ? 'hl' : '';
      for (let j = 0; j <= 28; j++) { const a = ((e.from || 0) + ((e.to || 0) - (e.from || 0)) * j / 28) * Math.PI / 180, q = [0, 0, 0]; q[u] = r * Math.cos(a); q[v] = r * Math.sin(a); pts.push(tf(p, q)); }
      ops.push({ k: 'poly', pts, cls: 'fr-arc ' + cls, arrow: cls });
      math(pts[14], e.label, cls, e.label_offset || [10, -8]);
    });
    (spec.vectors || []).forEach(e => {
      const a = pt(e, e.from), b = pt(e, e.to), cls = e.highlight ? 'hl' : '';
      ops.push({ k: 'seg', a, b, cls: 'fr-vec ' + cls, arrow: cls, labelTip: e.label, lcls: cls });
    });

    // orthographic view, fitted to a bounding sphere so the scale stays put while rotating
    const view = st.view3 || (st.view3 = { az: (spec.view && spec.view.azimuth) != null ? spec.view.azimuth : -55, el: (spec.view && spec.view.elevation) != null ? spec.view.elevation : 22 });
    const all = []; ops.forEach(o => { if (o.polys) o.polys.forEach(pl => pl.forEach(v => all.push(v.q))); if (o.pts) all.push(...o.pts); if (o.a) all.push(o.a, o.b); if (o.p) all.push(o.p); });
    const mn = [0, 1, 2].map(d => Math.min(...all.map(q => q[d]))), mx = [0, 1, 2].map(d => Math.max(...all.map(q => q[d])));
    const ctr = spec.center || mn.map((v, d) => (v + mx[d]) / 2), rad = spec.radius || Math.max(...all.map(q => Math.hypot(q[0] - ctr[0], q[1] - ctr[1], q[2] - ctr[2]))) || 1;
    const H = Math.min(spec.height || 400, W * 0.78), pad = 30, sc = (Math.min(W, H) - 2 * pad) / (2 * rad) * (spec.zoom || 1);
    const a = view.az * Math.PI / 180, e = view.el * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), ce = Math.cos(e), se = Math.sin(e);
    const P = q => { const x = q[0] - ctr[0], y = q[1] - ctr[1], z = q[2] - ctr[2]; return [W / 2 + (-x * sa + y * ca) * sc, H / 2 - (-x * ca * se - y * sa * se + z * ce) * sc]; };
    const Sx = q => P(q).map(v => v.toFixed(1)).join(',');
    if (leg.length) legend(host, leg);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H.toFixed(0)}`, role: 'img', class: 'scene' }, host);
    const mdefs = el('defs', {}, svg), uid = 'c' + Math.random().toString(36).slice(2, 8);
    ['', 'hl', 'aux'].forEach(c => { const mk = el('marker', { id: uid + c, viewBox: '0 0 8 8', refX: 7.5, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto', markerUnits: 'userSpaceOnUse' }, mdefs); el('path', { d: 'M0,0 L8,4 L0,8 z', class: 'ah ' + c }, mk); });
    const wv = [ca * ce, sa * ce, se];      // direction towards the viewer
    ops.filter(o => o.k === 'mesh').forEach(o => {
      const runs = { back: [], front: [] };
      o.polys.forEach(pl => {
        let cur = null, side = null;
        pl.forEach((v, j) => {
          const fr = !o.closed || (v.n[0] * wv[0] + v.n[1] * wv[1] + v.n[2] * wv[2]) >= 0, sd = fr ? 'front' : 'back';
          if (sd !== side) { if (cur) cur.push(Sx(v.q)); cur = []; runs[sd].push(cur); side = sd; }
          cur.push(Sx(v.q));
        });
      });
      ['back', 'front'].forEach(sd => { if (runs[sd].length) el('path', { d: runs[sd].filter(r => r.length > 1).map(r => 'M' + r.join('L')).join(''), class: o.cls + (sd === 'back' ? ' back' : '') }, svg); });
    });
    ops.forEach(o => {
      const mark = o.arrow != null ? { 'marker-end': `url(#${uid}${o.arrow})` } : {};
      if (o.k === 'polygon') el('polygon', { points: o.pts.map(Sx).join(' '), class: o.cls }, svg);
      else if (o.k === 'seg') {
        el('polyline', Object.assign({ points: Sx(o.a) + ' ' + Sx(o.b), class: o.cls }, mark), svg);
        if (o.labelTip) { const pa = P(o.a), pb = P(o.b), dx = pb[0] - pa[0], dy = pb[1] - pa[1], l = Math.hypot(dx, dy) || 1; mathNode(svg, String(o.labelTip), pb[0] + dx / l * 13, pb[1] + dy / l * 13, 14, o.lcls); }
      }
      else if (o.k === 'poly') el('polyline', Object.assign({ points: o.pts.map(Sx).join(' '), class: o.cls }, mark), svg);
      else if (o.k === 'dot') { const c = P(o.p); el('circle', { cx: c[0].toFixed(1), cy: c[1].toFixed(1), r: o.r || 3, class: o.cls }, svg); }
    });
    ops.filter(o => o.k === 'math').forEach(o => { const c = P(o.p); mathNode(svg, o.tex, c[0] + o.off[0], c[1] - o.off[1], 15, o.cls); });
    if (spec.rotate !== false && redraw) {
      el('text', { x: 0, y: H - 4, class: 'g-tick' }, svg, 'drag to rotate');
      svg.addEventListener('pointerdown', ev => {
        const x0 = ev.clientX, y0 = ev.clientY, az0 = view.az, el0 = view.el; ev.preventDefault();
        const move = m => { view.az = az0 - (m.clientX - x0) * 0.5; view.el = Math.max(-89, Math.min(89, el0 + (m.clientY - y0) * 0.5)); redraw(); };
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
      });
    }
  }

  /* ---------- warp: how a formula bends a grid (lens distortion and other 2-D maps) ---------- */
  function drawWarp(spec, host, st, S) {
    const m = spec.map || {}, lets = Object.entries(m.let || {}).map(([k, e]) => [k, compile(e, FN)]), fx = compile(m.x, FN), fy = compile(m.y, FN);
    const sc0 = Object.assign({}, S), ext = spec.extent || 1, n = spec.lines || 11;
    const f = (x, y) => { sc0.x = x; sc0.y = y; sc0.r = Math.hypot(x, y); lets.forEach(l => { sc0[l[0]] = l[1](sc0); }); return [fx(sc0), fy(sc0)]; };
    const side = Math.min(300, W < 520 ? W : W * 0.46), stacked = W < 520, H = stacked ? side * 2 + 30 : side, view = (spec.view_extent || ext * 1.25), pad = 6;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H.toFixed(0)}`, role: 'img' }, host);
    const X = x => pad + (x + view) / (2 * view) * (side - 2 * pad), Y = y => pad + (y + view) / (2 * view) * (side - 2 * pad);   // image convention: y down
    const cid = 'w' + Math.random().toString(36).slice(2, 8);
    el('rect', { x: 0, y: 0, width: side, height: side }, el('clipPath', { id: cid }, el('defs', {}, svg)));
    el('rect', { x: 0.5, y: 0.5, width: side - 1, height: side - 1, class: 'warp-box' }, svg);
    const g = el('g', { 'clip-path': `url(#${cid})` }, svg);
    const grid = (fn, cls) => {
      for (let i = 0; i < n; i++) {
        const c = -ext + 2 * ext * i / (n - 1), a = [], b = [];
        for (let j = 0; j <= 48; j++) { const t = -ext + 2 * ext * j / 48, p = fn(c, t), q = fn(t, c); a.push(X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)); b.push(X(q[0]).toFixed(1) + ',' + Y(q[1]).toFixed(1)); }
        el('polyline', { points: a.join(' '), class: cls }, g); el('polyline', { points: b.join(' '), class: cls }, g);
      }
    };
    grid((x, y) => [x, y], 'warp-ref'); grid(f, 'warp-out');
    el('circle', { cx: X(0), cy: Y(0), r: 2.5, class: 'ah' }, g);
    // radial profile: distorted radius against ideal radius
    const ox = stacked ? 0 : side + 40, oy = stacked ? side + 30 : 0, pw = (stacked ? W : W - side - 40), ph = side, mm = { l: 40, r: 8, t: 22, b: 34 }, rmax = ext * Math.SQRT2;
    const prof = []; let dmax = rmax;
    for (let j = 0; j <= 60; j++) { const r = rmax * j / 60, p = f(r, 0), d = Math.hypot(p[0], p[1]); if (isFinite(d)) { prof.push([r, d]); dmax = Math.max(dmax, d); } }
    const xd = [0, Math.ceil(rmax * 10) / 10], yd = domain([0, Math.min(dmax, rmax * 2)], false, true), PX = scale(xd, [ox + mm.l, ox + pw - mm.r]), PY = scale(yd, [oy + ph - mm.b, oy + mm.t]);
    el('text', { x: ox, y: oy + 10, class: 'g-axis' }, svg, spec.ylabel || 'Distorted radius');
    ticks(yd[0], yd[1], 4).forEach(v => { if (v) el('line', { x1: ox + mm.l, x2: ox + pw - mm.r, y1: PY(v), y2: PY(v), class: 'g-grid' }, svg); el('text', { x: ox + mm.l - 6, y: PY(v) + 4, 'text-anchor': 'end', class: 'g-tick' }, svg, fmt(v)); });
    ticks(xd[0], xd[1], 4).forEach(v => el('text', { x: PX(v), y: oy + ph - mm.b + 16, 'text-anchor': 'middle', class: 'g-tick' }, svg, fmt(v)));
    el('text', { x: ox + pw - mm.r, y: oy + ph - 2, 'text-anchor': 'end', class: 'g-axis' }, svg, spec.xlabel || 'Ideal radius r');
    const cap = Math.min(xd[1], yd[1]);
    el('line', { x1: PX(0), y1: PY(0), x2: PX(cap), y2: PY(cap), class: 'g-dash' }, svg);
    el('text', { x: PX(cap) - 4, y: PY(cap) - 6, 'text-anchor': 'end', class: 'g-tick' }, svg, 'no distortion');
    el('polyline', { points: prof.filter(p => p[1] <= yd[1] * 1.02).map(p => PX(p[0]).toFixed(1) + ',' + PY(p[1]).toFixed(1)).join(' '), class: 'ln hl' }, svg);
    el('line', { x1: ox + mm.l, x2: ox + pw - mm.r, y1: PY(0), y2: PY(0), class: 'g-base' }, svg);
  }

  /* ---------- stack: signal-flow diagram for control and learning stacks ----------
     Blocks on a grid, wires that carry a named signal and its shape, tensors drawn as wire-grid slabs. */
  function drawStack(spec, host) {
    const VW = spec.width || 656, cols = spec.cols || 3, rowH = spec.row_height || 112, top = spec.top != null ? spec.top : 16, cw = VW / cols;
    const MARK = { derived: ' †', assumed: ' ‡' }, N = {}, used = {};
    const slab = d => {                      // tensor [C, H, W] as an oblique wire-grid slab
      const lg = v => Math.log2(Math.max(1, v)), C = d[0], Hh = d[1], Ww = d[2];
      const fw = Math.max(16, Math.min(78, 14 + 9 * lg(Ww))), fh = Math.max(16, Math.min(70, 14 + 9 * lg(Hh))), dz = 4 + 3.2 * lg(C);
      return { fw, fh, ox: dz * 0.8, oy: dz * 0.55, C, Hh, Ww };
    };
    (spec.nodes || []).forEach(n => {
      const kind = n.kind || 'block', g = kind === 'tensor' ? slab(n.dims) : null;
      const sz = n.size || (kind === 'dot' ? [6, 6] : kind === 'sum' ? [26, 26] : kind === 'note' ? [180, 60] : g ? [g.fw + g.ox + 10, g.fh + g.oy + 10] : [136, 54]);
      N[n.id] = { n, kind, g, cx: (n.at[0] + 0.5) * cw + (n.dx || 0), cy: top + (n.at[1] + 0.5) * rowH + (n.dy || 0), w: sz[0], h: sz[1] };
      if (n.style) used[n.style] = 1;
    });
    const rows = Math.max(1, ...Object.values(N).map(q => q.n.at[1] + 1)), H = top + rows * rowH + (spec.bottom || 4);
    const leg = [];
    if (used.learned) leg.push({ label: (spec.legend || {}).learned || 'Trained for the task', cls: 'hl' });
    if (used.frozen) leg.push({ label: (spec.legend || {}).frozen || 'Pretrained, frozen', cls: 's2' });
    if (used.plant) leg.push({ label: (spec.legend || {}).plant || 'Robot and low-level control', cls: 'cx' });
    if ((spec.wires || []).some(w => w.style === 'dashed')) leg.push({ label: (spec.legend || {}).dashed || 'Measurement or supervision', cls: 'ink', shape: 'dash' });
    if (spec.legend !== false) legend(host, leg);
    const svg = el('svg', { viewBox: `0 0 ${VW} ${H}`, role: 'img', class: 'stack' }, host);
    const defs = el('defs', {}, svg), uid = 's' + Math.random().toString(36).slice(2, 8);
    ['', 'hl', 'aux'].forEach(c => { const mk = el('marker', { id: uid + c, viewBox: '0 0 8 8', refX: 7.5, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto', markerUnits: 'userSpaceOnUse' }, defs); el('path', { d: 'M0,0 L8,4 L0,8 z', class: 'ah ' + c }, mk); });
    (spec.groups || []).forEach(gr => {
      const qs = gr.nodes.map(id => N[id]), pad = gr.pad != null ? gr.pad : 14;
      const x0 = Math.min(...qs.map(q => q.cx - q.w / 2)) - pad, x1 = Math.max(...qs.map(q => q.cx + q.w / 2)) + pad;
      const y0 = Math.min(...qs.map(q => q.cy - q.h / 2)) - pad - 12, y1 = Math.max(...qs.map(q => q.cy + q.h / 2)) + pad;
      el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 6, class: 'st-group' }, svg);
      el('text', { x: gr.label_right ? x1 - 8 : x0 + 8, y: y0 + 13, 'text-anchor': gr.label_right ? 'end' : 'start', class: 'st-glabel' }, svg, String(gr.label || '').toUpperCase());
    });
    const port = (q, side, off) => side === 'r' ? [q.cx + q.w / 2, q.cy + off] : side === 'l' ? [q.cx - q.w / 2, q.cy + off] : side === 't' ? [q.cx + off, q.cy - q.h / 2] : [q.cx + off, q.cy + q.h / 2];
    (spec.wires || []).forEach(w => {
      const a = N[w.from], b = N[w.to]; if (!a || !b) throw new Error('stack: wire between unknown blocks "' + w.from + '" and "' + w.to + '"');
      const dx = b.cx - a.cx, dy = b.cy - a.cy, sameRow = Math.abs(dy) < 1, sameCol = Math.abs(dx) < 1;
      const fs = w.from_side || (sameCol ? (dy > 0 ? 'b' : 't') : (dx > 0 ? 'r' : 'l'));
      const ts = w.to_side || (sameCol ? (dy > 0 ? 't' : 'b') : sameRow ? (dx > 0 ? 'l' : 'r') : (dy > 0 ? 't' : 'b'));
      let p = port(a, fs, w.from_off || 0), q = port(b, ts, w.to_off || 0); const hz = s => s === 'l' || s === 'r';
      if (w.straight) { const dx2 = b.cx - a.cx, dy2 = b.cy - a.cy, L2 = Math.hypot(dx2, dy2) || 1, ra = (a.kind === 'sum' || a.kind === 'dot') ? a.w / 2 : Math.min(a.w / 2 / Math.abs(dx2 / L2 || 1e-9), a.h / 2 / Math.abs(dy2 / L2 || 1e-9)), rb = (b.kind === 'sum' || b.kind === 'dot') ? b.w / 2 : Math.min(b.w / 2 / Math.abs(dx2 / L2 || 1e-9), b.h / 2 / Math.abs(dy2 / L2 || 1e-9)); p = [a.cx + dx2 / L2 * ra, a.cy + dy2 / L2 * ra]; q = [b.cx - dx2 / L2 * rb, b.cy - dy2 / L2 * rb]; }
      let pts;
      if (w.straight) pts = [p, q];
      else if (hz(fs) && hz(ts)) { const mx = w.mid != null ? w.mid : (p[0] + q[0]) / 2; pts = Math.abs(p[1] - q[1]) < 0.5 ? [p, q] : [p, [mx, p[1]], [mx, q[1]], q]; }
      else if (!hz(fs) && !hz(ts)) { const my = w.mid != null ? w.mid : (p[1] + q[1]) / 2; pts = Math.abs(p[0] - q[0]) < 0.5 ? [p, q] : [p, [p[0], my], [q[0], my], q]; }
      else if (hz(fs)) pts = [p, [q[0], p[1]], q];
      else pts = [p, [p[0], q[1]], q];
      const cls = w.style === 'hl' ? 'hl' : w.style === 'dashed' ? 'aux' : '';
      const shape = w.shape != null ? String(w.shape) + (MARK[w.basis] || '') : null;
      const tipTxt = w.tip || [w.name || (w.sig ? String(w.sig).replace(/[\\{}]/g, '') : ''), shape, w.note].filter(Boolean).join(' · ');
      const g = el('g', tipTxt ? { 'data-tip': tipTxt, class: 'st-wire' } : { class: 'st-wire' }, svg);
      el('polyline', { points: pts.map(v => v.join(',')).join(' '), class: 'st-hit' }, g);
      el('polyline', { points: pts.map(v => v.join(',')).join(' '), class: 'st-w ' + (w.style || ''), 'marker-end': w.arrow === false ? null : `url(#${uid}${cls})` }, g);
      let si = 0, best = -1;
      pts.slice(1).forEach((v, i) => { const L = Math.hypot(v[0] - pts[i][0], v[1] - pts[i][1]); if (L > best) { best = L; si = i; } });
      if (w.label_seg != null) si = w.label_seg;
      const A = pts[si], B = pts[si + 1], t = w.label_pos != null ? w.label_pos : 0.5, mx = A[0] + (B[0] - A[0]) * t, my = A[1] + (B[1] - A[1]) * t;
      if (Math.abs(A[1] - B[1]) < 0.5) {        // horizontal run: signal above, shape below
        if (w.sig) mathNode(g, String(w.sig), mx, (w.label_side === 'below' ? my + 14 : my - 13) + (w.label_dy || 0), w.sig_size || 14, cls === 'aux' ? 'aux' : cls);
        else if (w.text) el('text', { x: mx, y: my - 8, 'text-anchor': 'middle', class: 'st-note' }, g, w.text);
        if (shape) el('text', { x: mx, y: my + 15, 'text-anchor': 'middle', class: 'st-shape ' + (w.basis || '') }, g, shape);
        if (w.note) el('text', { x: mx, y: my + (shape ? 27 : 15), 'text-anchor': 'middle', class: 'st-note' }, g, w.note);
      } else {                                  // vertical run: labels to one side
        const sgn = w.label_side === 'left' ? -1 : 1, anc = sgn > 0 ? 'start' : 'end';
        if (w.sig && !shape && !w.note && !w.text) { mathNode(g, String(w.sig), mx + sgn * (w.sig_dx || 7), my, w.sig_size || 14, cls === 'aux' ? 'aux' : cls, sgn > 0 ? 'start' : 'end'); }
        else if (w.rotate) { el('text', { x: mx + sgn * 9, y: my, 'text-anchor': 'middle', 'dominant-baseline': 'middle', transform: `rotate(-90 ${mx + sgn * 9} ${my})`, class: 'st-note' }, g, w.text || ''); }
        else {
          const lines = [shape, w.note].filter(Boolean), y0 = my - (lines.length - (w.sig || w.text ? 0 : 1)) * 6;
          if (w.sig) mathNode(g, String(w.sig), mx + sgn * (w.sig_dx || 20), y0 - 6, 14, cls === 'aux' ? 'aux' : cls);
          else if (w.text) el('text', { x: mx + sgn * 8, y: y0 - 2, 'text-anchor': anc, class: 'st-note' }, g, w.text);
          if (shape) el('text', { x: mx + sgn * 8, y: y0 + 13, 'text-anchor': anc, class: 'st-shape ' + (w.basis || '') }, g, shape);
          if (w.note) el('text', { x: mx + sgn * 8, y: y0 + (shape ? 25 : 13), 'text-anchor': anc, class: 'st-note' }, g, w.note);
        }
      }
    });
    Object.values(N).forEach(q => {
      const n = q.n, g = el('g', n.tip ? { 'data-tip': n.tip, class: 'st-node' } : { class: 'st-node' }, svg), x = q.cx - q.w / 2, y = q.cy - q.h / 2;
      if (q.kind === 'dot') { el('circle', { cx: q.cx, cy: q.cy, r: 3, class: 'st-dot' }, g); return; }
      if (q.kind === 'sum') { el('circle', { cx: q.cx, cy: q.cy, r: q.w / 2, class: 'st-box' + (n.style ? ' st-' + n.style : '') }, g); if (n.tex) mathNode(g, String(n.tex), q.cx, q.cy, n.tex_size || 13); else el('text', { x: q.cx, y: q.cy + 4.5, 'text-anchor': 'middle', class: 'st-t' }, g, n.title || '+'); return; }
      if (q.kind === 'note') { String(n.text || '').split('|').forEach((ln, i) => el('text', { x, y: y + 12 + i * 14, class: 'st-note' }, g, ln.trim())); return; }
      if (q.kind === 'tensor') {
        const s = q.g, tw = s.fw + s.ox, th = s.fh + s.oy, fx = q.cx - tw / 2, fy = q.cy - th / 2 + s.oy, P = v => v.map(c => c.toFixed(1)).join(',');
        const nx = Math.min(s.Ww, 8), ny = Math.min(s.Hh, 8), nc = Math.min(s.C, 4); let d = '';
        for (let i = 1; i < nx; i++) { const xx = fx + s.fw * i / nx; d += `M${P([xx, fy])}L${P([xx, fy + s.fh])}M${P([xx, fy])}L${P([xx + s.ox, fy - s.oy])}`; }
        for (let i = 1; i < ny; i++) { const yy = fy + s.fh * i / ny; d += `M${P([fx, yy])}L${P([fx + s.fw, yy])}M${P([fx + s.fw, yy])}L${P([fx + s.fw + s.ox, yy - s.oy])}`; }
        for (let i = 1; i < nc; i++) { const k = i / nc; d += `M${P([fx + s.ox * k, fy - s.oy * k])}L${P([fx + s.fw + s.ox * k, fy - s.oy * k])}L${P([fx + s.fw + s.ox * k, fy + s.fh - s.oy * k])}`; }
        el('path', { d: `M${P([fx, fy])}h${s.fw}v${s.fh}h${-s.fw}z M${P([fx, fy])}l${P([s.ox, -s.oy])}h${s.fw}l${P([-s.ox, s.oy])} M${P([fx + s.fw, fy])}l${P([s.ox, -s.oy])}v${s.fh}l${P([-s.ox, s.oy])}z`, class: 'st-tz' + (n.style === 'hl' ? ' hl' : '') }, g);
        if (d) el('path', { d, class: 'mesh' + (n.style === 'hl' ? ' hl' : '') }, g);
        if (n.sig) mathNode(g, String(n.sig), q.cx, y - 12, 14);
        else if (n.title) el('text', { x: q.cx, y: y - 8, 'text-anchor': 'middle', class: 'st-t' }, g, n.title);
        el('text', { x: q.cx, y: y + q.h + 13, 'text-anchor': 'middle', class: 'st-shape ' + (n.basis || '') }, g, (n.shape || n.dims.join('×')) + (MARK[n.basis] || ''));
        if (n.sub) el('text', { x: q.cx, y: y + q.h + 26, 'text-anchor': 'middle', class: 'st-note' }, g, n.sub);
        return;
      }
      const io = q.kind === 'io';
      el('rect', { x, y, width: q.w, height: q.h, rx: io ? q.h / 2 : 3, class: 'st-box' + (io ? ' io' : '') + (n.style === 'muted' ? ' st-muted' : '') }, g);
      if (!io && ['learned', 'frozen', 'plant', 'hl'].includes(n.style)) el('rect', { x: x + 0.5, y: y + 0.5, width: 9, height: q.h - 1, class: 'st-spine sp-' + n.style }, g);
      const tx = q.cx + (!io && n.style && n.style !== 'plain' ? 4 : 0), lines = String(n.title || '').split('|');
      const subs = n.sub ? String(n.sub).split('|') : [], mls = n.math ? [].concat(n.math) : [], ML = n.math_line || 19, nt = n.title ? lines.length : 0;
      const blockH = nt * 15 + mls.length * ML + subs.length * 12 + (subs.length ? 1 : 0) + (nt && mls.length ? 3 : 0), y0 = q.cy - blockH / 2 + 11.5;
      mls.forEach((t, i) => mathNode(g, String(t), tx, q.cy - blockH / 2 + nt * 15 + (nt ? 3 : 0) + ML * i + ML / 2, n.math_size || 12.5, 'st-m'));
      if (n.tex) mathNode(g, String(n.tex), tx, n.sub ? q.cy - 7 : q.cy, 15);
      else if (nt) lines.forEach((ln, i) => el('text', { x: tx, y: y0 + i * 15, 'text-anchor': 'middle', class: 'st-t' }, g, ln.trim()));
      subs.forEach((ln, i) => el('text', { x: tx, y: (n.tex ? q.cy + 15 : y0 + nt * 15 + (nt && mls.length ? 3 : 0) + mls.length * ML - 1) + i * 12, 'text-anchor': 'middle', class: 'st-s' }, g, ln.trim()));
    });
    if (spec.note) { const p = document.createElement('p'); p.className = 'st-foot'; p.textContent = spec.note; host.appendChild(p); }
  }

  /* ---------- figure frame: toggles and sliders ---------- */
  const DRAW = { line: drawLine, bar: drawBar, scatter: drawScatter, loop: drawLoop, frames: interactive(drawFrames), sim: drawSim, vbar: drawVbar, scene: interactive(drawScene), warp: interactive(drawWarp), stack: drawStack, plane: interactive(drawPlane) };
  const figures = [];
  function setup() {
    const specs = JSON.parse(document.getElementById('qr-specs').textContent || '{}');
    document.querySelectorAll('.chart[data-fig]').forEach(host => {
      let views = specs[host.dataset.fig] || [];
      if (views.length === 1 && views[0].type === 'bar' && views[0].stages) {
        const v = views[0];
        views = [Object.assign({}, v, { view: v.rate_label || (v.successes ? 'Success rate' : 'Value') }),
                 Object.assign({}, v, { view: v.stages_label || 'Breakdown', _stacked: true })];
      }
      const st = { view: 0, slider: 0, sliderValues: [] }, controls = host.parentNode.querySelector('.controls');
      const render = () => {
        W = Math.max(340, Math.min(656, host.clientWidth || 656)); host.textContent = '';
        const s = views[st.view];
        try { (DRAW[s.type] || drawLine)(s, host, st); }
        catch (e) { const p = document.createElement('p'); p.className = 'fig-error'; p.textContent = 'This figure could not be drawn: ' + e.message; host.appendChild(p); }
      };
      if (views.length > 1) {
        const seg = document.createElement('div'); seg.className = 'seg'; seg.setAttribute('role', 'group');
        views.forEach((v, i) => {
          const b = document.createElement('button'); b.type = 'button'; b.textContent = v.view || 'View ' + (i + 1);
          b.setAttribute('aria-pressed', i === 0);
          b.onclick = () => { st.view = i; seg.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-pressed', j === i)); render(); };
          seg.appendChild(b);
        });
        controls.appendChild(seg);
      }
      const sv = views[0];
      if (sv.slider && sv.rows) {
        st.sliderValues = uniq(sv.rows.map(r => r[sv.slider])).sort((a, b) => a - b);
        st.slider = Math.max(0, st.sliderValues.indexOf(sv.slider_default));
        const wrap = document.createElement('label'); wrap.className = 'slider';
        const name = document.createElement('span'); name.textContent = sv.slider_label || sv.slider;
        const inp = document.createElement('input'); inp.type = 'range'; inp.min = 0; inp.max = st.sliderValues.length - 1; inp.step = 1; inp.value = st.slider;
        const outp = document.createElement('output'); const show = () => { outp.textContent = fmt(st.sliderValues[st.slider]) + (sv.slider_unit ? ' ' + sv.slider_unit : ''); };
        inp.oninput = () => { st.slider = +inp.value; show(); render(); };
        show(); wrap.append(name, inp, outp); controls.appendChild(wrap);
      }
      figures.push({ render, math: views.some(v => ['loop', 'frames', 'sim', 'scene', 'stack', 'plane'].includes(v.type)) });
      render();
    });
  }
  window.MathJax = {
    loader: { load: ['[tex]/boldsymbol'] },
    tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']], packages: { '[+]': ['boldsymbol'] } }, svg: { fontCache: 'none' },
    startup: { ready() { MathJax.startup.defaultReady(); MathJax.startup.promise.then(() => figures.forEach(f => f.math && f.render())); } }
  };
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => figures.forEach(f => f.render()), 150); });
  function setupMedia() {
    const vids = document.querySelectorAll('video[data-src]');
    const start = v => { if (!v.src) { v.src = v.dataset.src; v.addEventListener('loadeddata', () => v.parentNode.classList.add('ready'), { once: true }); } const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) start(e.target); else e.target.pause(); }), { rootMargin: '200px 0px' });
      vids.forEach(v => io.observe(v));
    } else vids.forEach(start);
    vids.forEach(v => { if (!v.controls) v.addEventListener('click', () => (v.paused ? v.play() : v.pause())); });
    document.querySelectorAll('.filmstrip[data-animate]').forEach(strip => {
      const cells = strip.querySelectorAll('.clip'); let k = 0;
      const tick = () => { cells.forEach((c, j) => c.classList.toggle('on', j === k)); k = (k + 1) % cells.length; };
      tick(); setInterval(tick, 1100);
    });
  }
  const boot = () => { setup(); setupMedia(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

(function(){var f=function(){document.body.classList.toggle('scrolled',window.scrollY>200);};window.addEventListener('scroll',f,{passive:true});f();})();

(function () {
  var tip = document.createElement('div'); tip.className = 'qr-tip'; document.body.appendChild(tip);
  var cur = null;
  function target(n) {
    while (n && n.nodeType === 1 && n.tagName.toLowerCase() !== 'svg') {
      if (n.hasAttribute('data-tip')) return n;
      var t = n.querySelector && n.querySelector(':scope > title');
      if (t) { n.setAttribute('data-tip', t.textContent); n.setAttribute('aria-label', t.textContent); t.remove(); return n; }
      n = n.parentNode;
    }
    return null;
  }
  function prep(root) { root.querySelectorAll('.chart svg title').forEach(function (t) { var n = t.parentNode; n.setAttribute('data-tip', t.textContent); n.setAttribute('aria-label', t.textContent); t.remove(); }); }
  function off() { if (cur) { cur.classList.remove('hov'); var s = cur.ownerSVGElement; if (s) s.classList.remove('has-hov'); cur = null; } tip.classList.remove('on'); }
  function place(e) { var w = tip.offsetWidth, x = Math.min(window.innerWidth - w - 8, Math.max(8, e.clientX + 14)); tip.style.left = x + 'px'; tip.style.top = Math.max(8, e.clientY - 34) + 'px'; }
  document.addEventListener('pointerover', function (e) {
    if (!e.target.closest || !e.target.closest('.chart')) { off(); return; }
    prep(e.target.closest('.chart'));
    var n = target(e.target); if (n === cur) return; off(); if (!n) return;
    cur = n; n.classList.add('hov'); if (n.ownerSVGElement) n.ownerSVGElement.classList.add('has-hov');
    tip.textContent = n.getAttribute('data-tip'); tip.classList.add('on'); place(e);
  });
  document.addEventListener('pointermove', function (e) { if (cur) place(e); });
  window.addEventListener('scroll', off, { passive: true });
})();
