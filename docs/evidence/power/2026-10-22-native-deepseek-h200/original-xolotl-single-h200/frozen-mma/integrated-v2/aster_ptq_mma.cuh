// Derived from MIT Xolotl and the exact-code SM90 prototype; opt-in only.
namespace aster_ptq_mma {
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
// Values are exact signed integer codes; INT32 dot sums cannot overflow here.
__device__ __forceinline__ unsigned proto_packed4(const ProtoPtq* block,int col) {
    unsigned lo,hi;int depth;
    if(col<120) {
        unsigned raw;
        if(col<80){raw=*(const unsigned*)(block->qs+(col&15));depth=col>>4;}
        else {const int e=col-80;raw=*(const unsigned*)(block->qs+16+(e&7));depth=e>>3;}
        lo=raw&0x00ff00ffu;hi=(raw>>8)&0x00ff00ffu;
    }else{
        const unsigned q0=block->qh[0],q1=block->qh[1];
        lo=q0|(((q0*3u)&255u)<<16);hi=q1|(((q1*3u)&255u)<<16);
        depth=(col-120)>>1;
    }
    const unsigned power=depth<4?((0x1b090301u>>(8*depth))&255u):81u;
    lo=(lo*power)&0x00ff00ffu;hi=(hi*power)&0x00ff00ffu;
    const unsigned q=(((lo*3u)>>8)&0x00030003u)|((((hi*3u)>>8)&0x00030003u)<<8);
    return (q+0x7f7f7f7fu)^0x80808080u;
}
__device__ __forceinline__ void proto_mma(int* d,const unsigned* a,const unsigned* b) {
    asm volatile("mma.sync.aligned.m16n8k32.row.col.s32.s8.s8.s32 "
                 "{%0,%1,%2,%3}, {%4,%5,%6,%7}, {%8,%9}, {%0,%1,%2,%3};"
                 : "+r"(d[0]),"+r"(d[1]),"+r"(d[2]),"+r"(d[3])
                 : "r"(a[0]),"r"(a[1]),"r"(a[2]),"r"(a[3]),"r"(b[0]),"r"(b[1]) : "memory");
}
__device__ __forceinline__ void proto_block(const uint8_t* blob,int first,int entry,int count,
    int xb,const int32_t* tok,const ProtoQ8* x,NativeExpertLayout l,int lane,int ib,float (&value)[4]) {
    float scaled[4]={0,0,0,0};
#pragma unroll
    for(int sub=0;sub<4;++sub) {
        int dot[4]={0,0,0,0};unsigned a[4],b[2];
#pragma unroll
        for(int j=0;j<4;++j) {
            const int row=first+(j%2)*8+lane/4,col=sub*32+(j/2)*16+4*(lane%4);
            const bool is_up=row>=l.n_ff;const int rr=is_up?row-int(l.n_ff):row;
            const ProtoPtq* block=(const ProtoPtq*)(blob+(is_up?l.up_off:0)+(size_t)rr*l.gu_row)+ib;
            a[j]=proto_packed4(block,col);
        }
#pragma unroll
        for(int j=0;j<2;++j) {
            const int col=lane/4;
            if(col<count) {
                const ProtoQ8& q=x[(size_t)tok[entry+col]*xb+ib*4+sub];
                b[j]=((const unsigned*)q.qs)[j*4+lane%4];
            } else b[j]=0;
        }
        proto_mma(dot,a,b);
#pragma unroll
        for(int c=0;c<4;++c) {
            const int col=2*(lane%4)+(c%2);
            const float d=col<count?__low2float(x[(size_t)tok[entry+col]*xb+ib*4+sub].ds):0.0f;
            scaled[c]+=d*float(dot[c]);
        }
    }
#pragma unroll
    for(int c=0;c<4;++c) {
        const int row=first+(c/2)*8+lane/4;
        const bool is_up=row>=l.n_ff;const int rr=is_up?row-int(l.n_ff):row;
        const ProtoPtq* block=(const ProtoPtq*)(blob+(is_up?l.up_off:0)+(size_t)rr*l.gu_row)+ib;
        value[c]+=__half2float(block->d)*scaled[c];
    }
}
template<int NB>
__device__ __forceinline__ void proto_gu_body(const unsigned long long* ptr,const int32_t* starts,
    const int32_t* ng,const int32_t* tok,const ProtoQ8* x,NativeExpertLayout l,float* gate,float* up,float (*partial)[128]) {
    const int group=blockIdx.y;
    if(group>=*ng)return;
    if(starts[group+1]-starts[group]<4)return;
    const int lane=threadIdx.x&31,warp=threadIdx.x>>5,part=warp%4;
    const int first=blockIdx.x*32+(warp/4)*16;
    const int total=2*int(l.n_ff),xb=int(l.n_embd/32);
    const uint8_t* blob=(const uint8_t*)ptr[group];
    for(int entry=starts[group];entry<starts[group+1];entry+=8) {
        const int count=min(8,starts[group+1]-entry);
        float p0[4],p1[4],p2[4];
#pragma unroll 1
        for(int local=0;local<8;++local) {
            const int index=part*8+local,leaf=__brev(unsigned(index))>>27;
            float value[4]={0,0,0,0};
            if(leaf<NB)proto_block(blob,first,entry,count,xb,tok,x,l,lane,leaf,value);
            if(leaf+32<NB)proto_block(blob,first,entry,count,xb,tok,x,l,lane,leaf+32,value);
#pragma unroll
            for(int c=0;c<4;++c) {
                if(!(local&1)){p0[c]=value[c];continue;}value[c]=p0[c]+value[c];
                if(!(local&2)){p1[c]=value[c];continue;}value[c]=p1[c]+value[c];
                if(!(local&4)){p2[c]=value[c];continue;}value[c]=p2[c]+value[c];
                partial[warp][lane*4+c]=value[c];
            }
        }
        __syncthreads();
        if(part==0) {
#pragma unroll
            for(int c=0;c<4;++c) {
                const int q=lane*4+c;
                const float value=(partial[warp][q]+partial[warp+1][q])+(partial[warp+2][q]+partial[warp+3][q]);
                const int row=first+(c/2)*8+lane/4,col=2*(lane%4)+(c%2);
                if(row<total && col<count) {
                    const bool is_up=row>=l.n_ff;const int rr=is_up?row-int(l.n_ff):row;
                    (is_up?up:gate)[(size_t)(entry+col)*l.n_ff+rr]=value;
                }
            }
        }
        __syncthreads();
    }
}


__device__ unsigned long long group_histogram[10];
void report_group_histogram() {
    unsigned long long h[10]={};
    const cudaError_t e=cudaMemcpyFromSymbol(h,group_histogram,sizeof(h));
    if(e!=cudaSuccess){std::fprintf(stderr,"ASTER_MMA_GROUPS_ERROR %d\n",int(e));return;}
    std::fprintf(stderr,"ASTER_MMA_GROUPS {\"groups\":[%llu,%llu,%llu,%llu,%llu,%llu,%llu,%llu,%llu],\"entries\":%llu}\n",
        h[0],h[1],h[2],h[3],h[4],h[5],h[6],h[7],h[8],h[9]);
}
bool group_diagnostics() {
    static const bool enabled=[] {
        const char* v=std::getenv("ASTER_XQ_PTQ_MMA_DIAGNOSTICS");
        if(!v || std::strcmp(v,"0")==0)return false;
        if(std::strcmp(v,"1")!=0 || std::atexit(report_group_histogram)!=0){std::fprintf(stderr,"MMA diagnostics initialization refused\n");std::exit(1);}
        return true;
    }();
    return enabled;
}

}

template<bool RECORD>
__global__ __launch_bounds__(256) void aster_ptq_hybrid_gu(const unsigned long long* ptr,const int32_t* starts,
    const int32_t* ng,const int32_t* tok,const block_q8_1* x,NativeExpertLayout l,float* gate,float* up) {
    const int group=blockIdx.y;
    if(group>=*ng)return;
    const int count=starts[group+1]-starts[group];
    if(count<0){asm volatile("trap;");return;}
    if constexpr(RECORD) {
        if(blockIdx.x==0 && threadIdx.x==0) {
            atomicAdd(aster_ptq_mma::group_histogram+min(count,8),1ull);
            atomicAdd(aster_ptq_mma::group_histogram+9,(unsigned long long)count);
        }
    }
    __shared__ float partial[8][128];
    if(count<4)native_gu_amd_body<143,4>(ptr,starts,ng,tok,x,l,gate,up);
    else aster_ptq_mma::proto_gu_body<40>(ptr,starts,ng,tok,(const aster_ptq_mma::ProtoQ8*)x,l,gate,up,partial);
}
