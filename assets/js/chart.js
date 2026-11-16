/* 体重趋势图（纯手写 SVG，无第三方库） */

import { fmtMD } from './util.js';

let gid = 0;

function smoothPath(pts) {
  if (!pts.length) return '';
  if (pts.length === 1) return '';
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

/**
 * @param {{t:number,v:number,at:string}[]} points 时间升序
 */
export function weightChart(points, { width = 340, height = 152 } = {}) {
  if (!points || !points.length) {
    return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"></svg>`;
  }

  const padL = 30, padR = 14, padT = 20, padB = 24;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const vs = points.map((p) => p.v);
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  if (hi - lo < 0.02) { lo -= 0.08; hi += 0.08; }
  const pad = (hi - lo) * 0.3;
  lo = Math.max(0, lo - pad);
  hi = hi + pad;

  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const span = Math.max(1, t1 - t0);

  const X = (t) => (points.length === 1 ? padL + innerW / 2 : padL + ((t - t0) / span) * innerW);
  const Y = (v) => padT + innerH - ((v - lo) / (hi - lo)) * innerH;

  const pts = points.map((p) => ({ x: X(p.t), y: Y(p.v), v: p.v, at: p.at }));

  const uid = `w${++gid}`;
  const line = smoothPath(pts);
  const last = pts[pts.length - 1];

  // 区域填充（单点不填充，改画一条参考虚线）
  const area = pts.length > 1
    ? `${line} L${pts[pts.length - 1].x.toFixed(2)},${(padT + innerH).toFixed(2)} L${pts[0].x.toFixed(2)},${(padT + innerH).toFixed(2)} Z`
    : '';
  const guide = pts.length === 1
    ? `<line x1="${padL}" y1="${pts[0].y.toFixed(2)}" x2="${(width - padR).toFixed(2)}" y2="${pts[0].y.toFixed(2)}"
        stroke="var(--gold)" stroke-opacity=".3" stroke-width="1.5" stroke-dasharray="4 6" />`
    : '';

  // 网格
  const gridY = [0, 0.5, 1].map((f) => padT + innerH * f);
  const grid = gridY.map((y) =>
    `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}"
      stroke="var(--line-2)" stroke-width="1" stroke-dasharray="2 4" />`
  ).join('');

  const dots = pts.map((p, i) => {
    const isLast = i === pts.length - 1;
    if (isLast) {
      return `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="7.5" fill="var(--gold)" opacity=".16" />
              <circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="4" fill="var(--gold)" stroke="var(--card)" stroke-width="2" />`;
    }
    return `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="2.6" fill="var(--gold)" opacity=".55" />`;
  }).join('');

  const lastLabel = `<text x="${Math.min(last.x, width - padR - 4).toFixed(1)}" y="${(last.y - 12).toFixed(1)}"
      text-anchor="end" font-size="10.5" font-weight="700" fill="var(--ink)">${last.v}</text>`;

  const yLabels = `
    <text x="0" y="${(padT + 4).toFixed(1)}" font-size="9.5" fill="var(--ink-3)">${hi.toFixed(1)}</text>
    <text x="0" y="${(padT + innerH + 3).toFixed(1)}" font-size="9.5" fill="var(--ink-3)">${lo.toFixed(1)}</text>`;

  const xLabels = pts.length === 1
    ? `<text x="${pts[0].x.toFixed(1)}" y="${height - 4}" text-anchor="middle" font-size="9.5" fill="var(--ink-3)">${fmtMD(pts[0].at)}</text>`
    : `<text x="${padL}" y="${height - 4}" font-size="9.5" fill="var(--ink-3)">${fmtMD(points[0].at)}</text>
       <text x="${width - padR}" y="${height - 4}" text-anchor="end" font-size="9.5" fill="var(--ink-3)">${fmtMD(points[points.length - 1].at)}</text>`;

  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="体重趋势图">
    <defs>
      <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--gold)" stop-opacity=".28" />
        <stop offset="100%" stop-color="var(--gold)" stop-opacity="0" />
      </linearGradient>
    </defs>
    ${grid}
    ${area ? `<path d="${area}" fill="url(#${uid})" />` : ''}
    ${guide}
    ${pts.length > 1 ? `<path d="${line}" fill="none" stroke="var(--gold)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />` : ''}
    ${dots}
    ${lastLabel}
    ${yLabels}
    ${xLabels}
  </svg>`;
}
