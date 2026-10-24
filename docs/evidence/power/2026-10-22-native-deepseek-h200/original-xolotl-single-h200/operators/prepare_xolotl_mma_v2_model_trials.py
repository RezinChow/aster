"""Closed-set full-model and diagnostic plans for the qualified merged dispatch."""
import ast
from xolotl_trial_common import BASE
profiles={
 'single-current-mma-v2-control':dict(ptq_mma=False,ptq_mma_diagnostics=False,original_mtp=False),
 'single-current-mma-v2-candidate':dict(ptq_mma=True,ptq_mma_diagnostics=False,original_mtp=False),
 'single-current-mma-v2-diagnostic':dict(ptq_mma=True,ptq_mma_diagnostics=True,original_mtp=False),
 'single-current-mma-v2-original-mtp':dict(ptq_mma=False,ptq_mma_diagnostics=False,original_mtp=True),
}
worker=(BASE/'xolotl_mma_protocol_worker.frozen.py').read_text()
a="    if 'split_rows' in PLAN:"
b="""    if 'ptq_mma_diagnostics' in PLAN:
        if type(PLAN['ptq_mma_diagnostics']) is not bool:raise RuntimeError('MMA diagnostic flag must be boolean')
        env['ASTER_XQ_PTQ_MMA_DIAGNOSTICS']='1' if PLAN['ptq_mma_diagnostics'] else '0'
"""+a
if worker.count(a)!=1:raise RuntimeError('diagnostic worker placement differs')
worker=worker.replace(a,b)
a="    checked_file(PLAN['rank'],122880)"
b=a+"""
    if PLAN.get('original_mtp'):
        import hashlib
        p=checked_file(PLAN['sidecar'],8421868640)
        if p.is_symlink() or p.stat().st_uid!=10250:raise RuntimeError('original sidecar owner differs')
        h=hashlib.sha256()
        with p.open('rb') as f:
            while b:=f.read(8*1024**2):h.update(b)
        if h.hexdigest()!='6f3d5b8611ddb3954bb89c09e8890806225715fea90868a6d7ec0ffee5c72082':raise RuntimeError('original sidecar SHA differs')
"""
if worker.count(a)!=1:raise RuntimeError('sidecar worker validation placement differs')
worker=worker.replace(a,b);ast.parse(worker);(BASE/'xolotl_mma_v2_protocol_worker.frozen.py').write_text(worker)
s=(BASE/'launch_xolotl_mma_model_trial.frozen.py').read_text()
start=s.index('choices=[');end=s.index('],required=True',start)+1;s=s[:start]+'choices='+repr(list(profiles))+s[end:]
a="worker=(BASE/('xolotl_mma_protocol_worker.frozen.py' if args.mode in ['single-current-mma-control', 'single-current-mma-candidate'] else 'xolotl_protocol_trial_worker.py')).read_bytes()"
if s.count(a)!=1:raise RuntimeError('MMA v2 worker selection differs')
s=s.replace(a,"worker=(BASE/'xolotl_mma_v2_protocol_worker.frozen.py').read_bytes()")
start=s.index("if args.mode in ['single-current-mma-control','single-current-mma-candidate']:");end=s.index('record=dict(unix=time.time(),mode=args.mode',start)
block='''profiles=@PROFILES@
profile=profiles[args.mode]
mc=json.loads((BASE/'xolotl-ptq-mma-integrated-v2-latest.json').read_text())['result.json']
mi=json.loads((BASE/'xolotl-ptq-mma-integrated-v2-intent.json').read_text())
if mc.get('phase')!='qualified' or not mc.get('passed') or set(mc.get('controls',{}))!={'0','1','1-diagnostic'} or mc.get('diagnostic_fixture_histogram')!={'groups':[32,288,32,256,32,256,0,0,288],'entries':4928}:raise RuntimeError('merged dispatch numerical and exact histogram controls must pass')
stage['root']=mi['root'];binary=mc['binaries']['ds41_generate']
plan.update(binary=binary['path'],binary_sha256=binary['sha256'],graph_metadata_mib=1024,split_mmvq='11',ptq_rows_per_warp=4,max_trial_seconds=300,device_verify=False,split_rows=0,draft_depth=5,diagnostic_only=profile['ptq_mma_diagnostics'],**profile)
if profile['original_mtp']:
 sidecar=json.loads((BASE/'xolotl-original-mtp-stage-latest.json').read_text()).get('result.json',{})
 if sidecar.get('phase')!='verified' or not sidecar.get('verified') or sidecar.get('observed_sha256')!='6f3d5b8611ddb3954bb89c09e8890806225715fea90868a6d7ec0ffee5c72082' or sidecar.get('bytes')!=8421868640:raise RuntimeError('complete uploaded original MTP sidecar SHA must pass before model launch')
 plan['sidecar']=sidecar['path'];plan['sidecar_sha256']=sidecar['observed_sha256']
'''.replace('@PROFILES@',repr(profiles))
s=s[:start]+block+s[end:];ast.parse(s);(BASE/'launch_xolotl_mma_v2_model_trial.frozen.py').write_text(s)
observer=(BASE/'observe_xolotl_mma_model_trial.frozen.py').read_text();start=observer.index('choices=[');end=observer.index(']);p.add_argument',start)+1;observer=observer[:start]+'choices='+repr(list(profiles))+observer[end:]
ast.parse(observer);(BASE/'observe_xolotl_mma_v2_model_trial.frozen.py').write_text(observer)
comparison=(BASE/'compare_xolotl_mma_model.py').read_text()
comparison=comparison.replace("names=['single-current-mma-control','single-current-mma-candidate']","names=['single-current-mma-v2-control','single-current-mma-v2-candidate']").replace('xolotl-mma-model-comparison.json','xolotl-mma-v2-model-comparison.json')
ast.parse(comparison);(BASE/'compare_xolotl_mma_v2_model.frozen.py').write_text(comparison)
print('Prepared control/candidate and separate diagnostic/original-MTP profiles; native draft-depth5 cap retained; no unverified weights can launch.')
