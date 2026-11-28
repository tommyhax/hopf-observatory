// Fixed expansions for elementary functions in paired binary32 arithmetic.
// No correction of a quartic/cubic root is performed here.
vec2 gdSqrt(vec2 a) {
  if(a.x<=0.) return vec2(0);
  float s=sqrt(a.x);
  return dsAdd(vec2(s,0),dsDiv(dsSub(a,dsProduct(s,s)),vec2(2.*s,0)));
}
vec2 gdCbrt(vec2 a) {
  if(a.x==0.) return vec2(0);
  float s=sign(a.x)*pow(abs(a.x),1./3.);
  vec2 s3=dsMul(dsProduct(s,s),vec2(s,0));
  vec2 u=dsDiv(dsSub(a,s3),s3);
  vec2 correction=dsMul(u,dsAdd(dsDiv(vec2(1,0),vec2(3,0)),
    dsMul(u,dsAdd(dsDiv(vec2(-1,0),vec2(9,0)),dsMul(u,dsDiv(vec2(5,0),vec2(81,0)))))));
  return dsMul(vec2(s,0),dsAdd(vec2(1,0),correction));
}
void gdSinCos(vec2 x,out vec2 s,out vec2 c) {
  vec2 xx=-dsMul(x,x),st=x,ct=vec2(1,0);s=st;c=ct;
  // |x|<=pi: 18 terms, well below the paired-arithmetic error floor.
  for(int i=1;i<=18;++i){
    st=dsDiv(dsMul(st,xx),vec2(float(2*i*(2*i+1)),0));
    ct=dsDiv(dsMul(ct,xx),vec2(float((2*i-1)*2*i),0));
    s=dsAdd(s,st);c=dsAdd(c,ct);
  }
}
vec2 gdAtan(vec2 x) {
  float seed=atan(x.x);vec2 s,c;gdSinCos(vec2(seed,0),s,c);
  vec2 r=dsDiv(dsSub(dsMul(x,c),s),dsAdd(c,dsMul(x,s)));
  return dsAdd(vec2(seed,0),dsSub(r,dsDiv(dsMul(dsMul(r,r),r),vec2(3,0))));
}
vec2 gdAcos(vec2 x) {
  vec2 ax=x.x<0.?-x:x;
  vec2 ratio=dsDiv(dsSub(vec2(1,0),ax),dsAdd(vec2(1,0),ax));
  vec2 angle=gdAtan(gdSqrt(ratio))*2.;
  return x.x<0.?dsSub(vec2(3.1415927410125732,-8.742278000372485e-8),angle):angle;
}
