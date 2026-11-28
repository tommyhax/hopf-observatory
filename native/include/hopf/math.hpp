#pragma once
#include <algorithm>
#include <array>
#include <cmath>
#include <stdexcept>

namespace hopf {
struct vec2 {
    double x=0,y=0;
    vec2()=default;vec2(double v):x(v),y(v){}vec2(double a,double b):x(a),y(b){}
    double& operator[](int i){return i==0?x:y;}double operator[](int i)const{return i==0?x:y;}
};
struct vec3 {
    double x=0,y=0,z=0;
    vec3()=default;vec3(double v):x(v),y(v),z(v){}vec3(double a,double b,double c):x(a),y(b),z(c){}
    double& operator[](int i){return i==0?x:i==1?y:z;}double operator[](int i)const{return i==0?x:i==1?y:z;}
    vec2 xz()const{return {x,z};}
};
struct vec4 {
    double x=0,y=0,z=0,w=0;
    vec4()=default;vec4(double v):x(v),y(v),z(v),w(v){}
    vec4(double a,double b,double c,double d):x(a),y(b),z(c),w(d){}
    vec4(vec3 v,double d):x(v.x),y(v.y),z(v.z),w(d){}
    double& operator[](int i){return i==0?x:i==1?y:i==2?z:w;}
    double operator[](int i)const{return i==0?x:i==1?y:i==2?z:w;}
    vec3 xyz()const{return {x,y,z};}
};
#define HOPF_VECTOR(V,N) \
inline V operator+(V a,V b){for(int i=0;i<N;++i)a[i]+=b[i];return a;} \
inline V operator-(V a,V b){for(int i=0;i<N;++i)a[i]-=b[i];return a;} \
inline V operator*(V a,V b){for(int i=0;i<N;++i)a[i]*=b[i];return a;} \
inline V operator/(V a,V b){for(int i=0;i<N;++i)a[i]/=b[i];return a;} \
inline V operator-(V a){for(int i=0;i<N;++i)a[i]=-a[i];return a;} \
inline V& operator+=(V& a,V b){a=a+b;return a;} \
inline V& operator*=(V& a,V b){a=a*b;return a;} \
inline double dot(V a,V b){double s=0;for(int i=0;i<N;++i)s+=a[i]*b[i];return s;} \
inline double length(V a){return std::sqrt(dot(a,a));} \
inline V normalize(V a){return a/length(a);} \
inline V abs(V a){for(int i=0;i<N;++i)a[i]=std::abs(a[i]);return a;} \
inline V max(V a,V b){for(int i=0;i<N;++i)a[i]=std::max(a[i],b[i]);return a;} \
inline V pow(V a,V b){for(int i=0;i<N;++i)a[i]=std::pow(a[i],b[i]);return a;} \
inline V exp(V a){for(int i=0;i<N;++i)a[i]=std::exp(a[i]);return a;} \
inline V mix(V a,V b,double t){return a*(1-t)+b*t;}
HOPF_VECTOR(vec2,2)
HOPF_VECTOR(vec3,3)
HOPF_VECTOR(vec4,4)
#undef HOPF_VECTOR
inline vec3 cross(vec3 a,vec3 b){return {a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x};}
inline vec3 reflect(vec3 d,vec3 n){return d-2*dot(n,d)*n;}
inline vec3 refract(vec3 d,vec3 n,double eta){double c=dot(n,d),k=1-eta*eta*(1-c*c);return k<0?vec3(0):eta*d-(eta*c+std::sqrt(k))*n;}
inline double min(double a,double b){return std::min(a,b);}
inline double max(double a,double b){return std::max(a,b);}
inline double clamp(double x,double a,double b){return std::clamp(x,a,b);}
inline double mix(double a,double b,double t){return a*(1-t)+b*t;}
inline double smoothstep(double a,double b,double x){double t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
inline double fract(double x){return x-std::floor(x);}
inline double mod(double x,double y){return x-y*std::floor(x/y);}
inline double atan(double y,double x){return std::atan2(y,x);}
using std::abs;using std::acos;using std::asin;using std::cos;using std::sin;
using std::exp;using std::exp2;using std::floor;using std::log;using std::pow;using std::sqrt;
struct mat4 {
    std::array<vec4,4> col{};
    mat4()=default;
    explicit mat4(double d){for(int i=0;i<4;++i)col[i][i]=d;}
    vec4& operator[](int i){return col[i];}vec4 operator[](int i)const{return col[i];}
};
inline mat4 operator-(mat4 a,mat4 b){for(int i=0;i<4;++i)a[i]=a[i]-b[i];return a;}
inline vec4 operator*(mat4 a,vec4 b){vec4 r;for(int i=0;i<4;++i)r+=a[i]*b[i];return r;}
}
