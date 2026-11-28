// Revisit every substantial pixel difference from the initial or final images.
import {readFile,writeFile} from 'node:fs/promises';
import {openNative} from '../../../native/client.mjs';
const dir='research/diagnostics/native-renderer/';
const scenes=JSON.parse(await readFile('native/scenes/benchmark.json')).scenes;
const inputs=[JSON.parse(await readFile(dir+'trials/binary64/validation.json')),
              JSON.parse(await readFile(dir+'results/validation.json'))];
const points=new Map();
for(const input of inputs)for(const image of input.images.filter(x=>x.mode===0))
  for(const point of image.outliers.filter(x=>x.maxDifference>3)){
    const row={scene:image.scene,width:image.width,height:image.height,x:point.x,y:point.y};
    points.set(JSON.stringify(row),row);
  }
const native=await openNative({threads:1}),rows=[];
try{
  for(const point of points.values()){
    const args={op:'draw',name:'production',uniforms:{...scenes[point.scene].uniforms,uResolution:[point.width,point.height]},x:point.x,y:point.y};
    const row={...point};
    row.adaptive=await native.command({...args,queries:dir+`results/pixel-${point.scene}-${point.width}-${point.x}-${point.y}-queries.ndjson`});
    row.forced113=await native.command({...args,precision:113,adaptive:false});
    row.forced256=await native.command({...args,precision:256,adaptive:false});
    row.maxDifference=Math.max(...row.adaptive.pixels.map((x,i)=>Math.abs(x-row.forced256.pixels[i])));
    row.adaptiveRGBA=row.adaptive.pixels.slice(0,4).map(x=>Math.round(Math.max(0,Math.min(1,x))*255));
    row.referenceRGBA=row.forced256.pixels.slice(0,4).map(x=>Math.round(Math.max(0,Math.min(1,x))*255));
    rows.push(row);
  }
}finally{await native.close();}
await writeFile(dir+'results/outlier-final.json',JSON.stringify(rows,null,2)+'\n');
console.log(rows.map(x=>({scene:x.scene,width:x.width,x:x.x,y:x.y,error:x.maxDifference,byteMatch:JSON.stringify(x.adaptiveRGBA)===JSON.stringify(x.referenceRGBA)})));
