// Execute the existing complete transport suite through actual browser WebGL2.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const original = new URL('../../../../scripts/run-gpu-checks.mjs', import.meta.url);
const native = process.argv.includes('--native');
const variant = process.argv.find((x) => x.startsWith('--variant='))?.split('=')[1] || 'production';
process.env.HOPF_GPU_REPORT = fileURLToPath(
  new URL(`results/${native ? 'native' : 'webgl'}-transport-${variant}.json`, import.meta.url),
);
let source = await readFile(original, 'utf8');
source = source.replace(
  /from '(\.[^']+)'/g,
  (_, path) =>
    `from '${path.endsWith('renderer-variants.mjs') ? new URL('variants.mjs', import.meta.url).href : new URL(path, original).href}'`,
);
source = source.replaceAll('import.meta.url', JSON.stringify(original.href));
const start = source.indexOf("if (process.platform !== 'darwin')"),
  end = source.indexOf('const head = fragment.slice');
if (start < 0 || end < start) throw Error('Transport adapter markers changed');
if (!native)
  source =
    source.slice(0, start) +
    `
const {openGPU} = await import(${JSON.stringify(new URL('browser-gpu.mjs', import.meta.url).href)});
const browserGPU = await openGPU();
const command = browserGPU.command;
const ready = Promise.resolve(browserGPU.hardware);
let metadata;
const desktop = source => source;
` +
    source.slice(end);
if (!native)
  source = source.replace(
    '  gpu.stdin.end();\n  await rm(temp, { recursive: true, force: true });',
    '  await browserGPU.close();',
  );
source = source.replace(
  "'tests/native-gpu.m',",
  "'tests/native-gpu.m',\n      'research/diagnostics/algorithm1010/final/browser-gpu.mjs',\n      'research/diagnostics/algorithm1010/final/run-webgl-suite.mjs',\n      'research/diagnostics/algorithm1010/final/variants.mjs',\n      'research/webgl.mjs',",
);
if (!native)
  source = source.replace(
    'Native macOS offscreen OpenGL; same GLSL bodies with #version 410 core replacing #version 300 es. Browser integration is not tested.',
    'Actual browser WebGL2, GLSL ES 3.00, hardware ANGLE Metal; same transport suite and uniforms, fresh browser profile.',
  );
try {
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
