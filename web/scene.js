import { shellLevels, intersect, dot, mul } from './math.js';
export const MATERIALS = {
  glass: {
    label: 'Tinted glass',
    color: '#9ce3df',
    opacity: 0.06,
    ior: 1.35,
    roughness: 0.03,
    metallic: 0,
  },
  crystal: {
    label: 'Clear crystal',
    color: '#f3f7ff',
    opacity: 0,
    ior: 1.5,
    roughness: 0,
    metallic: 0,
  },
  chrome: {
    label: 'Chrome',
    color: '#d3d5d8',
    opacity: 1,
    ior: 1.5,
    roughness: 0.035,
    metallic: 1,
  },
  ceramic: {
    label: 'Ceramic',
    color: '#d2e4ed',
    opacity: 1,
    ior: 1.5,
    roughness: 0.45,
    metallic: 0,
  },
};
export function applyMaterial(object, name) {
  Object.assign(object, MATERIALS[name], { material: name });
}
export function makeTorus(t, color) {
  return {
    t,
    color,
    enabled: true,
    shell: true,
    shellWidth: 3,
    opacity: 0.04,
    ior: 1.2,
    roughness: 0.025,
    metallic: 0,
    material: 'glass',
  };
}
export function scenePreset(name) {
  const objects = [makeTorus(25, '#83e3da'), makeTorus(45, '#dea1d6'), makeTorus(65, '#f2c381')];
  if (name === 'chrome') {
    applyMaterial(objects[0], 'chrome');
    objects[1].ior = 1.14;
    objects[2].ior = 1.12;
  }
  return objects;
}
export function objectLevels(object) {
  const b = shellLevels(object.t, object.shellWidth);
  return { c: Math.cos((object.t * Math.PI) / 180) ** 2, low: b.cLow, high: b.cHigh };
}
export function linearColor(hex) {
  return [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
}
export function levelAt(p, P) {
  const r = dot(p, p),
    q = [...p.map((x) => (2 * x) / (1 + r)), (r - 1) / (1 + r)];
  return dot(q, mul(P, q));
}
export function materialMask(h, objects) {
  let mask = 0;
  objects.forEach((object, i) => {
    const b = objectLevels(object);
    if (object.enabled && (object.shell ? h > b.low && h < b.high : h > b.c)) mask |= 1 << i;
  });
  return mask;
}
// More specific level intervals replace wider regions; slot order breaks ties.
// This preserves inner media in nested solids even as their projections invert.
export function mediumFor(mask, objects) {
  let id = -1,
    width = 2;
  objects.forEach((o, i) => {
    if (!(mask & (1 << i))) return;
    const b = objectLevels(o),
      w = o.shell ? b.high - b.low : 1 - b.c;
    if (w <= width) {
      width = w;
      id = i;
    }
  });
  return id;
}
export function maskAcrossLevel(level, increasing, objects) {
  const above = (bound) => (Math.abs(level - bound) < 2e-7 ? increasing : level > bound);
  let mask = 0;
  objects.forEach((o, i) => {
    const b = objectLevels(o);
    if (o.enabled && (o.shell ? above(b.low) && !above(b.high) : above(b.c))) mask |= 1 << i;
  });
  return mask;
}
export function sceneIntersections(o, d, P, objects) {
  const hits = [];
  objects.forEach((object, id) => {
    if (!object.enabled) return;
    const b = objectLevels(object);
    for (const [level, normalSign] of object.shell
      ? [
          [b.low, -1],
          [b.high, 1],
        ]
      : [[b.c, -1]])
      for (const s of intersect(o, d, P, level)) hits.push({ s, level, normalSign, id });
  });
  return hits.sort((a, b) => a.s - b.s || a.id - b.id);
}

// The inverse stereographic metric has scale 2/(1+|p|²). Keep the
// origin bias small relative to the nearest angular separation in S³.
// The floor is roughly eight float32 ulps; unresolved gaps remain limited
// by GPU precision. Identical boundaries are handled as one medium event.
export function rayBiasScale(objects) {
  const angles = objects
    .filter((o) => o.enabled)
    .flatMap((o) => {
      const b = shellLevels(o.t, o.shellWidth);
      return o.shell ? [b.lowerT, b.upperT] : [o.t];
    })
    .sort((a, b) => a - b);
  let gap = Infinity;
  for (let i = 1; i < angles.length; i++) {
    const d = angles[i] - angles[i - 1];
    if (d > 0) gap = Math.min(gap, d);
  }
  return Math.max(1e-6, Math.min(4e-4, (0.05 * gap * Math.PI) / 180));
}

export function applyShellWidthToAll(objects, width) {
  const shared = Math.min(...objects.map((o) => shellLevels(o.t, width).width));
  objects.forEach((o) => (o.shellWidth = shared));
  return shared;
}
