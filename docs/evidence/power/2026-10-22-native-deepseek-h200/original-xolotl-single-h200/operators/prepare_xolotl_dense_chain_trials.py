"""Freeze normal paired and allocator/cache stress trials for the new dense chain."""
import ast
from xolotl_trial_common import BASE
profiles={'single-current-dense-chain-control':dict(dense_async_chain=False,chain_stress=False),'single-current-dense-chain-candidate':dict(dense_async_chain=True,chain_stress=False),'single-current-dense-chain-stress-control':dict(dense_async_chain=False,chain_stress=True),'single-current-dense-chain-stress-candidate':dict(dense_async_chain=True,chain_stress=True)}
worker=(BASE/'xolotl_qsum_protocol_worker.frozen.py').read_text();anchor="    if PLAN.get('ptq_qsum') not in ('0','gu','both'):"
insert='''    if type(PLAN.get('dense_async_chain')) is not bool or type(PLAN.get('chain_stress')) is not bool:raise RuntimeError('dense chain flags must be boolean')
    env['ASTER_XQ_DENSE_ASYNC_CHAIN']='1' if PLAN['dense_async_chain'] else '0'
    if PLAN['chain_stress']:env['DS41_GRAPH_REUSE']='0'
'''+anchor
if worker.count(anchor)!=1:raise RuntimeError('dense worker flag anchor differs')
worker=worker.replace(anchor,insert);ast.parse(worker);p=BASE/'xolotl_dense_chain_protocol_worker.frozen.py'
if p.exists():raise RuntimeError('dense-chain protocol worker already frozen')
p.write_text(worker)
s=(BASE/'launch_xolotl_qsum_v2_model_trial.frozen.py').read_text();a=s.index('choices=[');b=s.index('],required=True',a)+1;s=s[:a]+'choices='+repr(list(profiles))+s[b:]
s=s.replace("BASE/'xolotl_qsum_protocol_worker.frozen.py'","BASE/'xolotl_dense_chain_protocol_worker.frozen.py'")
a=s.index('\nprofiles={')+1;b=s.index('record=dict(unix=time.time(),mode=args.mode',a)
block='''profiles=@PROFILES@
profile=profiles[args.mode]
mc=json.loads((BASE/'xolotl-dense-chain-v2-build-latest.json').read_text())['result.json']
if mc.get('phase')!='built' or not mc.get('passed') or not mc.get('hermetic_fence_tests_passed'):raise RuntimeError('private dense build and lifetime tests must pass')
stage['root']=lease()['remote']+'/xolotl-dense-chain-trials';binary=mc['binary']
plan.update(binary=binary['path'],binary_sha256=binary['sha256'],graph_metadata_mib=256 if profile['chain_stress'] else1024,split_mmvq='11',ptq_rows_per_warp=4,max_trial_seconds=600 if profile['chain_stress'] else300,device_verify=False,split_rows=0,draft_depth=5,diagnostic_only=profile['chain_stress'],ptq_mma=False,ptq_mma_diagnostics=False,original_mtp=False,ptq_qsum='0',**profile)
if profile['chain_stress']:plan['cases']=[c for c in plan['cases'] if c['name'] in ['code-128','prose-128','arithmetic']]
'''.replace('@PROFILES@',repr(profiles)).replace('else1024','else 1024').replace('else300','else 300')
s=s[:a]+block+s[b:]
anchor="root=Path(r['root'])\nif root.parent.resolve()!=root.parent"
replacement="root=Path(r['root'])\nif root.parent.parent.resolve()!=root.parent.parent or root.parent.parent.stat().st_uid!=os.getuid():raise RuntimeError('dense trial lease parent differs')\nif not root.parent.exists():root.parent.mkdir(mode=0o700)\nif root.parent.resolve()!=root.parent"
if s.count(anchor)!=1:raise RuntimeError('new-lease trial staging anchor differs')
s=s.replace(anchor,replacement);ast.parse(s);(BASE/'launch_xolotl_dense_chain_trial.frozen.py').write_text(s)
s=(BASE/'observe_xolotl_qsum_v2_model_trial.frozen.py').read_text();a=s.index('choices=[');b=s.index(']);p.add_argument',a)+1;s=s[:a]+'choices='+repr(list(profiles))+s[b:];ast.parse(s);(BASE/'observe_xolotl_dense_chain_trial.frozen.py').write_text(s)
s=(BASE/'compare_xolotl_qsum_model.frozen.py').read_text();s=s.replace("p.add_argument('--candidate',choices=['gu','both'],required=True)","p.add_argument('--candidate',choices=['normal','stress'],required=True)")
s=s.replace("names=['single-current-qsum-control','single-current-qsum-'+args.candidate]","names=['single-current-dense-chain-'+('stress-' if args.candidate=='stress' else '')+'control','single-current-dense-chain-'+('stress-' if args.candidate=='stress' else '')+'candidate']")
s=s.replace("len(r['requests'])!=17","len(r['requests'])!=(9 if args.candidate=='stress' else17)").replace('else17','else 17')
s=s.replace("[p.pop('ptq_qsum') for p in plans]!=['0',args.candidate]","[p.pop('dense_async_chain') for p in plans]!=[False,True]")
s=s.replace('explicit qsum flag','explicit dense asynchronous-chain flag').replace('same binary with qsum0/','same binary with dense-chain0/1; ')
s=s.replace("'xolotl-qsum-'+args.candidate+'-model-comparison.json'","'xolotl-dense-chain-'+args.candidate+'-comparison.json'")
ast.parse(s);(BASE/'compare_xolotl_dense_chain.frozen.py').write_text(s)
print('Prepared only: normal17-request pair, separate9-request allocator/cache stress, default-off dense chain; new trials stage under the fresh lease while reusing an immutable binary.')
