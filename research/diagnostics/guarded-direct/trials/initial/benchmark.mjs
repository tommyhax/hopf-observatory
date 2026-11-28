// Same completed-frame WebGL protocol and scene uniforms as the prior study.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { openGPU } from '../algorithm1010/final/browser-gpu.mjs';
import { rendererVariant, variantFiles } from './renderer.mjs';
import { vertex, fragment } from '../../../web/shader.js';
const dir = 'research/diagnostics/guarded-direct/';
const sourcePath = 'research/diagnostics/algorithm1010/final/results/webgl-benchmark.json';
const accepted = JSON.parse(await readFile(sourcePath, 'utf8'));
const scenes = accepted.measurements.filter((x) => x.variant === 'production' && x.round === 0);
if (scenes.length !== 4) throw Error('Expected four recorded scenes');
const names = ['production', 'direct'];
const sha = (s) => createHash('sha256').update(s).digest('hex');
const median = (a) => { const s = [...a].sort((a,b)=>a-b); return (s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2; };
const files = [sourcePath, ...variantFiles, 'web/shader.js', 'research/webgl.mjs',
  'research/diagnostics/algorithm1010/final/browser-gpu.mjs', dir+'benchmark.mjs',
  dir+'results/roots.json', dir+'results/root-analysis.json', dir+'results/fixture-analysis.json', ...names.map(n=>dir+`results/transport-${n}.json`)];
const hashes = Object.fromEntries(await Promise.all(files.map(async(p)=>[p,sha(await readFile(p))])));
const rootChecks = JSON.parse(await readFile(dir+'results/roots.json','utf8'));
const rendererSources = {}, shaderHashes = {};
for (const name of names) {
  rendererSources[name] = await rendererVariant(fragment,name);
  shaderHashes[name] = sha(rendererSources[name]);
  const transport=JSON.parse(await readFile(dir+`results/transport-${name}.json`,'utf8'));
  if(!transport.passed || transport.shaderHashes.fragment!==shaderHashes[name] ||
      rootChecks.rendererHashes[name]!==shaderHashes[name]) throw Error('Correctness/source gate failed: '+name);
}
const correctness=JSON.parse(await readFile(dir+'results/root-analysis.json','utf8'));
for(const corpus of ['original','stress'])if(correctness.summary[corpus].direct['0.0001'].failed)throw Error('Root accuracy gate failed');
const fixtureChecks=JSON.parse(await readFile(dir+'results/fixture-analysis.json','utf8'));
if(fixtureChecks.results.some(r=>r.variant==='direct'&&r.match.failed))throw Error('Fixture gate failed');
const gpu = await openGPU(), measurements=[], renders=[];
try {
  console.log(JSON.stringify(gpu.hardware));
  if(!gpu.hardware.timerQueryAvailable)throw Error('GPU timer queries required');
  for(const name of names){console.log('Compiling renderer:',name);await gpu.compile(name,vertex,rendererSources[name]);}
  for(const [index,scene] of scenes.entries())for(let round=0;round<3;round++){
    const order=(round+index)%2?[...names].reverse():names;
    for(const name of order){
      const r=await gpu.command({op:'render',name,uniforms:scene.uniforms,width:1280,height:720,frames:10,warmup:5});
      if(r.glError||r.disjoint||r.milliseconds.length!==10)throw Error('Invalid timing block');
      measurements.push({scene:scene.scene,variant:name,round,order,width:1280,height:720,frames:10,warmup:5,
        uniforms:scene.uniforms,gpuMilliseconds:r.milliseconds,completionMilliseconds:r.completionMilliseconds,disjoint:r.disjoint});
      console.log(scene.scene,name,round,'GPU median',median(r.milliseconds).toFixed(3),'ms');
    }
  }
  const summaries=scenes.map(scene=>{
    const result={scene:scene.scene};
    for(const name of names){
      const blocks=measurements.filter(x=>x.scene===scene.scene&&x.variant===name);
      result[name]={gpuMedian:median(blocks.flatMap(x=>x.gpuMilliseconds)),blockMedians:blocks.map(x=>median(x.gpuMilliseconds)),
        completionMedian:median(blocks.flatMap(x=>x.completionMilliseconds))};
    }
    result.extraGpuPercent=100*(result.direct.gpuMedian/result.production.gpuMedian-1);return result;
  });
  await writeFile(dir+'results/benchmark.json',JSON.stringify({experimentDate:'2026-11-28',hardware:gpu.hardware,hashes,shaderHashes,
    method:'1280x720; 24 interactions; three alternating-order blocks; five warmups and ten completed frames; each frame has elapsed query and one-pixel readback; compilation/polling/warmup excluded.',
    measurements,summaries},null,2)+'\n');
  await mkdir(dir+'results/images',{recursive:true});
  for(const [index,scene] of scenes.entries())for(const [width,height,mode] of [[480,270,0],[480,270,1],[480,270,2],[1280,720,0]])for(const name of names){
    const uniforms={...scene.uniforms,uResolution:[width,height],uMode:mode};
    const r=await gpu.command({op:'render',name,uniforms,width,height,frames:1,warmup:0,capture:true});
    if(r.glError||r.disjoint)throw Error('Invalid image capture');
    const bytes=gzipSync(Buffer.from(r.pixels));
    const path=dir+`results/images/scene-${index}-${width}-mode-${mode}-${name}.rgba.gz`;
    await writeFile(path,bytes);
    renders.push({scene:scene.scene,variant:name,mode,width,height,uniforms,path,sha256:sha(bytes)});
  }
  await writeFile(dir+'results/renders.json',JSON.stringify({hardware:gpu.hardware,shaderHashes,renders},null,2)+'\n');
  console.log(JSON.stringify(summaries,null,2));
}finally{await gpu.close();}
for(const[p,h]of Object.entries(hashes))if(sha(await readFile(p))!==h)throw Error('Changed during benchmark: '+p);
