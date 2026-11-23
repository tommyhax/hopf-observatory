// Re-run the existing WebGL transport suite, routing only its report destination.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const original = new URL('../final/run-webgl-suite.mjs', import.meta.url);
const variant = process.argv.find((x) => x.startsWith('--variant='))?.split('=')[1];
if (
  !['production', 'production-unrolled', 'odm-loop', 'odm-direct'].includes(variant) ||
  process.argv.includes('--native')
)
  throw Error('Specify one of the four WebGL variants');
let source = await readFile(original, 'utf8');
source = source
  .replace('`results/${native', '`../traversal/results/${native')
  .replaceAll("'import.meta.url'", "'__ORIGINAL_IMPORT_META_URL__'")
  .replaceAll('import.meta.url', JSON.stringify(original.href))
  .replaceAll("'__ORIGINAL_IMPORT_META_URL__'", "'import.meta.url'");
await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
if (process.exitCode) throw Error('WebGL suite did not complete successfully');
const path = new URL(`results/webgl-transport-${variant}.json`, import.meta.url);
const report = JSON.parse(await readFile(path, 'utf8'));
report.sourceHashes['research/diagnostics/algorithm1010/traversal/run-correctness.mjs'] =
  createHash('sha256')
    .update(await readFile(new URL(import.meta.url)))
    .digest('hex');
await writeFile(path, JSON.stringify(report, null, 2) + '\n');
if (!report.passed) process.exitCode = 1;
