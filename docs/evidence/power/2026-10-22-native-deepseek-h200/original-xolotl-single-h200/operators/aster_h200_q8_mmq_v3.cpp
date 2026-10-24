// Aster experimental hardware control for the pinned MIT-licensed ggml backend.
#include "ggml.h"
#include "ggml-backend.h"
#include "ggml-alloc.h"
#include "ggml-cuda.h"
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <random>
#include <string>
#include <vector>
#include <fcntl.h>
#include <unistd.h>

bool ggml_cuda_should_use_mmvq(ggml_type, int, int64_t);
bool aster_h200_q8_mmq_selected(ggml_type,int,int64_t,int64_t,int64_t);
struct Q80 { uint16_t d; int8_t qs[32]; };
static_assert(sizeof(Q80)==34);
int main(int argc,char** argv) {
    if (argc!=3 || (std::strcmp(argv[1],"0") && std::strcmp(argv[1],"1"))) return 2;
    setenv("ASTER_H200_Q8_MMQ",argv[1],1);
    const bool mmq=argv[1][0]=='1';
    std::filesystem::path out(argv[2]);
    if (!std::filesystem::is_directory(out) || std::filesystem::canonical(out)!=out) return 2;
    ggml_backend_t be=ggml_backend_cuda_init(0);
    if (!be || !ggml_backend_is_cuda(be)) return 2;
    std::mt19937 rng(20261024);
    std::normal_distribution<float> normal(0.f,1.f);
    for (auto shape : {std::pair<int,int>{5120,1280},{1280,32768},{5120,4096},{5120,129280}}) {
        const int K=shape.first,N=shape.second;
        const std::vector<int> widths=N==129280?std::vector<int>{6}:std::vector<int>{1,2,3,4,5,6,8};
        std::vector<Q80> w((size_t)K*N/32);
        for (auto& b:w) { b.d=ggml_fp32_to_fp16(std::ldexp(.02f,(int)(rng()%5)-2)); for(auto& q:b.qs)q=(int8_t)((int)(rng()%255)-127); }
        std::vector<float> x((size_t)8*K);for(auto& v:x)v=normal(rng);
        for (int M:widths) {
            const bool vector_path=ggml_cuda_should_use_mmvq(GGML_TYPE_Q8_0,900,M) && !aster_h200_q8_mmq_selected(GGML_TYPE_Q8_0,900,M,K,N);
            if (vector_path!=!(mmq && M>=2 && M<=8 && ((K==1280 && N==32768)||(K==5120 && N==129280)))) return 3;
            ggml_init_params ip={ggml_tensor_overhead()*64+ggml_graph_overhead(),nullptr,true};
            ggml_context* c=ggml_init(ip);if(!c)return 2;
            auto* W=ggml_new_tensor_2d(c,GGML_TYPE_Q8_0,K,N);
            auto* X=ggml_new_tensor_2d(c,GGML_TYPE_F32,K,M);
            ggml_set_input(W);ggml_set_input(X);
            auto* Y=ggml_mul_mat(c,W,X);ggml_set_output(Y);
            auto* gf=ggml_new_graph(c);ggml_build_forward_expand(gf,Y);
            auto al=ggml_gallocr_new(ggml_backend_get_default_buffer_type(be));
            if(!ggml_gallocr_alloc_graph(al,gf))return 2;
            ggml_backend_tensor_set(W,w.data(),0,w.size()*sizeof(Q80));
            ggml_backend_tensor_set(X,x.data(),0,(size_t)K*M*4);
            for(int i=0;i<5;++i)if(ggml_backend_graph_compute(be,gf)!=GGML_STATUS_SUCCESS)return 2;
            const auto t0=std::chrono::steady_clock::now();
            for(int i=0;i<20;++i)if(ggml_backend_graph_compute(be,gf)!=GGML_STATUS_SUCCESS)return 2;
            ggml_backend_synchronize(be);
            const double us=std::chrono::duration<double,std::micro>(std::chrono::steady_clock::now()-t0).count()/20.;
            std::vector<float> y((size_t)N*M);ggml_backend_tensor_get(Y,y.data(),0,y.size()*4);
            for(float v:y)if(!std::isfinite(v))return 4;
            const auto name=std::to_string(K)+"x"+std::to_string(N)+"x"+std::to_string(M)+".f32";
            const auto path=out/name;int fd=open(path.c_str(),O_WRONLY|O_CREAT|O_EXCL,0600);if(fd<0)return 2;
            const auto bytes=y.size()*4;size_t written=0;
            while(written<bytes){ssize_t n=write(fd,(char*)y.data()+written,bytes-written);if(n<=0)return 2;written+=(size_t)n;}
            if(close(fd))return 2;
            std::printf("{\"file\":\"%s\",\"K\":%d,\"N\":%d,\"M\":%d,\"mmvq\":%s,\"mean_us\":%.6f,\"finite\":true}\n",name.c_str(),K,N,M,vector_path?"true":"false",us);std::fflush(stdout);
            ggml_gallocr_free(al);ggml_free(c);
        }
    }
    ggml_backend_free(be);return 0;
}
