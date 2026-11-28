import { readFile } from 'node:fs/promises';
import { replaceFunction } from '../../renderer-variants.mjs';

export const variantFiles = [
  'research/diagnostics/browser-precision/renderer.mjs',
  'research/diagnostics/browser-precision/paired.glsl',
  'research/renderer-variants.mjs',
];
export async function rendererVariant(source, name) {
  if (name === 'production') return source;
  if (name !== 'paired') throw Error('Unknown precision variant ' + name);
  const body = await readFile(new URL('paired.glsl', import.meta.url), 'utf8');
  const insertion = source.indexOf('float intersection(');
  if (insertion < 0) throw Error('Missing intersection insertion point');
  source = source.slice(0, insertion) + body + '\n' + source.slice(insertion);
  // Tiny chart roots need more absolute refinement than the original 25 steps.
  // Stop at float stagnation so ordinary roots do not pay all 48 iterations.
  const loop = 'for (int k = 0; k < 25; k++)';
  const midpoint = 'float m = .5 * (a + b), fm = value(p, n, m);';
  if (source.split(loop).length !== 2 || source.split(midpoint).length !== 2)
    throw Error('Isolation refinement markers changed');
  source = source.replace(loop, 'for (int k = 0; k < 48; k++)')
    .replace(midpoint, midpoint + '\n        if (m == a || m == b) break;');
  return replaceFunction(source, 'intersection',
    'float intersection(vec3 o,vec3 d,float level){return dsIntersection(o,d,level);}');
}
