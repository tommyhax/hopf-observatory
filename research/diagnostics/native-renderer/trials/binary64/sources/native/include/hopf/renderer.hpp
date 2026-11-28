#pragma once
#include <boost/multiprecision/cpp_bin_float.hpp>
#include <atomic>
#include <cstdint>
#include <functional>
#include <vector>
#include "math.hpp"
#include "quartic.hpp"

namespace hopf {
struct Texture {
    int width=1,height=1;
    std::vector<vec4> pixels{vec4(128./255,128./255,128./255,1)};
    vec4 sample(vec2 uv)const {
        double x=fract(uv.x)*width-.5,y=clamp(uv.y,0,1)*height-.5;
        int ix=int(floor(x)),iy=int(floor(y));double tx=fract(x),ty=fract(y);
        auto texel=[&](int a,int b){a=(a%width+width)%width;b=std::clamp(b,0,height-1);return pixels[b*width+a];};
        return mix(mix(texel(ix,iy),texel(ix+1,iy),tx),mix(texel(ix,iy+1),texel(ix+1,iy+1),tx),ty);
    }
};

struct Renderer {
    mat4 uP;
    vec2 uResolution{1,1};
    vec3 uEye,uRight,uUp,uForward;
    int uEnvironment=3,uMode=0,uBounces=24,uShell=0,uCount=0;
    std::array<int,3> uEnabled{},uShells{};
    vec3 uLevels,uLows,uHighs;
    std::array<vec4,3> uOptics{};
    std::array<vec3,3> uColors{};
    double uC=.5,uOpacity=0,uIOR=1.45,uShellLow=0,uShellHigh=0;
    double uEnvRotation=0,uExposure=0,uMapMaxLod=0,uRayBias=0;
    std::vector<Texture> uEnvironmentMap{Texture{}};
    int precision=53,debugStep=-1;
    std::array<double,16> captured{0,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0};
    std::atomic<std::uint64_t>* invalidRoots=nullptr;
    std::function<void(vec3,vec3,double)> invalidCallback;
    static constexpr double PI=3.14159265359;

    vec4 textureLod(const std::vector<Texture>& levels,vec2 uv,double lod) {
        lod=clamp(lod,0,double(levels.size()-1));
        int lo=int(floor(lod)),hi=std::min(lo+1,int(levels.size()-1));
        return mix(levels[lo].sample(uv),levels[hi].sample(uv),fract(lod));
    }
    double rayBiasScale(){
        if(uRayBias>0)return uRayBias;
        double gap=uShell==1?abs(acos(sqrt(clamp(uShellLow,0,1)))-acos(sqrt(clamp(uShellHigh,0,1)))):1;
        return clamp(.05*gap,1e-6,4e-4);
    }
    double rayEpsilon(vec3 p){return rayBiasScale()*max(1,length(p));}

    template<class R> native_quartic::Roots<double> roots(vec3 o,vec3 d,double level) {
        // Same construction and operation order as the validated standalone
        // native experiment. Convert inputs before performing any arithmetic.
        R k=0;std::array<R,3> ro{},rd{},center{};
        for(int i=0;i<3;++i){ro[i]=o[i];rd[i]=d[i];k+=ro[i]*rd[i];}
        R norm=0;for(int i=0;i<3;++i){center[i]=ro[i]-k*rd[i];norm+=center[i]*center[i];}
        using std::sqrt;
        R L=std::max(R(1),R(sqrt(norm))),inv=1/L;
        std::array<R,4> a{},b{},c{};a[3]=-inv*inv;
        for(int i=0;i<3;++i){R scaled=center[i]*inv;a[i]=2*scaled*inv;a[3]+=scaled*scaled;
            b[i]=2*rd[i]*inv;b[3]+=2*scaled*rd[i];c[3]+=rd[i]*rd[i];}
        auto B=[&](const auto& x,const auto& y){R sum=0;
            for(int i=0;i<4;++i){R v=0;for(int j=0;j<4;++j)
                v+=(R(uP[j][i])-(i==j?R(level):R(0)))*y[j];sum+=x[i]*v;}return sum;};
        std::array<R,5> f{B(a,a),R(B(a,b)+B(b,a)),R(B(a,c)+B(b,b)+B(c,a)),R(B(b,c)+B(c,b)),B(c,c)};
        auto rr=native_quartic::algebraic(f);native_quartic::Roots<double> out;
        for(int i=0;i<rr.n;++i){double s=static_cast<double>(L*rr.v[i]-k);
            if(!std::isfinite(s)||s>0)out.add(s);}
        out.sort();return out;
    }
    native_quartic::Roots<double> allRoots(vec3 o,vec3 d,double level){
        if(precision==113)return roots<boost::multiprecision::cpp_bin_float_quad>(o,d,level);
        return roots<double>(o,d,level);
    }
    double intersection(vec3 o,vec3 d,double level){
        auto candidates=allRoots(o,d,level);double best=-1,minS=.5*rayEpsilon(o);
        for(int i=0;i<candidates.n;++i){double s=candidates.v[i];
            if(!std::isfinite(s)){if(invalidRoots)++*invalidRoots;if(invalidCallback)invalidCallback(o,d,level);continue;}
            if(s>minS&&(best<0||s<best))best=s;}
        return best;
    }

    #include "optics.inc"

    vec3 cameraRay(double x,double y){
        vec2 uv=(vec2(x+.5,y+.5)-.5*uResolution)/uResolution.y;
        return normalize(uForward+1.05*(uv.x*uRight+uv.y*uUp));
    }
    vec4 pixel(double x,double y){
        vec2 uv=(vec2(x+.5,y+.5)-.5*uResolution)/uResolution.y;
        vec3 col=trace(uEye,cameraRay(x,y));
        if(uMode==0){col=col/(1.+col);col=pow(max(col,0.),vec3(1./2.2));}
        double vignette=1.-.16*dot(uv,uv);
        return vec4(col*max(.6,vignette),1);
    }
};
}
