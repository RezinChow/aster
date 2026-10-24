"""Use the same binary reduction online, retaining only five tree levels."""
import ast
from xolotl_trial_common import BASE
p=BASE/'aster_ptq_mma_prototype_v4.cu'
if p.exists():raise RuntimeError('V4 source already frozen')
s=(BASE/'aster_ptq_mma_prototype_v3.cu').read_text()
begin=s.index('template<int OFFSET,int INDEX=0>');end=s.index('__global__ void proto_swiglu',begin)
a=s.index('        for(int ib=0;ib<NB;++ib) {',begin);body_start=s.index('\n',a)+1
body_end=s.index('\n        }\n        proto_reduce<16>(partial);',body_start)
body=s[body_start:body_end].replace('partial[ib%32][c]','value[c]')
if 'partial' in body:raise RuntimeError('old partial escaped the block extractor')
replacement='''// Exact same leaf pairing and butterfly, evaluated in bit-reversed leaf order.
// Five pending levels replace the 32x4 partial array without reassociating sums.
template<int IB>
__device__ __forceinline__ void proto_block(const uint8_t* blob,int first,int entry,int count,
    int total,int xb,const int32_t* tok,const ProtoQ8* x,k::NativeExpertLayout l,int lane,float (&value)[4]) {
    constexpr int ib=IB;
@BODY@
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
@LEAVES@
    }
}

'''.replace('@BODY@',body).replace('@LEAVES@','\n'.join('        proto_leaf<'+str(i)+',NB>(blob,first,entry,count,total,xb,tok,x,l,lane,stack,gate,up);' for i in range(32)))
s=s[:begin]+replacement+s[end:];p.write_text(s)
for src,dest in [('stage_xolotl_ptq_mma_v3.frozen.py','stage_xolotl_ptq_mma_v4.frozen.py'),('observe_xolotl_ptq_mma_v3.frozen.py','observe_xolotl_ptq_mma_v4.frozen.py')]:
 s=(BASE/src).read_text()
 for a,b in [('xolotl-ptq-mma-v3-intent.json','xolotl-ptq-mma-v4-intent.json'),('xolotl-ptq-mma-v3-latest.json','xolotl-ptq-mma-v4-latest.json'),("'/xolotl-ptq-mma-v3'","'/xolotl-ptq-mma-v4'"),('aster_ptq_mma_prototype_v3.cu','aster_ptq_mma_prototype_v4.cu'),('xolotl_ptq_mma_v3_worker.frozen.py','xolotl_ptq_mma_v4_worker.frozen.py')]:
  if a in s:s=s.replace(a,b)
 ast.parse(s);(BASE/dest).write_text(s)
print('V4 uses an online identical reduction tree, with all original strict gates retained.')
