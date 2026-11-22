// Post-hoc stage capture. All output is separate from the frozen experiment.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openGPU } from '../../gpu-client.mjs';
import { specializeYuksel } from '../../comparison-shader.mjs';
import { vertex, fragment } from '../../../web/shader.js';
const dir = 'research/diagnostics/grazing/';
const read = (p) => readFile(p, 'utf8');
const hash = (s) => createHash('sha256').update(s).digest('hex');
const frozen = JSON.parse(await read(dir + 'frozen-manifest.json'));
async function verifyFrozen() {
  for (const [p, h] of Object.entries(frozen.files))
    if (hash(await readFile(p)) !== h) throw Error('Frozen file changed: ' + p);
}
await verifyFrozen();
const reference = JSON.parse(await read('research/results/stress-reference.json'));
const old = JSON.parse(await read('research/results/stress-gpu.json'));
const methods = ['compactified', 'yuksel_direct', 'yuksel_charts'];
const selected = reference.cases.filter((c) => c.family === 'tangent');
const head = fragment.slice(0, fragment.lastIndexOf('void main()'));
const collector = await read('research/all-roots.glsl');
const common =
  head +
  (await read('research/ferrari.glsl')) +
  specializeYuksel(await read('research/yuksel.glsl'));
const original = common + collector;
const capture =
  common +
  collector.replace('void main()', 'void baselineMain()') +
  (await read(dir + 'capture.glsl'));
const merge =
  /\|\|\s*abs\(roots\[count - 1\] - x\) < 3e-7 \* max\(abs\(x\), abs\(roots\[count - 1\]\)\)/g;
if ([...original.matchAll(merge)].length !== 1) throw Error('Cannot identify proximity merge');
const noMerge = original.replace(merge, '');
const decode = (r) => r.filter((x) => x !== -1).map((x) => (x === -2 ? null : x));
const sorted = (a) => [...a].sort((a, b) => (a ?? Infinity) - (b ?? Infinity));
const equal = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const gpu = await openGPU();
const results = [],
  mismatches = [];
try {
  console.log(gpu.hardware);
  await gpu.compile('original', vertex, original);
  await gpu.compile('capture', vertex, capture);
  await gpu.compile('noMerge', vertex, noMerge);
  for (const test of selected) {
    const uniforms = { uP: test.P.flat(), uC: test.c, uEye: test.o, uForward: test.d };
    async function draw(name, extra = {}) {
      const r = await gpu.command({ op: 'draw', name, uniforms: { ...uniforms, ...extra } });
      if (r.glError) throw Error('GL error ' + r.glError);
      return r.pixels;
    }
    const geometry = await draw('capture', { uDiagnostic: 1 });
    const A = await draw('capture', { uDiagnostic: 6 });
    const charts = [];
    for (let chart = 0; chart < 5; chart++) {
      const vectors = await draw('capture', { uDiagnostic: 2, uChart: chart });
      const coefficients = await draw('capture', { uDiagnostic: 3, uChart: chart });
      charts.push({ chart, vectors, coefficients });
    }
    const row = { id: test.id, geometry, A, charts, methods: {}, noMerge: {} };
    for (const [method, name] of methods.entries()) {
      const data = { probes: [] };
      for (const [stage, polish] of [
        ['raw', 0],
        ['polished', 1],
      ]) {
        const exact = decode(await draw('original', { uMethod: method, uPolish: polish }));
        const instrumented = decode(
          await draw('capture', { uDiagnostic: 0, uMethod: method, uPolish: polish }),
        );
        data[stage] = exact;
        if (!equal(exact, old.results[test.id][name][stage]))
          mismatches.push({
            id: test.id,
            name,
            stage,
            kind: 'frozen replay',
            expected: old.results[test.id][name][stage],
            actual: exact,
          });
        if (!equal(exact, instrumented))
          mismatches.push({
            id: test.id,
            name,
            stage,
            kind: 'instrumented collector',
            expected: exact,
            actual: instrumented,
          });
        if (method === 0)
          row.noMerge[stage] = decode(await draw('noMerge', { uMethod: 0, uPolish: polish }));
      }
      for (const chart of method === 1 ? [4] : [0, 1, 2, 3]) {
        const trace = await draw('capture', { uDiagnostic: 4, uMethod: method, uChart: chart });
        const acceptance = await draw('capture', {
          uDiagnostic: 5,
          uMethod: method,
          uChart: chart,
        });
        data.probes.push({ chart, trace, acceptance });
      }
      for (const [stage, offset, acceptOffset] of [
        ['raw', 8, 8],
        ['polished', 12, 12],
      ]) {
        const combined = [
          ...new Set(
            data.probes.flatMap((p) =>
              p.trace
                .slice(offset, offset + 4)
                .filter((x, i) => p.acceptance[acceptOffset + i] === 1),
            ),
          ),
        ];
        if (!equal(combined, data[stage]))
          mismatches.push({
            id: test.id,
            name,
            stage,
            kind: 'probe aggregation',
            expected: data[stage],
            actual: combined,
          });
      }
      row.methods[name] = data;
    }
    results.push(row);
    if (results.length % 50 === 0)
      console.log(
        `Captured ${results.length}/600; replay/probe discrepancies: ${mismatches.length}`,
      );
  }
  await verifyFrozen();
  const sources = [
    dir + 'run.mjs',
    dir + 'capture.glsl',
    dir + 'PROTOCOL.md',
    dir + 'frozen-manifest.json',
    ...Object.keys(frozen.files),
  ];
  const hashes = {};
  for (const p of sources) hashes[p] = hash(await readFile(p));
  await writeFile(
    dir + 'results/gpu.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        hardware: gpu.hardware,
        methods,
        shaderHashes: { original: hash(original), capture: hash(capture), noMerge: hash(noMerge) },
        hashes,
        selection: 'All 600 frozen grazing queries; post-hoc diagnosis',
        mismatches,
        results,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Wrote diagnostic GPU capture; ${mismatches.length} discrepancies retained`);
} finally {
  await gpu.close();
}
