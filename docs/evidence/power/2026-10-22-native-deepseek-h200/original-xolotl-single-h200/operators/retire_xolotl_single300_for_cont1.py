"""Require every prototype to be terminal before retiring the exact idle allocation."""
import json
from xolotl_trial_common import BASE
for stem in ['prototype','v2','v3','v4','v5']:
 p=BASE/('xolotl-ptq-mma-'+stem+'-latest.json')
 result=json.loads(p.read_text())['result.json']
 if result['phase'] not in ('complete','failed'):raise RuntimeError('prototype still active; no retirement')
s=(BASE/'retire_xolotl_pair_for_single300.py').read_text()
for a,b in [('xolotl-pair-retired-for-single300.json','xolotl-single300-retired-for-cont1.json'),('completed single-visible-GPU tests; hand over to a single-H200 allocation','all prototype screens terminal; retire idle single-H200 task before a bounded continuation')]:
 if s.count(a)!=1:raise RuntimeError('single-card retirement anchor differs')
 s=s.replace(a,b)
compile(s,'retire-single300.py','exec');(BASE/'retire_xolotl_single300_for_cont1.frozen.py').write_text(s)
exec(compile(s,'retire-single300.py','exec'))
