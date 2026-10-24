"""Use a register-resident nine-value half2 table with warp shuffle expansion."""
import ast
from xolotl_trial_common import BASE
p=BASE/'aster_ptq_mma_prototype_v9.cu'
if p.exists():raise RuntimeError('V9 source already frozen')
s=(BASE/'aster_ptq_mma_prototype_v8.cu').read_text()
if s.count('const unsigned* lookup')!=2:raise RuntimeError('shared lookup parameter sites differ')
s=s.replace('const unsigned* lookup','unsigned lookup')
a='                        a[j]=lookup[code];'
b='                        a[j]=__shfl_sync(0xffffffffu,lookup,code);'
if s.count(a)!=1:raise RuntimeError('shared lookup expansion differs')
s=s.replace(a,b)
a='''    __shared__ unsigned lookup[16];
    if(threadIdx.x<16) {const int v=threadIdx.x;lookup[v]=v<9?proto_pack(v%3-1,v/3-1):0x7fffffff;}
    __syncthreads();
    const int lane=threadIdx.x&31,warp=threadIdx.x>>5,first=blockIdx.x*128+warp*16;'''
b='''    const int lane=threadIdx.x&31,warp=threadIdx.x>>5,first=blockIdx.x*128+warp*16;
    const unsigned lookup=lane<9?proto_pack(lane%3-1,lane/3-1):0x7fffffff;'''
if s.count(a)!=1:raise RuntimeError('shared table initialization differs')
s=s.replace(a,b).replace('expands through a shared exact half2 table','expands through an exact warp-register half2 table');p.write_text(s)
for src,dest in [('stage_xolotl_ptq_mma_v8.frozen.py','stage_xolotl_ptq_mma_v9.frozen.py'),('observe_xolotl_ptq_mma_v8.frozen.py','observe_xolotl_ptq_mma_v9.frozen.py')]:
 s=(BASE/src).read_text()
 for a,b in [('xolotl-ptq-mma-v8-intent.json','xolotl-ptq-mma-v9-intent.json'),('xolotl-ptq-mma-v8-latest.json','xolotl-ptq-mma-v9-latest.json'),("'/xolotl-ptq-mma-v8'","'/xolotl-ptq-mma-v9'"),('aster_ptq_mma_prototype_v8.cu','aster_ptq_mma_prototype_v9.cu'),('xolotl_ptq_mma_v8_worker.frozen.py','xolotl_ptq_mma_v9_worker.frozen.py')]:
  if a in s:s=s.replace(a,b)
 ast.parse(s);(BASE/dest).write_text(s)
print('V9 replaces only shared-memory lookup with warp-register shuffle; same compressed bytes and strict gates.')
