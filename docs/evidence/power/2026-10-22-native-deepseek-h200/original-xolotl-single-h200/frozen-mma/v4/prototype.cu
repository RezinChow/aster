// Aster SM90 research prototype. MIT-licensed Xolotl fixture and llama.cpp
// m16n8k16 register-layout conventions are reused with their original notices.
// Integer ternary/q8 codes are represented exactly in FP16. Scales remain FP32.
// This standalone program is not a model-serving kernel or a deployment claim.
#define main xolotl_fixture_original_main
#include "/mnt/shared-storage-user/yangchao/Workspace/aster-h200-xq/aster-xolotl-300-0b1716ac50e0/xolotl-split-rows-h200/source/src/kernels/iq_multi_parity.cpp"
#undef main
#include <cuda_fp16.h>

namespace {
struct ProtoPtq { uint8_t qs[24], qh[2]; __half d; };
struct ProtoQ8 { __half2 ds; int8_t qs[32]; };
static_assert(sizeof(ProtoPtq)==28 && sizeof(ProtoQ8)==36);

__device__ __forceinline__ int proto_code(const ProtoPtq* b, int e) {
    uint32_t v; int t;
    if (e < 80) { v=b->qs[e & 15]; t=e >> 4; }
    else if (e < 120) { e-=80; v=b->qs[16+(e & 7)]; t=e >> 3; }
    else { e-=120; v=b->qh[e & 1]; t=e >> 1; }
#pragma unroll 4
    for (int j=0;j<t;++j) v=(v*3u)&255u;
    return int((v*3u)>>8)-1;
}
__device__ __forceinline__ unsigned proto_pack(int a,int b) {
    const __half2 x=__floats2half2_rn(float(a),float(b));
    return reinterpret_cast<const unsigned&>(x);
}
__device__ __forceinline__ void proto_mma(float* d,const unsigned* a,const unsigned* b) {
#if __CUDA_ARCH__ >= 800
    asm volatile("mma.sync.aligned.m16n8k16.row.col.f32.f16.f16.f32 "
                 "{%0,%1,%2,%3}, {%4,%5,%6,%7}, {%8,%9}, {%0,%1,%2,%3};"
                 : "+f"(d[0]),"+f"(d[1]),"+f"(d[2]),"+f"(d[3])
                 : "r"(a[0]),"r"(a[1]),"r"(a[2]),"r"(a[3]),"r"(b[0]),"r"(b[1]));
#else
    asm volatile("trap;");
#endif
}

// Exact same leaf pairing and butterfly, evaluated in bit-reversed leaf order.
// Five pending levels replace the 32x4 partial array without reassociating sums.
template<int IB>
__device__ __forceinline__ void proto_block(const uint8_t* blob,int first,int entry,int count,
    int total,int xb,const int32_t* tok,const ProtoQ8* x,k::NativeExpertLayout l,int lane,float (&value)[4]) {
    constexpr int ib=IB;
            float scaled[4]={0,0,0,0};
#pragma unroll
            for(int sub=0;sub<4;++sub) {
                float dot[4]={0,0,0,0};
#pragma unroll
                for(int phase=0;phase<2;++phase) {
                    unsigned a[4],b[2];
#pragma unroll
                    for(int j=0;j<4;++j) {
                        const int row=first+(j%2)*8+lane/4;
                        const bool is_up=row>=l.n_ff;
                        const int rr=is_up?row-int(l.n_ff):row;
                        const ProtoPtq* w=(const ProtoPtq*)(blob+(is_up?l.up_off:0)+(size_t)rr*l.gu_row)+ib;
                        const int col=sub*32+phase*16+2*((j/2)*4+lane%4);
                        a[j]=row<total?proto_pack(proto_code(w,col),proto_code(w,col+1)):0;
                    }
#pragma unroll
                    for(int j=0;j<2;++j) {
                        const int c=lane/4;
                        if(c<count) {
                            const ProtoQ8& q=x[(size_t)tok[entry+c]*xb+ib*4+sub];
                            const int col=phase*16+2*(j*4+lane%4);
                            b[j]=proto_pack(q.qs[col],q.qs[col+1]);
                        } else b[j]=0;
                    }
                    proto_mma(dot,a,b);
                }
#pragma unroll
                for(int c=0;c<4;++c) {
                    const int col=2*(lane%4)+(c%2);
                    const float d=col<count?__low2float(x[(size_t)tok[entry+col]*xb+ib*4+sub].ds):0.0f;
                    scaled[c]+=d*dot[c];
                }
            }
#pragma unroll
            for(int c=0;c<4;++c) {
                const int row=first+(c/2)*8+lane/4;
                const bool is_up=row>=l.n_ff;
                const int rr=is_up?row-int(l.n_ff):row;
                const ProtoPtq* w=(const ProtoPtq*)(blob+(is_up?l.up_off:0)+(size_t)rr*l.gu_row)+ib;
                value[c]+=__half2float(w->d)*scaled[c];
            }
}
template<int INDEX,int LEVEL=0>
__device__ __forceinline__ void proto_push(float (&value)[4],float (&stack)[5][4]) {
    if constexpr((INDEX & (1<<LEVEL))!=0) {
#pragma unroll
        for(int c=0;c<4;++c) value[c]=stack[LEVEL][c]+value[c];
        proto_push<INDEX,LEVEL+1>(value,stack);
    } else if constexpr(LEVEL<5) {
#pragma unroll
        for(int c=0;c<4;++c) stack[LEVEL][c]=value[c];
    }
}
template<int INDEX,int NB>
__device__ __forceinline__ void proto_leaf(const uint8_t* blob,int first,int entry,int count,
    int total,int xb,const int32_t* tok,const ProtoQ8* x,k::NativeExpertLayout l,int lane,
    float (&stack)[5][4],float* gate,float* up) {
    constexpr int leaf=((INDEX&1)<<4)|((INDEX&2)<<2)|(INDEX&4)|((INDEX&8)>>2)|((INDEX&16)>>4);
    float value[4]={0,0,0,0};
    if constexpr(leaf<NB) proto_block<leaf>(blob,first,entry,count,total,xb,tok,x,l,lane,value);
    if constexpr(leaf+32<NB) proto_block<leaf+32>(blob,first,entry,count,total,xb,tok,x,l,lane,value);
    proto_push<INDEX>(value,stack);
    if constexpr(INDEX==31) {
#pragma unroll
        for(int c=0;c<4;++c) {
            const int row=first+(c/2)*8+lane/4,col=2*(lane%4)+(c%2);
            if(row<total && col<count) {
                const bool is_up=row>=l.n_ff;const int rr=is_up?row-int(l.n_ff):row;
                (is_up?up:gate)[(size_t)(entry+col)*l.n_ff+rr]=value[c];
            }
        }
    }
}
template<int NB>
__global__ __launch_bounds__(256) void proto_gu(const unsigned long long* ptr,const int32_t* starts,
    const int32_t* ng,const int32_t* tok,const ProtoQ8* x,k::NativeExpertLayout l,float* gate,float* up) {
    const int group=blockIdx.y;
    if(group>=*ng)return;
    const int lane=threadIdx.x&31,warp=threadIdx.x>>5,first=blockIdx.x*128+warp*16;
    const int total=2*int(l.n_ff),xb=int(l.n_embd/32);
    if(first>=total)return;
    const uint8_t* blob=(const uint8_t*)ptr[group];
    for(int entry=starts[group];entry<starts[group+1];entry+=8) {
        const int count=min(8,starts[group+1]-entry);
        float stack[5][4];
        proto_leaf<0,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<1,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<2,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<3,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<4,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<5,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<6,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<7,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<8,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<9,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<10,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<11,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<12,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<13,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<14,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<15,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<16,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<17,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<18,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<19,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<20,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<21,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<22,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<23,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<24,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<25,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<26,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<27,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<28,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<29,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<30,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
        proto_leaf<31,NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);
    }
}

__global__ void proto_swiglu(const float* gate,const float* up,float* h,size_t n,float lim) {
    const size_t i=(size_t)blockIdx.x*blockDim.x+threadIdx.x;
    if(i>=n)return;
    const float g=fminf(gate[i],lim);
    h[i]=(g/(1.0f+__expf(-g)))*fminf(fmaxf(up[i],-lim),lim);
}
void proto_run(Grouped& g,cudaStream_t s) {
    const size_t n=(size_t)g.cap_ent*g.L.n_ff,fa=(n*4+255)&~size_t(255);
    float* gate=(float*)g.dscr;float* up=(float*)(g.dscr+fa);float* h=(float*)(g.dscr+2*fa);
    k::quantize_q8_1_rows(g.dx,g.n_tok,g.L.n_embd,g.dxq,s);
    const dim3 grid((unsigned)((2*g.L.n_ff+127)/128),(unsigned)g.cap_groups);
    if(g.L.n_embd==5120) proto_gu<40><<<grid,256,0,s>>>(g.dptr,g.dstart,g.dn,g.dtok,(ProtoQ8*)g.dxq,g.L,gate,up);
    else if(g.L.n_embd==1024) proto_gu<8><<<grid,256,0,s>>>(g.dptr,g.dstart,g.dn,g.dtok,(ProtoQ8*)g.dxq,g.L,gate,up);
    else {std::fprintf(stderr,"prototype refuses shape\n");std::exit(2);}
    ck(cudaGetLastError(),"prototype GU launch");
    const size_t live=(size_t)g.n_ent*g.L.n_ff;
    proto_swiglu<<<(unsigned)((live+255)/256),256,0,s>>>(gate,up,h,live,g.L.swiglu_limit);
    k::quantize_q8_1_rows(h,g.n_ent,g.L.n_ff,g.dscr+3*fa,s);
}

void prototype_case(int H,int FF,const std::vector<int>& counts,int nt,cudaStream_t s,std::mt19937& rng) {
    Grouped g(143,143,H,FF,counts,nt,rng);
    const size_t n=(size_t)g.cap_ent*FF,fa=(n*4+255)&~size_t(255),live=(size_t)g.n_ent*FF;
    std::vector<float> old(2*n),candidate(2*n);
    const size_t qbytes=(size_t)g.n_ent*(FF/32)*36;
    std::vector<uint8_t> qo(qbytes),qn(qbytes);
    k::native_expert_set_mode(4,1);
    ck(cudaMemset(g.dscr,0xff,k::native_expert_scratch_bytes(g.cap_ent,FF)),"reference sentinel");
    g.run(true,s);ck(cudaStreamSynchronize(s),"reference sync");
    ck(cudaMemcpy(old.data(),g.dscr,n*4,cudaMemcpyDeviceToHost),"reference gate");
    ck(cudaMemcpy(old.data()+n,g.dscr+fa,n*4,cudaMemcpyDeviceToHost),"reference up");
    ck(cudaMemcpy(qo.data(),g.dscr+3*fa,qbytes,cudaMemcpyDeviceToHost),"reference q8");
    ck(cudaMemset(g.dscr,0xff,k::native_expert_scratch_bytes(g.cap_ent,FF)),"candidate sentinel");
    proto_run(g,s);ck(cudaStreamSynchronize(s),"candidate sync");
    ck(cudaMemcpy(candidate.data(),g.dscr,n*4,cudaMemcpyDeviceToHost),"candidate gate");
    ck(cudaMemcpy(candidate.data()+n,g.dscr+fa,n*4,cudaMemcpyDeviceToHost),"candidate up");
    ck(cudaMemcpy(qn.data(),g.dscr+3*fa,qbytes,cudaMemcpyDeviceToHost),"candidate q8");
    bool finite=true,sentinels=true;size_t differences=0;double num=0,den=0,md=0,mr=0;
    for(int matrix=0;matrix<2;++matrix)for(size_t i=0;i<n;++i) {
        const size_t j=(size_t)matrix*n+i;
        if(i<live) {
            finite=finite&&std::isfinite(candidate[j])&&std::isfinite(old[j]);
            differences+=std::memcmp(&old[j],&candidate[j],4)!=0;
            const double d=double(candidate[j])-old[j];num+=d*d;den+=double(old[j])*old[j];
            md=std::max(md,std::abs(d));mr=std::max(mr,std::abs(double(old[j])));
        } else sentinels=sentinels&&std::memcmp(&old[j],&candidate[j],4)==0&&std::isnan(candidate[j]);
    }
    const double rel=std::sqrt(num/(den+1e-300)),mx=md/(mr+1e-300);
    const bool qmatch=qo==qn,strict=finite&&sentinels&&differences==0&&qmatch;
    const float old_us=1000*time_ms(s,20,[&]{g.run(true,s);});
    const float new_us=1000*time_ms(s,20,[&]{proto_run(g,s);});
    std::printf("{\"H\":%d,\"FF\":%d,\"groups\":%d,\"tokens\":%d,\"entries\":%d,\"finite\":%s,\"sentinels\":%s,\"different_gu_floats\":%zu,\"q8_equal\":%s,\"relative_l2\":%.12g,\"normalized_max\":%.12g,\"strict_passed\":%s,\"mode4_phase1_us\":%.9g,\"mma_phase1_us\":%.9g}\n",
                H,FF,g.n_groups,nt,g.n_ent,finite?"true":"false",sentinels?"true":"false",differences,qmatch?"true":"false",rel,mx,strict?"true":"false",old_us,new_us);
    if(!strict)++g_fail;
}
}

int main() {
    int devices=0;ck(cudaGetDeviceCount(&devices),"device count");
    cudaDeviceProp p;ck(cudaGetDeviceProperties(&p,0),"properties");
    if(devices!=1 || std::string(p.name)!="NVIDIA H200" || p.major!=9 || p.minor!=0)return 2;
    std::printf("{\"device\":\"NVIDIA H200\",\"sm\":90,\"devices\":1,\"strict_gate\":\"bitwise GU, identical q8, finite, untouched sentinels\"}\n");
    cudaStream_t s;ck(cudaStreamCreate(&s),"stream");std::mt19937 rng(31);
    const std::pair<int,int> shapes[]={{5120,2304},{1024,512}};
    for(const auto& shape:shapes)
        prototype_case(shape.first,shape.second,{1,3,4,5,0,8,2,11,1},8,s,rng);
    for(int nt:{1,3,5,8})prototype_case(5120,2304,std::vector<int>(7,nt),nt,s,rng);
    ck(cudaStreamDestroy(s),"destroy");
    std::printf("{\"complete\":true,\"failures\":%d}\n",g_fail);
    return g_fail?1:0;
}
