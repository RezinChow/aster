"""Prepare a bounded profile of current R4/Q3 decode; no speed claim or launch."""
import ast
from xolotl_trial_common import BASE
p=BASE/'xolotl_current_profile_v3_worker.frozen.py'
if p.exists():raise RuntimeError('profile V3 worker already frozen')
s=(BASE/'xolotl_nsys_protocol_worker_v2.frozen.py').read_text()
def once(s,a,b):
 if s.count(a)!=1:raise RuntimeError('current profile anchor differs: '+a[:70])
 return s.replace(a,b)
s=once(s,"        p=subprocess.run(command,stdout=out,stderr=out,timeout=90)","        p=subprocess.run(command,stdout=out,stderr=out,timeout=90 if action=='start' else 20)")
s=once(s,'def sample():',"def interrupt_trial(signum,frame):\n    raise TimeoutError('bounded current-profile interruption '+str(signum))\n\ndef sample():")
s=once(s,"    if time.time()+1800>PLAN['lease_ends_unix']:raise RuntimeError('insufficient immutable lease remaining')","""    if PLAN.get('max_trial_seconds')!=600:raise RuntimeError('current profile duration must be600 seconds')
    if time.time()+650>PLAN['lease_ends_unix']:raise RuntimeError('insufficient immutable lease remaining')
    signal.signal(signal.SIGTERM,interrupt_trial);signal.signal(signal.SIGALRM,interrupt_trial)
    signal.setitimer(signal.ITIMER_REAL,600)""")
s=once(s,"env={k:v for k,v in os.environ.items() if not k.startswith('STRATA_')}","env={k:v for k,v in os.environ.items() if not k.startswith(('STRATA_','ASTER_XQ_'))}")
s=once(s,"    if PLAN.get('async_attn_readback'):env['ASTER_XQ_ASYNC_ATTN_READBACK']='1'","""    if PLAN.get('async_attn_readback'):env['ASTER_XQ_ASYNC_ATTN_READBACK']='1'
    if PLAN.get('ptq_qsum')!='0' or PLAN.get('ptq_rows_per_warp')!=4 or PLAN.get('split_mmvq')!='11':raise RuntimeError('current profile must use R4/Q3 with experimental sums off')
    env.update(ASTER_XQ_PTQ_QSUM='0',STRATA_EXP_MODE_T143='4',STRATA_EXP_MODE_T11='0',ASTER_XQ_SPLIT_MMVQ='11',ASTER_XQ_SPLIT_ROWS='0',ASTER_XQ_DEVICE_VERIFY='0')""")
s=once(s,'finally:\n    if capture_active:','finally:\n    signal.setitimer(signal.ITIMER_REAL,0)\n    if capture_active:')
s=once(s,"    if child is not None and child.poll() is None:\n        target=ROOT/'profile-target-process.json'","    if child is not None:\n        target=ROOT/'profile-target-process.json'")
ast.parse(s);p.write_text(s)
mode='single-current-qsum-v2-profile'
for source,dest in [('launch_xolotl_qsum_v2_model_trial.frozen.py','launch_xolotl_current_profile_v3.frozen.py'),('observe_xolotl_qsum_v2_model_trial.frozen.py','observe_xolotl_current_profile_v3.frozen.py')]:
 s=(BASE/source).read_text();a=s.index('choices=[');b=s.index('],required=True',a)+1 if source.startswith('launch') else s.index(']);p.add_argument',a)+1;s=s[:a]+'choices='+repr([mode])+s[b:]
 if source.startswith('launch'):
  a=s.index('\nprofiles={')+1;b=s.index('\nmc=',a);s=s[:a]+'profiles='+repr({mode:'0'})+s[b:]
  s=once(s,"BASE/'xolotl_qsum_protocol_worker.frozen.py'","BASE/'xolotl_current_profile_v3_worker.frozen.py'")
  s=once(s,'max_trial_seconds=300','max_trial_seconds=600');s=once(s,'diagnostic_only=False','diagnostic_only=True')
 ast.parse(s);(BASE/dest).write_text(s)
print('Prepared only: current R4/Q3 GPU profile,3 warmups+1 captured prose request;600-second alarm and exact owned-target cleanup. No rate qualification.')
