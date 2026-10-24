"""Prepare closed same-binary full-model plans; launch requires all39 strict controls."""
import ast
from xolotl_trial_common import BASE
profiles={'single-current-qsum-control':'0','single-current-qsum-gu':'gu','single-current-qsum-both':'both'}
worker=(BASE/'xolotl_mma_v2_protocol_worker.frozen.py').read_text();anchor="    if 'ptq_mma' in PLAN:"
insert="""    if PLAN.get('ptq_qsum') not in ('0','gu','both'):raise RuntimeError('qsum mode must be0,gu or both')
    env['ASTER_XQ_PTQ_QSUM']=PLAN['ptq_qsum']
"""+anchor
if worker.count(anchor)!=1:raise RuntimeError('qsum worker environment anchor differs')
worker=worker.replace(anchor,insert);ast.parse(worker);p=BASE/'xolotl_qsum_protocol_worker.frozen.py'
if p.exists():raise RuntimeError('qsum worker already frozen')
p.write_text(worker)
s=(BASE/'launch_xolotl_mma_v2_model_trial.frozen.py').read_text();a=s.index('choices=[');b=s.index('],required=True',a)+1;s=s[:a]+'choices='+repr(list(profiles))+s[b:]
s=s.replace("worker=(BASE/'xolotl_mma_v2_protocol_worker.frozen.py').read_bytes()","worker=(BASE/'xolotl_qsum_protocol_worker.frozen.py').read_bytes()")
a=s.index('\nprofiles={')+1;b=s.index('record=dict(unix=time.time(),mode=args.mode',a)
block='''profiles=@PROFILES@
mc=json.loads((BASE/'xolotl-ptq-qsum-latest.json').read_text())['result.json']
mi=json.loads((BASE/'xolotl-ptq-qsum-intent.json').read_text())
if mc.get('phase')!='qualified' or not mc.get('passed') or mc.get('strict_cases')!=39 or set(mc.get('controls',{}))!={'0','gu','both'}:raise RuntimeError('all39 qsum exact GU/Down/q8/sentinel controls must pass')
stage['root']=mi['root'];binary=mc['binaries']['ds41_generate']
plan.update(binary=binary['path'],binary_sha256=binary['sha256'],graph_metadata_mib=1024,split_mmvq='11',ptq_rows_per_warp=4,max_trial_seconds=300,device_verify=False,split_rows=0,draft_depth=5,diagnostic_only=False,ptq_mma=False,ptq_mma_diagnostics=False,original_mtp=False,ptq_qsum=profiles[args.mode])
'''.replace('@PROFILES@',repr(profiles))
s=s[:a]+block+s[b:];ast.parse(s);(BASE/'launch_xolotl_qsum_model_trial.frozen.py').write_text(s)
s=(BASE/'observe_xolotl_mma_v2_model_trial.frozen.py').read_text();a=s.index('choices=[');b=s.index(']);p.add_argument',a)+1;s=s[:a]+'choices='+repr(list(profiles))+s[b:];ast.parse(s);(BASE/'observe_xolotl_qsum_model_trial.frozen.py').write_text(s)
s=(BASE/'compare_xolotl_mma_v2_model.frozen.py').read_text().replace('import json,time','import json,time,argparse')
s=s.replace("names=['single-current-mma-v2-control','single-current-mma-v2-candidate']","p=argparse.ArgumentParser();p.add_argument('--candidate',choices=['gu','both'],required=True);args=p.parse_args()\nnames=['single-current-qsum-control','single-current-qsum-'+args.candidate]")
s=s.replace("if [p.pop('ptq_mma') for p in plans]!=[False,True] or plans[0]!=plans[1]", "if [p.pop('ptq_qsum') for p in plans]!=['0',args.candidate] or plans[0]!=plans[1]")
s=s.replace('explicit MMA flag','explicit qsum flag').replace('same binary with flag0/1','same binary with qsum0/'+"'+args.candidate+'")
s=s.replace("BASE/'xolotl-mma-v2-model-comparison.json'","BASE/('xolotl-qsum-'+args.candidate+'-model-comparison.json')")
ast.parse(s);(BASE/'compare_xolotl_qsum_model.frozen.py').write_text(s)
print('Prepared only; all39 GPU controls and exact owned resource must pass before model launch.')
