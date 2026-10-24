"""Retain exact default-off dispatch sources and real numerical controls."""
import base64,hashlib,json,shutil
from xolotl_trial_common import BASE,WORK,jump
dest=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200'
stopfile=BASE/'xolotl-cont1-retired-after-mma.json'
if stopfile.exists():
 stop=json.loads(stopfile.read_text());observation=json.loads((BASE/'xolotl-trial-resource-latest.json').read_text())
 if observation['job_uid']!=stop['job_uid'] or len(observation['replicas'])!=1 or observation['replicas'][0]['uid']!=stop['replica_uid']:raise RuntimeError('terminal resource identity differs')
 if observation['phase']!='Stopped' or observation['replicas'][0]['phase']!='Stopped':raise RuntimeError('exact continuation allocation is not yet terminal')
 stop['terminal_observation']=dict(unix=observation['unix'],job_phase='Stopped',replica_phase='Stopped',job_uid=observation['job_uid'],replica_uid=observation['replicas'][0]['uid']);stop['phase']='terminal_confirmed'
 stopfile.write_text(json.dumps(stop,indent=2)+'\n')
intent=json.loads((BASE/'xolotl-ptq-mma-integrated-intent.json').read_text())
code='''from pathlib import Path
import base64,json,hashlib
r=@R@;root=Path(r['root'])
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('integrated retention owner differs')
expected={m['file']:m for m in r['files']};out={}
for name in ['plan.json','worker.py','process.json','result.json','iq-mma.patch','aster_ptq_mma.cuh','iq_kernels.original.cu','iq_kernels.cu','compile.stdout.log','compile.stderr.log','controls-0.stdout.log','controls-0.stderr.log','controls-1.stdout.log','controls-1.stderr.log','worker.log']:
 p=root/name
 if not p.exists():continue
 if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>524288:raise RuntimeError('integrated frozen file bound differs')
 raw=p.read_bytes()
 if name in expected and (len(raw)!=expected[name]['bytes'] or hashlib.sha256(raw).hexdigest()!=expected[name]['sha256']):raise RuntimeError('integrated frozen input hash differs')
 out[name]=base64.b64encode(raw).decode()
print(json.dumps(out))
'''.replace('@R@',repr(intent))
raw=jump(code);folder=dest/'frozen-mma/integrated';folder.mkdir(parents=True,exist_ok=True)
for name,b64 in raw.items():(folder/name).write_bytes(base64.b64decode(b64))
for name in ['xolotl_ptq_mma_integrated_worker.py','stage_xolotl_ptq_mma_integrated.py','observe_xolotl_ptq_mma_integrated.py','aster_ptq_mma_integrated.cuh','prepare_xolotl_mma_model_trials.py','xolotl_mma_protocol_worker.frozen.py','launch_xolotl_mma_model_trial.frozen.py','observe_xolotl_mma_model_trial.frozen.py','retain_xolotl_mma_integrated.py','compare_xolotl_mma_model.py','retire_xolotl_cont1_after_mma.py','retire_xolotl_cont1_after_mma.frozen.py']:
 shutil.copy2(BASE/name,dest/'operators'/name)
for name in ['xolotl-ptq-mma-integrated-intent.json','xolotl-ptq-mma-integrated-latest.json']:
 shutil.copy2(BASE/name,dest/name)
for name in ['xolotl-mma-model-comparison.json','xolotl-cont1-retired-after-mma.json','xolotl-trial-resource-latest.json']:
 if (BASE/name).exists():shutil.copy2(BASE/name,dest/name)
for mode in ['single-current-mma-control','single-current-mma-candidate']:
 for suffix in ['intent','latest','summary']:
  p=BASE/('xolotl-'+mode+'-'+suffix+'.json')
  if p.exists():shutil.copy2(p,dest/p.name)
r=json.loads((folder/'result.json').read_text());mfile=WORK/'docs/source-manifest.json';m=json.loads(mfile.read_text(encoding='utf-8'))
m['original_xolotl_h200_20261024']['ptq_mma_integrated_experiment']=dict(upstream='https://github.com/Indras-Mirror/Xolotl',license='MIT',parent_archive_sha256='92867ada2ab31266c43d1afd855d99a7c7349039c5b20fae417a4abadbf10287',binary=r.get('binaries',{}).get('ds41_generate'),patched_iq_source_sha256=r.get('patched_iq_source_sha256'),header_sha256=r.get('mma_header_sha256'),default_flag='ASTER_XQ_PTQ_MMA=0',candidate_flag='ASTER_XQ_PTQ_MMA=1',shape=dict(gu_type=143,n_embd=5120,n_ff=2304,group_entries_threshold=4),no_auxiliary_weight_cache=True,existing_small_group_kernel_retained=True,controls_passed=r.get('passed',False),strict_control_cases=sum(len(rows)-2 for rows in r.get('controls',{}).values()),integrated_into_experimental_binary=True,adopted=False,single_request_model_speed_qualified=False,target_300_met=False,target_500_met=False)
comparison=BASE/'xolotl-mma-model-comparison.json'
if comparison.exists():
 c=json.loads(comparison.read_text(encoding='utf-8'))
 m['original_xolotl_h200_20261024']['ptq_mma_integrated_experiment']['full_model_pair']=dict(control_tok_s=c['control']['mixed_tok_s'],candidate_tok_s=c['candidate']['mixed_tok_s'],gain_percent=c['mixed_rate_gain_percent'],all_17_pairs_ids_equal=c['all_17_pairs_ids_equal'],all_34_requests_exited_zero_and_reaped=True,stable_speed_qualified=False)
mfile.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path=dest.parent/'OUTCOME.md';s=path.read_text(encoding='utf-8');marker='### Original-PTQ TensorCore engine A/B (2026-10-24)'
if marker not in s and comparison.exists():
 s+='''

### Original-PTQ TensorCore engine A/B (2026-10-24)

V14 decodes original PTQ bytes directly, with no auxiliary weight storage
or preparation. All six strict GPU checks pass, but window5 regresses:
138.5520/182.9392us reference/candidate. V15 replaces each repeated modular
multiply-by3 loop with an exact power and unrolls the four q8 subblocks.
All1280 byte/depth states pass a host exhaust; all six strict GPU controls
pass. Window5 is138.6544/98.8912us, and window8 is209.1920/100.0048us.
Ten alternating L2-evicted pairs per case are retained as in V13. Small
windows1/3 remain slower. V2..V15 total84 strict standalone GPU cases.

A fresh opt-in experiment integrates this original-PTQ GU path into the
existing native expert dispatch. Small groups (<4 entries) retain the old
R4 kernel; larger groups use INT8/INT32 MMA. It applies only to type143,
5120x2304 gate/up with the existing R4 mode and no LoRA. Other paths,
down projection and the existing SwiGLU/q8 implementation remain. There
is no changed weight, scale, GPU cache blob format, CPU interface or public
Rust API. `ASTER_XQ_PTQ_MMA` defaults0; only0/1 are accepted. Both flag
modes pass six exact controls (12 integrated checks), including empty
groups, input scattering, partial8-column windows and unchanged sentinels.

The immutable parent archive is copied into a new owner-only directory;
one rebuilt CUDA object replaces its matching archive member. The old
source, libraries and engine are not mutated. Full original/patched source,
header, diff, worker, compile/link commands, archive/binary hashes, outputs
and resource receipts are retained. Both full-model tests use binary
fc958d782461c3d87747da94cb5c394de6b672c596429cc52dcc876c8c513443.
The only plan difference is the new flag. Context is actually4096, one
visible physical H200, unchanged main model/rank/Q2_K MTP/Engram, DSpark
depth5/confidence0.45, graph metadata1024MiB, no route bias/skip/file.

Control/candidate each finish17 serial requests with exit0 and a reaped
engine; all17 paired token sequences are identical. Across12 measured
requests, mixed real generated-token rates are94.691953/94.210710 tok/s
(-0.508220%). Counts129.1932/128.6713, code114.7562/114.3245,
English78.9250/78.3334 and Chinese91.0274/90.7075 tok/s. Warmups and
arithmetic42 are retained separately. This one paired round establishes
no stable gain and meets neither300 nor500. The candidate stays off.
The local GU microbenchmark improvement is not a model-speed improvement.

Next investigation must account for small-group distribution and the cost
of the additional dispatch. A single-kernel uniform group branch has not
been implemented or tested. The original-precision MTP sidecar is also
being fetched anonymously to the local workstation: the first bounded
600-second transfer times out with a retained1280141744-byte prefix.
After its PID is terminal, a separate3600-second bounded resume preserves
and hashes that prefix, resumes the pinned revision, and requires the
complete8421868640-byte SHA256 before any transfer/model test. This is
the auxiliary MTP file; the163GB main quantized model is already present
and loaded successfully. No result is claimed for the partial sidecar.

After all research workers and both model engines finish, GPU idle is
verified, and only exact job51cd429c-43d9-45bf-a38f-ff8eabca2809 and its
replica are stopped. A subsequent exact-UID observation confirms both
Stopped. No HTTP listener/key is delivered. A new GPU allocation requires
fresh terminal-predecessor and ownership/resource proofs.
'''
 path.write_text(s,encoding='utf-8')
print(json.dumps(dict(retained=True,phase=r.get('phase'),controls_passed=r.get('passed'),model_speed_qualified=False)))
