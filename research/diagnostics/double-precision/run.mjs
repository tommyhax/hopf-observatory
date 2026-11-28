// CPU-only replay; preserve every original uploaded binary32 geometry value.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dot, rayChart, rootsBernstein } from '../../../web/math.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const local = (name) => resolve(root, name);
const read = async (name) => JSON.parse(await readFile(local(name), 'utf8'));
const digest = async (name) =>
  createHash('sha256')
    .update(await readFile(local(name)))
    .digest('hex');

export function mapRoot(x, chart, k, L) {
  if (!Number.isFinite(x)) return null; // Retain a nonfinite candidate as a failure.
  const far = chart === 1 || chart === 3;
  const sign = chart < 2 ? -1 : 1;
  if (x < 0 || x > 1 || (x === 0 && (far || sign < 0))) return undefined;
  const s = sign * (far ? L / x : L * x) - k;
  if (!Number.isFinite(s)) return null;
  return s > 0 ? s : undefined;
}

export function collect(charts, k, L) {
  const outputs = charts.flatMap(({ chart, roots }) =>
    roots.map((x) => mapRoot(x, chart, k, L)).filter((s) => s !== undefined),
  );
  // Nonfinite candidates must remain accountable, even if there is more than one.
  return [...new Set(outputs.filter((s) => s !== null)), ...outputs.filter((s) => s === null)].sort(
    (a, b) => (a ?? Infinity) - (b ?? Infinity),
  );
}

export function construct64(test) {
  const k = dot(test.o, test.d);
  const center = test.o.map((v, i) => v - k * test.d[i]);
  const L = Math.max(1, Math.hypot(...center));
  const charts = [0, 1, 2, 3].map((chart) => {
    const sign = chart < 2 ? -1 : 1;
    const { b } = rayChart(
      center,
      test.d.map((v) => sign * v),
      test.P,
      test.c,
      chart === 1 || chart === 3,
      L,
    );
    return { chart, b, roots: rootsBernstein(b) };
  });
  return { k, center, L, charts, roots: collect(charts, k, L) };
}

async function main() {
  const manifestName = 'research/diagnostics/grazing/frozen-manifest.json';
  const manifest = await read(manifestName);
  const prefix = relative(root, here);
  const paths = [
    ...new Set([
      manifestName,
      ...Object.keys(manifest.files),
      'research/diagnostics/grazing/results/gpu.json',
      'research/diagnostics/grazing/results/analysis.json',
      'research/diagnostics/grazing/analyze.py',
      'research/analyze.py',
      'research/reference.py',
      'web/math.js',
      ...['PROTOCOL.md', 'run.mjs', 'analyze.py', 'test-replay.mjs', 'test_analysis.py'].map(
        (name) => `${prefix}/${name}`,
      ),
    ]),
  ];
  const hashes = Object.fromEntries(
    await Promise.all(paths.map(async (p) => [p, await digest(p)])),
  );
  const inheritedMismatches = Object.entries(manifest.files)
    .filter(([p, expected]) => hashes[p] !== expected)
    .map(([path, expected]) => ({ path, expected, actual: hashes[path] }));
  assert(
    inheritedMismatches.every((m) => m.path === 'web/technical-note.html'),
    'Unexpected inherited frozen-manifest mismatch',
  );

  const reference = await read('research/results/stress-reference.json');
  const gpu = await read('research/diagnostics/grazing/results/gpu.json');
  const captures = new Map(gpu.results.map((r) => [r.id, r]));
  const cases = reference.cases.filter((c) => c.family === 'tangent');
  assert.equal(cases.length, 600);
  assert.equal(captures.size, cases.length);
  const rows = cases.map((test) => {
    assert(
      [...test.P.flat(), test.c, ...test.o, ...test.d].every((v) => Math.fround(v) === v),
      `Input is not uploaded binary32 geometry: ${test.id}`,
    );
    const captured = captures.get(test.id);
    const [k, L] = captured.geometry;
    const charts = captured.charts.slice(0, 4).map(({ chart, coefficients }) => {
      const b = [...coefficients.slice(8, 12), coefficients[5]];
      return { chart, b, roots: rootsBernstein(b) };
    });
    return {
      id: test.id,
      gpu32Raw: captured.methods.compactified.raw,
      gpu32Refined: captured.methods.compactified.polished,
      solve64Only: { k, L, charts, roots: collect(charts, k, L) },
      construct64Solve64: construct64(test),
    };
  });
  for (const [p, expected] of Object.entries(hashes))
    assert.equal(await digest(p), expected, `Input changed during capture: ${p}`);
  const report = {
    schemaVersion: 1,
    experimentDate: '2026-11-28',
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    selection: 'All 600 tangent queries; unchanged uploaded binary32 P, c, o, d',
    solver: {
      arithmetic: 'binary64',
      stationaryTolerance: 1e-12,
      bisections: 55,
      homogeneousPolishing: false,
      residualFiltering: false,
      collector: 's > 0; exact distance duplicates only; no finite far cutoff',
    },
    inheritedMismatches,
    hashes,
    rows,
  };
  // JSON must not silently turn accidental NaNs in coefficients into nulls.
  const encoded = JSON.stringify(
    report,
    (key, value) => {
      if (typeof value === 'number' && !Number.isFinite(value))
        throw new Error(`Nonfinite captured number: ${key}`);
      return value;
    },
    2,
  );
  await mkdir(resolve(here, 'results'), { recursive: true });
  await writeFile(resolve(here, 'results/cpu.json'), encoded + '\n');
  console.log(`Captured ${rows.length} CPU double-precision queries.`);
  console.log(
    `Protected ${paths.length} source/input paths; pre-existing documentation mismatches: ${inheritedMismatches.length}.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
