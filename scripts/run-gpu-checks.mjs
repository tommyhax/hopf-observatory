#!/usr/bin/env node
// Offscreen hardware validation on macOS. GLSL ES 3.00 is compiled as
// desktop GLSL 4.10 by changing only the version directive. This exercises
// the shader's actual arithmetic/transport on the GPU, not Chrome's WebGL API.
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { vertex, fragment as baseFragment } from '../web/shader.js';
import { rendererVariant, variantFiles } from '../research/renderer-variants.mjs';
import { projector, intersect, gradient, dot, shellLevels } from '../web/math.js';
import {
  scenePreset,
  makeTorus,
  objectLevels,
  linearColor,
  rayBiasScale,
  levelAt,
} from '../web/scene.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  rad = Math.PI / 180;
const variant = process.argv.find((x) => x.startsWith('--variant='))?.split('=')[1] || 'production';
const fragment = await rendererVariant(baseFragment, variant);
const output =
  process.env.HOPF_GPU_REPORT ||
  join(
    root,
    variant === 'production'
      ? 'docs/gpu-results.json'
      : 'research/results/transport-' + variant + '.json',
  );
const selected = process.argv.find((x) => x.startsWith('--suite='))?.split('=')[1] || 'all';
if (process.platform !== 'darwin')
  throw Error(
    'This native GPU runner requires macOS and Xcode command-line tools. Use the WebGL verification pages on other platforms.',
  );
const temp = await mkdtemp(join(tmpdir(), 'hopf-gpu-')),
  binary = join(temp, 'check');
const build = spawnSync(
  'clang',
  [
    '-w',
    '-O2',
    '-fobjc-arc',
    join(root, 'tests/native-gpu.m'),
    '-framework',
    'Foundation',
    '-framework',
    'OpenGL',
    '-o',
    binary,
  ],
  { encoding: 'utf8' },
);
if (build.status !== 0) throw Error(build.stderr);
const gpu = spawn(binary, [], { stdio: ['pipe', 'pipe', 'inherit'] });
const pending = [];
let metadata;
const ready = new Promise((resolve, reject) => pending.push({ resolve, reject }));
createInterface({ input: gpu.stdout }).on('line', (line) => {
  const request = pending.shift();
  if (!request) return;
  try {
    const data = JSON.parse(line);
    if (data.error) request.reject(Error(data.error));
    else request.resolve(data);
  } catch (error) {
    request.reject(error);
  }
});
gpu.on('exit', (code) => {
  for (const p of pending.splice(0)) p.reject(Error(`GPU helper exited ${code}`));
});
const command = (data) =>
  new Promise((resolve, reject) => {
    pending.push({ resolve, reject });
    gpu.stdin.write(JSON.stringify(data) + '\n');
  });
const desktop = (source) => source.replace('#version 300 es', '#version 410 core');
const head = fragment.slice(0, fragment.lastIndexOf('void main()'));
async function compile(name, body, source = head) {
  return command({
    op: 'compile',
    name,
    vertex: desktop(vertex),
    fragment: desktop(source + body),
  });
}
async function draw(name, uniforms) {
  const r = await command({ op: 'draw', name, uniforms });
  if (r.glError) throw Error(`OpenGL error ${r.glError}`);
  return r.pixels;
}
const norm = (v) => {
  const len = Math.hypot(...v);
  return v.map((x) => x / len);
};
const f32 = (v) => v.map(Math.fround);
const point = (o, d, s) => o.map((x, i) => x + s * d[i]);
const floatPoint = (o, d, s) => o.map((x, i) => Math.fround(x + Math.fround(s * d[i])));
function config(objects, angles, o, d) {
  const P = projector(angles).map((row) => row.map(Math.fround)),
    b = objects.map(objectLevels),
    pad = (a) => [...a, ...Array(3 - a.length).fill(0)];
  const low = pad(b.map((x) => Math.fround(x.low))),
    high = pad(b.map((x) => Math.fround(x.high))),
    c = pad(b.map((x) => Math.fround(x.c)));
  return {
    objects,
    P,
    low,
    high,
    c,
    bias: Math.fround(rayBiasScale(objects)),
    u: {
      uP: P.flat(),
      uCount: objects.length,
      uEnabled: pad(objects.map((x) => +x.enabled)),
      uShells: pad(objects.map((x) => +x.shell)),
      uLevels: c,
      uLows: low,
      uHighs: high,
      'uOptics[0]': objects.flatMap((x) => [x.opacity, x.ior, x.roughness, x.metallic]),
      'uColors[0]': objects.flatMap((x) => linearColor(x.color)),
      uEye: f32(o),
      uForward: f32(d),
      uRayBias: Math.fround(rayBiasScale(objects)),
      uBounces: 24,
      uEnvironment: 3,
      uMode: 0,
      uExposure: 0,
      uEnvRotation: 0,
    },
  };
}
function expectedHits(conf, o, d) {
  const hits = [];
  conf.objects.forEach((object, id) => {
    if (!object.enabled) return;
    for (const [level, sign] of object.shell
      ? [
          [conf.low[id], -1],
          [conf.high[id], 1],
        ]
      : [[conf.c[id], -1]])
      for (const s of intersect(o, d, conf.P, level))
        if (s > 0.5 * conf.bias * Math.max(1, Math.hypot(...o)) && s < 1e7)
          hits.push({ s, level, sign, id });
  });
  hits.sort((a, b) => a.s - b.s || a.id - b.id);
  // The double-precision reference can split a grazing double root by less
  // than float32 resolution. Count such SAME-boundary contacts once; never
  // merge two shell walls. Report these exceptions explicitly.
  const result = [];
  result.unresolvedTangencies = [];
  for (const hit of hits) {
    const previous = result.at(-1),
      resolution = 8 * 2 ** -23 * Math.max(1, Math.hypot(...o), hit.s);
    if (
      previous &&
      previous.id === hit.id &&
      previous.level === hit.level &&
      hit.s - previous.s < resolution
    )
      result.unresolvedTangencies.push({ first: previous.s, second: hit.s, resolution });
    else result.push(hit);
  }
  return result;
}
function effectiveMedium(conf, p) {
  const h = levelAt(p, conf.P);
  let id = -1,
    width = 2;
  conf.objects.forEach((o, i) => {
    if (!o.enabled) return;
    if (o.shell ? h > conf.low[i] && h < conf.high[i] : h > conf.c[i]) {
      const w = o.shell ? conf.high[i] - conf.low[i] : 1 - conf.c[i];
      if (w <= width) {
        width = w;
        id = i;
      }
    }
  });
  return id;
}
const sourceHashes = Object.fromEntries(
  await Promise.all(
    [
      'web/shader.js',
      'web/math.js',
      'web/scene.js',
      'scripts/run-gpu-checks.mjs',
      'tests/native-gpu.m',
      ...(variant === 'production' ? [] : variantFiles),
    ].map(async (file) => [
      file,
      createHash('sha256')
        .update(await readFile(join(root, file)))
        .digest('hex'),
    ]),
  ),
);
const report = {
  variant,
  shaderHashes: {
    vertex: createHash('sha256').update(vertex).digest('hex'),
    fragment: createHash('sha256').update(fragment).digest('hex'),
  },
  sourceHashes,
  date: new Date().toISOString(),
  execution:
    'Native macOS offscreen OpenGL; same GLSL bodies with #version 410 core replacing #version 300 es. Browser integration is not tested.',
  suite: selected,
  hardware: null,
  results: {},
};
try {
  metadata = await ready;
  report.hardware = metadata;
  console.log(`GPU: ${metadata.renderer}, ${metadata.version}`);
  await command({
    op: 'compile',
    name: 'production',
    vertex: desktop(vertex),
    fragment: desktop(fragment),
  });
  await compile(
    'hits',
    'void main(){float level,sign;int id;float s=sceneHit(uEye,normalize(uForward),level,sign,id);outColor=vec4(s,level,sign,float(id));}',
  );
  await compile(
    'optical',
    'void main(){vec3 d=normalize(uForward);outColor=vec4(abs(trace(uEye,d)-environment(d)),1.);}',
  );
  // Instrument the actual production trace() at the Snell calculation. Earlier
  // bounces, offsets, medium changes and TIR branches are left unchanged.
  const outputs =
    'layout(location=0) out vec4 outColor; layout(location=1) out vec4 debugMedia; layout(location=2) out vec4 debugDirection; layout(location=3) out vec4 debugNormal; uniform int uDebugStep; vec4 capturedHit,capturedMedia,capturedDirection,capturedNormal;';
  const needle = '// Refraction event: numerical tests capture the state at this point.';
  if (!head.includes(needle))
    throw Error('Cannot locate production Snell calculation for instrumentation');
  const instrumented = head
    .replace('out vec4 outColor;', outputs)
    .replace(
      needle,
      needle +
        '\nif(bounce==uDebugStep){capturedHit=vec4(p,s);capturedMedia=vec4(float(before),float(after),n1,n2);capturedDirection=vec4(transmitted,tir?1.:0.);capturedNormal=vec4(n,level);return radiance;}',
    );
  await compile(
    'snell',
    'void main(){capturedHit=vec4(0,0,0,-1);capturedMedia=vec4(0);capturedDirection=vec4(0);capturedNormal=vec4(0);trace(uEye,normalize(uForward));outColor=capturedHit;debugMedia=capturedMedia;debugDirection=capturedDirection;debugNormal=capturedNormal;}',
    instrumented,
  );
  console.log('Production shader and instrumented transport compiled.');
  const thin = [];
  for (const t of [1, 5, 25, 45, 65, 85, 89])
    for (const width of [0.01, 0.05, 0.5, 3]) {
      const object = { ...makeTorus(t, '#ffffff'), shellWidth: width, opacity: 0, ior: 1.45 };
      thin.push({
        name: `axis t=${t}, width=${width}`,
        objects: [object],
        angles: [0, 0, 0, 0, 0, 0],
        o: [
          -(
            1 / Math.cos(shellLevels(t, width).upperT * rad) +
            Math.tan(shellLevels(t, width).upperT * rad) +
            2
          ),
          0,
          0,
        ],
        d: [1, 0, 0],
        required: 8,
      });
    }
  for (const width of [0.01, 0.05, 3]) {
    const objects = scenePreset('glass');
    objects.forEach((o) => Object.assign(o, { shellWidth: width, opacity: 0, ior: 1.45 }));
    thin.push({
      name: `three shells, width=${width}`,
      objects,
      angles: [0, 0, 0, 0, 0, 0],
      o: [-8, 0, 0],
      d: [1, 0, 0],
      required: 24,
    });
  }
  const crossings = {
    passed: 0,
    total: thin.length,
    hitCount: 0,
    maxRelativeError: 0,
    failures: [],
  };
  for (const test of thin) {
    const conf = config(test.objects, test.angles, test.o, test.d),
      d = norm(conf.u.uForward),
      expected = expectedHits(conf, conf.u.uEye, d);
    let o = conf.u.uEye.slice(),
      total = 0,
      actual = [];
    for (let j = 0; j < 25; j++) {
      const out = await draw('hits', { ...conf.u, uEye: o });
      if (out[0] < 0) break;
      actual.push({ s: total + out[0], level: out[1], sign: out[2], id: out[3] });
      const p = point(o, d, out[0]),
        eps = conf.bias * Math.max(1, Math.hypot(...p));
      o = f32(point(p, d, eps));
      total += out[0] + eps;
    }
    let error = 0,
      valid = actual.length === test.required && expected.length === test.required;
    expected.forEach((e, i) => {
      const a = actual[i];
      if (!a) {
        valid = false;
        return;
      }
      error = Math.max(error, Math.abs(a.s - e.s) / Math.max(1, e.s));
      if (a.level !== e.level || a.sign !== e.sign || a.id !== e.id) valid = false;
    });
    crossings.hitCount += actual.length;
    crossings.maxRelativeError = Math.max(crossings.maxRelativeError, error);
    if (valid && error < 0.003) crossings.passed++;
    else crossings.failures.push({ name: test.name, expected, actual, error });
  }
  report.results.thinCrossings = crossings;
  console.log(`Thin crossings: ${crossings.passed}/${crossings.total}`);
  const paths = thin.filter((t) => t.name.includes('width=0.01'));
  for (const angle of [0, 22, 44.99, 45.01, 70])
    for (const y of [0.15, 0.55])
      paths.push({
        name: `oblique 0.01 shell, XW=${angle}, y=${y}`,
        objects: [{ ...makeTorus(45, '#ffffff'), shellWidth: 0.01, opacity: 0, ior: 1.45 }],
        angles: [0, 0, angle * rad, 0, 0, 0],
        o: [-6, y, 0.2],
        d: [1, 0, 0],
      });
  for (const t of [5, 45, 85])
    for (const offset of [-0.005, 0, 0.005])
      paths.push({
        name: `pole boundary 0.01 shell, t=${t}, offset=${offset}`,
        objects: [{ ...makeTorus(t, '#ffffff'), shellWidth: 0.01, opacity: 0, ior: 1.45 }],
        angles: [0, 0, (90 - t + offset) * rad, 0, 0, 0],
        o: [-8, 0.01, 0.15],
        d: [1, 0, 0],
      });
  for (const angle of [0, 24.99, 25.005, 44.99, 45.005, 64.99, 65.005, 80]) {
    const objects = scenePreset('glass');
    objects.forEach((o) => Object.assign(o, { shellWidth: 0.01, opacity: 0, ior: 1.45 }));
    paths.push({
      name: `three oblique 0.01 shells, XW=${angle}`,
      objects,
      angles: [0, 0, angle * rad, 0, 0, 0],
      o: [-8, 0.1, 0.15],
      d: [1, 0, 0],
    });
  }
  paths.push({
    name: 'TIR inside a 0.01-degree shell',
    objects: [{ ...makeTorus(45, '#ffffff'), shellWidth: 0.01, opacity: 0, ior: 1.45 }],
    angles: [0, 0, 0, 0, 0, 0],
    o: [Math.SQRT2 + 1, 0, 0],
    d: norm([0.1, 1, 0]),
    tir: true,
  });
  const snell = {
    passed: 0,
    total: paths.length,
    interfaces: 0,
    entries: 0,
    exits: 0,
    totalInternalReflections: 0,
    maxSnellResidual: 0,
    maxNormalError: 0,
    failures: [],
    paths: [],
  };
  for (const test of paths) {
    const conf = config(test.objects, test.angles, test.o, test.d);
    let o = conf.u.uEye.slice(),
      d = norm(conf.u.uForward),
      count = 0,
      failures = [],
      entries = 0,
      exits = 0,
      tirCount = 0;
    for (let step = 0; step < 24; step++) {
      const out = await draw('snell', { ...conf.u, uDebugStep: step });
      if (out[3] < 0) {
        const remaining = expectedHits(conf, o, d)[0];
        if (remaining)
          failures.push({ step, kind: 'transport ended before next interface', remaining });
        break;
      }
      count++;
      const p = out.slice(0, 3),
        s = out[3],
        before = out[4],
        after = out[5],
        n1 = out[6],
        n2 = out[7],
        transmitted = out.slice(8, 11),
        tir = out[11] > 0.5,
        n = out.slice(12, 15),
        level = out[15];
      const expected = expectedHits(conf, o, d)[0];
      if (
        !expected ||
        Math.abs(expected.s - s) / Math.max(1, s) > 0.003 ||
        expected.level !== level
      )
        failures.push({ step, kind: 'wrong or skipped interface', expected, actual: { s, level } });
      let expectedNormal = norm(gradient(p, conf.P, level));
      if (dot(d, expectedNormal) > 0) expectedNormal = expectedNormal.map((x) => -x);
      const normalError = Math.hypot(...n.map((x, i) => x - expectedNormal[i]));
      snell.maxNormalError = Math.max(snell.maxNormalError, normalError);
      if (normalError > 2e-4) failures.push({ step, kind: 'normal mismatch', normalError });
      const ci = Math.max(0, Math.min(1, -dot(d, n))),
        eta = n1 / n2,
        K = 1 - eta * eta * (1 - ci * ci),
        eps = Math.fround(conf.bias * Math.max(1, Math.hypot(...p)));
      const expectedBefore = effectiveMedium(conf, o),
        probe = point(p, n, -eps),
        expectedAfter = effectiveMedium(conf, probe);
      if (before !== expectedBefore || after !== expectedAfter)
        failures.push({
          step,
          kind: 'medium mismatch',
          before,
          after,
          expectedBefore,
          expectedAfter,
        });
      if (!tir && before < 0 && after >= 0) entries++;
      if (!tir && before >= 0 && after < 0) exits++;
      const wantN1 = before < 0 ? 1 : Math.fround(test.objects[before].ior),
        wantN2 = after < 0 ? 1 : Math.fround(test.objects[after].ior);
      if (n1 !== wantN1 || n2 !== wantN2)
        failures.push({ step, kind: 'wrong index ratio', n1, n2, wantN1, wantN2 });
      if (tir) {
        tirCount++;
        if (K > 2e-5) failures.push({ step, kind: 'false TIR', K });
        d = norm(d.map((x, i) => x + 2 * ci * n[i]));
        o = floatPoint(p, n, eps);
      } else {
        const expectedT = d.map((x, i) => eta * x + (eta * ci - Math.sqrt(Math.max(0, K))) * n[i]);
        const error = Math.hypot(...transmitted.map((x, i) => x - expectedT[i]));
        const sinI = Math.hypot(...d.map((x, i) => x + ci * n[i])),
          ct = -dot(transmitted, n),
          sinT = Math.hypot(...transmitted.map((x, i) => x + ct * n[i]));
        const residual = Math.abs(n1 * sinI - n2 * sinT);
        snell.maxSnellResidual = Math.max(snell.maxSnellResidual, residual);
        if (
          K < -2e-5 ||
          error > 2e-4 ||
          residual > 2e-4 ||
          Math.abs(Math.hypot(...transmitted) - 1) > 2e-4
        )
          failures.push({ step, kind: 'Snell violation', K, error, residual });
        o = floatPoint(p, n, -eps);
        d = norm(transmitted);
      }
    }
    if (test.required && count !== test.required)
      failures.push({ kind: 'wrong interface count', count, required: test.required });
    if (test.required && entries !== exits)
      failures.push({ kind: 'unpaired entry/exit', entries, exits });
    if (test.tir && tirCount === 0) failures.push({ kind: 'missing TIR' });
    if (!test.required && !test.tir && count === 0)
      failures.push({ kind: 'no interfaces exercised' });
    snell.interfaces += count;
    snell.entries += entries;
    snell.exits += exits;
    snell.totalInternalReflections += tirCount;
    snell.paths.push({
      name: test.name,
      count,
      entries,
      exits,
      tir: tirCount,
      budgetReached: count === 24,
    });
    if (failures.length) snell.failures.push({ name: test.name, failures });
    else snell.passed++;
  }
  report.results.refraction = snell;
  console.log(
    `Production Snell paths: ${snell.passed}/${snell.total}, ${snell.interfaces} interfaces`,
  );
  const invisibility = { passed: 0, total: thin.length, maxError: 0, failures: [] };
  for (const test of thin) {
    const objects = test.objects.map((o) => ({ ...o, ior: 1, opacity: 0, metallic: 0 })),
      conf = config(objects, test.angles, test.o, test.d),
      out = await draw('optical', conf.u),
      error = Math.max(...out.slice(0, 3));
    invisibility.maxError = Math.max(invisibility.maxError, error);
    if (Number.isFinite(error) && error < 0.001) invisibility.passed++;
    else invisibility.failures.push({ name: test.name, error });
  }
  report.results.invisibility = invisibility;
  console.log(`Index-one optical checks: ${invisibility.passed}/${invisibility.total}`);
  if (selected === 'all') {
    async function checkCrossings(label, cases) {
      const summary = {
        passed: 0,
        total: cases.length,
        hitCount: 0,
        maxRelativeError: 0,
        unresolvedTangencies: [],
        failures: [],
      };
      for (const test of cases) {
        const conf = config(test.objects, test.angles, test.o, test.d),
          d = norm(conf.u.uForward),
          expected = expectedHits(conf, conf.u.uEye, d);
        let o = conf.u.uEye.slice(),
          total = 0,
          actual = [];
        for (let j = 0; j < 25; j++) {
          const out = await draw('hits', { ...conf.u, uEye: o });
          if (out[0] < 0) break;
          const s = total + out[0];
          if (s < 1e7) actual.push({ s, level: out[1], sign: out[2], id: out[3] });
          else break;
          const p = point(o, d, out[0]),
            eps = conf.bias * Math.max(1, Math.hypot(...p));
          o = f32(point(p, d, eps));
          total += out[0] + eps;
        }
        if (expected.unresolvedTangencies.length)
          summary.unresolvedTangencies.push({
            name: test.name,
            pairs: expected.unresolvedTangencies,
          });
        let error = 0,
          valid = actual.length === expected.length;
        expected.forEach((e, i) => {
          const a = test.tangent
            ? actual.reduce(
                (best, x) => (!best || Math.abs(x.s - e.s) < Math.abs(best.s - e.s) ? x : best),
                null,
              )
            : actual[i];
          if (!a) {
            valid = false;
            return;
          }
          error = Math.max(error, Math.abs(a.s - e.s) / Math.max(1, e.s));
          if (a.level !== e.level || a.sign !== e.sign || a.id !== e.id) valid = false;
        });
        if (test.tangent && actual.length && error < 0.003) valid = true;
        summary.hitCount += actual.length;
        summary.maxRelativeError = Math.max(summary.maxRelativeError, error);
        if (valid && error < 0.003) summary.passed++;
        else summary.failures.push({ name: test.name, test, expected, actual, error });
      }
      report.results[label] = summary;
      console.log(`${label}: ${summary.passed}/${summary.total}`);
    }
    const solidObject = (c) => ({
      ...makeTorus(Math.acos(Math.sqrt(c)) / rad, '#ffffff'),
      shell: false,
      opacity: 0,
      ior: 1.45,
    });
    const solid = [
      { name: 'Four crossings', angles: [0, 0, 0, 0, 0, 0], c: 0.5, o: [-4, 0, 0], d: [1, 0, 0] },
      {
        name: 'Double tangent',
        angles: [0, 0, 0, 0, 0, 0],
        c: 0.5,
        o: [-4, Math.SQRT2 + 1, 0],
        d: [1, 0, 0],
        tangent: true,
      },
      {
        name: 'Exact pole',
        angles: [0, 0, Math.PI / 4, 0, 0, 0],
        c: 0.5,
        o: [0, 0.5, 5],
        d: [0, 0, -1],
      },
      {
        name: 'Far root before pole',
        angles: [0, 0, 44.9 * rad, 0, 0, 0],
        c: 0.5,
        o: [0, 0, 0],
        d: [1, 0, 0],
      },
      {
        name: 'Far root after pole',
        angles: [0, 0, 45.1 * rad, 0, 0, 0],
        c: 0.5,
        o: [0, 0, 0],
        d: [-1, 0, 0],
      },
    ];
    let seed = 9741;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 500; i++) {
      const v = Array.from({ length: 3 }, () => random() * 2 - 1);
      solid.push({
        name: `Random ray ${i}`,
        angles: Array.from({ length: 6 }, () => random() * 6.28),
        c: 0.01 + 0.98 * random(),
        o: Array.from({ length: 3 }, () => random() * 12 - 6),
        d: norm(v),
      });
    }
    for (const t of [1, 5, 45, 85, 89])
      for (const offset of [-0.01, 0, 0.01])
        for (let j = 0; j < 8; j++) {
          const o = [3 * Math.sin(j), 0.3, 5 * Math.cos(j)];
          solid.push({
            name: `Pole neighborhood t=${t} offset=${offset} ray=${j}`,
            angles: [0, 0, (90 - t + offset) * rad, 0, 0, 0],
            c: Math.cos(t * rad) ** 2,
            o,
            d: norm(o.map((x) => -x)),
          });
        }
    solid.forEach((t) => (t.objects = [solidObject(t.c)]));
    await checkCrossings('solidSuite', solid);
    const shells = [];
    const addShell = (name, t, width, angles, o, d) =>
      shells.push({
        name,
        objects: [{ ...makeTorus(t, '#ffffff'), shellWidth: width, opacity: 0, ior: 1.45 }],
        angles: angles.map((x) => x * rad),
        o,
        d,
      });
    addShell('Eight crossings', 45, 6, [0, 0, 0, 0, 0, 0], [-4, 0, 0], [1, 0, 0]);
    addShell('Origin in glass', 45, 6, [0, 0, 0, 0, 0, 0], [Math.SQRT2 + 1, 0, 0], [-1, 0, 0]);
    addShell('Origin in air cavity', 45, 6, [0, 0, 0, 0, 0, 0], [Math.SQRT2, 0, 0], [1, 0, 0]);
    for (const t of [5, 45, 85])
      for (const width of [0.01, 0.05, 0.5, 6]) {
        const b = shellLevels(t, width);
        for (const a of [
          90 - b.upperT - 0.01,
          90 - b.upperT,
          90 - t,
          90 - b.lowerT,
          90 - b.lowerT + 0.01,
        ])
          for (let j = 0; j < 4; j++) {
            const o = [4 * Math.sin(j), 0.3, 5 * Math.cos(j)];
            addShell(
              `Pole t=${t}, width=${width}, XW=${a}, ray=${j}`,
              t,
              width,
              [0, 0, a, 0, 0, 0],
              o,
              norm(o.map((x) => -x)),
            );
          }
      }
    seed = 921;
    for (let i = 0; i < 160; i++) {
      const o = Array.from({ length: 3 }, () => random() * 10 - 5),
        d = Array.from({ length: 3 }, () => random() * 2 - 1);
      addShell(
        `Random shell ray ${i}`,
        5 + 80 * random(),
        0.5 + 12 * random(),
        Array.from({ length: 6 }, () => 360 * random()),
        o,
        norm(d),
      );
    }
    await checkCrossings('shellSuite', shells);
    const scenes = [
      {
        name: '24 crossings',
        objects: scenePreset('glass'),
        angles: [0, 0, 0, 0, 0, 0],
        o: [-8, 0, 0],
        d: [1, 0, 0],
      },
    ];
    for (const width of [0.01, 0.05]) {
      const objects = scenePreset('glass');
      objects.forEach((o) => (o.shellWidth = width));
      scenes.push({
        name: `24 thin crossings, width=${width}`,
        objects,
        angles: [0, 0, 0, 0, 0, 0],
        o: [-8, 0, 0],
        d: [1, 0, 0],
      });
    }
    seed = 2971;
    for (let i = 0; i < 120; i++) {
      const o = Array.from({ length: 3 }, () => 12 * random() - 6),
        d = Array.from({ length: 3 }, () => 2 * random() - 1);
      scenes.push({
        name: `Random family ${i}`,
        objects: scenePreset('glass'),
        angles: Array.from({ length: 6 }, () => 6.28 * random()),
        o,
        d: norm(d),
      });
    }
    for (const angle of [23.5, 25, 26.5, 43.5, 45, 46.5, 63.5, 65, 66.5, 80])
      scenes.push({
        name: `Pole crossing XW=${angle}`,
        objects: scenePreset('glass'),
        angles: [0, 0, angle * rad, 0, 0, 0],
        o: [0, 0.3, 6],
        d: [0, 0, -1],
      });
    await checkCrossings('sceneSuite', scenes);
  }
  const renderSmoke = { passed: 0, total: 8, failures: [] };
  for (let i = 0; i < 8; i++) {
    const conf = config(
      scenePreset(i === 7 ? 'chrome' : 'glass'),
      [0, 0, i === 7 ? 80 * rad : 0, 0, 0, 0],
      [-8, 0.1, 0.15],
      [1, 0, 0],
    );
    const pixel = await draw('production', {
      ...conf.u,
      uEnvironment: i === 7 ? 3 : i,
      uResolution: [1, 1],
      uRight: [0, 0, 1],
      uUp: [0, 1, 0],
    });
    if (
      pixel.slice(0, 4).every((x) => typeof x === 'number' && Number.isFinite(x)) &&
      pixel[3] === 1
    )
      renderSmoke.passed++;
    else renderSmoke.failures.push({ environment: i, pixel });
  }
  report.results.renderSmoke = renderSmoke;
  console.log(`Complete renderer fragment shader: ${renderSmoke.passed}/${renderSmoke.total}`);
  report.passed = Object.values(report.results).every((s) => s.passed === s.total);
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`Report: ${output}`);
  if (!report.passed) process.exitCode = 1;
} finally {
  await command({ op: 'quit' }).catch(() => {});
  gpu.stdin.end();
  await rm(temp, { recursive: true, force: true });
}
