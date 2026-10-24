"""Derive a fresh source stage and bounded GPU-free build from pinned inputs."""
import ast
from xolotl_trial_common import BASE,lease

s=(BASE/'stage_xolotl_split_build.py').read_text()
for a,b in [
 ("BASE,jump","BASE,jump,lease"),
 ('xolotl-h200-split-build-intent.json','xolotl-h200-device-verify-build-intent.json'),
 ('xolotl_split_build_worker.frozen.py','xolotl_device_verify_build_worker.frozen.py'),
 ("prior['root'].rsplit('/',1)[0]+'/xolotl-split-mmvq-h200'","lease()['remote']+'/xolotl-device-verify-h200'"),
 ("payload={'h200-experiments.patch'","payload={'device-verify.patch':(BASE/'xolotl-h200-device-verify.patch').read_bytes(),'h200-experiments.patch'")
]:
 if s.count(a)!=1:raise RuntimeError('stage derivation anchor changed: '+a)
 s=s.replace(a,b)
anchor="compile(source,'split-build-worker.py','exec')"
extra='''
anchor2=" command(['patch','--batch','--fuzz=0','-p1','-d',str(source),'-i',str(ROOT/'split-mmvq.patch')],'split-mmvq-patch',30)"
if source.count(anchor2)!=1:raise RuntimeError('device patch placement differs')
source=source.replace(anchor2,anchor2+"\\n command(['patch','--batch','--fuzz=0','-p1','-d',str(source),'-i',str(ROOT/'device-verify.patch')],'device-verify-patch',30)")
source=source.replace("'aster_xq_split_parity','-j','24'","'aster_xq_split_parity','test_ds41_fq','test_ds41_hcmix','-j','16'")
source=source.replace("'ds41_generate','aster_xq_split_parity']","'ds41_generate','aster_xq_split_parity','test_ds41_fq','test_ds41_hcmix']")
source=source.replace("'compile',2100)","'compile',900)")
'''
if s.count(anchor)!=1:raise RuntimeError('worker compile anchor differs')
s=s.replace(anchor,extra+anchor)
ast.parse(s);p=BASE/'stage_xolotl_device_verify_build.frozen.py';p.write_text(s)
exec(compile(s,str(p),'exec'))
