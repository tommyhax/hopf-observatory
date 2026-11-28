#include <boost/multiprecision/cpp_bin_float.hpp>
#include <boost/version.hpp>
#include <chrono>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <string>
#include <vector>
#include "solver.hpp"

using namespace native_quartic;
using Quad=boost::multiprecision::cpp_bin_float_quad;
using Wide=boost::multiprecision::number<boost::multiprecision::cpp_bin_float<256,boost::multiprecision::digit_base_2>>;
struct Input {int kind,id;std::array<double,23> data{};};
template<class R> struct Polynomial {std::array<R,5> f{};R k=0,L=1;bool reciprocal=false;};

template<class R> Polynomial<R> construct(const Input& in) {
    Polynomial<R> out;
    if(in.kind==1){for(int i=0;i<5;++i)out.f[i]=in.data[i];}
    else {
        std::array<R,3> o{},d{},center{};
        for(int i=0;i<3;++i){o[i]=in.data[17+i];d[i]=in.data[20+i];out.k+=o[i]*d[i];}
        R norm=0;
        for(int i=0;i<3;++i){center[i]=o[i]-out.k*d[i];norm+=center[i]*center[i];}
        out.L=std::max(R(1),R(sqrt(norm)));
        R inv=1/out.L;
        std::array<R,4> a{},b{},c{};
        a[3]=-inv*inv;
        for(int i=0;i<3;++i){
            R scaled=center[i]*inv;
            a[i]=2*scaled*inv;a[3]+=scaled*scaled;
            b[i]=2*d[i]*inv;b[3]+=2*scaled*d[i];c[3]+=d[i]*d[i];
        }
        auto B=[&](const auto& x,const auto& y){
            R sum=0;
            for(int i=0;i<4;++i){R v=0;for(int j=0;j<4;++j){
                R A=R(in.data[4*i+j])-(i==j?R(in.data[16]):R(0));
                v+=A*y[j];
            }sum+=x[i]*v;}return sum;
        };
        out.f={B(a,a),R(B(a,b)+B(b,a)),R(B(a,c)+B(b,b)+B(c,a)),R(B(b,c)+B(c,b)),B(c,c)};
    }
    out.reciprocal=abs(out.f[0])>abs(out.f[4]);
    return out;
}

template<class R> Roots<R> solve(const Polynomial<R>& p,bool algebraic,bool geometry) {
    Roots<R> out;
    auto add=[&](R x,bool reciprocal){
        if(!isfinite(x)){out.add(x);return;}
        if(reciprocal){if(x==0)return;x=1/x;}
        R s=geometry?R(p.L*x-p.k):x;
        if(!isfinite(s)||!geometry||s>0)out.add(s);
    };
    if(algebraic){
        auto f=p.f;if(p.reciprocal)std::reverse(f.begin(),f.end());
        auto roots=ferrari(f);
        for(int i=0;i<roots.n;++i)add(roots.v[i],p.reciprocal);
    } else {
        auto roots=isolate(p.f);
        for(int i=0;i<roots.n;++i)add(roots.v[i],false);
        auto f=p.f;std::reverse(f.begin(),f.end());roots=isolate(f);
        for(int i=0;i<roots.n;++i)if(abs(roots.v[i])<1&&roots.v[i]!=0)add(roots.v[i],true);
    }
    out.sort();return out;
}

volatile double sink=0;
template<class R> int run(const std::vector<Input>& inputs,bool algebraic,bool benchmark) {
    std::vector<Polynomial<R>> polys;for(auto& in:inputs)polys.push_back(construct<R>(in));
    if(!benchmark){
        std::cout<<std::setprecision(std::numeric_limits<R>::max_digits10);
        for(size_t i=0;i<inputs.size();++i){
            auto roots=solve(polys[i],algebraic,inputs[i].kind==0);
            std::cout<<inputs[i].id<<'\t'<<roots.n;
            for(int j=0;j<roots.n;++j)std::cout<<'\t'<<roots.v[j];
            std::cout<<'\t'<<polys[i].k<<'\t'<<polys[i].L;
            for(auto x:polys[i].f)std::cout<<'\t'<<x;
            std::cout<<'\n';
        }
    } else {
        using Clock=std::chrono::steady_clock;
        auto block=[&](int repeat,bool build){
            double checksum=0;auto start=Clock::now();
            for(int r=0;r<repeat;++r)for(size_t i=0;i<inputs.size();++i){
                if(inputs[i].kind!=0)continue;
                auto roots=solve(build?construct<R>(inputs[i]):polys[i],algebraic,true);
                checksum+=roots.n;
                for(int j=0;j<roots.n;++j)if(isfinite(roots.v[j]))checksum+=static_cast<double>(roots.v[j])/(1+abs(static_cast<double>(roots.v[j])));
            }
            auto end=Clock::now();sink=checksum;
            return std::chrono::duration<double>(end-start).count();
        };
        int count=0;for(auto& in:inputs)if(in.kind==0)++count;
        for(bool build:{false,true}){
            double warmup=block(1,build);
            int repeat=std::max(1,std::min(10000,int(0.08/std::max(warmup,1e-9))));
            for(int b=0;b<7;++b){
                double seconds=block(repeat,build);
                std::cout<<(build?"construct_solve":"solve_only")<<'\t'<<b<<'\t'<<repeat<<'\t'<<count<<'\t'
                  <<std::setprecision(17)<<seconds<<'\t'<<sink<<'\n';
            }
        }
    }
    return 0;
}

int main(int argc,char** argv){
    if(argc==2&&std::string(argv[1])=="--metadata"){
        std::cout<<"{\"compiler\":\""<<__clang_version__<<"\",\"boost\":\""<<BOOST_LIB_VERSION
          <<"\",\"double_bits\":"<<std::numeric_limits<double>::digits
          <<",\"long_double_bits\":"<<std::numeric_limits<long double>::digits
          <<",\"quad_bits\":"<<std::numeric_limits<Quad>::digits
          <<",\"wide_bits\":"<<std::numeric_limits<Wide>::digits<<"}\n";return 0;
    }
    if(argc!=5){std::cerr<<"usage: native-quartic INPUT BITS algebraic|iterative capture|benchmark\n";return 2;}
    std::ifstream file(argv[1]);if(!file)throw std::runtime_error("input file unavailable");
    std::vector<Input> inputs;Input in;
    while(file>>in.kind>>in.id){int n=in.kind==0?23:5;for(int i=0;i<n;++i)if(!(file>>in.data[i]))throw std::runtime_error("bad input");inputs.push_back(in);}
    bool alg=std::string(argv[3])=="algebraic",bench=std::string(argv[4])=="benchmark";
    int bits=std::stoi(argv[2]);
    if(bits==53)return run<double>(inputs,alg,bench);
    if(bits==113)return run<Quad>(inputs,alg,bench);
    if(bits==256)return run<Wide>(inputs,alg,bench);
    throw std::runtime_error("unsupported precision");
}
