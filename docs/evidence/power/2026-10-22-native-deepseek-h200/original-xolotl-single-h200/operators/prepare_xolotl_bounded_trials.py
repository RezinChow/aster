import ast
from xolotl_trial_common import BASE
p=BASE/'launch_xolotl_protocol_trial.py';s=p.read_text()
anchor=" stage['root']=split_intent['root']"
if s.count(anchor)!=1:raise RuntimeError('split budget anchor differs')
s=s.replace(anchor,anchor+"\n plan['max_trial_seconds']=900")
anchor="['timeout','--signal=TERM','--kill-after=30','1850','python3'"
if s.count(anchor)!=1:raise RuntimeError('wrapper deadline anchor differs')
s=s.replace(anchor,"['timeout','--signal=TERM','--kill-after=30',str(r['plan'].get('max_trial_seconds',1800)+50),'python3'")
anchor='deadline_seconds=1850)'
if s.count(anchor)!=1:raise RuntimeError('receipt deadline anchor differs')
s=s.replace(anchor,"deadline_seconds=r['plan'].get('max_trial_seconds',1800)+50)")
ast.parse(s);p.write_text(s)
print('future split trials: 900 second alarm, SIGTERM cleanup, 950 second outer deadline, immutable lease check')
