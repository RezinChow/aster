"""Freeze two same-binary full-model trials for the qualified default-off GU experiment."""
import ast
from xolotl_trial_common import BASE
worker=(BASE/'xolotl_protocol_trial_worker.py').read_text()
a="    env={k:v for k,v in os.environ.items() if not k.startswith('STRATA_')}"
b="    env={k:v for k,v in os.environ.items() if not k.startswith(('STRATA_','ASTER_XQ_'))}"
if worker.count(a)!=1:raise RuntimeError('worker environment anchor differs')
worker=worker.replace(a,b)
anchor="    if 'split_rows' in PLAN:"
extra="""    if 'ptq_mma' in PLAN:
        if type(PLAN['ptq_mma']) is not bool:raise RuntimeError('PTQ MMA must be a boolean')
        env['ASTER_XQ_PTQ_MMA']='1' if PLAN['ptq_mma'] else '0'
"""
if worker.count(anchor)!=1:raise RuntimeError('worker MMA flag insertion anchor differs')
worker=worker.replace(anchor,extra+anchor);ast.parse(worker);(BASE/'xolotl_mma_protocol_worker.frozen.py').write_text(worker)
modes=['single-current-mma-control','single-current-mma-candidate']
for src,dest in [('launch_xolotl_protocol_trial.py','launch_xolotl_mma_model_trial.frozen.py'),('observe_xolotl_protocol_trial.py','observe_xolotl_mma_model_trial.frozen.py')]:
 s=(BASE/src).read_text()
 anchor="'single-current-rows-r4']"
 if src.startswith('launch_'):
  # Choice list and the existing row-family branch have this suffix; only extend choices.
  first=s.index(anchor);s=s[:first]+s[first:].replace(anchor,"'single-current-rows-r4', 'single-current-mma-control', 'single-current-mma-candidate']",1)
  anchor="worker=(BASE/'xolotl_protocol_trial_worker.py').read_bytes()"
  if s.count(anchor)!=1:raise RuntimeError('worker selection anchor differs')
  s=s.replace(anchor,"worker=(BASE/('xolotl_mma_protocol_worker.frozen.py' if args.mode in "+repr(modes)+" else 'xolotl_protocol_trial_worker.py')).read_bytes()")
  anchor="record=dict(unix=time.time(),mode=args.mode"
  extra="""if args.mode in ['single-current-mma-control','single-current-mma-candidate']:
 mc=json.loads((BASE/'xolotl-ptq-mma-integrated-latest.json').read_text())['result.json']
 mi=json.loads((BASE/'xolotl-ptq-mma-integrated-intent.json').read_text())
 if mc.get('phase')!='qualified' or not mc.get('passed') or set(mc.get('controls',{}))!={'0','1'}:raise RuntimeError('both integrated-dispatch GPU controls must pass')
 stage['root']=mi['root'];binary=mc['binaries']['ds41_generate']
 plan.update(binary=binary['path'],binary_sha256=binary['sha256'],graph_metadata_mib=1024,split_mmvq='11',ptq_rows_per_warp=4,max_trial_seconds=300,device_verify=False,split_rows=0,ptq_mma=args.mode=='single-current-mma-candidate')
"""
  if s.count(anchor)!=1:raise RuntimeError('MMA plan placement anchor differs')
  s=s.replace(anchor,extra+anchor)
 else:
  if s.count(anchor)!=1:raise RuntimeError('observer choice anchor differs')
  s=s.replace(anchor,"'single-current-rows-r4', 'single-current-mma-control', 'single-current-mma-candidate']")
 ast.parse(s);(BASE/dest).write_text(s)
print('Frozen same-binary control/candidate model trials; 17 requests per trial, 300-second worker and exact existing cleanup.')
