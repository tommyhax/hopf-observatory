// Execute the unchanged expectations from the optical suite against native C++.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const original=new URL('../../../scripts/run-gpu-checks.mjs',import.meta.url);
const reportPath=new URL('results/transport-native.json',import.meta.url);
process.env.HOPF_GPU_REPORT=fileURLToPath(reportPath);
let source=await readFile(original,'utf8');
source=source.replace(/from '(\.[^']+)'/g,(_,path)=>`from '${new URL(path,original).href}'`);
source=source.replaceAll('import.meta.url',JSON.stringify(original.href));
const start=source.indexOf("if (process.platform !== 'darwin')"),end=source.indexOf('const head = fragment.slice');
if(start<0||end<start)throw Error('Suite markers changed');
source=source.slice(0,start)+`
const {openNative}=await import(${JSON.stringify(new URL('../../../native/client.mjs',import.meta.url).href)});
const native=await openNative({threads:1,logPath:${JSON.stringify(fileURLToPath(new URL('results/transport-requests.json.gz',import.meta.url)))}});
const command=native.command;
const ready=Promise.resolve(native.hardware);
let metadata;
const desktop=source=>source;
`+source.slice(end);
source=source.replace('  gpu.stdin.end();\n  await rm(temp, { recursive: true, force: true });','  await native.close();');
source=source.replace('Native macOS offscreen OpenGL; same GLSL bodies with #version 410 core replacing #version 300 es. Browser integration is not tested.',
 'C++ binary64 renderer: generated production optics, direct quartic intersections; same test inputs and expectations. Compile requests register probe intent; native code is compiled by CMake.');
try{await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));}
catch(error){console.error(error);process.exitCode=1;}
