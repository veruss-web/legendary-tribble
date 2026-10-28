/** SVG path helpers shared by the Overview and Analisa charts (unit-tested in tests/chart.test.mjs). */
export type XY = [number, number];

/** Monotone cubic path (Fritsch–Carlson): smooth, but never overshoots between samples. */
export function smoothPath(pts: XY[]) {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx: number[] = [], slope: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; slope[i] = dx[i] === 0 ? 0 : (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  const t: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) t[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  t[n - 1] = slope[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / slope[i], b = t[i + 1] / slope[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * slope[i]; t[i + 1] = k * b * slope[i]; }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) { const h = dx[i] / 3; d += ` C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`; }
  return d;
}

/** Round axis maximum for `ticks` equal steps: 0..max never ends on an awkward number like 1.337.000. */
export function niceScale(max: number, ticks = 4, integer = false) {
  if (!(max > 0)) return { max: ticks, step: 1 };
  const raw = max / ticks, mag = 10 ** Math.floor(Math.log10(raw)), norm = raw / mag;
  let step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  if (integer && step < 1) step = 1;
  return { max: step * ticks, step };
}

/** Which x-axis labels to print so they never collide: all of them when few, otherwise evenly spaced, always the last one. */
export function axisTicks(n: number, target = 6) {
  if (n <= 0) return [];
  if (n <= target + 2) return Array.from({ length: n }, (_, i) => i);
  const step = Math.ceil(n / target), out: number[] = [];
  for (let i = 0; i < n; i += step) if (n - 1 - i >= step * 0.6) out.push(i);
  out.push(n - 1);
  return out;
}
