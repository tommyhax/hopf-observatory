/* SO(4) geometry and a double-precision implementation of the ray solver. */
export const planes = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3],
];
export function projector(angles) {
  let R = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => +(i === j)));
  angles.forEach((angle, k) => {
    const [i, j] = planes[k],
      c = Math.cos(angle),
      s = Math.sin(angle);
    const a = R[i].slice(),
      b = R[j].slice();
    for (let n = 0; n < 4; n++) {
      R[i][n] = c * a[n] - s * b[n];
      R[j][n] = s * a[n] + c * b[n];
    }
  });
  return R.map((row) => R.map((other) => row[0] * other[0] + row[1] * other[1]));
}
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const mul = (M, v) => M.map((row) => dot(row, v));
export function field(p, P, c) {
  const r = dot(p, p),
    V = [...p.map((x) => 2 * x), r - 1];
  return dot(V, mul(P, V)) - c * (1 + r) ** 2;
}
export function gradient(p, P, c) {
  const r = dot(p, p),
    pv = mul(P, [...p.map((x) => 2 * x), r - 1]);
  return p.map((x, i) => 4 * (pv[i] + x * (pv[3] - c * (1 + r))));
}
// Near x=lambda/L and far x=L/lambda cover a centered half-ray. Scaling
// the homogeneous numerator by L^2 keeps coefficient construction bounded.
export function rayChart(o, d, P, c, farChart = false, L = Math.max(1, Math.hypot(...o))) {
  const invL = 1 / L,
    scaled = o.map((x) => x * invL),
    base = [...scaled.map((x) => 2 * x * invL), dot(scaled, scaled) - invL * invL],
    linear = [...d.map((x) => 2 * x * invL), 2 * dot(scaled, d)],
    top = [0, 0, 0, dot(d, d)],
    a = farChart ? top : base,
    quadratic = farChart ? base : top,
    middle = a.map((x, i) => x + linear[i] / 2),
    end = a.map((x, i) => x + linear[i] + quadratic[i]),
    A = P.map((row, i) => row.map((v, j) => v - (i === j ? c : 0))),
    B = (x, y) => dot(x, mul(A, y));
  return {
    b: [
      B(a, a),
      B(a, middle),
      (B(a, end) + 2 * B(middle, middle)) / 3,
      B(middle, end),
      B(end, end),
    ],
    L,
  };
}
export function bernstein(b, u) {
  let a = b.slice();
  for (let n = b.length - 1; n > 0; n--)
    for (let i = 0; i < n; i++) a[i] = a[i] * (1 - u) + a[i + 1] * u;
  return a[0];
}
export function rootsBernstein(b, tolerance = 1e-12) {
  const scale = Math.max(...b.map(Math.abs));
  if (scale === 0) return [];
  b = b.map((x) => x / scale);
  const n = b.length - 1;
  if (n === 1) {
    const den = b[0] - b[1],
      r = b[0] / den;
    return den !== 0 && r >= 0 && r <= 1 ? [r] : [];
  }
  const critical = rootsBernstein(
    b.slice(1).map((v, i) => v - b[i]),
    tolerance,
  );
  const cuts = [0, ...critical.filter((x) => x > 0 && x < 1), 1],
    roots = [];
  const add = (x) => {
    if (!roots.some((y) => x === y || Math.abs(x - y) < 2e-12 * Math.max(Math.abs(x), Math.abs(y))))
      roots.push(x);
  };
  for (let i = 0; i < cuts.length; i++) {
    const a = cuts[i],
      fa = bernstein(b, a);
    const left = i > 0 ? bernstein(b, cuts[i - 1]) : fa,
      right = i + 1 < cuts.length ? bernstein(b, cuts[i + 1]) : fa,
      crossing = left * fa < 0 || right * fa < 0;
    if (fa === 0 || (a > 0 && a < 1 && Math.abs(fa) <= tolerance && !crossing)) add(a);
    if (i + 1 === cuts.length) break;
    let lo = a,
      hi = cuts[i + 1],
      fl = fa,
      fh = bernstein(b, hi);
    if (fl * fh < 0) {
      for (let k = 0; k < 55; k++) {
        let m = (lo + hi) / 2,
          fm = bernstein(b, m);
        if (fl * fm <= 0) {
          hi = m;
          fh = fm;
        } else {
          lo = m;
          fl = fm;
        }
      }
      add(fl === 0 ? lo : fh === 0 ? hi : lo + (hi - lo) * (fl / (fl - fh)));
    }
  }
  return roots.sort((a, b) => a - b);
}
export function intersect(o, d, P, c) {
  const k = dot(o, d),
    center = o.map((v, i) => v - k * d[i]);
  const hits = [];
  for (const sign of [-1, 1]) {
    for (const farChart of [false, true]) {
      const { b, L } = rayChart(
        center,
        d.map((v) => sign * v),
        P,
        c,
        farChart,
      );
      for (const x of rootsBernstein(b)) {
        if (x < 0 || x > 1 || (farChart && x === 0)) continue;
        const distance = farChart ? L / x : L * x,
          s = sign * distance - k;
        if (
          Number.isFinite(s) &&
          s > 1e-9 &&
          !hits.some((h) => Math.abs(h - s) < 1e-7 * Math.max(1, s))
        )
          hits.push(s);
      }
    }
  }
  return hits.sort((a, b) => a - b);
}

// UI angles are degrees; width is a band in the S^3 coordinate, not a
// constant Euclidean wall thickness after stereographic projection.
export const MIN_SHELL_WIDTH = 0.01;
export function shellLevels(tDegrees, widthDegrees) {
  const maxWidth = Math.min(30, 2 * (tDegrees - 0.25), 2 * (89.75 - tDegrees));
  const width = Math.max(MIN_SHELL_WIDTH, Math.min(widthDegrees, maxWidth));
  const lowerT = tDegrees - width / 2,
    upperT = tDegrees + width / 2,
    rad = Math.PI / 180;
  return {
    lowerT,
    upperT,
    width,
    maxWidth,
    cLow: Math.cos(upperT * rad) ** 2,
    cHigh: Math.cos(lowerT * rad) ** 2,
  };
}
export function shellIntersections(o, d, P, low, high) {
  return [
    ...intersect(o, d, P, low).map((s) => ({ s, level: low, normalSign: -1 })),
    ...intersect(o, d, P, high).map((s) => ({ s, level: high, normalSign: 1 })),
  ].sort((a, b) => a.s - b.s);
}
