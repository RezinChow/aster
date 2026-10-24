"""Prevent cross-MMA memory-load hoisting; preserve the full numerical screen."""
import ast
from xolotl_trial_common import BASE
p=BASE/'aster_ptq_mma_prototype_v5.cu'
if p.exists():raise RuntimeError('V5 source already frozen')
s=(BASE/'aster_ptq_mma_prototype_v4.cu').read_text()
a='"r"(a[0]),"r"(a[1]),"r"(a[2]),"r"(a[3]),"r"(b[0]),"r"(b[1]));'
b='"r"(a[0]),"r"(a[1]),"r"(a[2]),"r"(a[3]),"r"(b[0]),"r"(b[1]) : "memory");'
if s.count(a)!=1:raise RuntimeError('MMA operand boundary differs')
p.write_text(s.replace(a,b))
for src,dest in [('stage_xolotl_ptq_mma_v4.frozen.py','stage_xolotl_ptq_mma_v5.frozen.py'),('observe_xolotl_ptq_mma_v4.frozen.py','observe_xolotl_ptq_mma_v5.frozen.py')]:
 s=(BASE/src).read_text()
 for a,b in [('xolotl-ptq-mma-v4-intent.json','xolotl-ptq-mma-v5-intent.json'),('xolotl-ptq-mma-v4-latest.json','xolotl-ptq-mma-v5-latest.json'),("'/xolotl-ptq-mma-v4'","'/xolotl-ptq-mma-v5'"),('aster_ptq_mma_prototype_v4.cu','aster_ptq_mma_prototype_v5.cu'),('xolotl_ptq_mma_v4_worker.frozen.py','xolotl_ptq_mma_v5_worker.frozen.py'),("'compile',180","'compile',120"),("'link',60","'link',30"),("'gpu',180","'gpu',90"),('time.time()+540>','time.time()+330>'),('time.time()+240>','time.time()+110>'),("'510','python3'","'300','python3'"),('deadline_seconds=510','deadline_seconds=300')]:
  if a in s:s=s.replace(a,b)
 ast.parse(s);(BASE/dest).write_text(s)
print('V5 changes only the compiler memory boundary; same6 correctness and timing cases, shorter bounded work budget.')
