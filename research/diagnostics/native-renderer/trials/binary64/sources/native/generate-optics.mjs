// The optical behavior stays owned by the production shader. Only its small
// GLSL/C++ syntax differences are translated; intersection is supplied by C++.
import { fragment } from '../web/shader.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
const output = process.argv[2];
if (!output) throw Error('Usage: node native/generate-optics.mjs OUTPUT');
let source = fragment.slice(fragment.indexOf('float side('), fragment.lastIndexOf('void main()'));
if (!source.startsWith('float side(') || !source.includes('vec3 trace(')) throw Error('Shader markers changed');
source = source.replace('// Refraction event: numerical tests capture the state at this point.', `
if (debugStep == bounce) {
  captured = {p.x,p.y,p.z,s,double(before),double(after),n1,n2,
              transmitted.x,transmitted.y,transmitted.z,tir?1.:0.,n.x,n.y,n.z,level};
  return radiance;
}`);
source = source.replace(/out (float|int) (\w+)/g, '$1& $2')
  .replace(/\bfloat\b/g, 'double')
  .replace(/\.xyz\b/g, '.xyz()').replace(/\.rgb\b/g, '.xyz()')
  .replace(/\.xz\b/g, '.xz()')
  .replace(/\.r\b/g, '.x').replace(/\.g\b/g, '.y').replace(/\.b\b/g, '.z');
const hash = createHash('sha256').update(fragment).digest('hex');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `// Generated from web/shader.js; fragment SHA256 ${hash}\n${source}`);
