"""Fresh source build for combined row interleave and weight-decode reuse."""
import ast
from xolotl_trial_common import BASE
s=(BASE/'stage_xolotl_device_verify_build.frozen.py').read_text()
for a,b in [('xolotl-h200-device-verify-build-intent.json','xolotl-h200-split-rows-build-intent.json'),('xolotl_device_verify_build_worker.frozen.py','xolotl_split_rows_build_worker.frozen.py'),("'/xolotl-device-verify-h200'","'/xolotl-split-rows-h200'"),("payload={'device-verify.patch'","payload={'split-rows.patch':(BASE/'xolotl-h200-split-rows.patch').read_bytes(),'device-verify.patch'")]:
 if s.count(a)!=1:raise RuntimeError('split rows stage anchor differs: '+a)
 s=s.replace(a,b)
anchor="compile(source,'split-build-worker.py','exec')"
extra='''
anchor3=" command(['patch','--batch','--fuzz=0','-p1','-d',str(source),'-i',str(ROOT/'device-verify.patch')],'device-verify-patch',30)"
if source.count(anchor3)!=1:raise RuntimeError('split rows patch placement differs')
source=source.replace(anchor3,anchor3+"\\n command(['patch','--batch','--fuzz=0','-p1','-d',str(source),'-i',str(ROOT/'split-rows.patch')],'split-rows-patch',30)")
'''
if s.count(anchor)!=1:raise RuntimeError('worker final compile anchor differs')
s=s.replace(anchor,extra+anchor);ast.parse(s);p=BASE/'stage_xolotl_split_rows_build.frozen.py';p.write_text(s)
exec(compile(s,str(p),'exec'))
