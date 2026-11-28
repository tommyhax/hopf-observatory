import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {openGPU} from '../algorithm1010/final/browser-gpu.mjs';
import {rendererVariant,variantFiles} from './renderer.mjs';
import {vertex,fragment} from '../../../web/shader.js';
const dir='research/diagnostics/guarded-direct/';
const sourcePath='research/diagnostics/algorithm1010/final/results/webgl-benchmark.json';
const scenes=JSON.parse(await readFile(sourcePath,'utf8')).measurements.filter(x=>x.variant==='production'&&x.round===0);
const sha=x=>createHash('sha256').update(x).digest('hex');
const files=[sourcePath,...variantFiles,'web/shader.js',dir+'capture.mjs',
 'research/diagnostics/algorithm1010/final/browser-gpu.mjs','research/webgl.mjs'];
const hashes=Object.fromEntries(await Promise.all(files.map(async p=>[p,sha(await readFile(p))])));
const gpu=await openGPU(),renders=[],shaderHashes={};
try{
 for(const name of ['production','direct']){const s=await rendererVariant(fragment,name);shaderHashes[name]=sha(s);
  console.log('Compiling capture',name);await gpu.compile(name,vertex,s);}
 await mkdir(dir+'results/images',{recursive:true});
 for(const [index,scene]of scenes.entries())for(const [width,height,mode]of [[480,270,0],[480,270,1],[480,270,2],[1280,720,0]]){
  for(const name of ['production','direct']){
   const uniforms={...scene.uniforms,uResolution:[width,height],uMode:mode};
   const r=await gpu.command({op:'render',name,uniforms,width,height,frames:1,warmup:0,capture:true});
   if(r.glError||r.disjoint)throw Error('Invalid capture');
   const bytes=gzipSync(Buffer.from(r.pixels)),path=dir+`results/images/scene-${index}-${width}-mode-${mode}-${name}.rgba.gz`;
   await writeFile(path,bytes);renders.push({scene:scene.scene,index,variant:name,mode,width,height,uniforms,path,sha256:sha(bytes)});
   console.log(index,width,mode,name,r.milliseconds[0].toFixed(1),'ms');
  }
 }
}finally{await gpu.close();}
for(const[p,h]of Object.entries(hashes))if(sha(await readFile(p))!==h)throw Error('Source changed '+p);
await writeFile(dir+'results/renders.json',JSON.stringify({hardware:gpu.hardware,hashes,shaderHashes,renders},null,2)+'\n');
