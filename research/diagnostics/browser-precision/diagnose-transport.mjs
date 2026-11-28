// Replay the previously failing close-contact case, including the GPU-normalized ray.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openGPU } from '../algorithm1010/final/browser-gpu.mjs';
import { vertex, fragment } from '../../../web/shader.js';
import { projector, shellLevels } from '../../../web/math.js';
import { rayBiasScale } from '../../../web/scene.js';
import { rendererVariant } from './renderer.mjs';
const dir='research/diagnostics/browser-precision/';
const report=JSON.parse(await readFile(dir+'trials/refined/transport-paired.json','utf8'));
const failures=report.results.shellSuite.failures;
if(failures.length!==1)throw Error('Expected one shell mismatch');
const test=failures[0].test,obj=test.objects[0],levels=shellLevels(obj.t,obj.shellWidth);
const P=projector(test.angles).map(r=>r.map(Math.fround));
const low=Math.fround(levels.cLow),high=Math.fround(levels.cHigh),bias=Math.fround(rayBiasScale(test.objects));
const d0=test.d.map(Math.fround),n=Math.hypot(...d0),cpuD=d0.map(x=>x/n);
const shaders={};for(const name of ['production','paired']){
 const source=await rendererVariant(fragment,name);
 shaders[name]=source.slice(0,source.lastIndexOf('void main()'))+`
 layout(location=1) out vec4 diagnosticDirection;
 layout(location=2) out vec4 diagnosticOrigin;
 layout(location=3) out vec4 diagnosticUnused;
 void main(){vec3 d=normalize(uForward);float level,sign;int id;
 float s=sceneHit(uEye,d,level,sign,id);outColor=vec4(s,level,sign,float(id));
 diagnosticDirection=vec4(d,0.);diagnosticOrigin=vec4(uEye,0.);diagnosticUnused=vec4(0.);}`;
}
const gpu=await openGPU(),paths={};
try{
 for(const name of ['production','paired']){
  await gpu.compile(name,vertex,shaders[name]);
  let o=test.o.map(Math.fround),total=0;paths[name]=[];
  for(let i=0;i<25;++i){
   const r=await gpu.command({op:'draw',name,uniforms:{uP:P.flat(),uEye:o,uForward:d0,uCount:1,
    uEnabled:[1,0,0],uShells:[1,0,0],uLevels:[Math.fround(Math.cos(obj.t*Math.PI/180)**2),0,0],
    uLows:[low,0,0],uHighs:[high,0,0],uRayBias:bias,uPrecisionGuard:0}});
   if(r.glError)throw Error('Diagnostic draw failed');
   const [s,level,normalSign,id]=r.pixels;
   paths[name].push({o:[...o],d:r.pixels.slice(4,7),s,level,normalSign,id,total,
    minS:.5*bias*Math.max(1,Math.hypot(...o))});
   if(s<0||total+s>=1e7)break;
   const p=o.map((x,j)=>x+s*cpuD[j]),eps=bias*Math.max(1,Math.hypot(...p));
   o=p.map((x,j)=>Math.fround(x+eps*cpuD[j]));total+=s+eps;
  }
 }
}finally{await gpu.close();}
await writeFile(dir+'results/transport-diagnostic.json',JSON.stringify({hardware:gpu.hardware,test,P,low,high,bias,cpuD,
 priorFailure:failures[0],paths,shaderSources:shaders,
 hashes:Object.fromEntries(await Promise.all([dir+'diagnose-transport.mjs',dir+'results/transport-paired.json',
 dir+'trials/refined/transport-paired.json',dir+'paired.glsl',dir+'renderer.mjs','web/shader.js','web/math.js','web/scene.js'].map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])))} ,null,2)+'\n');
console.log(JSON.stringify(paths,null,2));
