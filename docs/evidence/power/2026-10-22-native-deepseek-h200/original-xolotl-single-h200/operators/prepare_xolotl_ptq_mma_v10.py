"""Exact INT8 MMA with a bounded dynamic reduction loop, isolated from the engine."""
import ast
from xolotl_trial_common import BASE
p=BASE/'aster_ptq_mma_prototype_v10.cu'
if p.exists():raise RuntimeError('V10 source already frozen')
s=(BASE/'aster_ptq_mma_prototype_v9.cu').read_text()
start=s.index('__device__ __forceinline__ void proto_mma(')
end=s.index('__global__ void proto_swiglu(',start)
s=s[:start]+r'''// Values are exact signed integer codes; INT32 dot sums cannot overflow here.
__device__ __forceinline__ unsigned proto_pair(unsigned v) {
    return ((v%3-1)&255u)|(((v/3-1)&255u)<<8);
}
__device__ __forceinline__ void proto_mma(int* d,const unsigned* a,const unsigned* b) {
    asm volatile("mma.sync.aligned.m16n8k32.row.col.s32.s8.s8.s32 "
                 "{%0,%1,%2,%3}, {%4,%5,%6,%7}, {%8,%9}, {%0,%1,%2,%3};"
                 : "+r"(d[0]),"+r"(d[1]),"+r"(d[2]),"+r"(d[3])
                 : "r"(a[0]),"r"(a[1]),"r"(a[2]),"r"(a[3]),"r"(b[0]),"r"(b[1]) : "memory");
}
__device__ __forceinline__ void proto_block(const uint8_t* blob,int first,int entry,int count,
    int xb,const int32_t* tok,const ProtoQ8* x,k::NativeExpertLayout l,int lane,int ib,float (&value)[4]) {
    float scaled[4]={0,0,0,0};
#pragma unroll 1
    for(int sub=0;sub<4;++sub) {
        int dot[4]={0,0,0,0};unsigned a[4],b[2];
#pragma unroll
        for(int j=0;j<4;++j) {
            const size_t index=((size_t)(first/16)*(l.n_embd/128)+ib)*512+(sub*4+j)*32+lane;
            const unsigned packed=blob[index];
            a[j]=proto_pair(packed&15)|(proto_pair(packed>>4)<<16);
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
        const __half* scale=(const __half*)(blob+(size_t)(2*l.n_ff)*l.n_embd/4)+(size_t)row*(l.n_embd/128)+ib;
        value[c]+=__half2float(*scale)*scaled[c];
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
        float p0[4],p1[4],p2[4],p3[4],p4[4];
#pragma unroll 1
        for(int index=0;index<32;++index) {
            const int leaf=__brev(unsigned(index))>>27;
            float value[4]={0,0,0,0};
            if(leaf<NB)proto_block(blob,first,entry,count,xb,tok,x,l,lane,leaf,value);
            if(leaf+32<NB)proto_block(blob,first,entry,count,xb,tok,x,l,lane,leaf+32,value);
            // Identical old butterfly: low levels combine before high levels.
#pragma unroll
            for(int c=0;c<4;++c) {
                if(!(index&1)){p0[c]=value[c];continue;}value[c]=p0[c]+value[c];
                if(!(index&2)){p1[c]=value[c];continue;}value[c]=p1[c]+value[c];
                if(!(index&4)){p2[c]=value[c];continue;}value[c]=p2[c]+value[c];
                if(!(index&8)){p3[c]=value[c];continue;}value[c]=p3[c]+value[c];
                if(!(index&16)){p4[c]=value[c];continue;}value[c]=p4[c]+value[c];
                const int row=first+(c/2)*8+lane/4,col=2*(lane%4)+(c%2);
                if(row<total && col<count) {
                    const bool is_up=row>=l.n_ff;const int rr=is_up?row-int(l.n_ff):row;
                    (is_up?up:gate)[(size_t)(entry+col)*l.n_ff+rr]=value[c];
                }
            }
        }
    }
}

'''+s[end:]
start=s.index('__global__ void proto_predecode(');end=s.index('struct ProtoHotGU',start)
s=s[:start]+r'''__global__ void proto_predecode(const unsigned long long* packed,const unsigned long long* decoded,k::NativeExpertLayout l) {
    const size_t byte=(size_t)blockIdx.x*blockDim.x+threadIdx.x;
    const size_t n=(size_t)2*l.n_ff*l.n_embd;
    if(byte>=n/4)return;
    const int nb=l.n_embd/128,group=blockIdx.y;
    const int lane=byte%32,reg=(byte/32)%4,sub=(byte/128)%4;
    const int ib=(byte/512)%nb,tile=byte/(512*nb);
    const int row=tile*16+(reg%2)*8+lane/4,col=ib*128+sub*32+(reg/2)*16+4*(lane%4);
    const bool is_up=row>=l.n_ff;const int rr=is_up?row-int(l.n_ff):row;
    const uint8_t* source=(const uint8_t*)packed[group];
    const ProtoPtq* block=(const ProtoPtq*)(source+(is_up?l.up_off:0)+(size_t)rr*l.gu_row)+ib;
    unsigned encoded=0;
#pragma unroll
    for(int pair=0;pair<2;++pair) {
        const unsigned first=proto_code(block,(col+pair*2)%128)+1,second=proto_code(block,(col+pair*2+1)%128)+1;
        encoded|=(first+3*second)<<(4*pair);
    }
    if(sub==0 && reg<2 && lane%4==0)
        ((__half*)((uint8_t*)decoded[group]+n/4))[(size_t)row*nb+ib]=block->d;
    ((uint8_t*)decoded[group])[byte]=(uint8_t)encoded;
}
'''+s[end:]
s=s.replace('// Integer ternary/q8 codes are represented exactly in FP16. Scales remain FP32.','// Exact signed INT8 codes feed INT32 MMA. Original FP32 scales are retained.')
s=s.replace('// V8 stores two ternary codes in a four-bit nibble and expands through an exact warp-register half2 table.','// V10 uses INT8 MMA and bounded loops to avoid compiler live-range explosion.')
p.write_text(s)
for src,dest in [('stage_xolotl_ptq_mma_v9.frozen.py','stage_xolotl_ptq_mma_v10.frozen.py'),('observe_xolotl_ptq_mma_v9.frozen.py','observe_xolotl_ptq_mma_v10.frozen.py')]:
 s=(BASE/src).read_text()
 for a,b in [('xolotl-ptq-mma-v9-intent.json','xolotl-ptq-mma-v10-intent.json'),('xolotl-ptq-mma-v9-latest.json','xolotl-ptq-mma-v10-latest.json'),("'/xolotl-ptq-mma-v9'","'/xolotl-ptq-mma-v10'"),('aster_ptq_mma_prototype_v9.cu','aster_ptq_mma_prototype_v10.cu'),('xolotl_ptq_mma_v9_worker.frozen.py','xolotl_ptq_mma_v10_worker.frozen.py')]:
  if a in s:s=s.replace(a,b)
 ast.parse(s);(BASE/dest).write_text(s)
print('V10 prepared: exact INT8/INT32 MMA, dynamic reduction, unchanged six strict GPU controls.')
