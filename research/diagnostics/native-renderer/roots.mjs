import {readFile,writeFile} from 'node:fs/promises';
import {openNative} from '../../../native/client.mjs';
const native=await openNative({threads:1}),rows=[];
try{
  for(const corpus of ['reference','stress-reference']){
    const tests=JSON.parse(await readFile(`research/results/${corpus}.json`,'utf8')).cases;
    for(const test of tests){
      const result=await native.command({op:'roots',roundUniforms:false,uniforms:{uP:test.P.flat(),uC:test.c,uEye:test.o,uForward:test.d}});
      rows.push({corpus,id:test.id,expected:test.reference.roots.map(x=>x.s),actual:result.roots});
    }
  }
  await writeFile('research/diagnostics/native-renderer/results/roots.json',JSON.stringify({hardware:native.hardware,rows})+'\n');
  console.log(`Captured ${rows.length} unchanged original-ray root cases.`);
}finally{await native.close();}
