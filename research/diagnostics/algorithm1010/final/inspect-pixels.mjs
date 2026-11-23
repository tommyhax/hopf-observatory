// Trace only the two previously observed solid-scene outliers; no new corpus.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openGPU } from './pixel-gpu.mjs';
import { rendererVariant, variantFiles } from '../renderer.mjs';
import { vertex, fragment } from '../../../../web/shader.js';
const dir = 'research/diagnostics/algorithm1010/';
const browser = process.argv.includes('--webgl');
const backend = browser ? 'webgl' : 'native';
const original = JSON.parse(await readFile(dir + 'results/render-comparison.json', 'utf8'));
const uniforms = original.renders.find((x) => x.scene === 'single solid' && x.mode === 0).uniforms;
const pixels = [
    [284, 77],
    [312, 126],
  ],
  variants = ['production', 'odm-direct'];
const gpu = await openGPU(browser);
const records = [],
  shaderHashes = {};
const sha = (text) => createHash('sha256').update(text).digest('hex');
try {
  for (const variant of variants) {
    const source = await rendererVariant(fragment, variant);
    const atPixel = source;
    await gpu.compile(variant + '-color', vertex, atPixel);
    let instrumented = atPixel
      .replace(
        'out vec4 outColor;',
        `
      layout(location=0) out vec4 outColor;
      layout(location=1) out vec4 probeDirection;
      layout(location=2) out vec4 probeNormal;
      layout(location=3) out vec4 probeColor;
      uniform int uProbeStep,uProbePath;
      int primaryIndex=0,reflectionIndex=0;
      bool inReflection=false;
      vec4 capturedOrigin=vec4(0,0,0,-1),capturedDirection=vec4(0),capturedNormal=vec4(0,0,0,-1);
    `,
      )
      .replace('float sceneHit(', 'float originalSceneHit(');
    const wrapper = `
      float sceneHit(vec3 o,vec3 d,out float level,out float normalSign,out int id) {
        float s=originalSceneHit(o,d,level,normalSign,id);
        int index=inReflection?reflectionIndex++:primaryIndex++;
        if(index==uProbeStep && (inReflection?1:0)==uProbePath) {
          capturedOrigin=vec4(o,s);capturedDirection=vec4(d,level);
          capturedNormal=vec4(s>=0.?normalAt(o+s*d,level):vec3(0),float(id));
        }
        return s;
      }
    `;
    instrumented = instrumented
      .replace('float line(', wrapper + '\nfloat line(')
      .replace('vec3 reflectionPath(', 'vec3 originalReflectionPath(')
      .replace(
        'vec3 trace(',
        `
        vec3 reflectionPath(vec3 o,vec3 d,float roughness) {
          inReflection=true;
          vec3 color=originalReflectionPath(o,d,roughness);
          inReflection=false;return color;
        }
        vec3 trace(`,
      )
      .replace(
        'outColor = vec4(col * max(.6, vignette), 1);',
        `
        outColor=capturedOrigin;probeDirection=capturedDirection;probeNormal=capturedNormal;
        probeColor=vec4(col*max(.6,vignette),1);
      `,
      );
    shaderHashes[variant] = {
      original: sha(source),
      colorProbe: sha(atPixel),
      traceProbe: sha(instrumented),
    };
    await gpu.compile(variant + '-trace', vertex, instrumented);
    for (const pixel of pixels) {
      const u = uniforms;
      const sample = { width: 480, height: 270, x: pixel[0], y: 269 - pixel[1] };
      const color = await gpu.command({
        op: 'draw',
        name: variant + '-color',
        uniforms: u,
        ...sample,
      });
      if (color.glError) throw Error('Color probe error ' + color.glError);
      const events = [];
      for (const path of [0, 1])
        for (let step = 0; step < (path ? 4 : 24); step++) {
          const r = await gpu.command({
            op: 'draw',
            name: variant + '-trace',
            uniforms: { ...u, uProbeStep: step, uProbePath: path },
            ...sample,
          });
          if (r.glError) throw Error('Trace probe error ' + r.glError);
          events.push({
            path,
            step,
            origin: r.pixels.slice(0, 3),
            s: r.pixels[3],
            direction: r.pixels.slice(4, 7),
            level: r.pixels[7],
            normal: r.pixels.slice(8, 11),
            id: r.pixels[11],
            color: r.pixels.slice(12, 15),
          });
        }
      records.push({ variant, pixel, color: color.pixels.slice(0, 3), events });
      console.log(
        backend,
        variant,
        pixel,
        'color',
        color.pixels.slice(0, 3),
        'instrumented',
        events[0].color,
      );
    }
  }
  const files = [
    'web/shader.js',
    ...variantFiles,
    dir + 'final/inspect-pixels.mjs',
    dir + 'final/pixel-gpu.mjs',
    dir + 'final/browser-gpu.mjs',
    'research/webgl.mjs',
    'research/gpu-client.mjs',
    'research/native-render.m',
    dir + 'results/render-comparison.json',
  ];
  const hashes = Object.fromEntries(
    await Promise.all(files.map(async (p) => [p, sha(await readFile(p))])),
  );
  await writeFile(
    dir + `final/results/pixels-${backend}.json`,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        hardware: gpu.hardware,
        hashes,
        shaderHashes,
        uniforms,
        records,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await gpu.close();
}
