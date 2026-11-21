import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openGPU } from './gpu-client.mjs';
import { benchmarkScenes, sceneUniforms } from './scenes.mjs';
import { rendererVariant, variantFiles } from './renderer-variants.mjs';
import { vertex, fragment } from '../web/shader.js';
import { makeTorus } from '../web/scene.js';

const names = [
  'bernstein-unguarded',
  'bernstein-decreasing',
  'bernstein-guarded',
  'yuksel-direct',
  'yuksel-charts',
];
const scenes = benchmarkScenes();
scenes.splice(1, 0, {
  name: 'single 0.01 shell',
  objects: [{ ...makeTorus(45, '#dea1d6'), shellWidth: 0.01, opacity: 0, ior: 1.45 }],
  angles: [0, 0, 0, 0, 0, 0],
  eye: [4, 3, 7],
});
const gpu = await openGPU(),
  measurements = [],
  shaderHashes = {};
const budget = 24,
  rounds = 3,
  frames = 10;
const median = (values) => {
  const sorted = values.slice().sort((a, b) => a - b),
    mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
try {
  for (const name of names) {
    const source = await rendererVariant(fragment, name);
    shaderHashes[name] = createHash('sha256').update(source).digest('hex');
    await gpu.compile(name, vertex, source);
  }
  // Rotate the starting variant by round/configuration to reduce ordering bias.
  // Warmups and compilation are excluded; every timed sample completes a frame.
  for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
    const scene = scenes[sceneIndex];
    for (const [width, height] of [
      [640, 360],
      [1280, 720],
    ]) {
      const uniforms = sceneUniforms(scene.objects, scene.angles, scene.eye, budget);
      uniforms.uResolution = [width, height];
      for (let round = 0; round < rounds; round++) {
        const shift = (round + sceneIndex) % names.length;
        const order = [...names.slice(shift), ...names.slice(0, shift)];
        for (const name of order) {
          const r = await gpu.command({ op: 'render', name, uniforms, width, height, frames });
          if (r.glError) throw Error('GL timing error ' + r.glError);
          measurements.push({
            variant: name,
            scene: scene.name,
            width,
            height,
            budget,
            round,
            warmup: 5,
            frames,
            milliseconds: r.milliseconds,
            median: median(r.milliseconds),
            uniforms,
          });
          console.log(
            scene.name +
              ', ' +
              width +
              'x' +
              height +
              ', round ' +
              round +
              ', ' +
              name +
              ': ' +
              median(r.milliseconds).toFixed(2) +
              ' ms',
          );
        }
      }
    }
  }
  const summaries = [];
  for (const scene of scenes)
    for (const [width, height] of [
      [640, 360],
      [1280, 720],
    ])
      for (const name of names) {
        const blocks = measurements.filter(
          (x) => x.variant === name && x.scene === scene.name && x.width === width,
        );
        const samples = blocks.flatMap((x) => x.milliseconds),
          sorted = samples.slice().sort((a, b) => a - b);
        summaries.push({
          variant: name,
          scene: scene.name,
          width,
          height,
          budget,
          frames: samples.length,
          median: median(samples),
          p25: sorted[7],
          p75: sorted[22],
          blockMedians: blocks.map((x) => x.median),
        });
      }
  const files = [
    'web/shader.js',
    'web/scene.js',
    'web/math.js',
    'research/benchmark-renderers.mjs',
    'research/scenes.mjs',
    'research/native-render.m',
    'research/gpu-client.mjs',
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
    'research/results/renderer-benchmark.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        hardware: gpu.hardware,
        hashes,
        shaderHashes,
        method:
          'Full production optical renderer with replacement intersection/refinement functions; native draw + glFinish wall time. No compilation, readback, UI or vsync. Three rotated-order blocks of five warmup and ten measured frames per variant/configuration.',
        budget,
        rounds,
        framesPerRound: frames,
        variants: names,
        measurements,
        summaries,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await gpu.close();
}
