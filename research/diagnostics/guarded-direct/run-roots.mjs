import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {openGPU} from '../algorithm1010/final/browser-gpu.mjs';
import {rendererVariant,variantFiles} from './renderer.mjs';
import {vertex,fragment} from '../../../web/shader.js';
import {specializeYuksel} from '../../comparison-shader.mjs';
const dir='research/diagnostics/guarded-direct/';
const sha=x=>createHash('sha256').update(x).digest('hex');
const read=p=>readFile(p,'utf8');
const inputs=['research/results/reference.json','research/results/stress-reference.json'];
const files=[...inputs,...variantFiles,'web/shader.js',dir+'run-roots.mjs',dir+'PROTOCOL.md',
 'research/all-roots.glsl','research/ferrari.glsl','research/yuksel.glsl','research/comparison-shader.mjs',
 'research/diagnostics/algorithm1010/final/browser-gpu.mjs','research/webgl.mjs'];
const hashes=Object.fromEntries(await Promise.all(files.map(async p=>[p,sha(await readFile(p))])));
const collector=await read('research/all-roots.glsl');
const record=collector.slice(0,collector.indexOf('void powerCoefficients('));
const directCollector=record+`
uniform int uDiagnostic;
void main(){hitCount=0;for(int i=0;i<16;++i)hits[i]=-1.;
 gpRoots r=gdRayRoots(uEye,uForward,uC);
 for(int i=0;i<4;++i)if(i<r.n)recordHit(dsFloat(r.v[i]));
 outColor=vec4(hits[0],hits[1],hits[2],hits[3]);
 roots1=vec4(hits[4],hits[5],hits[6],hits[7]);
 roots2=vec4(hits[8],hits[9],hits[10],hits[11]);
 roots3=vec4(hits[12],hits[13],hits[14],hits[15]);
 if(uDiagnostic==1)outColor=vec4(float(gdUsedWide),float(gdUncertain),float(r.n),0.);
}`;
const head=s=>s.slice(0,s.lastIndexOf('void main()'));
const rendererSources={},sources={};
const names=process.argv.includes('--paired-only')?['paired-direct']:['production','direct','paired-direct'];
for(const n of names){rendererSources[n]=await rendererVariant(fragment,n);
 sources[n]=head(rendererSources[n])+(n==='production'?
 (await read('research/ferrari.glsl'))+specializeYuksel(await read('research/yuksel.glsl'))+collector:directCollector);}
const results={},diagnostics={};const gpu=await openGPU();
try{
 console.log(JSON.stringify(gpu.hardware));
 for(const n of names){console.log('Compiling',n);await gpu.compile(n,vertex,sources[n]);}
 for(const path of inputs){const corpus=path.includes('stress-')?'stress':'original';
  let cases=JSON.parse(await read(path)).cases;if(process.argv.includes('--smoke'))cases=cases.slice(0,20);
  results[corpus]=[];diagnostics[corpus]=[];
  for(const c of cases){const row={id:c.id},diag={id:c.id};
   for(const n of names){
    const uniforms={uP:c.P.flat(),uC:c.c,uEye:c.o,uForward:c.d,uMethod:0,uPolish:1,uPrecisionGuard:0,uDiagnostic:0};
    const r=await gpu.command({op:'draw',name:n,uniforms});if(r.glError)throw Error('GL error '+r.glError);
    row[n]=r.pixels.filter(x=>x!==-1).map(x=>x===-2?null:x);
    if(n!=='production'){const d=await gpu.command({op:'draw',name:n,uniforms:{uDiagnostic:1}});diag[n]=d.pixels.slice(0,3);}
   }results[corpus].push(row);diagnostics[corpus].push(diag);
   if(results[corpus].length%100===0)console.log(corpus,results[corpus].length+'/'+cases.length);
  }
 }
}finally{await gpu.close();}
for(const[p,h]of Object.entries(hashes))if(sha(await readFile(p))!==h)throw Error('Source changed '+p);
await mkdir(dir+'results',{recursive:true});
await writeFile(dir+'results/roots.json',JSON.stringify({date:'2026-11-28',hardware:gpu.hardware,hashes,
 rendererHashes:Object.fromEntries(Object.entries(rendererSources).map(([n,s])=>[n,sha(s)])),
 rendererSources,shaderSources:sources,results,diagnostics},null,2)+'\n');
