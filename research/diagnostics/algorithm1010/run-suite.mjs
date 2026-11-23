// Reuse the frozen transport/timing suites with only backend and output routing
// changed. Do not copy, alter, or overwrite the original experiment files.
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const benchmark = process.argv.includes('--benchmark');
const original = new URL(
  benchmark ? '../../benchmark-renderers.mjs' : '../../../scripts/run-gpu-checks.mjs',
  import.meta.url,
);
const renderer = new URL('renderer.mjs', import.meta.url).href;
const destination = new URL('results/', import.meta.url);
await mkdir(destination, { recursive: true });
let source = await readFile(original, 'utf8');
function replaceOnce(before, after) {
  if (source.split(before).length !== 2) throw Error('Non-unique suite replacement: ' + before);
  source = source.replace(before, after);
}
// Resolve all existing relative imports against their original script location.
source = source.replace(
  /from '(\.[^']+)'/g,
  (_, path) =>
    `from '${path.endsWith('renderer-variants.mjs') ? renderer : new URL(path, original).href}'`,
);
source = source.replaceAll('import.meta.url', JSON.stringify(original.href));
if (benchmark) {
  replaceOnce(
    `const names = [
  'bernstein-unguarded',
  'bernstein-decreasing',
  'bernstein-guarded',
  'yuksel-direct',
  'yuksel-charts',
];`,
    "const names = ['production', 'odm-direct', 'odm-charts'];",
  );
  replaceOnce(
    "'research/results/renderer-benchmark.json'",
    JSON.stringify(fileURLToPath(new URL('benchmark.json', destination))),
  );
} else {
  const name = process.argv.find((x) => x.startsWith('--variant='))?.split('=')[1];
  if (!['odm-direct', 'odm-charts'].includes(name))
    throw Error('Specify --variant=odm-direct or --variant=odm-charts');
  process.env.HOPF_GPU_REPORT = fileURLToPath(new URL('transport-' + name + '.json', destination));
}
await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
