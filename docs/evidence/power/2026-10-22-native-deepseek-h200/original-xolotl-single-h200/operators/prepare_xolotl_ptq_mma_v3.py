"""Replace dynamic reduction indexing with compile-time indices; preserve V2."""
import ast
from xolotl_trial_common import BASE
p=BASE/'aster_ptq_mma_prototype_v3.cu'
if p.exists():raise RuntimeError('V3 source already frozen')
s=(BASE/'aster_ptq_mma_prototype_v2.cu').read_text()
anchor='// The old scalar lane owns blocks lane, lane+32.'
helper='''template<int OFFSET,int INDEX=0>
__device__ __forceinline__ void proto_reduce(float (&p)[32][4]) {
    if constexpr(INDEX<OFFSET) {
#pragma unroll
        for(int c=0;c<4;++c) p[INDEX][c]+=p[INDEX+OFFSET][c];
        proto_reduce<OFFSET,INDEX+1>(p);
    } else if constexpr(OFFSET>1) proto_reduce<OFFSET/2>(p);
}

'''
if s.count(anchor)!=1:raise RuntimeError('reduction helper anchor differs')
s=s.replace(anchor,helper+anchor)
a='''#pragma unroll
        for(int offset=16;offset>0;offset/=2)
#pragma unroll
            for(int j=0;j<offset;++j)
#pragma unroll
                for(int c=0;c<4;++c) partial[j][c]+=partial[j+offset][c];'''
if s.count(a)!=1:raise RuntimeError('dynamic reduction differs')
s=s.replace(a,'        proto_reduce<16>(partial);');p.write_text(s)
for src,dest in [('stage_xolotl_ptq_mma_v2.frozen.py','stage_xolotl_ptq_mma_v3.frozen.py'),('observe_xolotl_ptq_mma_v2.frozen.py','observe_xolotl_ptq_mma_v3.frozen.py')]:
 s=(BASE/src).read_text()
 for a,b in [('xolotl-ptq-mma-v2-intent.json','xolotl-ptq-mma-v3-intent.json'),('xolotl-ptq-mma-v2-latest.json','xolotl-ptq-mma-v3-latest.json'),("'/xolotl-ptq-mma-v2'","'/xolotl-ptq-mma-v3'"),('aster_ptq_mma_prototype_v2.cu','aster_ptq_mma_prototype_v3.cu'),('xolotl_ptq_mma_v2_worker.frozen.py','xolotl_ptq_mma_v3_worker.frozen.py')]:
  if a in s:s=s.replace(a,b)
 ast.parse(s);(BASE/dest).write_text(s)
print('V3 preserves every numerical/timing gate; reduction indices are compile-time constants.')
