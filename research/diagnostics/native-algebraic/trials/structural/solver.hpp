// Ferrari/Cardano formula adapted from Boost.Math's quartic_roots.hpp and
// cubic_roots.hpp, (C) Copyright Nick Thompson 2021.
// Distributed under the Boost Software License, Version 1.0 (LICENSE_1_0.txt).
// All polynomial-root polishing has been removed. Exact degree reduction,
// distinct-root collection and stable quadratic extraction are explicit here.
#pragma once
#include <algorithm>
#include <array>
#include <cmath>
#include <limits>
#include <stdexcept>

namespace native_quartic {
using std::abs;
using std::sqrt;
using std::acos;
using std::cos;
using std::sin;
using std::cbrt;
using std::isfinite;

template<class R> struct Roots {
    std::array<R, 16> v{};
    int n = 0;
    void add(R x) {
        for (int i=0;i<n;++i) if (v[i]==x) return;
        if (n==16) throw std::runtime_error("root buffer overflow");
        v[n++]=x;
    }
    void append(const Roots& r) { for(int i=0;i<r.n;++i) add(r.v[i]); }
    void sort() { std::sort(v.begin(),v.begin()+n,[](const R& a,const R& b){
        if (!isfinite(a)) return false;
        if (!isfinite(b)) return true;
        return a<b;
    }); }
};

template<class R> Roots<R> quadratic(R a,R b,R c) {
    Roots<R> out;
    if (a==0) { if(b!=0) out.add(-c/b); return out; }
    if (c==0) { out.add(R(0));out.add(-b/a);return out; }
    R disc=b*b-4*a*c;
    if (!isfinite(disc)) {out.add(std::numeric_limits<R>::quiet_NaN());return out;}
    if (disc<0) return out;
    if (disc==0) {out.add(-b/(2*a));return out;}
    R t=-(b+(b<0 ? -sqrt(disc):sqrt(disc)))/2;
    out.add(t/a);out.add(c/t);
    return out;
}

template<class R> Roots<R> cubic(R a,R b,R c,R d) {
    if (a==0) return quadratic(b,c,d);
    if (d==0) {auto out=quadratic(a,b,c);out.add(R(0));return out;}
    Roots<R> out;
    R p=b/a,q=c/a,r=d/a;
    R Q=(p*p-3*q)/9, Rv=(2*p*p*p-9*p*q+27*r)/54;
    R disc=Rv*Rv-Q*Q*Q;
    if (!isfinite(disc)) {out.add(std::numeric_limits<R>::quiet_NaN());return out;}
    if(disc<0) {
        R rt=sqrt(Q),arg=Rv/(Q*rt);
        // The discriminant branch guarantees |arg|<=1 in exact arithmetic.
        arg=std::max(R(-1),std::min(R(1),arg));
        R theta=acos(arg)/3,st=sin(theta),ct=cos(theta);
        out.add(-2*rt*ct-p/3);
        out.add(-rt*(-ct+sqrt(R(3))*st)-p/3);
        out.add(rt*(ct+sqrt(R(3))*st)-p/3);
    } else {
        R A=(Rv>=0?-1:1)*cbrt(R(abs(Rv)+sqrt(disc)));
        R B=A==0?R(0):R(Q/A);
        out.add(A+B-p/3);
        if(disc==0) out.add(-A-p/3);
    }
    return out;
}

// Ascending power coefficients. Returns distinct real roots, not multiplicity.
template<class R> Roots<R> ferrari(const std::array<R,5>& f) {
    R a=f[4],b=f[3],c=f[2],d=f[1],e=f[0];
    if(a==0) return cubic(b,c,d,e);
    if(e==0) {auto out=cubic(a,b,c,d);out.add(R(0));return out;}
    R A=b/a,B=c/a,C=d/a,D=e/a,Asq=A*A;
    R p=B-3*Asq/8,q=C-A*B/2+Asq*A/8;
    R r=D-A*C/4+Asq*B/16-3*Asq*Asq/256;
    Roots<R> out;
    if (!isfinite(p)||!isfinite(q)||!isfinite(r)) {
        out.add(std::numeric_limits<R>::quiet_NaN());return out;
    }
    if(r==0) {
        auto cr=cubic(R(1),R(0),p,q);
        for(int i=0;i<cr.n;++i) out.add(cr.v[i]-A/4);
        out.add(-A/4); return out;
    }
    if(q==0) {
        auto z=quadratic(R(1),p,r);
        for(int i=0;i<z.n;++i) if(z.v[i]>=0) {
            R t=sqrt(z.v[i]); out.add(t-A/4);out.add(-t-A/4);
        }
        return out;
    }
    auto z=cubic(R(1),R(2*p),R(p*p-4*r),R(-q*q));
    R largest=0;
    for(int i=0;i<z.n;++i) if(z.v[i]>largest) largest=z.v[i];
    if(largest<=0) {out.add(std::numeric_limits<R>::quiet_NaN());return out;}
    R s=sqrt(largest),sum=p+largest,diff=q/s;
    // uv=r. Compute the larger factor constant by addition, the smaller by
    // division, avoiding subtraction of nearly equal quantities.
    R u,v;
    if(sum*diff>=0) {v=(sum+diff)/2;u=r/v;}
    else {u=(sum-diff)/2;v=r/u;}
    // Translate the quadratic factors before root extraction. Subtracting
    // A/4 from a nearly equal root would destroy small roots. Their constant
    // terms multiply to D, so obtain the smaller by a stable division.
    R b1=A/2+s,b2=A/2-s;
    R c1=u+(A/4)*(A/4+s),c2=v+(A/4)*(A/4-s);
    if(abs(c1)>abs(c2))c2=D/c1;
    else if(c2!=0)c1=D/c2;
    out.append(quadratic(R(1),b1,c1));
    out.append(quadratic(R(1),b2,c2));
    return out;
}

template<class R> R evaluate(const std::array<R,5>& f,int degree,R x) {
    R y=f[degree];for(int i=degree-1;i>=0;--i)y=y*x+f[i];return y;
}

template<class R> Roots<R> algebraic(std::array<R,5> f) {
    Roots<R> out;
    R scale=0;for(auto x:f)scale=std::max(scale,R(abs(x)));
    if(scale==0)return out;
    // Preserve structural zeros before changing coordinates. This also
    // preserves exact origins and degree loss without a proximity tolerance.
    if(f[0]==0){
        std::array<R,5> deflated{};
        for(int i=1;i<=4;++i)deflated[i-1]=f[i];
        out=algebraic(deflated);out.add(R(0));return out;
    }
    if(f[4]==0&&f[3]==0)return quadratic(f[2],f[1],f[0]);
    // Ferrari's biquadratic case needs no cubic resolvent. Retaining that
    // algebraic structure also preserves the exact repeated-root fixtures.
    if(f[4]!=0){
        R A=f[3]/f[4],B=f[2]/f[4],C=f[1]/f[4];
        if(C-A*B/2+A*A*A/8==0)return ferrari(f);
    }
    R shift=0,best=abs(f[0]);
    for(int t:{-2,-1,1,2}){
        R v=abs(evaluate(f,4,R(t)));
        if(v>best){best=v;shift=t;}
    }
    // In-place Taylor shift, followed by an optional reciprocal chart.
    for(int i=3;i>=0;--i)for(int j=i;j<4;++j)f[j]+=shift*f[j+1];
    bool reciprocal=abs(f[0])>abs(f[4]);
    if(reciprocal)std::reverse(f.begin(),f.end());
    auto roots=ferrari(f);
    for(int i=0;i<roots.n;++i){
        R x=roots.v[i];
        if(reciprocal){if(x==0)continue;x=1/x;}
        out.add(x+shift);
    }
    return out;
}

template<class R> bool crossing(R a,R b) {return (a<0&&b>0)||(a>0&&b<0);}

// Independent iterative control. Solves only [-1,1], including endpoints.
template<class R> Roots<R> isolate(std::array<R,5> f,int degree=4) {
    while(degree>0&&f[degree]==0)--degree;
    Roots<R> out;
    if(degree==0) return out;
    // Deflate an exact zero before recursive interval work. Otherwise a
    // rounded critical point can turn zero (infinity in a reciprocal chart)
    // into an extremely remote spurious finite root.
    if(f[0]==0){
        std::array<R,5> deflated{};
        for(int i=1;i<=degree;++i)deflated[i-1]=f[i];
        out=isolate(deflated,degree-1);out.add(R(0));return out;
    }
    R scale=0;for(int i=0;i<=degree;++i)scale=std::max(scale,R(abs(f[i])));
    // Power-of-two scaling preserves exactly representable coefficients;
    // arbitrary normalization can perturb repeated roots into complex pairs.
    using std::frexp;
    using std::ldexp;
    int exponent=0;frexp(scale,&exponent);
    for(int i=0;i<=degree;++i)f[i]=ldexp(f[i],-exponent);
    if(degree==1){R x=-f[0]/f[1];if(x>=-1&&x<=1)out.add(x);return out;}
    std::array<R,5> derivative{};
    for(int i=1;i<=degree;++i)derivative[i-1]=f[i]*i;
    auto crit=isolate(derivative,degree-1);crit.sort();
    std::array<R,7> cuts{},values{};int n=0;cuts[n++]=-1;
    for(int i=0;i<crit.n;++i)if(crit.v[i]>-1&&crit.v[i]<1)cuts[n++]=crit.v[i];
    cuts[n++]=1;
    for(int i=0;i<n;++i)values[i]=evaluate(f,degree,cuts[i]);
    R tolerance=ldexp(R(1),-std::numeric_limits<R>::digits+14);
    for(int i=0;i<n;++i){
        bool cross=(i>0&&crossing(values[i-1],values[i]))||(i+1<n&&crossing(values[i],values[i+1]));
        if(values[i]==0||(i>0&&i+1<n&&abs(values[i])<=tolerance&&!cross))out.add(cuts[i]);
        if(i+1==n||!crossing(values[i],values[i+1]))continue;
        R lo=cuts[i],hi=cuts[i+1],fl=values[i],fh=values[i+1];
        for(int j=0;j<std::numeric_limits<R>::digits+4;++j){
            R mid=(lo+hi)/2;
            if(mid==lo||mid==hi)break;
            R fm=evaluate(f,degree,mid);
            if(fm==0){lo=hi=mid;fl=fh=0;break;}
            if(crossing(fl,fm)){hi=mid;fh=fm;}else{lo=mid;fl=fm;}
        }
        out.add(fl==0?lo:fh==0?hi:R(lo+(hi-lo)*fl/(fl-fh)));
    }
    return out;
}
}
