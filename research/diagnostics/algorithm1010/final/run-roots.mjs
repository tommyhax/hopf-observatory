// Re-run the original 54 polynomial fixtures and 867 rays in WebGL2.
import { readFile } from 'node:fs/promises';
const original = new URL('../run.mjs', import.meta.url);
let source = await readFile(original, 'utf8');
source = source.replace(
  /from '(\.[^']+)'/g,
  (_, path) =>
    `from '${path.endsWith('gpu-client.mjs') ? new URL('browser-gpu.mjs', import.meta.url).href : new URL(path, original).href}'`,
);
source = source.replace("  ['stress', 'research/results/stress-reference.json'],", '');
source = source.replace(
  "  dir + 'run.mjs',",
  "  dir + 'run.mjs',\n  dir + 'final/run-roots.mjs',\n  dir + 'final/browser-gpu.mjs',\n  'research/webgl.mjs',",
);
source = source.replace("'results/gpu.json'", "'final/results/webgl-roots.json'");
try {
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
