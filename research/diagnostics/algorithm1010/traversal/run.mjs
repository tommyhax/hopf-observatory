// Controlled 2x2 traversal/solver comparison; existing shaders and timing unchanged.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { openGPU } from '../final/browser-gpu.mjs';
import { rendererVariant, variantFiles } from '../final/variants.mjs';
import { vertex, fragment } from '../../../../web/shader.js';

const dir = 'research/diagnostics/algorithm1010/';
const output = dir + 'traversal/';
const names = ['production', 'production-unrolled', 'odm-loop', 'odm-direct'];
const accepted = JSON.parse(await readFile(dir + 'final/results/webgl-benchmark.json', 'utf8'));
const scenes = accepted.measurements.filter((x) => x.variant === 'production' && x.round === 0);
if (scenes.length !== 4) throw Error('Expected the four accepted scenes');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const files = [
  ...new Set([
    'web/shader.js',
    'research/webgl.mjs',
    ...variantFiles,
    dir + 'final/browser-gpu.mjs',
    dir + 'final/benchmark-webgl.mjs',
    dir + 'final/results/webgl-benchmark.json',
    output + 'run.mjs',
    ...names.map((name) => dir + `final/results/webgl-transport-${name}.json`),
  ]),
];
const hashes = Object.fromEntries(
  await Promise.all(files.map(async (p) => [p, sha(await readFile(p))])),
);
await mkdir(output + 'results', { recursive: true });
await mkdir(output + 'figures', { recursive: true });
const gpu = await openGPU(),
  measurements = [],
  renders = [],
  shaderHashes = {},
  compiledShaderHashes = {};
try {
  console.log(JSON.stringify(gpu.hardware));
  for (const key of ['renderer', 'vendor', 'version', 'userAgent'])
    if (gpu.hardware[key] !== accepted.hardware[key])
      throw Error('Browser/hardware changed: ' + key);
  if (!gpu.hardware.timerQueryAvailable) throw Error('GPU timer queries required');
  for (const name of names) {
    const source = await rendererVariant(fragment, name);
    const prior = JSON.parse(
      await readFile(dir + `final/results/webgl-transport-${name}.json`, 'utf8'),
    );
    shaderHashes[name] = sha(source);
    // The shared browser adapter adds explicit output location 0 at compilation.
    compiledShaderHashes[name] = sha(
      source.replace('out vec4 outColor;', 'layout(location=0) out vec4 outColor;'),
    );
    if (!prior.passed || prior.shaderHashes.fragment !== shaderHashes[name])
      throw Error('Unvalidated shader ' + name);
    if (accepted.shaderHashes[name] && accepted.shaderHashes[name] !== shaderHashes[name])
      throw Error('Accepted shader changed');
    const r = await gpu.compile(name, vertex, source);
    if (r.glError) throw Error('Compile GL error ' + r.glError);
  }
  // Generalize the accepted forward/reverse alternation to all four variants.
  // Keep three blocks, five warmups and ten completed measured frames per cell.
  for (const [sceneIndex, scene] of scenes.entries()) {
    for (let round = 0; round < 3; round++) {
      const order = (round + sceneIndex) % 2 ? names.slice().reverse() : names.slice();
      for (const [position, name] of order.entries()) {
        const r = await gpu.command({
          op: 'render',
          name,
          uniforms: scene.uniforms,
          width: 1280,
          height: 720,
          frames: 10,
          warmup: 5,
        });
        if (
          r.glError ||
          r.disjoint ||
          r.milliseconds.length !== 10 ||
          r.milliseconds.some((x) => !Number.isFinite(x) || x <= 0)
        )
          throw Error('Invalid timing block');
        measurements.push({
          variant: name,
          scene: scene.scene,
          sceneIndex,
          round,
          position,
          order,
          width: 1280,
          height: 720,
          frames: 10,
          warmup: 5,
          uniforms: scene.uniforms,
          gpuMilliseconds: r.milliseconds,
          completionMilliseconds: r.completionMilliseconds,
          disjoint: r.disjoint,
        });
        const sorted = r.milliseconds.slice().sort((a, b) => a - b);
        console.log(scene.scene, round, name, ((sorted[4] + sorted[5]) / 2).toFixed(3), 'ms GPU');
      }
    }
  }
  await writeFile(
    output + 'results/benchmark.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        hardware: gpu.hardware,
        hashes,
        shaderHashes,
        compiledShaderHashes,
        method: accepted.method,
        ordering:
          'Four variants in listed order, reversed when (round + sceneIndex) is odd. Same three blocks, five warmups and ten completed measured frames as accepted protocol. No full-image capture during timing.',
        variants: names,
        measurements,
      },
      null,
      2,
    ) + '\n',
  );
  // Output consistency is separate from timing: identical benchmark scenes,
  // at 720p in material, normal and depth modes; all other uniforms unchanged.
  for (const [sceneIndex, scene] of scenes.entries())
    for (const mode of [0, 1, 2]) {
      for (const name of names) {
        const uniforms = { ...scene.uniforms, uMode: mode };
        const r = await gpu.command({
          op: 'render',
          name,
          uniforms,
          width: 1280,
          height: 720,
          frames: 1,
          warmup: 0,
          capture: true,
        });
        if (r.glError || r.disjoint || r.pixels.length !== 1280 * 720 * 4)
          throw Error('Invalid image capture');
        const bytes = Buffer.from(r.pixels);
        const path = output + `figures/${sceneIndex}-${mode}-${name}.rgba.gz`;
        const compressed = gzipSync(bytes);
        await writeFile(path, compressed);
        renders.push({
          scene: scene.scene,
          sceneIndex,
          mode,
          variant: name,
          width: 1280,
          height: 720,
          uniforms,
          path,
          format: 'RGBA8, bottom row first',
          rgbaSHA256: sha(bytes),
          fileSHA256: sha(compressed),
        });
      }
      console.log('Captured', scene.scene, 'mode', mode);
    }
  await writeFile(
    output + 'results/renders.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        hardware: gpu.hardware,
        hashes,
        shaderHashes,
        compiledShaderHashes,
        renders,
      },
      null,
      2,
    ) + '\n',
  );
  for (const [path, digest] of Object.entries(hashes))
    if (sha(await readFile(path)) !== digest)
      throw Error('Source/input changed during run: ' + path);
} finally {
  await gpu.close();
}
