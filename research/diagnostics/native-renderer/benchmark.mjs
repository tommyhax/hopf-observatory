import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {openNative} from '../../../native/client.mjs';
import {openGPU} from '../algorithm1010/final/browser-gpu.mjs';
import {vertex,fragment} from '../../../web/shader.js';
const dir='research/diagnostics/native-renderer/';
const scenes=JSON.parse(await readFile('native/scenes/benchmark.json','utf8')).scenes;
const capture=process.argv.includes('--capture');
const sha=x=>createHash('sha256').update(x).digest('hex');
const files=['native/CMakeLists.txt','native/main.cpp','native/generate-optics.mjs','native/client.mjs',
 'native/include/hopf/math.hpp','native/include/hopf/renderer.hpp','native/include/hopf/quartic.hpp','native/include/hopf/workers.hpp',
 'native/build/generated/optics.inc','native/build/hopf-render','native/scenes/benchmark.json',
 'web/shader.js','research/webgl.mjs','research/diagnostics/algorithm1010/final/browser-gpu.mjs',
 dir+'benchmark.mjs',dir+'PROTOCOL.md'];
const hashes=Object.fromEntries(await Promise.all(files.map(async p=>[p,sha(await readFile(p))])));
const native=await openNative(),gpu=await openGPU();
const report={date:new Date().toISOString(),native:native.hardware,gpu:gpu.hardware,hashes,shaderSHA256:sha(fragment),measurements:[]};
const median=x=>{x=[...x].sort((a,b)=>a-b);return(x[Math.floor((x.length-1)/2)]+x[Math.floor(x.length/2)])/2;};
try {
  console.log('Native:',JSON.stringify(native.hardware));console.log('GPU:',JSON.stringify(gpu.hardware));
  if(!gpu.hardware.timerQueryAvailable)throw Error('GPU timer extension required');
  await gpu.compile('production',vertex,fragment);
  if(capture){
    await mkdir(dir+'results/images',{recursive:true});
    for(const scene of scenes)for(const [width,height,mode] of [[480,270,0],[480,270,1],[480,270,2],[1280,720,0]]){
      const uniforms={...scene.uniforms,uResolution:[width,height],uMode:mode};
      const path=resolve(dir+`results/images/${width}-scene-${scene.id}-mode-${mode}-native.rgba`);
      const cpu=await native.command({op:'render',uniforms,width,height,frames:1,warmup:0,output:path,present:true,
        diagnostics:resolve(dir+`results/invalid-final-${width}-${scene.id}-${mode}.ndjson`)});
      const cppBytes=await readFile(path);await writeFile(path+'.gz',gzipSync(cppBytes));
      const browser=await gpu.command({op:'render',name:'production',uniforms,width,height,frames:1,warmup:0,capture:true});
      if(browser.glError||browser.disjoint)throw Error('Invalid GPU capture');
      const gpuPath=dir+`results/images/${width}-scene-${scene.id}-mode-${mode}-production.rgba.gz`;
      await writeFile(gpuPath,gzipSync(Buffer.from(browser.pixels)));
      const {pixels,...gpuStats}=browser;
      report.measurements.push({scene:scene.id,name:scene.name,mode,width,height,uniforms,native:cpu,gpu:gpuStats,
        nativePath:path+'.gz',nativeSHA256:sha(await readFile(path+'.gz')),gpuPath,gpuSHA256:sha(await readFile(gpuPath))});
      console.log(scene.name,width,'mode',mode,'native ms',cpu.milliseconds[0].toFixed(2),'invalid roots',cpu.invalidRoots);
    }
    await writeFile(dir+'results/captures.json',JSON.stringify(report,null,2)+'\n');
  }else{
    const transport=JSON.parse(await readFile(dir+'results/transport-native.json','utf8'));
    const validation=JSON.parse(await readFile(dir+'results/validation.json','utf8'));
    if(!transport.passed||!validation.rootCorpusPassed||validation.invalidRoots||validation.invalidPixels)throw Error('Correctness gates not met');
    for(const scene of scenes)for(let block=0;block<3;++block){
      const order=(scene.id+block)%2?['gpu','native']:['native','gpu'];
      const uniforms={...scene.uniforms,uResolution:[1280,720],uMode:0};
      for(const backend of order){
        const args={uniforms,width:1280,height:720,frames:3,warmup:1};
        const result=backend==='native'?await native.command({op:'render',...args,present:true}):
          await gpu.command({op:'render',name:'production',...args});
        if(result.glError||result.disjoint||result.invalidRoots||result.invalidPixels)throw Error('Invalid timed frame: '+JSON.stringify(result));
        report.measurements.push({scene:scene.id,name:scene.name,backend,block,order,...args,result});
        console.log(scene.name,backend,block,'render median',median(result.milliseconds).toFixed(2),'completion',median(result.completionMilliseconds).toFixed(2),'ms');
        await writeFile(dir+'results/benchmark.partial.json',JSON.stringify(report,null,2)+'\n');
      }
    }
    const single=await openNative({threads:1});
    report.singleThread=[];
    try{
      for(const scene of scenes){
        const result=await single.command({op:'render',uniforms:scene.uniforms,width:1280,height:720,frames:1,warmup:0});
        if(result.invalidRoots||result.invalidPixels)throw Error('Invalid single-thread frame');
        report.singleThread.push({scene:scene.id,name:scene.name,result});
        console.log(scene.name,'one worker',result.milliseconds[0].toFixed(2),'ms');
      }
    }finally{await single.close();}
    report.summary=scenes.map(scene=>{
      const rows=report.measurements.filter(x=>x.scene===scene.id),cpu=rows.filter(x=>x.backend==='native'),gpuRows=rows.filter(x=>x.backend==='gpu');
      const pick=(a,k)=>median(a.flatMap(x=>x.result[k]));
      return {scene:scene.id,name:scene.name,nativeRenderMs:pick(cpu,'milliseconds'),nativeUploadMs:pick(cpu,'presentationMilliseconds'),
        nativeCompletedMs:pick(cpu,'completionMilliseconds'),gpuElapsedMs:pick(gpuRows,'milliseconds'),gpuCompletedMs:pick(gpuRows,'completionMilliseconds')};
    });
    await writeFile(dir+'results/benchmark.json',JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report.summary,null,2));
  }
}finally{await native.close();await gpu.close();}
for(const [p,h]of Object.entries(hashes))if(sha(await readFile(p))!==h)throw Error('Source changed during measurement: '+p);
