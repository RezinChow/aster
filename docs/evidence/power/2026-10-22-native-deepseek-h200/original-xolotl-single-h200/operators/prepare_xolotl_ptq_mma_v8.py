"""Losslessly encode each ternary pair as one nibble in MMA fragment order."""
import ast
from xolotl_trial_common import BASE
p=BASE/'aster_ptq_mma_prototype_v8.cu'
if p.exists():raise RuntimeError('V8 source already frozen')
s=(BASE/'aster_ptq_mma_prototype_v7.cu').read_text()
def once(a,b):
 global s
 if s.count(a)!=1:raise RuntimeError('nibble source anchor differs: '+a[:80])
 s=s.replace(a,b)
once('int total,int xb,const int32_t* tok,const ProtoQ8* x,k::NativeExpertLayout l,int lane,float (&value)[4]) {','int total,int xb,const int32_t* tok,const ProtoQ8* x,k::NativeExpertLayout l,int lane,const unsigned* lookup,float (&value)[4]) {')
once('int total,int xb,const int32_t* tok,const ProtoQ8* x,k::NativeExpertLayout l,int lane,\n    float (&stack)[5][4],float* gate,float* up) {','int total,int xb,const int32_t* tok,const ProtoQ8* x,k::NativeExpertLayout l,int lane,\n    const unsigned* lookup,float (&stack)[5][4],float* gate,float* up) {')
once('                        a[j]=((const unsigned*)blob)[index];','                        const unsigned code=(blob[index/2]>>(4*(index&1)))&15;\n                        a[j]=lookup[code];')
once('const __half* scale=(const __half*)blob+(size_t)(2*l.n_ff)*l.n_embd+(size_t)row*(l.n_embd/128)+ib;','const __half* scale=(const __half*)(blob+(size_t)(2*l.n_ff)*l.n_embd/4)+(size_t)row*(l.n_embd/128)+ib;')
if s.count('xb,tok,x,l,lane,value);')!=2:raise RuntimeError('block lookup arguments differ')
s=s.replace('xb,tok,x,l,lane,value);','xb,tok,x,l,lane,lookup,value);')
if s.count('xb,tok,x,l,lane,stack,gate,up);')!=32:raise RuntimeError('leaf lookup arguments differ')
s=s.replace('xb,tok,x,l,lane,stack,gate,up);','xb,tok,x,l,lane,lookup,stack,gate,up);')
once('    if(group>=*ng)return;\n    const int lane=threadIdx.x&31,warp=threadIdx.x>>5,first=blockIdx.x*128+warp*16;','''    if(group>=*ng)return;
    __shared__ unsigned lookup[16];
    if(threadIdx.x<16) {const int v=threadIdx.x;lookup[v]=v<9?proto_pack(v%3-1,v/3-1):0x7fffffff;}
    __syncthreads();
    const int lane=threadIdx.x&31,warp=threadIdx.x>>5,first=blockIdx.x*128+warp*16;''')
start=s.index('__global__ void proto_predecode(');end=s.index('struct ProtoHotGU',start)
replacement='''__global__ void proto_predecode(const unsigned long long* packed,const unsigned long long* decoded,k::NativeExpertLayout l) {
    const size_t byte=(size_t)blockIdx.x*blockDim.x+threadIdx.x;
    const size_t n=(size_t)2*l.n_ff*l.n_embd;
    if(byte>=n/4)return;
    const int nb=l.n_embd/128,group=blockIdx.y;
    unsigned encoded=0;
#pragma unroll
    for(int half=0;half<2;++half) {
        const size_t index=2*byte+half;
        const int lane=index%32,reg=(index/32)%4,phase=(index/128)%2,sub=(index/256)%4;
        const int ib=(index/1024)%nb,tile=index/(1024*nb);
        const int row=tile*16+(reg%2)*8+lane/4,col=ib*128+sub*32+phase*16+2*((reg/2)*4+lane%4);
        const bool is_up=row>=l.n_ff;const int rr=is_up?row-int(l.n_ff):row;
        const uint8_t* source=(const uint8_t*)packed[group];
        const ProtoPtq* block=(const ProtoPtq*)(source+(is_up?l.up_off:0)+(size_t)rr*l.gu_row)+ib;
        const unsigned first=proto_code(block,col%128)+1,second=proto_code(block,(col+1)%128)+1;
        encoded|=(first+3*second)<<(4*half);
        if(sub==0 && phase==0 && reg<2 && lane%4==0)
            ((__half*)((uint8_t*)decoded[group]+n/4))[(size_t)row*nb+ib]=block->d;
    }
    ((uint8_t*)decoded[group])[byte]=(uint8_t)encoded;
}
'''
s=s[:start]+replacement+s[end:]
once('const size_t per=(size_t)2*g.L.n_ff*(g.L.n_embd+g.L.n_embd/128)*2;','const size_t per=(size_t)2*g.L.n_ff*(g.L.n_embd/4+(g.L.n_embd/128)*2);')
once('proto_predecode<<<dim3((unsigned)((n/2+255)/256),g.n_groups),256,0,s>>>','proto_predecode<<<dim3((unsigned)((n/4+255)/256),g.n_groups),256,0,s>>>')
s=s.replace('// V6 measures predecoded synthetic GU codes; one-time decode cost and extra memory are separate.','// V8 stores two ternary codes in a four-bit nibble and expands through a shared exact half2 table.\n// The cache is 34/28 of the original PTQ GU bytes, not an all-model FP16 expansion.')
p.write_text(s)
for src,dest in [('stage_xolotl_ptq_mma_v7.frozen.py','stage_xolotl_ptq_mma_v8.frozen.py'),('observe_xolotl_ptq_mma_v7.frozen.py','observe_xolotl_ptq_mma_v8.frozen.py')]:
 s=(BASE/src).read_text()
 for a,b in [('xolotl-ptq-mma-v7-intent.json','xolotl-ptq-mma-v8-intent.json'),('xolotl-ptq-mma-v7-latest.json','xolotl-ptq-mma-v8-latest.json'),("'/xolotl-ptq-mma-v7'","'/xolotl-ptq-mma-v8'"),('aster_ptq_mma_prototype_v7.cu','aster_ptq_mma_prototype_v8.cu'),('xolotl_ptq_mma_v7_worker.frozen.py','xolotl_ptq_mma_v8_worker.frozen.py')]:
  if a in s:s=s.replace(a,b)
 s=s.replace('predecoded synthetic GU codes capped at1GiB','lossless nibble-encoded synthetic GU codes capped at1GiB, 34/28 original PTQ GU bytes')
 ast.parse(s);(BASE/dest).write_text(s)
print('V8 prepared: exact9-value ternary-pair table, 2-bit codes plus original scales; original6 strict gates retained.')
