"""Reorder synthetic expanded codes into the exact MMA register-fragment layout."""
import ast
from xolotl_trial_common import BASE
p=BASE/'aster_ptq_mma_prototype_v7.cu'
if p.exists():raise RuntimeError('V7 source already frozen')
s=(BASE/'aster_ptq_mma_prototype_v6.cu').read_text()
a='''                        const int row=first+(j%2)*8+lane/4;
                        const int col=sub*32+phase*16+2*((j/2)*4+lane%4);
                        const __half* code=(const __half*)blob+(size_t)row*l.n_embd+ib*128+col;
                        a[j]=row<total?*(const unsigned*)code:0;'''
b='''                        const size_t index=((size_t)(first/16)*(l.n_embd/128)+ib)*1024+((sub*2+phase)*4+j)*32+lane;
                        a[j]=((const unsigned*)blob)[index];'''
if s.count(a)!=1:raise RuntimeError('expanded row-major input anchor differs')
s=s.replace(a,b)
start=s.index('__global__ void proto_predecode(');end=s.index('struct ProtoHotGU',start)
replacement='''__global__ void proto_predecode(const unsigned long long* packed,const unsigned long long* decoded,k::NativeExpertLayout l) {
    const size_t index=(size_t)blockIdx.x*blockDim.x+threadIdx.x;
    const size_t n=(size_t)2*l.n_ff*l.n_embd;
    if(index>=n/2)return;
    const int nb=l.n_embd/128,group=blockIdx.y;
    const int lane=index%32,reg=(index/32)%4,phase=(index/128)%2,sub=(index/256)%4;
    const int ib=(index/1024)%nb,tile=index/(1024*nb);
    const int row=tile*16+(reg%2)*8+lane/4,col=ib*128+sub*32+phase*16+2*((reg/2)*4+lane%4);
    const bool is_up=row>=l.n_ff;const int rr=is_up?row-int(l.n_ff):row;
    const uint8_t* source=(const uint8_t*)packed[group];
    const ProtoPtq* block=(const ProtoPtq*)(source+(is_up?l.up_off:0)+(size_t)rr*l.gu_row)+ib;
    ((unsigned*)decoded[group])[index]=proto_pack(proto_code(block,col%128),proto_code(block,(col+1)%128));
    if(sub==0 && phase==0 && reg<2 && lane%4==0)
        ((__half*)decoded[group])[n+(size_t)row*nb+ib]=block->d;
}
'''
s=s[:start]+replacement+s[end:]
a='proto_predecode<<<dim3((unsigned)((n+255)/256),g.n_groups),256,0,s>>>'
b='proto_predecode<<<dim3((unsigned)((n/2+255)/256),g.n_groups),256,0,s>>>'
if s.count(a)!=1:raise RuntimeError('preparation launch extent differs')
s=s.replace(a,b);p.write_text(s)
for src,dest in [('stage_xolotl_ptq_mma_v6.frozen.py','stage_xolotl_ptq_mma_v7.frozen.py'),('observe_xolotl_ptq_mma_v6.frozen.py','observe_xolotl_ptq_mma_v7.frozen.py')]:
 s=(BASE/src).read_text()
 for a,b in [('xolotl-ptq-mma-v6-intent.json','xolotl-ptq-mma-v7-intent.json'),('xolotl-ptq-mma-v6-latest.json','xolotl-ptq-mma-v7-latest.json'),("'/xolotl-ptq-mma-v6'","'/xolotl-ptq-mma-v7'"),('aster_ptq_mma_prototype_v6.cu','aster_ptq_mma_prototype_v7.cu'),('xolotl_ptq_mma_v6_worker.frozen.py','xolotl_ptq_mma_v7_worker.frozen.py')]:
  if a in s:s=s.replace(a,b)
 ast.parse(s);(BASE/dest).write_text(s)
print('V7 changes only expanded-code memory order; same sizes, strict gates, and timing cases.')
