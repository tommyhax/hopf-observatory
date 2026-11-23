// Traversal controls only: no new solver or coefficient construction.
import { rendererVariant as candidate, variantFiles as candidateFiles } from '../renderer.mjs';
import { replaceFunction } from '../../../renderer-variants.mjs';
export const variantFiles = [
  ...candidateFiles,
  'research/diagnostics/algorithm1010/final/variants.mjs',
];
function sceneFunction(source) {
  const start = source.indexOf('float sceneHit('),
    brace = source.indexOf('{', start);
  if (start < 0 || brace < 0) throw Error('Missing sceneHit');
  let depth = 1,
    end = brace + 1;
  while (depth && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  if (depth) throw Error('Unclosed sceneHit');
  return source.slice(start, end);
}
export async function rendererVariant(source, name) {
  if (name === 'production') return source;
  const odm = await candidate(source, 'odm-direct');
  if (name === 'odm-direct') return odm;
  if (name === 'odm-loop') return replaceFunction(odm, 'sceneHit', sceneFunction(source));
  if (name === 'production-unrolled')
    return replaceFunction(source, 'sceneHit', sceneFunction(odm));
  throw Error('Unknown traversal control ' + name);
}
