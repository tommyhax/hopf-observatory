import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openGPU } from '../algorithm1010/final/browser-gpu.mjs';
import { rendererVariant, variantFiles } from './renderer.mjs';
import { specializeYuksel } from '../../comparison-shader.mjs';
import { vertex, fragment } from '../../../web/shader.js';
const dir = 'research/diagnostics/browser-precision/';
const read = (p) => readFile(p, 'utf8');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const scope = process.argv.includes('--all') ? 'all' : process.argv.includes('--primitives') ? 'primitives' : 'grazing';
const output = process.argv.find((a) => a.startsWith('--output='))?.slice(9) || `roots-${scope}.json`;
if (!/^[a-z0-9-]+\.json$/.test(output)) throw Error('Output must be a local JSON basename');
const inputs = ['research/results/reference.json', 'research/results/stress-reference.json'];
const files = [
  'web/shader.js', 'web/math.js', 'web/scene.js', 'research/all-roots.glsl',
  'research/yuksel.glsl', 'research/ferrari.glsl', 'research/comparison-shader.mjs',
  'research/webgl.mjs', 'research/diagnostics/algorithm1010/final/browser-gpu.mjs',
  dir+'run-roots.mjs', dir+'PROTOCOL.md', ...variantFiles, ...inputs,
];
const hashes = Object.fromEntries(await Promise.all(files.map(async(p)=>[p,sha(await readFile(p))])));
const collector = await read('research/all-roots.glsl');
const record = collector.slice(0,collector.indexOf('void powerCoefficients('));
const pairedCollector = record + `
void main(){
 hitCount=0;for(int i=0;i<16;++i)hits[i]=-1.;
 DS4 center;vec2 k;float L;dsRay(uEye,uForward,center,k,L);
 for(int chart=0;chart<4;++chart){
   float sign=chart<2?-1.:1.;bool farChart=chart==1||chart==3;
   DS4 a,b,c;dsVectors(center,sign*uForward,L,farChart,a,b,c);
   vec4 roots;int count;quarticRoots(dsPolynomial(a,b,c,uC),roots,count);
   for(int i=0;i<4;++i)if(i<count){
     float x=roots[i];if(uPolish!=0&&!dsRefine(a,b,c,x,uC))continue;
     if(farChart&&x<=0.)continue;
     if(!farChart&&sign<0.&&x==0.)continue;
     recordHit(dsDistance(x,farChart,sign,L,k));
   }
 }
 outColor=vec4(hits[0],hits[1],hits[2],hits[3]);
 roots1=vec4(hits[4],hits[5],hits[6],hits[7]);
 roots2=vec4(hits[8],hits[9],hits[10],hits[11]);
 roots3=vec4(hits[12],hits[13],hits[14],hits[15]);
}`;
const head = (source) => source.slice(0,source.lastIndexOf('void main()'));
const rendererSources = {production:fragment,paired:await rendererVariant(fragment,'paired')};
const sources = {
  production:head(fragment)+(await read('research/ferrari.glsl'))+
    specializeYuksel(await read('research/yuksel.glsl'))+collector,
  paired:head(rendererSources.paired)+pairedCollector,
};
const primitiveSource = head(rendererSources.paired)+`
uniform vec2 uA,uB;uniform int uOperation;
void main(){
 vec2 r;
 if(uOperation==0)r=dsAdd(uA,uB);
 else if(uOperation==1)r=dsMul(uA,uB);
 else if(uOperation==2)r=dsDiv(uA,uB);
 else if(uOperation==3)r=dsSub(dsAdd(uA,uB),uA);
 else r=dsSub(dsMul(uA,uB),vec2(1.,0.));
 outColor=vec4(r,0.,1.);
}`;
const fixtureInputs = [
  ['small-add',0,[1,0],[2**-25,0]],
  ['cancellation',3,[1,0],[2**-25,0]],
  ['signed-sum',0,[1,2**-25],[-1,2**-26]],
  ['product-residual',4,[1+2**-23,0],[1-2**-23,0]],
  ['product',1,[1234.5,2**-16],[-456.75,2**-17]],
  ['division',2,[1,0],[3,0]],
  ['small-division',2,[2**-40,2**-65],[7,0]],
  ['large-cancellation',0,[2**30,1],[-(2**30),.125]],
];
const gpu = await openGPU();
const results = {},primitives=[];
try {
  console.log(JSON.stringify(gpu.hardware));
  console.log('Compiling paired arithmetic probes...');
  await gpu.compile('primitives',vertex,primitiveSource);
  for(const [name,op,a,b] of fixtureInputs){
    const response=await gpu.command({op:'draw',name:'primitives',uniforms:{uA:a,uB:b,uOperation:op,uPrecisionGuard:0}});
    if(response.glError)throw Error('Primitive GL error');
    const av=a[0]+a[1],bv=b[0]+b[1];
    const expected=op===0?av+bv:op===1?av*bv:op===2?av/bv:op===3?bv:av*bv-1;
    const actual=response.pixels[0]+response.pixels[1];
    const error=Math.abs(actual-expected)/Math.max(1e-30,Math.abs(expected));
    const pass=response.pixels.slice(0,2).every(Number.isFinite)&&error<=2e-13;
    primitives.push({name,op,a,b,expected,pair:response.pixels.slice(0,2),actual,error,pass});
  }
  console.log('Paired arithmetic fixtures:',primitives.filter(x=>x.pass).length+'/'+primitives.length);
  if(primitives.every(x=>x.pass)&&scope!=='primitives'){
    for(const [name,source] of Object.entries(sources)){
      console.log('Compiling all-roots shader:',name);await gpu.compile(name,vertex,source);
    }
    for(const path of scope==='all'?inputs:[inputs[1]]){
      const corpus=path.includes('stress-')?'stress':'original';
      const reference=JSON.parse(await read(path));
      const cases=reference.cases.filter(c=>scope==='all'||c.family==='tangent');
      results[corpus]=[];
      for(const c of cases){
        const row={id:c.id};
        for(const name of ['production','paired']){
          const response=await gpu.command({op:'draw',name,uniforms:{uP:c.P.flat(),uC:c.c,uEye:c.o,uForward:c.d,uMethod:0,uPolish:1,uPrecisionGuard:0}});
          if(response.glError)throw Error('Root GL error');
          row[name]=response.pixels.filter(x=>x!==-1).map(x=>x===-2?null:x);
          if(name==='paired'){
            const raw=await gpu.command({op:'draw',name,uniforms:{uPolish:0}});
            if(raw.glError)throw Error('Raw root GL error');
            row.pairedRaw=raw.pixels.filter(x=>x!==-1).map(x=>x===-2?null:x);
          }
        }
        results[corpus].push(row);
        if(results[corpus].length%100===0)console.log(corpus,results[corpus].length+'/'+cases.length);
      }
    }
  }
}finally{await gpu.close();}
for(const [p,h] of Object.entries(hashes))if(sha(await readFile(p))!==h)throw Error('Source changed: '+p);
await mkdir(dir+'results',{recursive:true});
await writeFile(dir+'results/'+output,JSON.stringify({experimentDate:'2026-11-28',scope,hardware:gpu.hardware,hashes,
  shaderHashes:Object.fromEntries(Object.entries(sources).map(([n,s])=>[n,sha(s)])),
  rendererHashes:Object.fromEntries(Object.entries(rendererSources).map(([n,s])=>[n,sha(s)])),
  primitiveShaderHash:sha(primitiveSource),shaderSources:sources,rendererSources,primitives,results},null,2)+'\n');
if(!primitives.every(x=>x.pass))process.exitCode=1;
