// Aster private regression: pending producer stream versus synchronous tensor IO.
#include "aster_dense_async_fence.hpp"
#include <cuda_runtime.h>
#include <cstdio>
#include <cstdlib>
static void ck(cudaError_t e) {
    if (e != cudaSuccess) { std::fprintf(stderr,"CUDA: %s\n",cudaGetErrorString(e)); std::exit(2); }
}
__global__ static void delayed_state(int *dst,unsigned long long cycles,int value) {
    const auto begin=clock64();
    while(clock64()-begin<cycles) { }
    *dst=value;
}
int main() {
    int n=0;ck(cudaGetDeviceCount(&n));if(n!=1)return 3;
    cudaDeviceProp p{};ck(cudaGetDeviceProperties(&p,0));if(p.major!=9 || p.minor!=0)return 4;
    cudaStream_t producer;ck(cudaStreamCreateWithFlags(&producer,cudaStreamNonBlocking));
    int *device=nullptr,*host=nullptr;ck(cudaMalloc(&device,sizeof(int)));ck(cudaMallocHost(&host,sizeof(int)));
    int stale=0,correct=0;
    for(int guarded=0;guarded<2;++guarded) for(int sample=0;sample<6;++sample) {
        *host=0;
        ck(cudaMemcpyAsync(device,host,sizeof(int),cudaMemcpyHostToDevice,cudaStreamPerThread));
        ck(cudaStreamSynchronize(cudaStreamPerThread));
        AsterDenseAsyncFence fence;
        delayed_state<<<1,1,0,producer>>>(device,(unsigned long long)p.clockRate*50,37);
        ck(cudaGetLastError());fence.submitted(true,true);
        if(guarded)fence.invalidate([&]{ck(cudaStreamSynchronize(producer));});
        // Exactly the stream used by ggml_backend_cuda_buffer_get_tensor.
        ck(cudaMemcpyAsync(host,device,sizeof(int),cudaMemcpyDeviceToHost,cudaStreamPerThread));
        ck(cudaStreamSynchronize(cudaStreamPerThread));
        const int actual=*host;
        fence.invalidate([&]{ck(cudaStreamSynchronize(producer));});
        if(!guarded && actual==0)++stale;
        else if(guarded && actual==37)++correct;
        else { std::fprintf(stderr,"unexpected sample guarded=%d actual=%d\n",guarded,actual);return 5; }
    }
    ck(cudaFreeHost(host));ck(cudaFree(device));ck(cudaStreamDestroy(producer));
    if(stale!=6 || correct!=6)return 6;
    std::printf("PASS: unfenced stale readbacks=%d; guarded exact readbacks=%d; SM%d%d\n",stale,correct,p.major,p.minor);
}
