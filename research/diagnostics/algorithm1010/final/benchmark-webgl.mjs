import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openGPU } from './browser-gpu.mjs';
import { rendererVariant, variantFiles } from '../renderer.mjs';
import { vertex, fragment } from '../../../../web/shader.js';
const dir = 'research/diagnostics/algorithm1010/';
const native = JSON.parse(await readFile(dir + 'results/benchmark.json', 'utf8'));
const scenes = native.measurements.filter(
  (x) => x.width === 1280 && x.variant === 'production' && x.round === 0,
);
const names = ['production', 'odm-direct'];
const gpu = await openGPU(),
  measurements = [],
  shaderHashes = {};
const median = (xs) => {
  const a = xs.slice().sort((a, b) => a - b),
    n = a.length;
  return (a[Math.floor((n - 1) / 2)] + a[Math.floor(n / 2)]) / 2;
};
try {
  console.log(JSON.stringify(gpu.hardware));
  for (const name of names) {
    const source = await rendererVariant(fragment, name);
    shaderHashes[name] = createHash('sha256').update(source).digest('hex');
    if (shaderHashes[name] !== native.shaderHashes[name]) throw Error('Native shader changed');
    await gpu.compile(name, vertex, source);
  }
  for (const [index, scene] of scenes.entries())
    for (let round = 0; round < 3; round++) {
      const order = (round + index) % 2 ? names.slice().reverse() : names;
      for (const name of order) {
        const r = await gpu.command({
          op: 'render',
          name,
          uniforms: scene.uniforms,
          width: 1280,
          height: 720,
          frames: 10,
          warmup: 5,
        });
        if (r.glError || r.disjoint) throw Error('Invalid timing block: ' + JSON.stringify(r));
        const sample = {
          variant: name,
          scene: scene.scene,
          round,
          width: 1280,
          height: 720,
          frames: 10,
          warmup: 5,
          gpuMilliseconds: r.milliseconds,
          completionMilliseconds: r.completionMilliseconds,
          blockMilliseconds: r.blockMilliseconds,
          completionMillisecondsPerFrame: r.blockMilliseconds / 10,
          uniforms: scene.uniforms,
        };
        measurements.push(sample);
        console.log(
          scene.scene,
          name,
          round,
          'GPU median',
          r.milliseconds.length ? median(r.milliseconds).toFixed(3) : 'unavailable',
          'completion/frame',
          (r.blockMilliseconds / 10).toFixed(3),
        );
      }
    }
  const summaries = scenes.flatMap((scene) =>
    names.map((variant) => {
      const blocks = measurements.filter((x) => x.scene === scene.scene && x.variant === variant);
      const times = blocks.flatMap((x) => x.gpuMilliseconds);
      return {
        scene: scene.scene,
        variant,
        gpuMedianMilliseconds: times.length ? median(times) : null,
        completionMedianMilliseconds: median(blocks.flatMap((x) => x.completionMilliseconds)),
        gpuBlockMedians: blocks.map((x) =>
          x.gpuMilliseconds.length ? median(x.gpuMilliseconds) : null,
        ),
        completionBlockMeans: blocks.map((x) => x.completionMillisecondsPerFrame),
        frames: 30,
      };
    }),
  );
  const files = [
    'web/shader.js',
    'research/webgl.mjs',
    ...variantFiles,
    dir + 'final/browser-gpu.mjs',
    dir + 'final/benchmark-webgl.mjs',
    dir + 'results/benchmark.json',
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
    dir + 'final/results/webgl-benchmark.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        hardware: gpu.hardware,
        hashes,
        shaderHashes,
        method:
          'WebGL2 RGBA8 offscreen 1280x720, same four native scenes/uniforms, 24 interactions. Three alternating-order blocks per scene/variant; five warmup and ten measured completed frames. Every draw has a separate EXT_disjoint_timer_query_webgl2 elapsed query and synchronous 1-pixel readback before the next draw. Disjoint samples reject the run. GPU elapsed and draw-plus-readback wall times reported separately. Compilation, warmup, timer-result polling, full-image readback, Playwright IPC, UI and vsync excluded. Per-frame completion prevents elimination of earlier identical fullscreen draws.',
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
