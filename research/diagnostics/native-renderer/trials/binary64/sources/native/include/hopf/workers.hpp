#pragma once
#include <atomic>
#include <condition_variable>
#include <functional>
#include <mutex>
#include <thread>
#include <vector>

namespace hopf {
// Persistent workers: thread creation is outside every timed frame. Each tile
// is exclusively owned, and the main thread waits for every worker to finish.
class Workers {
    std::vector<std::thread> threads;
    std::mutex mutex;std::condition_variable ready,done;
    std::function<void(int)> job;
    std::atomic<int> next{0};int count=0,pending=0;unsigned generation=0;bool stop=false;
public:
    explicit Workers(int n){
        for(int i=0;i<n;++i)threads.emplace_back([this]{unsigned seen=0;
            for(;;){
                {std::unique_lock<std::mutex> lock(mutex);ready.wait(lock,[&]{return stop||generation!=seen;});
                 if(stop)return;seen=generation;}
                for(int t;(t=next.fetch_add(1,std::memory_order_relaxed))<count;)job(t);
                {std::lock_guard<std::mutex> lock(mutex);if(--pending==0)done.notify_one();}
            }
        });
    }
    ~Workers(){
        {std::lock_guard<std::mutex> lock(mutex);stop=true;}ready.notify_all();
        for(auto& t:threads)t.join();
    }
    void run(int tiles,std::function<void(int)> callback){
        std::unique_lock<std::mutex> lock(mutex);job=std::move(callback);count=tiles;next=0;
        pending=int(threads.size());++generation;ready.notify_all();done.wait(lock,[&]{return pending==0;});
    }
    int size()const{return int(threads.size());}
};
}
