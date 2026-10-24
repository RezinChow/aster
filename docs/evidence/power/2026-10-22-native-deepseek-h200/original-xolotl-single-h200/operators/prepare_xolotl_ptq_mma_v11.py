"""Four cooperating K partitions preserve the exact 32-leaf binary tree."""
import ast
from xolotl_trial_common import BASE
p=BASE/'aster_ptq_mma_prototype_v11.cu'
if p.exists():raise RuntimeError('V11 source already frozen')
s=(BASE/'aster_ptq_mma_prototype_v10.cu').read_text()
start=s.index('template<int NB>\n__global__');end=s.index('__global__ void proto_swiglu(',start)
s=s[:start]+r'''template<int NB>
__global__ __launch_bounds__(256) void proto_gu(const unsigned long long* ptr,const int32_t* starts,
    const int32_t* ng,const int32_t* tok,const ProtoQ8* x,k::NativeExpertLayout l,float* gate,float* up) {
    const int group=blockIdx.y;
    if(group>=*ng)return;
    __shared__ float partial[8][128];
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

'''+s[end:]
a='const dim3 grid((unsigned)((2*g.L.n_ff+127)/128),(unsigned)g.cap_groups);'
b='const dim3 grid((unsigned)((2*g.L.n_ff+31)/32),(unsigned)g.cap_groups);'
if s.count(a)!=1:raise RuntimeError('GU grid anchor differs')
s=s.replace(a,b).replace('// V10 uses INT8 MMA and bounded loops to avoid compiler live-range explosion.','// V11 distributes the identical reduction tree across four cooperating warps.')
p.write_text(s)
for src,dest in [('stage_xolotl_ptq_mma_v10.frozen.py','stage_xolotl_ptq_mma_v11.frozen.py'),('observe_xolotl_ptq_mma_v10.frozen.py','observe_xolotl_ptq_mma_v11.frozen.py')]:
 s=(BASE/src).read_text()
 for a,b in [('xolotl-ptq-mma-v10-intent.json','xolotl-ptq-mma-v11-intent.json'),('xolotl-ptq-mma-v10-latest.json','xolotl-ptq-mma-v11-latest.json'),("'/xolotl-ptq-mma-v10'","'/xolotl-ptq-mma-v11'"),('aster_ptq_mma_prototype_v10.cu','aster_ptq_mma_prototype_v11.cu'),('xolotl_ptq_mma_v10_worker.frozen.py','xolotl_ptq_mma_v11_worker.frozen.py')]:
  if a in s:s=s.replace(a,b)
 ast.parse(s);(BASE/dest).write_text(s)
print('V11: K4 parallel exact tree, 4096 shared bytes, unchanged numerical and timing controls.')
