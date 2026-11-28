import { readFile } from 'node:fs/promises';
import { replaceFunction } from '../../renderer-variants.mjs';
export const variantFiles = ['renderer.mjs','solver.glsl.in','elementary.glsl','intersection.glsl']
  .map(p=>'research/diagnostics/guarded-direct/'+p)
  .concat(['research/diagnostics/browser-precision/paired.glsl','research/renderer-variants.mjs']);
export async function rendererVariant(source,name){
  if(name==='production')return source;
  if(!['direct','paired-direct'].includes(name))throw Error('Unknown variant '+name);
  const read=p=>readFile(new URL(p,import.meta.url),'utf8');
  let arithmetic=await read('../browser-precision/paired.glsl');
  arithmetic=arithmetic.slice(0,arithmetic.indexOf('Poly dsPolynomial('));
  const template=await read('solver.glsl.in');
  const floatHelpers=`
float gfC(float a){return a;}float gfF(float a){return a;}
float gfA(float a,float b){return a+b;}float gfS(float a,float b){return a-b;}
float gfM(float a,float b){return a*b;}float gfD(float a,float b){return a/b;}
bool gfZ(float a){return a==0.;}bool gfEQ(float a,float b){return a==b;}
float gfSQ(float a){return sqrt(max(0.,a));}float gfCB(float a){return sign(a)*pow(abs(a),1./3.);}
float gfAC(float a){return acos(clamp(a,-1.,1.));}void gfSC(float a,out float s,out float c){s=sin(a);c=cos(a);}
const float gfEPS=0.0000152587890625;
`;
  const pairedHelpers=`
vec2 gpC(float a){return vec2(a,0);}float gpF(vec2 a){return dsFloat(a);}
vec2 gpA(vec2 a,vec2 b){return dsAdd(a,b);}vec2 gpS(vec2 a,vec2 b){return dsSub(a,b);}
vec2 gpM(vec2 a,vec2 b){return dsMul(a,b);}vec2 gpD(vec2 a,vec2 b){return dsDiv(a,b);}
bool gpZ(vec2 a){return all(equal(a,vec2(0)));}bool gpEQ(vec2 a,vec2 b){return all(equal(a,b));}
vec2 gpSQ(vec2 a){return gdSqrt(a);}vec2 gpCB(vec2 a){return gdCbrt(a);}
vec2 gpAC(vec2 a){return gdAcos(a);}void gpSC(vec2 a,out vec2 s,out vec2 c){gdSinCos(a,s,c);}
const float gpEPS=4.547473508864641e-13;
`;
  const instantiate=(prefix,type)=>template.replace(/@R\b/g,type).replaceAll('@',prefix);
  const body=arithmetic+'\n'+await read('elementary.glsl')+
    '\nbool gdUncertain=false;bool gdUsedWide=false;\n'+floatHelpers+pairedHelpers+
    instantiate('gf','float')+instantiate('gp','vec2')+
    (await read('intersection.glsl')).replace('GD_FORCE_PAIRED',name==='paired-direct'?'true':'false');
  const where=source.indexOf('float intersection(');
  if(where<0)throw Error('Missing intersection insertion point');
  source=source.slice(0,where)+body+'\n'+source.slice(where);
  return replaceFunction(source,'intersection','float intersection(vec3 o,vec3 d,float level){return gdIntersection(o,d,level);}');
}
