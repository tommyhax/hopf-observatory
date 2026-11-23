// Corrected Algorithm 1010 float32 GPU comparison; original evidence unchanged.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openGPU } from '../../gpu-client.mjs';
import { specializeYuksel } from '../../comparison-shader.mjs';
import { vertex, fragment } from '../../../web/shader.js';

const dir = 'research/diagnostics/algorithm1010/';
const sanityOnly = process.argv.includes('--sanity-only');
const read = (path) => readFile(path, 'utf8');
const sha = (data) => createHash('sha256').update(data).digest('hex');
const inputs = [
  ['original', 'research/results/reference.json'],
  ['stress', 'research/results/stress-reference.json'],
];
const files = [
  'web/shader.js',
  'research/ferrari.glsl',
  'research/yuksel.glsl',
  'research/all-roots.glsl',
  'research/comparison-shader.mjs',
  'research/gpu-client.mjs',
  'research/native-render.m',
  dir + 'run.mjs',
  dir + 'solver.glsl',
  dir + 'fixtures.json',
  dir + 'generate-fixtures.py',
  ...inputs.map(([, path]) => path),
];
const frozen = JSON.parse(await read('research/diagnostics/grazing/frozen-manifest.json'));
async function verifyFrozen() {
  for (const [path, digest] of Object.entries(frozen.files))
    if (sha(await readFile(path)) !== digest) throw Error('Frozen file changed: ' + path);
}
await verifyFrozen();
const ferrari = await read('research/ferrari.glsl');
const odm = await read(dir + 'solver.glsl');
const fixtures = JSON.parse(await read(dir + 'fixtures.json'));
const yuksel = specializeYuksel(await read('research/yuksel.glsl'));
const collector = await read('research/all-roots.glsl');
const head = fragment
  .slice(0, fragment.lastIndexOf('void main()'))
  .replace('out vec4 outColor;', 'layout(location=0) out vec4 outColor;');
function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw Error('Non-unique source replacement: ' + before);
  return source.replace(before, after);
}
// uMethod=4 routes Ferrari through the same power-coefficient construction and
// four near/reciprocal chart domains as the iterative comparison. Reject roots
// outside [0,1] BEFORE shared refinement, so polishing cannot pull an external
// algebraic root into a chart. Nonfinite roots remain explicit failures.
const chartCollector = replaceOnce(
  collector,
  '    yRoots(p, 0., 1., roots);',
  `    if (uMethod == 4) {
      vec4 r;
      int count = quarticF(vec4(p[0], p[1], p[2], p[3]), p[4], r);
      for (int i = 0; i < 4; ++i) {
        float x = r[i];
        roots[i] = i < count && (isnan(x) || isinf(x) || (x >= 0. && x <= 1.))
          ? x : Y_NO_ROOT;
      }
      roots[4] = Y_NO_ROOT;
    } else {
      yRoots(p, 0., 1., roots);
    }`,
);
const programs = {
  baseline: head + ferrari + yuksel + collector,
  odm: head + odm + yuksel + chartCollector.replaceAll('quarticF(', 'oQuartic('),
};
const methods = [
  { id: 'bernstein', program: 'baseline', index: 0 },
  { id: 'ferrari_direct', program: 'baseline', index: 3 },
  { id: 'odm_direct', program: 'odm', index: 3 },
  { id: 'odm_charts', program: 'odm', index: 4 },
];
const decode = (pixels) => pixels.filter((x) => x !== -1).map((x) => (x === -2 ? null : x));
const gpu = await openGPU();
const results = {};
const sanity = [];
try {
  console.log(gpu.hardware);
  for (const [name, source] of Object.entries(programs)) await gpu.compile(name, vertex, source);
  // Independently known roots; raw algebraic solvers, no surface refinement.
  // Record challenging failures too, rather than selecting only passing cases.
  for (const [policy, source] of [['odm', odm]]) {
    const name = 'sanity_' + policy;
    await gpu.compile(
      name,
      vertex,
      head +
        source +
        `
      uniform vec4 uTest; uniform float uLead;
      void main() {
        vec4 roots; int count = oQuartic(uTest, uLead, roots);
        for (int i=0; i<4; ++i) if (i>=count) roots[i]=3.4e38;
        outColor=roots;
      }`,
    );
    for (const test of fixtures) {
      const response = await gpu.command({
        op: 'draw',
        name,
        uniforms: { uTest: test.c, uLead: test.lead },
      });
      if (response.glError) throw Error('GL error ' + response.glError);
      const actual = [
        ...new Set(response.pixels.slice(0, 4).filter((x) => x !== Math.fround(3.4e38))),
      ].sort((a, b) => a - b);
      const pass =
        actual.length === test.roots.length &&
        actual.every(
          (x, i) =>
            x !== null &&
            Math.abs(x - test.roots[i]) <= 1e-4 * Math.max(1e-20, Math.abs(test.roots[i])),
        );
      sanity.push({ policy, ...test, actual, pass });
    }
  }
  for (const [corpus, path] of sanityOnly ? [] : inputs) {
    const reference = JSON.parse(await read(path));
    results[corpus] = [];
    for (const test of reference.cases) {
      const row = { id: test.id };
      for (const method of methods) {
        row[method.id] = {};
        for (const [stage, polish] of [
          ['raw', 0],
          ['polished', 1],
        ]) {
          const response = await gpu.command({
            op: 'draw',
            name: method.program,
            uniforms: {
              uP: test.P.flat(),
              uC: test.c,
              uEye: test.o,
              uForward: test.d,
              uMethod: method.index,
              uPolish: polish,
            },
          });
          if (response.glError) throw Error('GL error ' + response.glError);
          row[method.id][stage] = decode(response.pixels);
        }
      }
      results[corpus].push(row);
      if (results[corpus].length % 200 === 0)
        console.log(corpus, results[corpus].length, '/', reference.cases.length);
    }
  }
} finally {
  await gpu.close();
}
await verifyFrozen();
const hashes = Object.fromEntries(
  await Promise.all(files.map(async (path) => [path, sha(await readFile(path))])),
);
await mkdir(dir + 'results', { recursive: true });
await writeFile(
  dir + (sanityOnly ? 'results/sanity.json' : 'results/gpu.json'),
  JSON.stringify(
    {
      date: new Date().toISOString(),
      hardware: gpu.hardware,
      protocol:
        'All distinct positive roots of unchanged original rays; shared coefficient construction/refinement; no near bias or finite far cutoff; exact duplicate consolidation only. Corrected Algorithm 1010 factorization with algebraic lower-degree handling; no iterative quartic fallback.',
      methods,
      stages: ['raw', 'polished'],
      hashes,
      shaderHashes: Object.fromEntries(
        Object.entries(programs).map(([name, source]) => [name, sha(source)]),
      ),
      sanity,
      results,
    },
    null,
    2,
  ) + '\n',
);
for (const row of sanity) if (!row.pass) console.log('Sanity failure', row);
console.log('Polynomial checks', sanity.filter((x) => x.pass).length, '/', sanity.length);
