// Reuse the existing complete-render comparison protocol, with isolated outputs.
import { readFile } from 'node:fs/promises';
const original = new URL('../../compare-renders.mjs', import.meta.url);
let source = await readFile(original, 'utf8');
source = source.replace(
  /from '(\.[^']+)'/g,
  (_, path) =>
    `from '${path.endsWith('renderer-variants.mjs') ? new URL('renderer.mjs', import.meta.url).href : new URL(path, original).href}'`,
);
source = source.replace(
  "['production', 'yuksel-direct', 'yuksel-charts']",
  "['production', 'odm-direct', 'odm-charts']",
);
source = source.replaceAll('research/figures', 'research/diagnostics/algorithm1010/figures');
source = source.replaceAll(
  'research/results/render-comparison.json',
  'research/diagnostics/algorithm1010/results/render-comparison.json',
);
source = source.replace(
  '    ...variantFiles,',
  "    ...variantFiles,\n    'research/diagnostics/algorithm1010/run-renders.mjs',",
);
try {
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
