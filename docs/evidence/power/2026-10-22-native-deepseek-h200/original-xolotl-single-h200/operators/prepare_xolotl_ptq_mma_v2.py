"""Retain refused V1; correct explicit shape-array typing in a separate V2 root."""
import ast
from xolotl_trial_common import BASE
p=BASE/'aster_ptq_mma_prototype_v2.cu'
if p.exists():raise RuntimeError('V2 source already frozen')
s=(BASE/'aster_ptq_mma_prototype.cu').read_text()
a='    for(auto shape:{std::pair<int,int>{5120,2304},{1024,512}})'
b='    const std::pair<int,int> shapes[]={{5120,2304},{1024,512}};\n    for(const auto& shape:shapes)'
if s.count(a)!=1:raise RuntimeError('V1 shape initializer differs')
p.write_text(s.replace(a,b))
for src,dest in [('stage_xolotl_ptq_mma_prototype.py','stage_xolotl_ptq_mma_v2.frozen.py'),('observe_xolotl_ptq_mma_prototype.py','observe_xolotl_ptq_mma_v2.frozen.py')]:
 s=(BASE/src).read_text()
 for a,b in [('xolotl-ptq-mma-prototype-intent.json','xolotl-ptq-mma-v2-intent.json'),('xolotl-ptq-mma-prototype-latest.json','xolotl-ptq-mma-v2-latest.json'),("'/xolotl-ptq-mma-prototype'","'/xolotl-ptq-mma-v2'"),('aster_ptq_mma_prototype.cu','aster_ptq_mma_prototype_v2.cu'),('xolotl_ptq_mma_prototype_worker.frozen.py','xolotl_ptq_mma_v2_worker.frozen.py')]:
  if a in s:s=s.replace(a,b)
 ast.parse(s);(BASE/dest).write_text(s)
print('V2 fixes only host shape-array typing; numerical and timing gates unchanged.')
