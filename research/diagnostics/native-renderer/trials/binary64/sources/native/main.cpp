#include "hopf/renderer.hpp"
#include "hopf/workers.hpp"
#include <boost/property_tree/json_parser.hpp>
#include <boost/version.hpp>
#include <chrono>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <memory>
#include <sstream>
#ifdef HOPF_SDL
#include <SDL3/SDL.h>
#endif
using namespace hopf;
using Tree=boost::property_tree::ptree;
using Clock=std::chrono::steady_clock;
double ms(Clock::time_point start){return std::chrono::duration<double,std::milli>(Clock::now()-start).count();}
std::string quote(const std::string& s){std::ostringstream o;o<<'"';for(char c:s){if(c=='"'||c=='\\')o<<'\\'<<c;else if(c=='\n')o<<"\\n";else if(c=='\r')o<<"\\r";else o<<c;}return o.str()+'"';}
void number(std::ostream& out,double x){if(std::isfinite(x))out<<std::setprecision(17)<<x;else out<<"null";}
template<class V> void numbers(std::ostream& out,const V& xs){out<<'[';bool first=true;for(auto x:xs){if(!first)out<<',';first=false;number(out,x);}out<<']';}
std::vector<double> array(const Tree& t,const std::string& key,bool f32=true){
    std::vector<double> a;auto c=t.get_child_optional(Tree::path_type(key,'/'));
    if(c)for(auto& v:*c){double x=v.second.get_value<double>();if(!std::isfinite(x))throw std::runtime_error("nonfinite input");a.push_back(f32?double(float(x)):x);}return a;
}
Renderer scene(const Tree& request){
    Renderer r;auto u=request.get_child_optional("uniforms");if(!u)return r;
    bool round=request.get<bool>("roundUniforms",true);
    auto scalar=[&](const char* key,double value){double x=u->get<double>(key,value);return round?double(float(x)):x;};
    auto vector=[&](const char* key,auto& value,int n){auto a=array(*u,key,round);for(int i=0;i<std::min(n,int(a.size()));++i)value[i]=a[i];};
    auto p=array(*u,"uP",round);for(int i=0;i<int(p.size())&&i<16;++i)r.uP[i/4][i%4]=p[i];
    vector("uEye",r.uEye,3);vector("uForward",r.uForward,3);vector("uRight",r.uRight,3);vector("uUp",r.uUp,3);
    vector("uResolution",r.uResolution,2);vector("uLevels",r.uLevels,3);vector("uLows",r.uLows,3);vector("uHighs",r.uHighs,3);
    vector("uEnabled",r.uEnabled,3);vector("uShells",r.uShells,3);
    auto optics=array(*u,"uOptics[0]",round),colors=array(*u,"uColors[0]",round);
    for(int i=0;i<int(optics.size())&&i<12;++i)r.uOptics[i/4][i%4]=optics[i];
    for(int i=0;i<int(colors.size())&&i<9;++i)r.uColors[i/3][i%3]=colors[i];
    #define LOAD_SCALAR(n) r.n=scalar(#n,r.n)
    LOAD_SCALAR(uC);LOAD_SCALAR(uOpacity);LOAD_SCALAR(uIOR);LOAD_SCALAR(uShellLow);LOAD_SCALAR(uShellHigh);
    LOAD_SCALAR(uEnvRotation);LOAD_SCALAR(uExposure);LOAD_SCALAR(uMapMaxLod);LOAD_SCALAR(uRayBias);
    LOAD_SCALAR(uCount);LOAD_SCALAR(uShell);LOAD_SCALAR(uBounces);LOAD_SCALAR(uEnvironment);LOAD_SCALAR(uMode);
    #undef LOAD_SCALAR
    r.precision=request.get<int>("precision",53);
    if(r.precision!=53&&r.precision!=113)throw std::runtime_error("precision must be 53 or 113");
    if(r.uCount<0||r.uCount>3||r.uEnvironment<0||r.uEnvironment>6)throw std::runtime_error("scene values out of range");
    return r;
}

class Display {
#ifdef HOPF_SDL
    SDL_Window* window=nullptr;SDL_Renderer* renderer=nullptr;SDL_Texture* upload=nullptr;SDL_Texture* target=nullptr;
    int width=0,height=0;
public:
    ~Display(){if(target)SDL_DestroyTexture(target);if(upload)SDL_DestroyTexture(upload);if(renderer)SDL_DestroyRenderer(renderer);if(window)SDL_DestroyWindow(window);if(renderer)SDL_Quit();}
    void prepare(int w,int h){
        if(!renderer){if(!SDL_Init(SDL_INIT_VIDEO)||!SDL_CreateWindowAndRenderer("Hopf Observatory — C++",w,h,SDL_WINDOW_HIDDEN,&window,&renderer))throw std::runtime_error(SDL_GetError());SDL_SetRenderVSync(renderer,0);}
        if(w==width&&h==height)return;
        if(target)SDL_DestroyTexture(target);if(upload)SDL_DestroyTexture(upload);width=w;height=h;
        upload=SDL_CreateTexture(renderer,SDL_PIXELFORMAT_RGBA32,SDL_TEXTUREACCESS_STREAMING,w,h);
        target=SDL_CreateTexture(renderer,SDL_PIXELFORMAT_RGBA32,SDL_TEXTUREACCESS_TARGET,w,h);
        if(!upload||!target)throw std::runtime_error(SDL_GetError());SDL_SetTextureBlendMode(upload,SDL_BLENDMODE_NONE);
    }
    double complete(const std::vector<unsigned char>& pixels){
        auto start=Clock::now();
        if(!SDL_UpdateTexture(upload,nullptr,pixels.data(),width*4)||!SDL_SetRenderTarget(renderer,target)||!SDL_RenderTexture(renderer,upload,nullptr,nullptr))throw std::runtime_error(SDL_GetError());
        SDL_Rect one{0,0,1,1};auto surface=SDL_RenderReadPixels(renderer,&one);
        if(!surface)throw std::runtime_error(SDL_GetError());SDL_DestroySurface(surface);
        return ms(start);
    }
    std::string name()const{return renderer?SDL_GetRendererName(renderer):"uninitialized";}
    void view(){
        SDL_SetWindowSize(window,width,height);SDL_ShowWindow(window);SDL_SetRenderTarget(renderer,nullptr);
        // Captures use OpenGL's bottom row first. Flip only for display.
        SDL_RenderTextureRotated(renderer,target,nullptr,nullptr,0,nullptr,SDL_FLIP_VERTICAL);SDL_RenderPresent(renderer);
        SDL_Event e;bool running=true;
        while(running&&SDL_WaitEvent(&e)){if(e.type==SDL_EVENT_QUIT||e.type==SDL_EVENT_KEY_DOWN)running=false;}
        SDL_HideWindow(window);
    }
#else
public:
    void prepare(int,int){throw std::runtime_error("Build with SDL3 for presentation");}
    double complete(const std::vector<unsigned char>&){return 0;}
    std::string name()const{return "unavailable";}
    void view(){}
#endif
};

int main(int argc,char** argv){
    try {
        int n=std::max(1u,std::thread::hardware_concurrency());
        for(int i=1;i+1<argc;++i)if(std::string(argv[i])=="--threads")n=std::stoi(argv[i+1]);
        if(n<1||n>256)throw std::runtime_error("threads must be 1..256");
        Workers workers(n);Display display;
        std::cout<<"{\"ready\":true,\"threads\":"<<n<<",\"hardwareThreads\":"<<std::thread::hardware_concurrency()
          <<",\"doubleBits\":"<<std::numeric_limits<double>::digits<<",\"boost\":"<<quote(BOOST_LIB_VERSION)<<",\"compiler\":"<<quote(
        #ifdef _MSC_VER
        "MSVC"
        #else
        __VERSION__
        #endif
        )<<",\"sdl\":"<<
        #ifdef HOPF_SDL
        "true"
        #else
        "false"
        #endif
        <<"}\n"<<std::flush;
        for(std::string line;std::getline(std::cin,line);){
            try {
                std::istringstream input(line);Tree request;boost::property_tree::read_json(input,request);
                auto op=request.get<std::string>("op");if(op=="quit")break;
                if(op=="compile"){std::cout<<"{\"glError\":0}\n"<<std::flush;continue;}
                Renderer r=scene(request);std::atomic<std::uint64_t> invalid{0};r.invalidRoots=&invalid;
                std::mutex diagnosticMutex;std::ofstream diagnostic;int diagnosticCount=0;
                auto diagnosticPath=request.get<std::string>("diagnostics","");
                if(!diagnosticPath.empty()){
                    diagnostic.open(diagnosticPath);
                    r.invalidCallback=[&](vec3 o,vec3 d,double level){std::lock_guard<std::mutex> lock(diagnosticMutex);
                        if(diagnosticCount++>=128)return;
                        diagnostic<<"{\"o\":";numbers(diagnostic,std::array<double,3>{o.x,o.y,o.z});
                        diagnostic<<",\"d\":";numbers(diagnostic,std::array<double,3>{d.x,d.y,d.z});
                        diagnostic<<",\"level\":";number(diagnostic,level);diagnostic<<"}\n";
                    };
                }
                if(op=="roots"){
                    auto roots=r.allRoots(r.uEye,r.uForward,r.uC);std::vector<double> values(roots.v.begin(),roots.v.begin()+roots.n);
                    std::cout<<"{\"roots\":";numbers(std::cout,values);std::cout<<"}\n"<<std::flush;continue;
                }
                if(op=="draw"){
                    auto name=request.get<std::string>("name");std::array<double,16> out{};
                    vec3 d=normalize(r.uForward);
                    if(name=="hits"){double level,sign;int id;out[0]=r.sceneHit(r.uEye,d,level,sign,id);out[1]=level;out[2]=sign;out[3]=id;}
                    else if(name=="optical"){vec3 c=abs(r.trace(r.uEye,d)-r.environment(d));out[0]=c.x;out[1]=c.y;out[2]=c.z;out[3]=1;}
                    else if(name=="snell"){r.debugStep=request.get<int>("uniforms.uDebugStep",0);r.trace(r.uEye,d);out=r.captured;}
                    else {auto c=r.pixel(request.get<double>("x",0),request.get<double>("y",0));for(int i=0;i<4;++i)out[i]=c[i];}
                    std::cout<<"{\"glError\":0,\"invalidRoots\":"<<invalid<<",\"pixels\":";numbers(std::cout,out);std::cout<<"}\n"<<std::flush;continue;
                }
                if(op!="render")throw std::runtime_error("Unknown operation");
                int width=request.get<int>("width",1280),height=request.get<int>("height",720);
                int frames=request.get<int>("frames",1),warmup=request.get<int>("warmup",0);
                if(width<1||height<1||width>8192||height>8192||frames<1||warmup<0)throw std::runtime_error("render dimensions/counts invalid");
                r.uResolution={double(width),double(height)};
                bool present=request.get<bool>("present",false),view=request.get<bool>("view",false);present|=view;
                if(present)display.prepare(width,height);
                std::vector<unsigned char> pixels(size_t(width)*height*4);
                std::vector<double> times,presentation,completed;
                std::atomic<std::uint64_t> invalidPixels{0};
                int tilesX=(width+15)/16,tilesY=(height+15)/16;
                for(int frame=-warmup;frame<frames;++frame){
                    auto start=Clock::now();
                    workers.run(tilesX*tilesY,[&](int tile){
                        int x0=(tile%tilesX)*16,y0=(tile/tilesX)*16;
                        for(int y=y0;y<std::min(y0+16,height);++y)for(int x=x0;x<std::min(x0+16,width);++x){
                            auto c=r.pixel(x,y);for(int i=0;i<4;++i){double v=c[i];
                                if(!std::isfinite(v)){++invalidPixels;v=0;}
                                pixels[(size_t(y)*width+x)*4+i]=static_cast<unsigned char>(std::nearbyint(clamp(v,0,1)*255));
                            }
                        }
                    });
                    double compute=ms(start),upload=present?display.complete(pixels):0;
                    if(frame>=0){times.push_back(compute);presentation.push_back(upload);completed.push_back(ms(start));}
                }
                auto path=request.get<std::string>("output","");
                if(!path.empty()){std::ofstream out(path,std::ios::binary);out.write(reinterpret_cast<const char*>(pixels.data()),pixels.size());if(!out)throw std::runtime_error("Could not write RGBA output");}
                auto ppm=request.get<std::string>("ppm","");
                if(!ppm.empty()){std::ofstream out(ppm,std::ios::binary);out<<"P6\n"<<width<<' '<<height<<"\n255\n";
                    for(int y=height-1;y>=0;--y)for(int x=0;x<width;++x)out.write(reinterpret_cast<const char*>(&pixels[(size_t(y)*width+x)*4]),3);}
                std::uint64_t checksum=1469598103934665603ull;for(auto b:pixels){checksum^=b;checksum*=1099511628211ull;}
                std::cout<<"{\"milliseconds\":";numbers(std::cout,times);std::cout<<",\"presentationMilliseconds\":";numbers(std::cout,presentation);
                std::cout<<",\"completionMilliseconds\":";numbers(std::cout,completed);
                std::cout<<",\"invalidRoots\":"<<invalid<<",\"invalidPixels\":"<<invalidPixels<<",\"checksum\":"<<quote(std::to_string(checksum))
                  <<",\"presentationBackend\":"<<quote(present?display.name():"none")<<"}\n"<<std::flush;
                if(view)display.view();
            }catch(const std::exception& e){std::cout<<"{\"error\":"<<quote(e.what())<<"}\n"<<std::flush;}
        }
    }catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
