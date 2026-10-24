"""Keep V12 math unchanged and add paired L2-evicted phase1 measurements."""
import ast
from xolotl_trial_common import BASE
p=BASE/'aster_ptq_mma_prototype_v13.cu'
if p.exists():raise RuntimeError('V13 source already frozen')
s=(BASE/'aster_ptq_mma_prototype_v12.cu').read_text()
anchor='void prototype_case(int H,int FF,const std::vector<int>& counts,int nt,cudaStream_t s,std::mt19937& rng) {'
helper=r'''__global__ void proto_evict(const volatile unsigned* data,size_t n,unsigned* observed) {
    unsigned sum=0;
    for(size_t i=(size_t)blockIdx.x*blockDim.x+threadIdx.x;i<n;i+=(size_t)blockDim.x*gridDim.x)sum^=data[i];
    atomicXor(observed,sum);
}
struct ProtoCold {
    unsigned* buffer=nullptr;unsigned* observed=nullptr;size_t bytes=0;
    cudaEvent_t a,b;
    ProtoCold(cudaStream_t s) {
        cudaDeviceProp p;ck(cudaGetDeviceProperties(&p,0),"cold device properties");
        bytes=(size_t(p.l2CacheSize)*2+65535)&~size_t(65535);
        if(bytes<16*1024*1024 || bytes>256*1024*1024){std::fprintf(stderr,"L2 eviction bound refused\n");std::exit(2);}
        buffer=dalloc<unsigned>(bytes/4);observed=dalloc<unsigned>(1);
        ck(cudaMemsetAsync(buffer,0x5a,bytes,s),"eviction initialization");
        ck(cudaMemsetAsync(observed,0,4,s),"observable initialization");
        ck(cudaEventCreate(&a),"cold event");ck(cudaEventCreate(&b),"cold event");
    }
    template<typename F>float run(cudaStream_t s,F fn) {
        proto_evict<<<384,256,0,s>>>(buffer,bytes/4,observed);ck(cudaGetLastError(),"eviction launch");
        ck(cudaEventRecord(a,s),"cold begin");fn();ck(cudaEventRecord(b,s),"cold end");
        ck(cudaEventSynchronize(b),"cold synchronize");float ms=0;ck(cudaEventElapsedTime(&ms,a,b),"cold elapsed");return 1000*ms;
    }
    ~ProtoCold(){cudaEventDestroy(a);cudaEventDestroy(b);cudaFree(buffer);cudaFree(observed);}
};
std::string proto_json_times(const std::vector<float>& values) {
    std::string s="[";for(size_t i=0;i<values.size();++i){if(i)s+=",";s+=std::to_string(values[i]);}return s+"]";
}

'''
if s.count(anchor)!=1:raise RuntimeError('prototype fixture anchor differs')
s=s.replace(anchor,helper+anchor)
anchor='    const float new_us=1000*time_ms(s,20,[&]{proto_run(g,s,hot.pointers);});'
replacement=anchor+r'''
    ProtoCold cold(s);std::vector<float> cold_ref(10),cold_mma(10);
    for(int i=0;i<10;++i) {
        auto ref=[&]{cold_ref[i]=cold.run(s,[&]{g.run(true,s);});};
        auto mma=[&]{cold_mma[i]=cold.run(s,[&]{proto_run(g,s,hot.pointers);});};
        if(i&1){mma();ref();}else{ref();mma();}
    }
    const std::string cold_ref_json=proto_json_times(cold_ref),cold_mma_json=proto_json_times(cold_mma);'''
if s.count(anchor)!=1:raise RuntimeError('timing anchor differs')
s=s.replace(anchor,replacement)
anchor=r'\"mma_phase1_us\":%.9g}\n'
replacement=r'\"mma_phase1_us\":%.9g,\"l2_eviction_bytes\":%zu,\"cold_reference_us\":%s,\"cold_mma_us\":%s}\n'
if s.count(anchor)!=1:raise RuntimeError('timing output schema differs')
s=s.replace(anchor,replacement)
anchor='rel,mx,strict?"true":"false",old_us,new_us);'
if s.count(anchor)!=1:raise RuntimeError('printf argument anchor differs')
s=s.replace(anchor,'rel,mx,strict?"true":"false",old_us,new_us,cold.bytes,cold_ref_json.c_str(),cold_mma_json.c_str());')
p.write_text(s)
for src,dest in [('stage_xolotl_ptq_mma_v12.frozen.py','stage_xolotl_ptq_mma_v13.frozen.py'),('observe_xolotl_ptq_mma_v12.frozen.py','observe_xolotl_ptq_mma_v13.frozen.py')]:
 s=(BASE/src).read_text()
 for a,b in [('xolotl-ptq-mma-v12-intent.json','xolotl-ptq-mma-v13-intent.json'),('xolotl-ptq-mma-v12-latest.json','xolotl-ptq-mma-v13-latest.json'),("'/xolotl-ptq-mma-v12'","'/xolotl-ptq-mma-v13'"),('aster_ptq_mma_prototype_v12.cu','aster_ptq_mma_prototype_v13.cu'),('xolotl_ptq_mma_v12_worker.frozen.py','xolotl_ptq_mma_v13_worker.frozen.py')]:
  if a in s:s=s.replace(a,b)
 s=s.replace('steady-state phase1 over lossless signed two-bit synthetic GU codes','warm phase1 plus ten alternating paired L2-evicted phase1 samples over lossless signed two-bit synthetic GU codes')
 ast.parse(s);(BASE/dest).write_text(s)
print('V13 prepared: V12 arithmetic unchanged, 2x actual L2 volatile-read eviction excluded from event timing, ten alternating pairs retained per case.')
