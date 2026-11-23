// Run the exact same fixtures, coefficients, root collector and matcher inputs
// through GLSL ES 3.00 / WebGL 2 instead of the native OpenGL helper.
import { readFile } from 'node:fs/promises';
const original = new URL('run.mjs', import.meta.url);
let source = await readFile(original, 'utf8');
source = source.replace(
  /from '(\.[^']+)'/g,
  (_, path) =>
    `from '${new URL(path.endsWith('gpu-client.mjs') ? './browser-client.mjs' : path, original).href}'`,
);
source = source.replace(
  "  dir + 'run.mjs',",
  "  dir + 'run.mjs',\n  dir + 'run-browser.mjs',\n  dir + 'browser-client.mjs',\n  'research/webgl.mjs',",
);
source = source
  .replaceAll("'results/gpu.json'", "'results/webgl.json'")
  .replaceAll("'results/sanity.json'", "'results/webgl-sanity.json'");
try {
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
