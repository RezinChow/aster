"""Freeze a separate bounded continuation only after the current single-card job ends."""
import ast
from xolotl_trial_common import BASE
s=(BASE/'prepare_xolotl_single300_lease.py').read_text()
for a,b in [('submit_xolotl_single300_lease.frozen.py','submit_xolotl_single500_cont1_lease.frozen.py'),('xolotl-single300-lease-pending.json','xolotl-single500-cont1-lease-pending.json'),("name='aster-xolotl-300-'","name='aster-xolotl-500c1-'"),('bounded one-hour single-H200 optimization toward the user-requested 300 token/s milestone','bounded one-hour continuation of the single-H200 500 token/s goal, with the current 300 token/s milestone')]:
 if s.count(a)!=1:raise RuntimeError('continuation lease derivation differs: '+a)
 s=s.replace(a,b)
ast.parse(s);(BASE/'prepare_xolotl_single500_cont1.frozen.py').write_text(s)
exec(compile(s,'single500-cont1-prepare.py','exec'))
