#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openNative } from './client.mjs';
const arg=(key,fallback)=>process.argv.find(x=>x.startsWith(`--${key}=`))?.split('=').slice(1).join('=')??fallback;
const scenes=JSON.parse(await readFile(new URL('scenes/benchmark.json',import.meta.url),'utf8')).scenes;
const scene=scenes[Number(arg('scene',0))];if(!scene)throw Error('Scene must be 0..3');
const renderer=await openNative({threads:Number(arg('threads',0))||undefined});
try {
  console.log(renderer.hardware);
  const output=resolve(arg('output','hopf-frame.ppm'));
  const result=await renderer.command({op:'render',uniforms:scene.uniforms,width:Number(arg('width',1280)),height:Number(arg('height',720)),
    frames:1,warmup:0,precision:Number(arg('precision',53)),adaptive:!process.argv.includes('--strict'),ppm:output,view:process.argv.includes('--view')});
  console.log(scene.name,output,result);
}finally{await renderer.close();}
