"""Launch once against the fresh owned pair; a single visible GPU by default."""
import argparse,base64,hashlib,json,time
from xolotl_trial_common import BASE,lease,owned
p=argparse.ArgumentParser();p.add_argument('--mode',choices=['single-current-dense-chain-v3-control', 'single-current-dense-chain-v3-candidate', 'single-current-dense-chain-v3-stress-control', 'single-current-dense-chain-v3-stress-candidate'],required=True);args=p.parse_args()
recordpath=BASE/('xolotl-'+args.mode+'-intent.json')
if recordpath.exists():raise RuntimeError('trial intent exists; observe it, do not repeat')
stage=json.loads((BASE/'xolotl-b345-stage-result.json').read_text())
engram_root=stage['root']+'/engram'
if args.mode.startswith('single-current-'):
 qualification=json.loads((BASE/'xolotl-current-build-hardware-controls.json').read_text())
 build=json.loads((BASE/'xolotl-current-build-latest.json').read_text())['build-result.json']
 if not qualification['passed'] or build['phase']!='built':raise RuntimeError('rebuilt engine requires completed build and real CUDA controls')
 current=json.loads((BASE/'xolotl-h200-current-build-intent.json').read_text())
 stage.update(root=current['root'],engine_revision=current['source_revision'],binary_sha256=build['binaries']['ds41_generate']['sha256'])
obs=json.loads((BASE/'xolotl-trial-resource-latest.json').read_text())
inputs=json.loads((BASE/'xolotl-trial-prompt-ids.json').read_text(encoding='utf-8'))
assets='/mnt/shared-storage-user/yangchao/Workspace/aster-h200-xq'
plan=dict(engine_revision=stage['engine_revision'],binary=stage['root']+'/engine/build-h200/ds41_generate',binary_sha256=stage['binary_sha256'],model=assets+'/native-payload-73df1934302f/V41-XQ-1017-v3.gguf',model_sha256='73df1934302f867601dd27f7fca59109d9b11674f50cc60526ec2a1cd4f3d389',rank=assets+'/assets/v3/rank-1017-v3.bin',sidecar=assets+'/assets/V41-MTP-Vision-1017.Q2_K.gguf',engram=stage['root']+'/engram',visible_devices='0,1' if args.mode.startswith('pair-') else '0',dspark=args.mode.endswith('-dspark'),lease_ends_unix=obs['resource-result.json']['leaseEndsUnix'],cases=inputs['cases'])
worker=(BASE/'xolotl_dense_chain_protocol_worker.frozen.py').read_bytes()
if args.mode in ['single-current-profile-prose','single-current-profile-prose-v2']:
 if not json.loads((BASE/'xolotl-nsys-stdio-check.json').read_text())['passed']:raise RuntimeError('Nsight protocol forwarding is unverified')
 worker=(BASE/('xolotl_nsys_protocol_worker_v2.frozen.py' if args.mode.endswith('-v2') else 'xolotl_nsys_protocol_worker.frozen.py')).read_bytes()
plan['arena_gib']=160 if '-resident-' in args.mode else 60
plan['dspark']='dspark' in args.mode
if args.mode.startswith('single-current-'):
 plan.update(binary=build['binaries']['ds41_generate']['path'],engram=engram_root,arena_gib=160,dspark=True,campaign='broad-warm-v1',draft_depth=5,d3_prefetch=0,draft_confidence=0.45,graph_metadata_mib=1024 if '-cache1024' in args.mode else 256,async_attn_readback=args.mode.endswith('-async'))
 if args.mode in ['single-current-profile-prose','single-current-profile-prose-v2']:plan.update(graph_metadata_mib=1024,diagnostic_only=True,profile='nsys-interactive-v1')
if '-warm-d' in args.mode:
 plan.update(dspark=True,campaign='broad-warm-v1',draft_depth=5 if '-d5' in args.mode else 4)
 if '-pf0' in args.mode:plan['d3_prefetch']=0
 if args.mode.endswith('-conf06'):plan['draft_confidence']=0.6
 if args.mode.endswith('-conf045'):plan['draft_confidence']=0.45
if args.mode.endswith(('-r2','-r4')):plan['expert_rows_per_warp']=2 if args.mode.endswith('-r2') else 4
if args.mode.startswith('single-current-split-'):
 split_controls=json.loads((BASE/'xolotl-split-build-hardware-controls.json').read_text()).get('controls-result.json',{})
 split_build=json.loads((BASE/'xolotl-split-build-latest.json').read_text())['build-result.json']
 if not split_controls.get('passed') or split_build['phase']!='built':raise RuntimeError('split kernel hardware controls must pass before model launch')
 split_intent=json.loads((BASE/'xolotl-h200-split-build-intent.json').read_text())
 stage['root']=split_intent['root']
 plan['max_trial_seconds']=900
 plan.update(binary=split_build['binaries']['ds41_generate']['path'],binary_sha256=split_build['binaries']['ds41_generate']['sha256'],graph_metadata_mib=1024,split_mmvq='both' if args.mode.endswith('-both') else '0')
profiles={'single-current-dense-chain-v3-control': {'dense_async_chain': False, 'chain_stress': False}, 'single-current-dense-chain-v3-candidate': {'dense_async_chain': True, 'chain_stress': False}, 'single-current-dense-chain-v3-stress-control': {'dense_async_chain': False, 'chain_stress': True}, 'single-current-dense-chain-v3-stress-candidate': {'dense_async_chain': True, 'chain_stress': True}}
profile=profiles[args.mode]
mc=json.loads((BASE/'xolotl-dense-chain-v3-build-latest.json').read_text())['result.json']
if mc.get('phase')!='built' or not mc.get('passed') or not mc.get('hermetic_fence_tests_passed'):raise RuntimeError('private dense build and lifetime tests must pass')
gpu_regression=json.loads((BASE/'xolotl-dense-external-regression-result.json').read_text())
if not gpu_regression.get('passed'):raise RuntimeError('actual CUDA external readback controls must pass')
stage['root']=lease()['remote']+'/xolotl-dense-chain-trials';binary=mc['binary']
plan.update(binary=binary['path'],binary_sha256=binary['sha256'],graph_metadata_mib=256 if profile['chain_stress'] else 1024,split_mmvq='11',ptq_rows_per_warp=4,max_trial_seconds=600 if profile['chain_stress'] else 300,device_verify=False,split_rows=0,draft_depth=5,diagnostic_only=profile['chain_stress'],ptq_mma=False,ptq_mma_diagnostics=False,original_mtp=False,ptq_qsum='0',**profile)
if profile['chain_stress']:plan['cases']=[c for c in plan['cases'] if c['name'] in ['code-128','prose-128','arithmetic']]
record=dict(unix=time.time(),mode=args.mode,phase='prepared',root=stage['root']+'/'+args.mode,plan=plan,worker_sha256=hashlib.sha256(worker).hexdigest(),job=obs['job'],job_uid=obs['job_uid'],replica=obs['replicas'][0]['name'],replica_uid=obs['replicas'][0]['uid'])
recordpath.write_text(json.dumps(record,indent=2)+'\n')
code='''import json,base64,hashlib,os,subprocess,time
from pathlib import Path
r=@RECORD@
root=Path(r['root'])
if root.parent.parent.resolve()!=root.parent.parent or root.parent.parent.stat().st_uid!=os.getuid():raise RuntimeError('dense trial lease parent differs')
if not root.parent.exists():root.parent.mkdir(mode=0o700)
if root.parent.resolve()!=root.parent or root.parent.stat().st_uid!=os.getuid() or root.exists():raise RuntimeError('trial stage identity/exclusivity changed')
binary=Path(r['plan']['binary'])
if hashlib.sha256(binary.read_bytes()).hexdigest()!=r['plan']['binary_sha256']:raise RuntimeError('trial executable identity differs')
proof=json.loads((root.parent.parent/'resource-result.json').read_text())
if proof['phase']!='passed' or proof['leaseEndsUnix']!=r['plan']['lease_ends_unix']:raise RuntimeError('immutable resource proof differs')
active=subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,check=True,timeout=8)
if active.stdout.strip():raise RuntimeError('another GPU workload must finish before trial')
root.mkdir(mode=0o700)
raw=base64.b64decode(@WORKER@)
if hashlib.sha256(raw).hexdigest()!=r['worker_sha256']:raise RuntimeError('trial worker differs')
(root/'worker.py').write_bytes(raw)
(root/'plan.json').write_text(json.dumps(r['plan'],indent=2)+'\\n')
with (root/'worker.log').open('xb',buffering=0) as log:
 child=subprocess.Popen(['timeout','--signal=TERM','--kill-after=30',str(r['plan'].get('max_trial_seconds',1800)+50),'python3','-u',str(root/'worker.py')],cwd=root,stdout=log,stderr=log,start_new_session=True)
 ticks=int(Path('/proc/'+str(child.pid)+'/stat').read_text().split(') ',1)[1].split()[19])
process=dict(pid=child.pid,start_ticks=ticks,uid=os.getuid(),unix=time.time(),deadline_seconds=r['plan'].get('max_trial_seconds',1800)+50)
(root/'process.json').write_text(json.dumps(process,indent=2)+'\\n')
print(json.dumps(process))
'''.replace('@RECORD@',repr(record)).replace('@WORKER@',repr(base64.b64encode(worker).decode()))
record['phase']='launch_requested';recordpath.write_text(json.dumps(record,indent=2)+'\n')
record['process']=owned(code)
record['phase']='launched';recordpath.write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(dict(mode=args.mode,phase=record['phase'],root=record['root'],process=record['process']),indent=2))
