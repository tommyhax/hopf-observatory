import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { specializeYuksel } from './comparison-shader.mjs';
import { openGPU } from './gpu-client.mjs';
import { vertex, fragment } from '../web/shader.js';

const reference = JSON.parse(await readFile(new URL('results/reference.json', import.meta.url)));
const ferrari = await readFile(new URL('ferrari.glsl', import.meta.url), 'utf8');
const yuksel = specializeYuksel(await readFile(new URL('yuksel.glsl', import.meta.url), 'utf8'));
const collector = await readFile(new URL('all-roots.glsl', import.meta.url), 'utf8');
const head = fragment.slice(0, fragment.lastIndexOf('void main()'));
const methods = [
  { id: 'compactified', label: 'Bernstein near/reciprocal', index: 0 },
  { id: 'yuksel_direct', label: 'Yuksel–Peters, centered power basis', index: 1 },
  { id: 'yuksel_charts', label: 'Yuksel–Peters, near/reciprocal power basis', index: 2 },
  { id: 'ferrari', label: 'Ferrari, centered power basis', index: 3 },
];
const files = [
  'web/shader.js',
  'research/ferrari.glsl',
  'research/yuksel.glsl',
  'research/all-roots.glsl',
  'research/comparison-shader.mjs',
  'research/reference.py',
  'research/run-experiment.mjs',
  'research/native-render.m',
  'research/gpu-client.mjs',
  'research/results/reference.json',
];
const gpu = await openGPU();
const results = [],
  sanity = [],
  collectionChecks = [];
const decode = (pixels) => pixels.filter((x) => x !== -1).map((x) => (x === -2 ? null : x));
console.log(gpu.hardware);
try {
  await gpu.compile('all-roots', vertex, head + ferrari + yuksel + collector);
  // Validate the port independently of geometry and without surface polishing.
  await gpu.compile(
    'yuksel-check',
    vertex,
    head +
      yuksel +
      `
    uniform vec4 uTest;
    uniform float uLead, uBegin, uEnd;
    void main() {
      float p[5], roots[5];
      for (int i=0; i<4; ++i) p[i]=uTest[i];
      p[4]=uLead;
      yRoots(p,uBegin,uEnd,roots);
      outColor=vec4(roots[0],roots[1],roots[2],roots[3]);
    }`,
  );
  for (const test of [
    {
      name: 'four simple roots',
      c: [24, -50, 35, -10],
      lead: 1,
      interval: [0, 5],
      roots: [1, 2, 3, 4],
    },
    { name: 'cubic degree loss', c: [-6, 11, -6, 1], lead: 0, interval: [0, 4], roots: [1, 2, 3] },
    { name: 'quadratic degree loss', c: [-1, 0, 1, 0], lead: 0, interval: [-2, 2], roots: [-1, 1] },
    { name: 'linear degree loss', c: [-2, 1, 0, 0], lead: 0, interval: [0, 4], roots: [2] },
    { name: 'constant', c: [1, 0, 0, 0], lead: 0, interval: [-1, 1], roots: [] },
    { name: 'zero polynomial', c: [0, 0, 0, 0], lead: 0, interval: [-1, 1], roots: [] },
    { name: 'double zero', c: [0, 0, 1, 0], lead: 0, interval: [-1, 1], roots: [0] },
    { name: 'two double roots', c: [1, 0, -2, 0], lead: 1, interval: [-2, 2], roots: [-1, 1] },
    { name: 'closed endpoints', c: [0, -1, 1, 0], lead: 0, interval: [0, 1], roots: [0, 1] },
    {
      name: 'two separated scales',
      c: [1, -1e10, 1, 0],
      lead: 0,
      interval: [0, 2e10],
      roots: [1e-10, 1e10],
    },
    {
      name: 'near-zero chart root',
      c: [-1e-10, 1, 0, 1],
      lead: 0,
      interval: [0, 1],
      roots: [1e-10],
    },
  ]) {
    const r = await gpu.command({
      op: 'draw',
      name: 'yuksel-check',
      uniforms: {
        uTest: test.c,
        uLead: test.lead,
        uBegin: test.interval[0],
        uEnd: test.interval[1],
      },
    });
    const actual = [...new Set(r.pixels.slice(0, 4).filter((x) => x !== Math.fround(3.4e38)))].sort(
      (a, b) => a - b,
    );
    const pass =
      r.glError === 0 &&
      actual.length === test.roots.length &&
      actual.every(
        (x, i) =>
          x !== null &&
          Math.abs(x - test.roots[i]) <= 1e-5 * Math.max(1e-20, Math.abs(test.roots[i])),
      );
    sanity.push({ ...test, actual, pass });
    if (!pass) throw Error('Yuksel–Peters sanity check failed: ' + JSON.stringify(sanity.at(-1)));
  }
  await gpu.compile(
    'ferrari-check',
    vertex,
    head +
      ferrari +
      `
    uniform vec4 uTest; uniform float uLead;
    void main() {
      vec4 roots; int count=quarticF(uTest,uLead,roots);
      for(int i=0;i<4;++i) if(i>=count) roots[i]=-1.;
      outColor=roots;
    }`,
  );
  for (const test of sanity.slice(0, 3)) {
    const r = await gpu.command({
      op: 'draw',
      name: 'ferrari-check',
      uniforms: { uTest: test.c, uLead: test.lead },
    });
    // These three fixtures have no root at the unused-slot sentinel -1 except
    // the quadratic, whose count is known from its degree.
    const actual = r.pixels.slice(0, test.roots.length).sort((a, b) => a - b);
    const pass =
      r.glError === 0 && actual.every((x, i) => x !== null && Math.abs(x - test.roots[i]) < 1e-4);
    sanity.push({ name: test.name, method: 'ferrari', expected: test.roots, actual, pass });
    if (!pass) throw Error('Ferrari polynomial sanity check failed');
  }
  // Geometry fixtures exercise the collector rather than just the solver port.
  // The sub-bias hit would be lost by the rendering cutoff, which is excluded.
  const poleP = [
    [0.5, 0, 0, -0.5],
    [0, 1, 0, 0],
    [0, 0, 0, 0],
    [-0.5, 0, 0, 0.5],
  ];
  const step = 2 ** -20;
  for (const test of [
    {
      name: 'four intersections on original ray',
      P: [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      o: [-4, 0, 0],
      d: [1, 0, 0],
      expected: [3 - Math.SQRT2, 5 - Math.SQRT2, 3 + Math.SQRT2, 5 + Math.SQRT2].sort(
        (a, b) => a - b,
      ),
    },
    {
      name: 'chart junctions and origin exclusion',
      P: poleP,
      o: [-1, 0, 0],
      d: [1, 0, 0],
      expected: [1, 2],
    },
    {
      name: 'positive hit below rendering bias',
      P: poleP,
      o: [-1 - step, 0, 0],
      d: [1, 0, 0],
      expected: [step, 1 + step, 2 + step],
    },
    {
      name: 'contained line has no isolated roots',
      P: poleP,
      o: [0, 0, 0],
      d: [0, Math.SQRT1_2, Math.SQRT1_2],
      expected: [],
    },
  ]) {
    for (const method of methods) {
      for (const [stage, polish] of [
        ['raw', 0],
        ['polished', 1],
      ]) {
        const r = await gpu.command({
          op: 'draw',
          name: 'all-roots',
          uniforms: {
            uP: test.P.flat(),
            uC: 0.5,
            uEye: test.o,
            uForward: test.d,
            uMethod: method.index,
            uPolish: polish,
          },
        });
        const actual = decode(r.pixels).sort((a, b) => a - b);
        const pass =
          r.glError === 0 &&
          actual.length === test.expected.length &&
          actual.every(
            (x, i) =>
              x !== null &&
              Math.abs(x - test.expected[i]) <= 1e-5 * Math.max(Math.abs(test.expected[i]), 1e-20),
          );
        collectionChecks.push({ ...test, method: method.id, stage, actual, pass });
        if (r.glError) throw Error(`Collector fixture GL error ${r.glError}`);
        // Record numerical failures as data: a baseline may return a spurious
        // near-origin root. Only the well-conditioned polynomial checks gate
        // the run; challenging geometry must not be silently dropped.
      }
    }
  }
  for (const test of reference.cases) {
    const row = { id: test.id };
    for (const method of methods) {
      row[method.id] = {};
      for (const [stage, polish] of [
        ['raw', 0],
        ['polished', 1],
      ]) {
        const r = await gpu.command({
          op: 'draw',
          name: 'all-roots',
          uniforms: {
            uP: test.P.flat(),
            uC: test.c,
            uEye: test.o,
            uForward: test.d,
            uMethod: method.index,
            uPolish: polish,
          },
        });
        if (r.glError) throw Error(`GL error ${r.glError}`);
        row[method.id][stage] = decode(r.pixels);
      }
    }
    results.push(row);
    if (test.id % 100 === 0) console.log(`GPU cases ${test.id}/${reference.cases.length}`);
  }
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
  const report = {
    schemaVersion: 2,
    date: new Date().toISOString(),
    hardware: gpu.hardware,
    execution: 'Native offscreen OpenGL; ES 3.00 version directive replaced by GLSL 4.10',
    protocol:
      'All distinct positive roots of the unchanged original ray; no origin advance or positive-distance bias',
    methods,
    stages: ['raw', 'polished'],
    coordinates: {
      common: 'k=dot(o,d), center=o-k*d, L=max(1,length(center)); lambda=s+k',
      direct: 'x=lambda/L; coefficient-only Cauchy bound, no finite scene far cutoff',
      charts: 'Each signed half-line: near x=abs(lambda)/L in [0,1], far x=L/abs(lambda) in (0,1]',
      duplicates:
        'Both charts include the junction; positive near owns the center; identical float hits consolidated only',
    },
    polishing:
      'Four production homogeneous-form Newton steps and conditioned residual <2e-6, shared by every method',
    hashes,
    sanity,
    collectionChecks,
    results,
  };
  await writeFile(
    new URL('results/pole-gpu.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log('Wrote pole-gpu.json');
} finally {
  await gpu.close();
}
