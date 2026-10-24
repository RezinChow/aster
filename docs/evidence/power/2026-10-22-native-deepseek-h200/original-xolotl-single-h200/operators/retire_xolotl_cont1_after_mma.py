"""Retire this exact idle allocation after completed controls/model A/B; keep all artifacts."""
import json
from xolotl_trial_common import BASE,lease
current=lease()
if current['submitted']['uid']!='51cd429c-43d9-45bf-a38f-ff8eabca2809':raise RuntimeError('continuation allocation changed; no stop')
for version in ['v6','v7','v8','v9','v10','v11','v12','v13','v14','v15','integrated']:
 r=json.loads((BASE/('xolotl-ptq-mma-'+version+'-latest.json')).read_text())['result.json']
 if r.get('phase') not in ('complete','failed','qualified'):raise RuntimeError('an owned CUDA research worker is still active')
s=(BASE/'retire_xolotl_pair_for_single300.py').read_text()
a="['single-current-q8-control','single-current-q8-mmq','single-current-split-conf020','single-current-split-conf045-final']"
b="['single-current-mma-control','single-current-mma-candidate']"
if s.count(a)!=1:raise RuntimeError('model terminal guard anchor differs')
s=s.replace(a,b)
for a,b in [('xolotl-pair-retired-for-single300.json','xolotl-cont1-retired-after-mma.json'),('completed single-visible-GPU tests; hand over to a single-H200 allocation','all exact-code controls and full-model MMA A/B completed; retire idle allocation while original MTP sidecar downloads locally')]:
 if s.count(a)!=1:raise RuntimeError('retirement receipt anchor differs')
 s=s.replace(a,b)
(BASE/'retire_xolotl_cont1_after_mma.frozen.py').write_text(s);exec(compile(s,'retire-cont1.py','exec'))
