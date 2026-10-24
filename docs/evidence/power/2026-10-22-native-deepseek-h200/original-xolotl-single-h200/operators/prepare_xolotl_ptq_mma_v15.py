"""Collapse exact modular byte decoding to powers of three and unroll four q8 subblocks."""
import ast
from xolotl_trial_common import BASE
p=BASE/'aster_ptq_mma_prototype_v15.cu'
if p.exists():raise RuntimeError('V15 source already frozen')
s=(BASE/'aster_ptq_mma_prototype_v14.cu').read_text()
a='''#pragma unroll 1
    for(int j=0;j<depth;++j){lo=(lo*3u)&0x00ff00ffu;hi=(hi*3u)&0x00ff00ffu;}'''
b='''    const unsigned power=depth<4?((0x1b090301u>>(8*depth))&255u):81u;
    lo=(lo*power)&0x00ff00ffu;hi=(hi*power)&0x00ff00ffu;'''
if s.count(a)!=1:raise RuntimeError('fractional decoder loop anchor differs')
s=s.replace(a,b)
a='#pragma unroll 1\n    for(int sub=0;sub<4;++sub) {'
if s.count(a)!=1:raise RuntimeError('q8 subblock loop anchor differs')
s=s.replace(a,'#pragma unroll\n    for(int sub=0;sub<4;++sub) {')
p.write_text(s)
for src,dest in [('stage_xolotl_ptq_mma_v14.frozen.py','stage_xolotl_ptq_mma_v15.frozen.py'),('observe_xolotl_ptq_mma_v14.frozen.py','observe_xolotl_ptq_mma_v15.frozen.py')]:
 s=(BASE/src).read_text()
 for a,b in [('xolotl-ptq-mma-v14-intent.json','xolotl-ptq-mma-v15-intent.json'),('xolotl-ptq-mma-v14-latest.json','xolotl-ptq-mma-v15-latest.json'),("'/xolotl-ptq-mma-v14'","'/xolotl-ptq-mma-v15'"),('aster_ptq_mma_prototype_v14.cu','aster_ptq_mma_prototype_v15.cu'),('xolotl_ptq_mma_v14_worker.frozen.py','xolotl_ptq_mma_v15_worker.frozen.py')]:
  if a in s:s=s.replace(a,b)
 ast.parse(s);(BASE/dest).write_text(s)
for raw in range(256):
 for depth in range(5):
  old=raw
  for _ in range(depth):old=old*3&255
  power=((0x1b090301>>(8*depth))&255) if depth<4 else 81
  if old!=(raw*power)&255:raise RuntimeError('modular decoder power equivalence differs')
print('V15 prepared: all1280 byte/depth states exact; no auxiliary bytes, same cold-cache GPU gates.')
