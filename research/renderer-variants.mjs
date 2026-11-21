import { readFile } from 'node:fs/promises';
import { specializeYuksel } from './comparison-shader.mjs';

export const variantFiles = [
  'research/renderer-variants.mjs',
  'research/unguarded-refinement.glsl',
  'research/guarded-refinement.glsl',
  'research/yuksel-renderer.glsl',
  'research/yuksel.glsl',
  'research/comparison-shader.mjs',
];
const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

/** Replace one complete function; fail rather than silently benchmark unchanged code. */
export function replaceFunction(source, name, replacement) {
  const start = source.indexOf('float ' + name + '(');
  if (start < 0) throw Error('Missing shader function ' + name);
  let end = source.indexOf('{', start),
    depth = 1;
  while (++end < source.length && depth) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
  }
  if (depth) throw Error('Unclosed shader function ' + name);
  return source.slice(0, start) + replacement + source.slice(end);
}

export async function rendererVariant(source, name) {
  if (name === 'production' || name === 'bernstein-decreasing') return source;
  const guarded = await read('guarded-refinement.glsl');
  const unguarded = await read('unguarded-refinement.glsl');
  if (name === 'bernstein-unguarded') return replaceFunction(source, 'refineChart', unguarded);
  if (name === 'bernstein-raw')
    return replaceFunction(
      source,
      'refineChart',
      'float refineChart(vec4 a,vec4 b,vec4 c,float x,float level){return x;}',
    );
  if (name === 'bernstein-guarded') return replaceFunction(source, 'refineChart', guarded);
  // Yuksel backends share the production residual-decreasing refinement.
  if (!['yuksel-direct', 'yuksel-charts'].includes(name))
    throw Error('Unknown renderer variant ' + name);
  const extra = specializeYuksel(await read('yuksel.glsl')) + (await read('yuksel-renderer.glsl'));
  const insertion = source.indexOf('float chartIntersection(');
  source = source.slice(0, insertion) + extra + source.slice(insertion);
  if (name === 'yuksel-direct')
    return replaceFunction(
      source,
      'intersection',
      'float intersection(vec3 o,vec3 d,float level){return yukselDirectIntersection(o,d,level);}',
    );
  return replaceFunction(
    source,
    'chartIntersection',
    'float chartIntersection(vec3 center,vec3 direction,float L,float k,float sign,bool farChart,float minS,float level){return yukselChartIntersection(center,direction,L,k,sign,farChart,minS,level);}',
  );
}
