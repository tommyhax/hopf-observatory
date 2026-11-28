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
  return replaceFunction(source, 'intersection',
    'float intersection(vec3 o,vec3 d,float level){return dsIntersection(o,d,level);}');
}
