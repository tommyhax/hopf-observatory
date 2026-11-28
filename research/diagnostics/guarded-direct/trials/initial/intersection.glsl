// Original geometry -> paired power coefficients -> guarded direct formulas.
void gdCoefficients(vec3 o,vec3 d,float level,out vec2 f[5],out vec2 k,out float L){
  DS4 center,a,b,c;dsRay(o,d,center,k,L);dsVectors(center,d,L,false,a,b,c);
  DS4 aa=dsMatrix(a,level),ab=dsMatrix(b,level),ac=dsMatrix(c,level);
  f[0]=dsDot(a,aa);
  f[1]=dsAdd(dsDot(a,ab),dsDot(b,aa));
  f[2]=dsAdd(dsAdd(dsDot(a,ac),dsDot(b,ab)),dsDot(c,aa));
  f[3]=dsAdd(dsDot(b,ac),dsDot(c,ab));f[4]=dsDot(c,ac);
}
gpRoots gdRoots(vec2 f[5]){
  gdUncertain=false;gdUsedWide=false;
  if(!GD_FORCE_PAIRED){
    float narrow[5];for(int i=0;i<5;++i)narrow[i]=dsFloat(f[i]);
    gfRoots fast=gfSolve(narrow);
    if(!gdUncertain){gpRoots r=gpEmpty();for(int i=0;i<4;++i)if(i<fast.n)gpPush(r,vec2(fast.v[i],0));return r;}
  }
  gdUncertain=false;gdUsedWide=true;return gpSolve(f);
}
gpRoots gdRayRoots(vec3 o,vec3 d,float level){
  vec2 f[5],k;float L;gdCoefficients(o,d,level,f,k,L);gpRoots r=gdRoots(f);
  for(int i=0;i<4;++i)if(i<r.n)r.v[i]=dsSub(dsMul(vec2(L,0),r.v[i]),k);
  return r;
}
float gdIntersection(vec3 o,vec3 d,float level){
  gpRoots r=gdRayRoots(o,d,level);float best=-1.,minS=.5*rayEpsilon(o);
  for(int i=0;i<4;++i)if(i<r.n){float s=dsFloat(r.v[i]);
    if(s>minS&&!isnan(s)&&!isinf(s)&&(best<0.||s<best))best=s;}
  return best;
}
