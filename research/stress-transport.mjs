// Capture actual production trace states; no replacement transport calculation.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openGPU } from './gpu-client.mjs';
import { rendererVariant, variantFiles } from './renderer-variants.mjs';
import { sceneUniforms } from './scenes.mjs';
import { makeTorus } from '../web/scene.js';
import { vertex, fragment } from '../web/shader.js';
const reference = JSON.parse(await readFile('research/results/stress-reference.json'));
const selection = [0, 1, 20, 21, 40, 41, 60, 61, 80, 81, 98, 99];
const variants = ['production', 'yuksel-direct', 'yuksel-charts'];
const gpu = await openGPU(),
  paths = [],
  shaderHashes = {};
function instrument(source) {
  let head = source.slice(0, source.lastIndexOf('void main()'));
  head = head.replace(
    'out vec4 outColor;',
    'layout(location=0) out vec4 outColor; layout(location=1) out vec4 extra1; layout(location=2) out vec4 extra2; layout(location=3) out vec4 extra3; uniform int uDebugStep,uDebugView; vec4 saved0,saved1,saved2,saved3;',
  );
  const start = head.indexOf('vec3 trace(vec3 origin');
  if (start < 0) throw Error('Trace instrumentation target missing');
  let trace = head.slice(start);
  const event = `if(bounce==uDebugStep){
    if(uDebugView==0){saved0=vec4(p,s);saved1=vec4(float(before),float(after),n1,n2);saved2=vec4(transmitted,tir?1.:0.);saved3=vec4(n,level);}
    else{saved0=vec4(o,eps);saved1=vec4(d,float(id));saved2=vec4(reflect(d,n),tangent?1.:0.);saved3=vec4(float(nextMask),float(mask),1,0);}
    return radiance;}`;
  const marker = '// Refraction event: numerical tests capture the state at this point.';
  if (!trace.includes(marker)) throw Error('Refraction instrumentation target missing');
  trace = trace.replace(marker, event + marker);
  trace = trace.replace(
    'if (before == after && !tangent) {',
    `if (before == after && !tangent) {
    if(bounce==uDebugStep){
      if(uDebugView==0){saved0=vec4(p,s);saved1=vec4(float(before),float(after),optics(before).y,optics(after).y);saved2=vec4(d,0);saved3=vec4(n,level);}
      else{saved0=vec4(o,eps);saved1=vec4(d,float(id));saved2=vec4(reflect(d,n),0);saved3=vec4(float(nextMask),float(mask),2,0);}
      return radiance;}`,
  );
  trace = trace.replace(
    'if (s < 0.)',
    `if(s<0. && bounce==uDebugStep){saved0=vec4(o,-1);saved1=vec4(d,0);return radiance;} if (s < 0.)`,
  );
  return (
    head.slice(0, start) +
    trace +
    `void main(){saved0=vec4(0,0,0,-2);saved1=vec4(0);saved2=vec4(0);saved3=vec4(0);trace(uEye,normalize(uForward));outColor=saved0;extra1=saved1;extra2=saved2;extra3=saved3;}`
  );
}
try {
  for (const variant of variants) {
    const source = await rendererVariant(fragment, variant);
    shaderHashes[variant] = createHash('sha256').update(source).digest('hex');
    await gpu.compile(variant, vertex, instrument(source));
  }
  for (const id of selection) {
    const group = reference.shellGroups[id],
      cases = group.cases.map((i) => reference.cases[i]);
    const objects = group.t.map((t, i) => ({
      ...makeTorus(Number(t), '#ffffff'),
      shellWidth: 0.01,
      opacity: 0,
      ior: [1.3, 1.45, 1.6][i],
    }));
    const uniforms = sceneUniforms(objects);
    Object.assign(uniforms, {
      uP: cases[0].P.flat(),
      uLows: [cases[0].c, cases[2].c, cases[4].c],
      uHighs: [cases[1].c, cases[3].c, cases[5].c],
      uEye: cases[0].o,
      uForward: cases[0].d,
    });
    for (const variant of variants) {
      const events = [];
      for (let step = 0; step < 24; step++) {
        const states = [];
        for (const view of [0, 1]) {
          const r = await gpu.command({
            op: 'draw',
            name: variant,
            uniforms: { ...uniforms, uDebugStep: step, uDebugView: view },
          });
          if (r.glError || !r.finite) throw Error('Invalid transport query');
          states.push(r.pixels);
        }
        events.push({ step, states });
        if (states[0][3] < 0) break;
      }
      paths.push({ group: id, kind: group.kind, variant, uniforms, events });
      console.log(
        'Stress transport group ' +
          id +
          ', ' +
          variant +
          ': ' +
          events.filter((e) => e.states[0][3] >= 0).length +
          ' events',
      );
    }
  }
  const files = [
    'web/shader.js',
    'web/scene.js',
    'web/math.js',
    'research/stress-transport.mjs',
    'research/results/stress-reference.json',
    'research/scenes.mjs',
    'research/gpu-client.mjs',
    'research/native-render.m',
    ...variantFiles,
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
    'research/results/stress-transport.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        hardware: gpu.hardware,
        selection,
        shaderHashes,
        hashes,
        paths,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await gpu.close();
}
