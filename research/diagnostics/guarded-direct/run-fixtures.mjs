import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {openGPU} from '../algorithm1010/final/browser-gpu.mjs';
import {rendererVariant,variantFiles} from './renderer.mjs';
import {vertex,fragment} from '../../../web/shader.js';
const dir='research/diagnostics/guarded-direct/',sha=s=>createHash('sha256').update(s).digest('hex');
const path='research/diagnostics/algorithm1010/fixtures.json';
const fixtures=JSON.parse(await readFile(path,'utf8'));
const hashes=Object.fromEntries(await Promise.all([...variantFiles,path,dir+'run-fixtures.mjs','web/shader.js'].map(async p=>[p,sha(await readFile(p))])));
const gpu=await openGPU(),results=[],rendererHashes={};
try{
 for(const name of ['direct','paired-direct']){
  const renderer=await rendererVariant(fragment,name);rendererHashes[name]=sha(renderer);
  const source=renderer.slice(0,renderer.lastIndexOf('void main()'))+`
  layout(location=1)out vec4 roots1;layout(location=2)out vec4 roots2;layout(location=3)out vec4 roots3;
  uniform vec4 uCoeff;uniform float uLead;
  void main(){vec2 f[5];for(int i=0;i<4;++i)f[i]=vec2(uCoeff[i],0);f[4]=vec2(uLead,0);
   gpRoots r=gdRoots(f);vec4 values=vec4(0);for(int i=0;i<4;++i)if(i<r.n)values[i]=dsFloat(r.v[i]);outColor=values;
   roots1=vec4(float(r.n),float(gdUsedWide),float(gdUncertain),0);roots2=roots3=vec4(0);}`;
  console.log('Compiling fixtures',name);await gpu.compile(name,vertex,source);
  for(const [id,c]of fixtures.entries()){
   const uCoeff=c.c.map(Math.fround),uLead=Math.fround(c.lead);
   const r=await gpu.command({op:'draw',name,uniforms:{uCoeff,uLead,uPrecisionGuard:0}});
   if(r.glError)throw Error('GL error');results.push({id,name:c.name,variant:name,coefficients:[...uCoeff,uLead],
    actual:r.pixels.slice(0,r.pixels[4]),count:r.pixels[4],wide:r.pixels[5],uncertain:r.pixels[6]});
  }
 }
}finally{await gpu.close();}
for(const[p,h]of Object.entries(hashes))if(sha(await readFile(p))!==h)throw Error('Source changed '+p);
await writeFile(dir+'results/fixtures.json',JSON.stringify({hardware:gpu.hardware,hashes,rendererHashes,results},null,2)+'\n');
