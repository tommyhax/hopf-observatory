// Fixed complete-render comparisons; byte readback is image evidence, not ground truth.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openGPU } from './gpu-client.mjs';
import { rendererVariant, variantFiles } from './renderer-variants.mjs';
import { benchmarkScenes, sceneUniforms } from './scenes.mjs';
import { vertex, fragment } from '../web/shader.js';
const variants = ['production', 'yuksel-direct', 'yuksel-charts'];
const scenes = benchmarkScenes();
for (const angle of [44.995, 45.005])
  scenes.push({ ...scenes[2], name: 'thin shells XW ' + angle, angles: [0, 0, angle, 0, 0, 0] });
const gpu = await openGPU(),
  renders = [],
  shaderHashes = {};
await mkdir('research/figures', { recursive: true });
try {
  for (const variant of variants) {
    const source = await rendererVariant(fragment, variant);
    shaderHashes[variant] = createHash('sha256').update(source).digest('hex');
    await gpu.compile(variant, vertex, source);
  }
  for (const [index, scene] of scenes.entries())
    for (const mode of [0, 1, 2]) {
      const uniforms = sceneUniforms(scene.objects, scene.angles, scene.eye, 24);
      uniforms.uResolution = [480, 270];
      uniforms.uMode = mode;
      for (const variant of variants) {
        const path = 'research/figures/comparison-' + index + '-' + mode + '-' + variant + '.ppm';
        const r = await gpu.command({
          op: 'render',
          name: variant,
          uniforms,
          width: 480,
          height: 270,
          frames: 1,
          path,
        });
        if (r.glError) throw Error('Render GL error ' + r.glError);
        renders.push({ scene: scene.name, variant, mode, path, uniforms });
      }
      console.log('Compared scene ' + scene.name + ', mode ' + mode);
    }
  const files = [
    'web/shader.js',
    'web/math.js',
    'web/scene.js',
    'research/compare-renders.mjs',
    'research/scenes.mjs',
    'research/gpu-client.mjs',
    'research/native-render.m',
    ...variantFiles,
  ];
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
    'research/results/render-comparison.json',
    JSON.stringify(
      { date: new Date().toISOString(), hardware: gpu.hardware, hashes, shaderHashes, renders },
      null,
      2,
    ) + '\n',
  );
} finally {
  await gpu.close();
}
