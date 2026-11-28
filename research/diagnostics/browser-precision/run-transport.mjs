// Run the existing optical suite with this experimental renderer in WebGL.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const original = new URL('../../../scripts/run-gpu-checks.mjs', import.meta.url);
const variant = process.argv.find((x) => x.startsWith('--variant='))?.split('=')[1] || 'paired';
if (!['production', 'paired'].includes(variant)) throw Error('Unknown variant');
// The imported suite reads argv itself.
if (!process.argv.some((x) => x.startsWith('--variant='))) process.argv.push('--variant=paired');
const reportPath = new URL(`results/transport-${variant}.json`, import.meta.url);
process.env.HOPF_GPU_REPORT = fileURLToPath(reportPath);
let source = await readFile(original, 'utf8');
source = source.replace(/from '(\.[^']+)'/g, (_, path) =>
  `from '${path.endsWith('renderer-variants.mjs') ? new URL('renderer.mjs', import.meta.url).href : new URL(path, original).href}'`);
source = source.replaceAll('import.meta.url', JSON.stringify(original.href));
const start = source.indexOf("if (process.platform !== 'darwin')");
const end = source.indexOf('const head = fragment.slice');
if (start < 0 || end < start) throw Error('Suite adapter markers changed');
source = source.slice(0, start) + `
const {openGPU}=await import(${JSON.stringify(new URL('../algorithm1010/final/browser-gpu.mjs', import.meta.url).href)});
const browserGPU=await openGPU();
const command=browserGPU.command;
const ready=Promise.resolve(browserGPU.hardware);
let metadata;
const desktop=source=>source;
` + source.slice(end);
const cleanup = '  gpu.stdin.end();\n  await rm(temp, { recursive: true, force: true });';
if (!source.includes(cleanup)) throw Error('Suite cleanup marker changed');
source = source.replace(cleanup, '  await browserGPU.close();');
source = source.replace(
  'Native macOS offscreen OpenGL; same GLSL bodies with #version 410 core replacing #version 300 es. Browser integration is not tested.',
  'Actual hardware browser WebGL2; original transport suite with paired-precision experimental intersections.');
try {
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  for (const path of [
    'research/diagnostics/browser-precision/run-transport.mjs',
    'research/diagnostics/algorithm1010/final/browser-gpu.mjs', 'research/webgl.mjs',
  ]) report.sourceHashes[path] = createHash('sha256').update(await readFile(path)).digest('hex');
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
