import assert from 'node:assert/strict';
import test from 'node:test';
import { collect, construct64, mapRoot } from './run.mjs';

test('reciprocal infinity and backward hits are excluded; center belongs to one half', () => {
  assert.equal(mapRoot(0, 1, -2, 3), undefined);
  assert.equal(mapRoot(0, 3, -2, 3), undefined);
  assert.equal(mapRoot(0, 0, -2, 3), undefined);
  assert.equal(mapRoot(0, 2, -2, 3), 2);
  assert.equal(mapRoot(0, 2, 0, 3), undefined);
  assert.equal(mapRoot(0.5, 1, -10, 3), 4);
  assert.equal(mapRoot(0.5, 3, -2, 3), 8);
});

test('all-roots collection preserves close hits and hits below the renderer cutoff', () => {
  const roots = collect([{ chart: 2, roots: [1e-12, 0.5, 0.5 + 1e-10, 0.5] }], 0, 1);
  assert.deepEqual(roots, [1e-12, 0.5, 0.5 + 1e-10]);
});

test('nonfinite solver candidates are retained as failures', () => {
  assert.deepEqual(collect([{ chart: 2, roots: [NaN, Infinity] }], 0, 1), [null, null]);
});

test('aligned Clifford torus has four known intersections without renormalizing direction', () => {
  const P = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  // At y=z=0, x=+/- (sqrt(2)+/-1); a non-unit direction tests p=o+s*d.
  const row = construct64({ P, c: 0.5, o: [-4, 0, 0], d: [2, 0, 0] });
  const expected = [3 - Math.SQRT2, 5 - Math.SQRT2, 3 + Math.SQRT2, 5 + Math.SQRT2]
    .map((x) => x / 2)
    .sort((a, b) => a - b);
  assert.equal(row.roots.length, 4);
  row.roots.forEach((s, i) => assert(Math.abs(s - expected[i]) < 1e-10));
});
