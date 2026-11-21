import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openGPU } from './gpu-client.mjs';
import { vertex, fragment } from '../web/shader.js';
const reference = JSON.parse(await readFile(new URL('results/reference.json', import.meta.url)));
const ferrari = await readFile(new URL('ferrari.glsl', import.meta.url), 'utf8');
const head = fragment.slice(0, fragment.lastIndexOf('void main()'));
const gpu = await openGPU(),
  results = [];
console.log(gpu.hardware);
try {
  for (const [name, fn, extra] of [
    ['compactified', 'intersection', ''],
    ['ferrari', 'ferrariHit', ferrari],
  ]) {
    await gpu.compile(
      name,
      vertex,
      head + extra + `void main(){outColor=vec4(${fn}(uEye,uForward,uC),0,0,1);}`,
    );
  }
  // Sanity-check the port independently on well-separated polynomial roots.
  await gpu.compile(
    'baseline-check',
    vertex,
    head +
      ferrari +
      'uniform vec4 uTest;uniform float uLead;void main(){vec4 roots;int n=quarticF(uTest,uLead,roots);outColor=roots;}',
  );
  const sanity = [];
  for (const test of [
    { c: [24, -50, 35, -10], lead: 1, roots: [1, 2, 3, 4] },
    { c: [-6, 11, -6, 1], lead: 0, roots: [1, 2, 3] },
    { c: [-1, 0, 1, 0], lead: 0, roots: [-1, 1] },
  ]) {
    const r = await gpu.command({
        op: 'draw',
        name: 'baseline-check',
        uniforms: { uTest: test.c, uLead: test.lead },
      }),
      actual = r.pixels.slice(0, test.roots.length).sort((a, b) => a - b);
    const pass = actual.every((x, i) => Math.abs(x - test.roots[i]) < 1e-4);
    sanity.push({ ...test, actual, pass });
    if (!pass) throw Error('Ferrari baseline sanity check failed: ' + JSON.stringify(sanity));
  }
  for (const test of reference.cases) {
    const row = { id: test.id };
    for (const method of ['compactified', 'ferrari']) {
      let o = test.o.slice(),
        total = 0,
        hits = [];
      for (let j = 0; j < 6; j++) {
        const r = await gpu.command({
          op: 'draw',
          name: method,
          uniforms: { uP: test.P.flat(), uC: test.c, uEye: o, uForward: test.d, uRayBias: 4e-4 },
        });
        if (r.glError) throw Error(`GL error ${r.glError}`);
        const s = r.pixels[0];
        if (s === null || !Number.isFinite(s)) {
          hits.push(null);
          break;
        }
        if (s < 0) break;
        hits.push(total + s);
        const p = o.map((x, i) => x + s * test.d[i]),
          eps = 4e-4 * Math.max(1, Math.hypot(...p));
        o = p.map((x, i) => Math.fround(x + eps * test.d[i]));
        total += s + eps;
      }
      row[method] = hits;
    }
    results.push(row);
    if (test.id % 100 === 0) console.log(`GPU cases ${test.id}/${reference.cases.length}`);
  }
  const files = [
    'web/shader.js',
    'research/ferrari.glsl',
    'research/reference.py',
    'research/run-experiment.mjs',
    'research/native-render.m',
    'research/gpu-client.mjs',
    'research/results/reference.json',
  ];
  const hashes = Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [
        file,
        createHash('sha256')
          .update(await readFile(file))
          .digest('hex'),
      ]),
    ),
  );
  await writeFile(
    new URL('results/pole-gpu.json', import.meta.url),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        hardware: gpu.hardware,
        execution: 'Native offscreen OpenGL; ES 3.00 version directive replaced by GLSL 4.10',
        hashes,
        sanity,
        results,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('Wrote pole-gpu.json');
} finally {
  await gpu.close();
}
