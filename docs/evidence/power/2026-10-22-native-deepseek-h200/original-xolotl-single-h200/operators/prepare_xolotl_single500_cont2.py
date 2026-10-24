"""Freeze a new one-hour single-H200 lease after the exact predecessor is terminal."""
import ast,json,shutil
from xolotl_trial_common import BASE,lease
old=lease();observation=json.loads((BASE/'xolotl-trial-resource-latest.json').read_text())
if old['submitted']['uid']!='51cd429c-43d9-45bf-a38f-ff8eabca2809' or observation['job_uid']!=old['submitted']['uid'] or observation['phase']!='Stopped' or len(observation['replicas'])!=1 or observation['replicas'][0]['phase']!='Stopped':raise RuntimeError('exact stopped predecessor proof differs')
archive=BASE/'xolotl-single500-cont1-terminal-proof.json'
if archive.exists():
 if json.loads(archive.read_text())!=observation:raise RuntimeError('archived terminal predecessor differs')
else:shutil.copy2(BASE/'xolotl-trial-resource-latest.json',archive)
s=(BASE/'prepare_xolotl_single500_cont1.frozen.py').read_text()
for a,b in [('submit_xolotl_single500_cont1_lease.frozen.py','submit_xolotl_single500_cont2_lease.frozen.py'),('xolotl-single500-cont1-lease-pending.json','xolotl-single500-cont2-lease-pending.json'),("name='aster-xolotl-500c1-'","name='aster-xolotl-500c2-'"),('bounded one-hour continuation of the single-H200 500 token/s goal, with the current 300 token/s milestone','bounded one-hour second continuation: single-H200 merged dispatch, speculative verification and original MTP controls toward500 tok/s, with300 first')]:
 if s.count(a)!=1:raise RuntimeError('continuation2 derivation anchor differs: '+a)
 s=s.replace(a,b)
ast.parse(s);p=BASE/'prepare_xolotl_single500_cont2.frozen.py'
if p.exists():raise RuntimeError('continuation2 preparer already frozen')
p.write_text(s);exec(compile(s,str(p),'exec'))
