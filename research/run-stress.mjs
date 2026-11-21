// Frozen production GLSL; collect every root of each original stress ray.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openGPU } from './gpu-client.mjs';
import { specializeYuksel } from './comparison-shader.mjs';
import { vertex, fragment } from '../web/shader.js';
const reference = JSON.parse(await readFile('research/results/stress-reference.json'));
const methods = ['compactified', 'yuksel_direct', 'yuksel_charts'];
const files = [
  'web/shader.js',
  'research/run-stress.mjs',
  'research/results/stress-reference.json',
  'research/all-roots.glsl',
  'research/ferrari.glsl',
  'research/yuksel.glsl',
  'research/comparison-shader.mjs',
  'research/gpu-client.mjs',
  'research/native-render.m',
];
const extra =
  (await readFile('research/ferrari.glsl', 'utf8')) +
  specializeYuksel(await readFile('research/yuksel.glsl', 'utf8')) +
  (await readFile('research/all-roots.glsl', 'utf8'));
const gpu = await openGPU(),
  results = [];
try {
  await gpu.compile(
    'stress',
    vertex,
    fragment.slice(0, fragment.lastIndexOf('void main()')) + extra,
  );
  for (const test of reference.cases) {
    const row = { id: test.id };
    for (const [index, name] of methods.entries()) {
      row[name] = {};
      for (const [stage, polish] of [
        ['raw', 0],
        ['polished', 1],
      ]) {
        const result = await gpu.command({
          op: 'draw',
          name: 'stress',
          uniforms: {
            uP: test.P.flat(),
            uC: test.c,
            uEye: test.o,
            uForward: test.d,
            uMethod: index,
            uPolish: polish,
          },
        });
        if (result.glError) throw Error('GL error ' + result.glError);
        row[name][stage] = result.pixels.filter((x) => x !== -1).map((x) => (x === -2 ? null : x));
      }
    }
    results.push(row);
    if (results.length % 200 === 0) console.log('Stress GPU ' + results.length + '/2400');
  }
  const hashes = Object.fromEntries(
    await Promise.all(
      files.map(async (p) => [
        p,
        createHash('sha256')
          .update(await readFile(p))
          .digest('hex'),
      ]),
    ),
  );
  await writeFile(
    'research/results/stress-gpu.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        baselineRevision: reference.baselineRevision,
        hardware: gpu.hardware,
        hashes,
        methods,
        stages: ['raw', 'polished'],
        protocol:
          'All distinct positive roots of unchanged original rays; no rendering bias or finite far cutoff; no proximity consolidation',
        results,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await gpu.close();
}
