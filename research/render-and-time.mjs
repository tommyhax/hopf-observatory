import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { openGPU } from './gpu-client.mjs';
import { figureScenes, benchmarkScenes, sceneUniforms } from './scenes.mjs';
import { vertex, fragment } from '../web/shader.js';
await mkdir('research/figures', { recursive: true });
await mkdir('research/results', { recursive: true });
const gpu = await openGPU();
try {
  await gpu.compile('render', vertex, fragment);
  const renders = [];
  for (const s of figureScenes()) {
    const u = sceneUniforms(s.objects, s.angles, s.eye);
    u.uResolution = [s.width, s.height];
    u.uMode = s.mode || 0;
    const path = resolve(`research/figures/${s.name}.ppm`);
    const r = await gpu.command({
      op: 'render',
      name: 'render',
      uniforms: u,
      width: s.width,
      height: s.height,
      frames: 1,
      path,
    });
    if (r.glError) throw Error('GL render error ' + r.glError);
    renders.push({ ...s, uniforms: u, path: `figures/${s.name}.ppm` });
    console.log(`Rendered ${s.name}`);
  }
  const measurements = [];
  for (const s of benchmarkScenes())
    for (const [width, height] of [
      [640, 360],
      [1280, 720],
    ])
      for (const budget of [8, 16, 24]) {
        const u = sceneUniforms(s.objects, s.angles, s.eye, budget);
        u.uResolution = [width, height];
        const r = await gpu.command({
          op: 'render',
          name: 'render',
          uniforms: u,
          width,
          height,
          frames: 30,
        });
        if (r.glError) throw Error('GL timing error ' + r.glError);
        const sorted = r.milliseconds.slice().sort((a, b) => a - b),
          median = (sorted[14] + sorted[15]) / 2;
        measurements.push({
          scene: s.name,
          width,
          height,
          budget,
          warmup: 5,
          frames: 30,
          milliseconds: r.milliseconds,
          median,
          p95: sorted[28],
          uniforms: u,
        });
        console.log(`${s.name}, ${width}×${height}, ${budget}: ${median.toFixed(2)} ms`);
      }
  const shaderHash = createHash('sha256')
    .update(await readFile('web/shader.js'))
    .digest('hex');
  await writeFile(
    'research/results/rendering.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        hardware: gpu.hardware,
        shaderHash,
        method:
          'Native offscreen GLSL; wall time around glDrawArrays + glFinish; excludes shader compilation, readback, browser, UI and vsync; five warmup frames, 30 measured frames per configuration',
        renders,
        measurements,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await gpu.close();
}
