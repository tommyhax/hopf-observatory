// Paired binary32 arithmetic. Not IEEE binary64; binary32 exponent range.
// A runtime-opaque bit operation forces rounding before error recovery.
// uPrecisionGuard MUST be zero (the WebGL uniform initialization default).
uniform int uPrecisionGuard;
float dsRound(float x) {
  return uintBitsToFloat(floatBitsToUint(x) ^ uint(uPrecisionGuard));
}
vec2 dsSum(float a, float b) {
  float s = dsRound(a+b), v = dsRound(s-a);
  float e = dsRound(dsRound(a-dsRound(s-v)) + dsRound(b-v));
  return vec2(s,e);
}
vec2 dsAdd(vec2 a, vec2 b) {
  vec2 s = dsSum(a.x,b.x);
  return dsSum(s.x,dsRound(s.y+dsRound(a.y+b.y)));
}
vec2 dsSub(vec2 a, vec2 b) { return dsAdd(a,-b); }
vec2 dsProduct(float a, float b) {
  float p = dsRound(a*b);
  // Twelve-bit significands make the high*high product exactly representable.
  float ah = uintBitsToFloat(floatBitsToUint(a) & 0xfffff000u);
  float bh = uintBitsToFloat(floatBitsToUint(b) & 0xfffff000u);
  float al = dsRound(a-ah), bl = dsRound(b-bh);
  float e = dsRound(dsRound(ah*bh)-p);
  e = dsRound(e+dsRound(ah*bl));
  e = dsRound(e+dsRound(al*bh));
  e = dsRound(e+dsRound(al*bl));
  return vec2(p,e);
}
vec2 dsMul(vec2 a, vec2 b) {
  vec2 p = dsProduct(a.x,b.x);
  float e = dsRound(p.y+dsRound(dsRound(a.x*b.y)+dsRound(a.y*b.x)));
  return dsSum(p.x,e);
}
vec2 dsDiv(vec2 a, vec2 b) {
  float q = dsRound(a.x/b.x);
  vec2 r = dsSub(a,dsMul(b,vec2(q,0.)));
  return dsSum(q,dsRound(dsRound(r.x+r.y)/b.x));
}
float dsFloat(vec2 a) { return dsRound(a.x+a.y); }
struct DS4 { vec4 hi; vec4 lo; };
vec2 dsGet(DS4 a,int i) { return vec2(a.hi[i],a.lo[i]); }
void dsSet(inout DS4 a,int i,vec2 v) { a.hi[i]=v.x; a.lo[i]=v.y; }
DS4 dsVector(vec4 a) { return DS4(a,vec4(0)); }
DS4 dsVAdd(DS4 a,DS4 b) {
  DS4 r; for(int i=0;i<4;++i) dsSet(r,i,dsAdd(dsGet(a,i),dsGet(b,i))); return r;
}
DS4 dsVScale(DS4 a,vec2 s) {
  DS4 r; for(int i=0;i<4;++i) dsSet(r,i,dsMul(dsGet(a,i),s)); return r;
}
vec2 dsDot(DS4 a,DS4 b) {
  vec2 r=vec2(0); for(int i=0;i<4;++i) r=dsAdd(r,dsMul(dsGet(a,i),dsGet(b,i))); return r;
}
DS4 dsMatrix(DS4 v,float level) {
  DS4 r;
  for(int i=0;i<4;++i) {
    vec2 sum=vec2(0);
    for(int j=0;j<4;++j) {
      vec2 a=dsSub(vec2(uP[j][i],0.),vec2(i==j?level:0.,0.));
      sum=dsAdd(sum,dsMul(a,dsGet(v,j)));
    }
    dsSet(r,i,sum);
  }
  return r;
}
void dsRay(vec3 o,vec3 d,out DS4 center,out vec2 k,out float L) {
  DS4 origin=dsVector(vec4(o,0.)), direction=dsVector(vec4(d,0.));
  k=dsDot(origin,direction);
  center=dsVAdd(origin,dsVScale(direction,-k));
  L=max(1.,length(center.hi.xyz)); // Any positive common scale defines valid charts.
}
void dsVectors(DS4 center,vec3 d,float L,bool farChart,out DS4 a,out DS4 b,out DS4 c) {
  vec2 invL=dsDiv(vec2(1.,0.),vec2(L,0.)), invL2=dsMul(invL,invL);
  DS4 direction=dsVector(vec4(d,0.)), scaled=dsVScale(center,invL);
  DS4 base=dsVScale(scaled,invL*2.);
  dsSet(base,3,dsSub(dsDot(scaled,scaled),invL2));
  b=dsVScale(direction,invL*2.);
  dsSet(b,3,dsDot(scaled,direction)*2.);
  DS4 top=dsVector(vec4(0)); dsSet(top,3,dsDot(direction,direction));
  if(farChart){a=top;c=base;}else{a=base;c=top;}
}
Poly dsPolynomial(DS4 a,DS4 b,DS4 c,float level) {
  DS4 middle=dsVAdd(a,dsVScale(b,vec2(.5,0.))), end=dsVAdd(dsVAdd(a,b),c);
  DS4 aa=dsMatrix(a,level), am=dsMatrix(middle,level), ae=dsMatrix(end,level);
  vec2 b2=dsDiv(dsAdd(dsDot(a,ae),dsDot(middle,am)*2.),vec2(3.,0.));
  return Poly(vec4(dsFloat(dsDot(a,aa)),dsFloat(dsDot(a,am)),dsFloat(b2),
    dsFloat(dsDot(middle,ae))),dsFloat(dsDot(end,ae)));
}
float dsDistance(float x,bool farChart,float sign,float L,vec2 k) {
  vec2 t=farChart?dsDiv(vec2(L,0.),vec2(x,0.)):dsProduct(L,x);
  return dsFloat(dsSub(t*sign,k));
}
void dsField(DS4 a,DS4 b,DS4 c,float x,float level,out float f,out float df,out float magnitude) {
  DS4 w=dsVAdd(a,dsVScale(dsVAdd(b,dsVScale(c,vec2(x,0.))),vec2(x,0.)));
  DS4 aw=dsMatrix(w,level), dw=dsVAdd(b,dsVScale(c,vec2(2.*x,0.)));
  f=dsFloat(dsDot(w,aw));df=2.*dsFloat(dsDot(dw,aw));
  mat4 A=uP-mat4(level);
  mat4 absA=mat4(abs(A[0]),abs(A[1]),abs(A[2]),abs(A[3]));
  magnitude=dot(abs(w.hi),absA*abs(w.hi));
}
bool dsRefine(DS4 a,DS4 b,DS4 c,inout float x,float level) {
  float f,df,m;dsField(a,b,c,x,level,f,df,m);
  for(int i=0;i<4;++i){
    if(f==0.||df==0.)break;
    float next=x-f/df;
    if(next<0.||next>1.||next==x||abs(next-x)>.05*max(x,1e-6))break;
    float nf,nd,nm;dsField(a,b,c,next,level,nf,nd,nm);
    if(!(abs(nf)<abs(f)))break;
    x=next;f=nf;df=nd;m=nm;
  }
  // Arithmetic allowance for the paired form plus binary32 coordinate rounding.
  // Heuristic, not an interval certificate; no constant absolute residual floor.
  return abs(f)<=1e-12*m+9.5367431640625e-7*abs(x*df);
}
float dsChartHit(DS4 center,vec3 direction,float L,vec2 k,float sign,bool farChart,
                 float minS,float level) {
  DS4 a,b,c; dsVectors(center,direction,L,farChart,a,b,c);
  Poly p=dsPolynomial(a,b,c,level);
  float lo=min(min(p.a.x,p.a.y),min(p.a.z,p.a.w));
  float hi=max(max(p.a.x,p.a.y),max(p.a.z,p.a.w));
  if(min(lo,p.b)>0.||max(hi,p.b)<0.) return -1.;
  vec4 roots; int count; quarticRoots(p,roots,count);
  float best=-1.;
  for(int i=0;i<4;++i) if(i<count) {
    float x=roots[i]; if(!dsRefine(a,b,c,x,level))continue;
    if(farChart&&x<=0.) continue;
    float s=dsDistance(x,farChart,sign,L,k);
    if(s>minS&&!isnan(s)&&!isinf(s)&&(best<0.||s<best)) best=s;
  }
  return best;
}
float dsIntersection(vec3 o,vec3 d,float level) {
  DS4 center; vec2 k; float L; dsRay(o,d,center,k,L);
  float minS=.5*rayEpsilon(o),hit;
  if(k.x<0.) {
    hit=dsChartHit(center,-d,L,k,-1.,true,minS,level); if(hit>=0.) return hit;
    hit=dsChartHit(center,-d,L,k,-1.,false,minS,level); if(hit>=0.) return hit;
  }
  hit=dsChartHit(center,d,L,k,1.,false,minS,level); if(hit>=0.) return hit;
  return dsChartHit(center,d,L,k,1.,true,minS,level);
}
