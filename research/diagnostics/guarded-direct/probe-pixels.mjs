// Retain full raster coordinates; scissor limits work to the sampled pixel.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {rendererVariant,variantFiles} from './renderer.mjs';
import {vertex,fragment} from '../../../web/shader.js';
const dir='research/diagnostics/guarded-direct/',sha=s=>createHash('sha256').update(s).digest('hex');
const original=new URL('../algorithm1010/final/browser-gpu.mjs',import.meta.url);
let driver=await readFile(original,'utf8');
driver=driver.replace("import { chromium } from '@playwright/test';",`import {chromium} from ${JSON.stringify(import.meta.resolve('@playwright/test'))};`)
 .replaceAll('import.meta.url',JSON.stringify(original.href))
 .replace('window.target(1, 1, true, shader.outputs);','window.target(request.width, request.height, true, shader.outputs); gl.enable(gl.SCISSOR_TEST); gl.scissor(request.x,request.y,1,1);')
 .replace('gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, buffer);','gl.readPixels(request.x, request.y, 1, 1, gl.RGBA, gl.FLOAT, buffer);');
const {openGPU}=await import('data:text/javascript;base64,'+Buffer.from(driver).toString('base64'));
const analysis=JSON.parse(await readFile(dir+'results/image-analysis.json','utf8'));
const renders=JSON.parse(await readFile(dir+'results/renders.json','utf8'));
const points=analysis.images.filter(x=>x.mode===0).flatMap(x=>x.outliers.map(p=>({...p,scene:x.scene,index:x.index,width:x.width,height:x.height})));
const source=await rendererVariant(fragment,'direct');
if(sha(source)!==renders.shaderHashes.direct)throw Error('Capture/source mismatch');
let instrumented=source.replace('out vec4 outColor;',`
 layout(location=0)out vec4 outColor;layout(location=1)out vec4 roots1;
 layout(location=2)out vec4 roots2;layout(location=3)out vec4 roots3;
 uniform int uProbeStep;int queryCount=0,capturedId=-1;
 vec4 capturedOrigin=vec4(0,0,0,-1),capturedDirection=vec4(0);
 `).replace('float sceneHit(','float originalSceneHit(')
 .replace('float line(',`
 float sceneHit(vec3 o,vec3 d,out float level,out float normalSign,out int id){
  float s=originalSceneHit(o,d,level,normalSign,id);
  if(queryCount++==uProbeStep){capturedOrigin=vec4(o,s);capturedDirection=vec4(d,level);capturedId=id;}
  return s;
 }
 float line(`)
 .replace('outColor = vec4(col * max(.6, vignette), 1);',`
 outColor=capturedOrigin;roots1=capturedDirection;roots2=vec4(float(capturedId),float(queryCount),0,0);
 roots3=vec4(col*max(.6,vignette),1);`);
const files=[...variantFiles,'web/shader.js',dir+'probe-pixels.mjs',dir+'results/image-analysis.json',dir+'results/renders.json',
 'research/diagnostics/algorithm1010/final/browser-gpu.mjs','research/webgl.mjs'];
const hashes=Object.fromEntries(await Promise.all(files.map(async p=>[p,sha(await readFile(p))])));
const gpu=await openGPU(),records=[];
const f32=x=>Array.isArray(x)?x.map(f32):typeof x==='number'?Math.fround(x):x;
try{
 console.log('Compiling pixel trace; points:',points.length);await gpu.compile('trace',vertex,instrumented);
 await gpu.compile('color',vertex,source);
 for(const point of points){
  const uniforms=Object.fromEntries(Object.entries(renders.renders.find(x=>x.index===point.index&&x.width===point.width&&x.mode===0&&x.variant==='direct').uniforms).map(([k,v])=>[k,f32(v)]));
  const sample={width:point.width,height:point.height,x:point.x,y:point.height-1-point.y};
  const command=async(name,step)=>{const r=await gpu.command({op:'draw',name,...sample,uniforms:{...uniforms,uProbeStep:step}});if(r.glError)throw Error('GL error');return r.pixels;};
  const color=(await command('color',-1)).slice(0,4),probe=await command('trace',-1);
  const count=probe[9],events=[];
  if(!Number.isInteger(count)||count<0||count>128)throw Error('Unexpected trace length');
  for(let step=0;step<count;step++){const p=await command('trace',step);events.push({step,o:p.slice(0,3),s:p[3],d:p.slice(4,7),level:p[7],id:p[8],color:p.slice(12,16)});}
  records.push({...point,uniforms,color,instrumentedColor:probe.slice(12,16),events});
  console.log(point.index,point.width,point.x,point.y,'queries',count,'instrumentation error',Math.max(...color.map((x,i)=>Math.abs(x-probe[12+i]))));
 }
}finally{await gpu.close();}
for(const[p,h]of Object.entries(hashes))if(sha(await readFile(p))!==h)throw Error('Source changed '+p);
await writeFile(dir+'results/pixel-probes.json',JSON.stringify({hardware:gpu.hardware,hashes,shaderHash:sha(source),probeHash:sha(instrumented),records},null,2)+'\n');
