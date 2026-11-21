import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { vertex, fragment } from '../web/shader.js';
import { openGPU } from './gpu-client.mjs';
import { specializeYuksel } from './comparison-shader.mjs';
import { rendererVariant, variantFiles } from './renderer-variants.mjs';

const load = (name) => readFile(new URL(name, import.meta.url), 'utf8');
const reference = JSON.parse(await load('results/reference.json'));
const extra =
  (await load('ferrari.glsl')) +
  specializeYuksel(await load('yuksel.glsl')) +
  (await load('all-roots.glsl'));
const names = ['bernstein-raw', 'bernstein-unguarded', 'bernstein-decreasing', 'bernstein-guarded'];
const methods = names.map((id) => ({ id, label: id }));
const sources = {};
const gpu = await openGPU();
const results = [];
try {
  for (const name of names) {
    const source = await rendererVariant(fragment, name);
    sources[name] = createHash('sha256').update(source).digest('hex');
    await gpu.compile(name, vertex, source.slice(0, source.lastIndexOf('void main()')) + extra);
  }
  for (const test of reference.cases) {
    const row = { id: test.id };
    for (const name of names) {
      const r = await gpu.command({
        op: 'draw',
        name,
        uniforms: {
          uP: test.P.flat(),
          uC: test.c,
          uEye: test.o,
          uForward: test.d,
          uMethod: 0,
          uPolish: 1,
        },
      });
      if (r.glError) throw Error('GL error ' + r.glError);
      row[name] = { polished: r.pixels.filter((x) => x !== -1).map((x) => (x === -2 ? null : x)) };
    }
    results.push(row);
    if (test.id % 100 === 0)
      console.log('Refinement cases ' + test.id + '/' + reference.cases.length);
  }
  const files = [
    'web/shader.js',
    'research/run-refinement.mjs',
    'research/all-roots.glsl',
    'research/ferrari.glsl',
    'research/gpu-client.mjs',
    'research/native-render.m',
    'research/results/reference.json',
    ...variantFiles,
  ];
  const hashes = Object.fromEntries(
    await Promise.all(
      files.map(async (name) => [
        name,
        createHash('sha256')
          .update(await readFile(name))
          .digest('hex'),
      ]),
    ),
  );
  await writeFile(
    'research/results/refinement-gpu.json',
    JSON.stringify(
      {
        schemaVersion: 2,
        date: new Date().toISOString(),
        hardware: gpu.hardware,
        hashes,
        shaderHashes: sources,
        methods,
        stages: ['polished'],
        results,
        protocol:
          'All positive roots of unchanged rays; common residual acceptance; only refinement policy changes',
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await gpu.close();
}
