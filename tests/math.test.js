import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  projector,
  field,
  gradient,
  rayChart,
  bernstein,
  rootsBernstein,
  intersect,
  dot,
  mul,
} from '../web/math.js';
const rad = Math.PI / 180;
let seed = 461;
function random() {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 4294967296;
}
const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
test('SO(4) projector is symmetric, idempotent, rank two for 100 rotations', () => {
  for (let k = 0; k < 100; k++) {
    const P = projector(Array.from({ length: 6 }, () => random() * 6));
    close(
      P.reduce((s, r, i) => s + r[i], 0),
      2,
    );
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        close(P[i][j], P[j][i]);
        close(dot(P[i], P[j]), P[i][j]);
      }
  }
});
test('both ray charts equal the homogeneous quartic for 1000 rays', () => {
  for (let k = 0; k < 1000; k++) {
    const P = projector(Array.from({ length: 6 }, () => random() * 6)),
      c = 0.05 + 0.9 * random(),
      o = Array.from({ length: 3 }, () => random() * 10 - 5),
      v = Array.from({ length: 3 }, () => random() * 2 - 1),
      d = v.map((x) => x / Math.hypot(...v)),
      x = 0.001 + random() * 0.999;
    for (const far of [false, true]) {
      const { b, L } = rayChart(o, d, P, c, far),
        distance = far ? L / x : L * x,
        p = o.map((v, i) => v + distance * d[i]),
        expected = (field(p, P, c) / L ** 4) * (far ? x ** 4 : 1);
      close(bernstein(b, x), expected, 2e-9 * Math.max(1, Math.abs(expected)));
    }
  }
});
test('analytic gradient matches central differences', () => {
  for (let k = 0; k < 200; k++) {
    const P = projector(Array.from({ length: 6 }, () => random() * 6)),
      p = Array.from({ length: 3 }, () => random() * 8 - 4),
      c = random(),
      g = gradient(p, P, c);
    for (let i = 0; i < 3; i++) {
      const a = p.slice(),
        b = p.slice(),
        eps = 1e-5;
      a[i] += eps;
      b[i] -= eps;
      close(g[i], (field(a, P, c) - field(b, P, c)) / (2 * eps), 1e-5);
    }
  }
});
test('aligned Clifford torus has four exact axis intersections', () => {
  const P = projector([0, 0, 0, 0, 0, 0]),
    hits = intersect([-4, 0, 0], [1, 0, 0], P, 0.5);
  assert.equal(hits.length, 4);
  [4 - Math.SQRT2 - 1, 4 - Math.SQRT2 + 1, 4 + Math.SQRT2 - 1, 4 + Math.SQRT2 + 1].forEach((s, i) =>
    close(hits[i], s, 1e-9),
  );
});
test('tangent ray retains its double root', () => {
  // Exactly representable pole configuration: f(o+s*d)=-2*(4-s)^2.
  const P = [
      [0.5, 0, 0, -0.5],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
      [-0.5, 0, 0, 0.5],
    ],
    hits = intersect([0, 0, 4], [0, 0, -1], P, 0.5);
  assert.equal(hits.length, 1);
  close(hits[0], 4, 1e-8);
});
test('pole-crossing quartic drops degree without losing finite roots', () => {
  const P = projector([0, 0, 45 * rad, 0, 0, 0]),
    o = [0, 0.5, 5],
    d = [0, 0, -1],
    { b } = rayChart(o, d, P, 0.5, true);
  close(b[0], 0, 1e-10);
  const hits = intersect(o, d, P, 0.5);
  assert.equal(hits.length, 2);
  close(hits[0], 4.5, 1e-8);
  close(hits[1], 5.5, 1e-8);
});
test('roots with multiplicity and degree reduction', () => {
  // (u-.5)^4 in degree-four Bernstein form.
  const r = rootsBernstein([0.0625, -0.0625, 0.0625, -0.0625, 0.0625]);
  assert.equal(r.length, 1);
  close(r[0], 0.5);
  // Linear polynomial represented in degree-four basis.
  const l = rootsBernstein([-0.3, -0.05, 0.2, 0.45, 0.7]);
  assert.equal(l.length, 1);
  close(l[0], 0.3);
});
test('1000 arbitrary torus intersections satisfy the original field', () => {
  let count = 0;
  for (let k = 0; k < 1000; k++) {
    const P = projector(Array.from({ length: 6 }, () => random() * 6)),
      c = 0.03 + 0.94 * random(),
      o = Array.from({ length: 3 }, () => random() * 12 - 6),
      v = Array.from({ length: 3 }, () => random() * 2 - 1),
      d = v.map((x) => x / Math.hypot(...v));
    for (const s of intersect(o, d, P, c)) {
      const p = o.map((x, i) => x + s * d[i]);
      assert.ok(Math.abs(field(p, P, c)) / (1 + dot(p, p)) ** 2 < 1e-8);
      count++;
    }
  }
  assert.ok(count > 150);
});
test('a far intersection survives compactification without a finite bounding sphere', () => {
  const P = projector([0, 0, 44.99 * rad, 0, 0, 0]),
    hits = intersect([0, 0, 0], [1, 0, 0], P, 0.5);
  assert.ok(hits.some((s) => s > 5000));
});

test('shell endpoints stay ordered and nondegenerate near the parameter limits', async () => {
  const { shellLevels } = await import('../web/math.js');
  for (const t of [1, 5, 45, 85, 89])
    for (const width of [0.01, 0.05, 0.5, 6, 30]) {
      const b = shellLevels(t, width);
      assert.ok(b.lowerT >= 0.25 && b.upperT <= 89.75 && b.lowerT < b.upperT);
      assert.ok(b.cLow > 0 && b.cLow < b.cHigh && b.cHigh < 1);
      close((b.lowerT + b.upperT) / 2, t);
      close(b.upperT - b.lowerT, b.width);
    }
});
test('a shell has eight axis crossings with alternating glass and air', async () => {
  const { shellLevels, shellIntersections } = await import('../web/math.js');
  const P = projector([0, 0, 0, 0, 0, 0]),
    b = shellLevels(45, 6),
    o = [-4, 0, 0],
    d = [1, 0, 0];
  const hits = shellIntersections(o, d, P, b.cLow, b.cHigh);
  assert.equal(hits.length, 8);
  const expected = [b.lowerT, b.upperT]
    .flatMap((t) => {
      const R = 1 / Math.cos(t * rad),
        r = Math.tan(t * rad);
      return [4 - R - r, 4 - R + r, 4 + R - r, 4 + R + r];
    })
    .sort((a, b) => a - b);
  const inside = (s) => {
    const p = o.map((x, i) => x + s * d[i]);
    return field(p, P, b.cLow) > 0 && field(p, P, b.cHigh) < 0;
  };
  for (let i = 0; i < 8; i++) {
    close(hits[i].s, expected[i], 1e-9);
    assert.equal(inside(hits[i].s - 1e-5), i % 2 === 1);
    assert.equal(inside(hits[i].s + 1e-5), i % 2 === 0);
  }
});
test('both shell boundary normals point out of the material', async () => {
  const { shellLevels, shellIntersections } = await import('../web/math.js');
  const b = shellLevels(45, 6),
    P = projector([0, 0, 0, 0, 0, 0]),
    o = [-4, 0, 0],
    d = [1, 0, 0];
  for (const hit of shellIntersections(o, d, P, b.cLow, b.cHigh)) {
    const p = o.map((x, i) => x + hit.s * d[i]),
      g = gradient(p, P, hit.level),
      len = Math.hypot(...g),
      n = g.map((x) => (hit.normalSign * x) / len);
    const out = p.map((x, i) => x + 1e-5 * n[i]),
      inn = p.map((x, i) => x - 1e-5 * n[i]);
    const material = (p) => field(p, P, b.cLow) > 0 && field(p, P, b.cHigh) < 0;
    assert.equal(material(out), false);
    assert.equal(material(inn), true);
  }
});
test('the projection pole enters and leaves the shell at its two distinct boundaries', async () => {
  const { shellLevels } = await import('../web/math.js');
  const b = shellLevels(45, 6);
  for (const [angle, level] of [
    [90 - b.upperT, b.cLow],
    [90 - b.lowerT, b.cHigh],
  ]) {
    const P = projector([0, 0, angle * rad, 0, 0, 0]);
    close(P[3][3], level);
  }
  const center = projector([0, 0, 45 * rad, 0, 0, 0])[3][3];
  assert.ok(center > b.cLow && center < b.cHigh);
});

// Multi-object checks use analytic axis roots and samples on either side of
// every boundary, independently of the shader's medium-transition rule.
import {
  scenePreset,
  objectLevels,
  sceneIntersections,
  levelAt,
  materialMask,
  mediumFor,
  maskAcrossLevel,
  applyMaterial,
  rayBiasScale,
  applyShellWidthToAll,
} from '../web/scene.js';
test('three shells have 24 correctly ordered analytic axis crossings', () => {
  const objects = scenePreset('glass'),
    P = projector([0, 0, 0, 0, 0, 0]),
    o = [-8, 0, 0],
    d = [1, 0, 0];
  const hits = sceneIntersections(o, d, P, objects);
  const expected = objects
    .flatMap((object, id) =>
      [object.t - object.shellWidth / 2, object.t + object.shellWidth / 2].flatMap((t) => {
        const R = 1 / Math.cos(t * rad),
          r = Math.tan(t * rad);
        return [8 - R - r, 8 - R + r, 8 + R - r, 8 + R + r].map((s) => ({ s, id }));
      }),
    )
    .sort((a, b) => a.s - b.s);
  assert.equal(hits.length, 24);
  hits.forEach((h, i) => {
    close(h.s, expected[i].s, 1e-8);
    assert.equal(h.id, expected[i].id);
  });
});
test('all shell transitions agree with independent spatial membership', () => {
  const objects = scenePreset('glass');
  for (const angle of [0, 22, 25, 43.5, 45, 65, 80]) {
    const P = projector([0, 0, angle * rad, 0, 0, 0]),
      o = [-8, 0.1, 0.15],
      d = [1, 0, 0];
    for (const h of sceneIntersections(o, d, P, objects)) {
      const p = o.map((x, i) => x + h.s * d[i]),
        g = gradient(p, P, h.level),
        increasing = dot(g, d) > 0;
      const after = p.map((x, i) => x + 1e-6 * d[i]);
      assert.equal(
        maskAcrossLevel(h.level, increasing, objects),
        materialMask(levelAt(after, P), objects),
      );
    }
  }
});
test('nested solids and overlapping shells use explicit material priority', () => {
  const objects = scenePreset('glass');
  objects.forEach((o) => (o.shell = false));
  assert.equal(mediumFor(materialMask(0.99, objects), objects), 0);
  objects[0].enabled = false;
  assert.equal(mediumFor(materialMask(0.99, objects), objects), 1);
  objects[1].enabled = false;
  assert.equal(mediumFor(materialMask(0.99, objects), objects), 2);
  objects[2].enabled = false;
  assert.equal(mediumFor(materialMask(0.99, objects), objects), -1);
  const shells = scenePreset('glass');
  shells.forEach((o) => {
    o.t = 45;
    o.shellWidth = 6;
  });
  const b = objectLevels(shells[0]);
  assert.equal(maskAcrossLevel(b.low, true, shells), 7);
  assert.equal(maskAcrossLevel(b.low, false, shells), 0);
  assert.equal(maskAcrossLevel(b.high, false, shells), 7);
  assert.equal(maskAcrossLevel(b.high, true, shells), 0);
});
test('hidden tori disappear from ray queries and material assignment preserves geometry', () => {
  const objects = scenePreset('glass'),
    P = projector([0, 0, 0, 0, 0, 0]);
  objects[1].enabled = false;
  objects[2].enabled = false;
  assert.equal(sceneIntersections([-8, 0, 0], [1, 0, 0], P, objects).length, 8);
  const before = objects.map((o) => [o.t, o.shell, o.shellWidth, o.enabled]);
  objects.forEach((o) => applyMaterial(o, 'chrome'));
  assert.deepEqual(
    objects.map((o) => [o.t, o.shell, o.shellWidth, o.enabled]),
    before,
  );
  assert.ok(objects.every((o) => o.metallic === 1 && o.material === 'chrome'));
});
test('a chrome inner solid becomes the material at infinity after pole rotation', () => {
  const objects = scenePreset('glass');
  objects.forEach((o) => (o.shell = false));
  applyMaterial(objects[0], 'chrome');
  const unrotated = projector([0, 0, 0, 0, 0, 0]),
    rotated = projector([0, 0, 80 * rad, 0, 0, 0]);
  assert.equal(mediumFor(materialMask(levelAt([1e6, 0, 0], unrotated), objects), objects), -1);
  const id = mediumFor(materialMask(levelAt([1e6, 0, 0], rotated), objects), objects);
  assert.equal(id, 0);
  assert.equal(objects[id].material, 'chrome');
});

// Reproduce the renderer's forward cutoff and offset using CPU intersections,
// rounding each new ray origin to float32. Analytic axis roots independently
// establish how many interfaces must survive. This is not a GLSL execution test.
function countOffsetCrossings(objects, P, start, bias) {
  let o = [start, 0, 0],
    count = 0;
  for (let i = 0; i < 32; i++) {
    const hit = sceneIntersections(o, [1, 0, 0], P, objects).find(
      (h) => h.s > 0.5 * bias * Math.max(1, Math.hypot(...o)),
    );
    if (!hit) break;
    const x = o[0] + hit.s,
      eps = bias * Math.max(1, Math.abs(x));
    o = [Math.fround(x + eps), 0, 0];
    count++;
  }
  return count;
}
test('shell width can reach 0.01 degrees and clamps smaller inputs', async () => {
  const { shellLevels } = await import('../web/math.js');
  for (const t of [1, 25, 45, 65, 89]) {
    close(shellLevels(t, 0.01).width, 0.01);
    close(shellLevels(t, 0.001).width, 0.01);
    close(shellLevels(t, 0).width, 0.01);
    const b = shellLevels(t, 0.01);
    assert.ok(
      Math.fround(b.cHigh) - Math.fround(b.cLow) > 2e-7,
      'Float32 levels must remain distinct from the coincidence tolerance',
    );
  }
});
test('adaptive offsets retain all eight crossings of 0.01-degree shells', () => {
  const P = projector([0, 0, 0, 0, 0, 0]);
  for (const t of [1, 5, 25, 45, 65, 85, 89]) {
    const object = { ...scenePreset('glass')[0], t, shellWidth: 0.01 },
      objects = [object];
    const start = -(1 / Math.cos(t * rad) + Math.tan(t * rad) + 2);
    const hits = sceneIntersections([start, 0, 0], [1, 0, 0], P, objects);
    const expected = [t - 0.005, t + 0.005]
      .flatMap((a) => {
        const R = 1 / Math.cos(a * rad),
          r = Math.tan(a * rad);
        return [-R - r - start, -R + r - start, R - r - start, R + r - start];
      })
      .sort((a, b) => a - b);
    assert.equal(hits.length, 8);
    hits.forEach((hit, i) => close(hit.s, expected[i], 2e-7 * Math.max(1, hit.s)));
    assert.equal(countOffsetCrossings(objects, P, start, rayBiasScale(objects)), 8, `t=${t}`);
    assert.ok(
      countOffsetCrossings(objects, P, start, 4e-4) < 8,
      'Regression: the former offset skips thin walls',
    );
  }
});
test('three 0.01-degree shells retain all 24 crossings with rounded ray origins', () => {
  const objects = scenePreset('glass');
  objects.forEach((o) => (o.shellWidth = 0.01));
  const P = projector([0, 0, 0, 0, 0, 0]);
  assert.equal(countOffsetCrossings(objects, P, -8, rayBiasScale(objects)), 24);
  assert.equal(countOffsetCrossings(objects, P, -8, 4e-4), 12);
});

test('shared shell width reaches all three slots and respects every parameter limit', () => {
  const objects = scenePreset('chrome');
  objects[1].enabled = false;
  objects[2].shell = false;
  const otherSettings = () => objects.map(({ shellWidth, ...rest }) => rest);
  const before = otherSettings();
  close(applyShellWidthToAll(objects, 0.01), 0.01);
  assert.deepEqual(
    objects.map((o) => o.shellWidth),
    [0.01, 0.01, 0.01],
  );
  assert.deepEqual(otherSettings(), before);
  objects[1].t = 1;
  close(applyShellWidthToAll(objects, 6), 1.5);
  assert.deepEqual(
    objects.map((o) => o.shellWidth),
    [1.5, 1.5, 1.5],
  );
  assert.equal(objects[1].t, 1);
});

test('roots close to reciprocal zero retain relative accuracy', () => {
  for (const x of [1e-9, 1e-15, 1e-24]) {
    const roots = rootsBernstein([-x, 0.25 - x, 0.5 - x, 0.75 - x, 1 - x]);
    assert.equal(roots.length, 1);
    assert.ok(Math.abs(roots[0] / x - 1) < 1e-10);
  }
});

test('the two charts agree at their shared finite endpoint', () => {
  const P = [
    [0.5, 0, 0, -0.5],
    [0, 1, 0, 0],
    [0, 0, 0, 0],
    [-0.5, 0, 0, 0.5],
  ];
  for (const sign of [-1, 1]) {
    const hits = intersect([-6 * sign, 0, 0], [sign, 0, 0], P, 0.5);
    assert.equal(hits.length, 3);
    [5, 6, 7].forEach((s, i) => close(hits[i], s, 1e-10));
  }
});
