"""Separate one-time ternary-code decoding from measured matrix work on bounded synthetic fixtures."""
import ast
from xolotl_trial_common import BASE
p=BASE/'aster_ptq_mma_prototype_v6.cu'
if p.exists():raise RuntimeError('V6 source already frozen')
s=(BASE/'aster_ptq_mma_prototype_v5.cu').read_text()
def once(a,b):
 global s
 if s.count(a)!=1:raise RuntimeError('predecoded source anchor differs: '+a[:70])
 s=s.replace(a,b)
a='''                        const bool is_up=row>=l.n_ff;
                        const int rr=is_up?row-int(l.n_ff):row;
                        const ProtoPtq* w=(const ProtoPtq*)(blob+(is_up?l.up_off:0)+(size_t)rr*l.gu_row)+ib;
                        const int col=sub*32+phase*16+2*((j/2)*4+lane%4);
                        a[j]=row<total?proto_pack(proto_code(w,col),proto_code(w,col+1)):0;'''
b='''                        const int col=sub*32+phase*16+2*((j/2)*4+lane%4);
                        const __half* code=(const __half*)blob+(size_t)row*l.n_embd+ib*128+col;
                        a[j]=row<total?*(const unsigned*)code:0;'''
once(a,b)
a='''                const bool is_up=row>=l.n_ff;
                const int rr=is_up?row-int(l.n_ff):row;
                const ProtoPtq* w=(const ProtoPtq*)(blob+(is_up?l.up_off:0)+(size_t)rr*l.gu_row)+ib;
                value[c]+=__half2float(w->d)*scaled[c];'''
b='''                const __half* scale=(const __half*)blob+(size_t)(2*l.n_ff)*l.n_embd+(size_t)row*(l.n_embd/128)+ib;
                value[c]+=__half2float(*scale)*scaled[c];'''
once(a,b)
anchor='void proto_run(Grouped& g,cudaStream_t s) {'
helper='''// Diagnostic auxiliary storage: synthetic fixtures only, capped at1GiB.
// This does not imply the full model can be expanded to FP16 on a single H200.
__global__ void proto_predecode(const unsigned long long* packed,const unsigned long long* decoded,k::NativeExpertLayout l) {
    const size_t index=(size_t)blockIdx.x*blockDim.x+threadIdx.x;
    const size_t n=(size_t)2*l.n_ff*l.n_embd;
    if(index>=n)return;
    const int row=index/l.n_embd,col=index%l.n_embd,group=blockIdx.y;
    const bool is_up=row>=l.n_ff;const int rr=is_up?row-int(l.n_ff):row;
    const uint8_t* source=(const uint8_t*)packed[group];
    const ProtoPtq* block=(const ProtoPtq*)(source+(is_up?l.up_off:0)+(size_t)rr*l.gu_row)+col/128;
    __half* destination=(__half*)decoded[group];
    destination[index]=__float2half_rn(float(proto_code(block,col%128)));
    if(col%128==0) destination[n+(size_t)row*(l.n_embd/128)+col/128]=block->d;
}
struct ProtoHotGU {
    std::vector<uint8_t*> buffers;unsigned long long* pointers=nullptr;
    size_t bytes=0;float preparation_ms=0;
    ProtoHotGU(const Grouped& g,cudaStream_t s) {
        const size_t per=(size_t)2*g.L.n_ff*(g.L.n_embd+g.L.n_embd/128)*2;
        bytes=per*g.n_groups;
        if(bytes>1024ull*1024*1024) {std::fprintf(stderr,"diagnostic decode storage exceeds1GiB\\n");std::exit(2);}
        std::vector<unsigned long long> ptr;
        for(int group=0;group<g.n_groups;++group) {uint8_t* p=dalloc<uint8_t>(per);buffers.push_back(p);ptr.push_back((unsigned long long)p);}
        pointers=dalloc<unsigned long long>(g.n_groups);
        ck(cudaMemcpyAsync(pointers,ptr.data(),ptr.size()*8,cudaMemcpyHostToDevice,s),"auxiliary pointers");
        cudaEvent_t a,b;ck(cudaEventCreate(&a),"prepare event");ck(cudaEventCreate(&b),"prepare event");
        ck(cudaEventRecord(a,s),"prepare begin");
        const size_t n=(size_t)2*g.L.n_ff*g.L.n_embd;
        proto_predecode<<<dim3((unsigned)((n+255)/256),g.n_groups),256,0,s>>>(g.dptr,pointers,g.L);
        ck(cudaGetLastError(),"predecode launch");ck(cudaEventRecord(b,s),"prepare end");
        ck(cudaEventSynchronize(b),"prepare sync");ck(cudaEventElapsedTime(&preparation_ms,a,b),"prepare time");
        ck(cudaEventDestroy(a),"prepare event destroy");ck(cudaEventDestroy(b),"prepare event destroy");
    }
    ~ProtoHotGU(){for(auto p:buffers)cudaFree(p);cudaFree(pointers);}
};

void proto_run(Grouped& g,cudaStream_t s,const unsigned long long* auxiliary) {'''
once(anchor,helper)
if s.count('>>>(g.dptr,g.dstart,g.dn,g.dtok,(ProtoQ8*)g.dxq,g.L,gate,up);')!=2:raise RuntimeError('MMA input pointer sites differ')
s=s.replace('>>>(g.dptr,g.dstart,g.dn,g.dtok,(ProtoQ8*)g.dxq,g.L,gate,up);','>>>(auxiliary,g.dstart,g.dn,g.dtok,(ProtoQ8*)g.dxq,g.L,gate,up);')
once('    Grouped g(143,143,H,FF,counts,nt,rng);','    Grouped g(143,143,H,FF,counts,nt,rng);\n    ProtoHotGU hot(g,s);')
if s.count('proto_run(g,s)')!=2:raise RuntimeError('prototype runner sites differ')
s=s.replace('proto_run(g,s)','proto_run(g,s,hot.pointers)')
once('    if(!strict)++g_fail;','    // Auxiliary size/preparation are reported separately; excluded from steady-state event timing.\n    std::fprintf(stderr,"auxiliary bytes=%zu preparation_ms=%.6f H=%d FF=%d groups=%d\\n",hot.bytes,hot.preparation_ms,H,FF,g.n_groups);\n    if(!strict)++g_fail;')
s=s.replace('// This standalone program is not a model-serving kernel or a deployment claim.','// This standalone program is not a model-serving kernel or a deployment claim.\n// V6 measures predecoded synthetic GU codes; one-time decode cost and extra memory are separate.')
p.write_text(s)
for src,dest in [('stage_xolotl_ptq_mma_v5.frozen.py','stage_xolotl_ptq_mma_v6.frozen.py'),('observe_xolotl_ptq_mma_v5.frozen.py','observe_xolotl_ptq_mma_v6.frozen.py')]:
 s=(BASE/src).read_text()
 for a,b in [('xolotl-ptq-mma-v5-intent.json','xolotl-ptq-mma-v6-intent.json'),('xolotl-ptq-mma-v5-latest.json','xolotl-ptq-mma-v6-latest.json'),("'/xolotl-ptq-mma-v5'","'/xolotl-ptq-mma-v6'"),('aster_ptq_mma_prototype_v5.cu','aster_ptq_mma_prototype_v6.cu'),('xolotl_ptq_mma_v5_worker.frozen.py','xolotl_ptq_mma_v6_worker.frozen.py')]:
  if a in s:s=s.replace(a,b)
 s=s.replace('same phase1 functionality, candidate writes an extra temporary h row; synthetic only, no model tok/s conversion','steady-state phase1 over predecoded synthetic GU codes capped at1GiB; one-time preparation and extra bytes reported separately in gpu stderr; candidate also writes temporary h; no full-model memory or tok/s claim')
 ast.parse(s);(BASE/dest).write_text(s)
print('V6 prepared only: bounded predecoded synthetic codes, same strict6-case gate; no full-model memory/speed claim.')
