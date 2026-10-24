"""Retain merged-dispatch sources, exact controls, resource proof and complete model rounds."""
import base64,hashlib,json,shutil
from xolotl_trial_common import BASE,WORK,jump
dest=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200'
r=json.loads((BASE/'xolotl-ptq-mma-integrated-v2-intent.json').read_text());folder=dest/'frozen-mma/integrated-v2';folder.mkdir(parents=True,exist_ok=True)
groups=[['plan.json','worker.py','process.json','result.json','iq-mma.patch','aster_ptq_mma.cuh','iq_kernels.original.cu','iq_kernels.cu'],['compile.stdout.log','compile.stderr.log','controls-0.stdout.log','controls-0.stderr.log','controls-1.stdout.log','controls-1.stderr.log','controls-1-diagnostic.stdout.log','controls-1-diagnostic.stderr.log','worker.log']]
for names in groups:
 code='''from pathlib import Path
import json,base64,hashlib
r=@R@;root=Path(r['root']);expected={m['file']:m for m in r['files']};out={}
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('merged retention owner differs')
for name in @NAMES@:
 p=root/name
 if not p.exists():continue
 if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>2*1024**2:raise RuntimeError('merged source/log bound differs')
 raw=p.read_bytes()
 if name in expected and (len(raw)!=expected[name]['bytes'] or hashlib.sha256(raw).hexdigest()!=expected[name]['sha256']):raise RuntimeError('merged frozen input SHA differs')
 out[name]=base64.b64encode(raw).decode()
print(json.dumps(out))
'''.replace('@R@',repr(r)).replace('@NAMES@',repr(names))
 for name,b64 in jump(code).items():(folder/name).write_bytes(base64.b64decode(b64))
operators=['prepare_xolotl_ptq_mma_integrated_v2.py','xolotl_ptq_mma_integrated_v2_worker.py','aster_ptq_mma_integrated_v2.cuh','stage_xolotl_ptq_mma_integrated_v2.frozen.py','observe_xolotl_ptq_mma_integrated_v2.frozen.py','prepare_xolotl_mma_v2_model_trials.py','xolotl_mma_v2_protocol_worker.frozen.py','launch_xolotl_mma_v2_model_trial.frozen.py','observe_xolotl_mma_v2_model_trial.frozen.py','compare_xolotl_mma_v2_model.frozen.py','read_xolotl_mma_v2_resources.py','prepare_xolotl_host_thread_trials.py','xolotl_host_thread_protocol_worker.frozen.py','launch_xolotl_host_thread_trial.frozen.py','observe_xolotl_host_thread_trial.frozen.py','compare_xolotl_host_thread_trial.frozen.py','prepare_xolotl_single500_cont2.py','prepare_xolotl_single500_cont2.frozen.py','submit_xolotl_single500_cont2_lease.frozen.py','inspect_xolotl_cont2_startup.py','fetch_xolotl_mtp_ranged_probe.py','stage_xolotl_original_mtp.py','observe_xolotl_original_mtp_stage.py','retain_xolotl_mma_v2.py']
for name in operators:shutil.copy2(BASE/name,dest/'operators'/name)
files=['xolotl-ptq-mma-integrated-v2-intent.json','xolotl-ptq-mma-integrated-v2-latest.json','xolotl-mma-v2-model-comparison.json','xolotl-mma-v2-compiler-resources.json','xolotl-mma-v2-group-diagnostic.json','xolotl-single500-cont1-terminal-proof.json','xolotl-single500-cont2-lease-pending.json','xolotl-cont2-startup-latest.json','xolotl-trial-resource-latest.json','xolotl-original-mtp-ranged-probe-intent.json','xolotl-original-mtp-ranged-probe-latest.json','xolotl-original-mtp-windows-resume1-latest.json','xolotl-original-mtp-stage-intent.json','xolotl-original-mtp-stage-latest.json']
for name in files:
 p=BASE/name
 if p.exists():
  if p.stat().st_size>2*1024**2:raise RuntimeError('merged local receipt bound differs')
  shutil.copy2(p,dest/name)
for mode in ['single-current-mma-v2-control','single-current-mma-v2-candidate','single-current-mma-v2-diagnostic','single-current-mma-v2-original-mtp','single-current-hostthreads-1','single-current-hostthreads-4']:
 for suffix in ['intent','latest','summary']:
  p=BASE/('xolotl-'+mode+'-'+suffix+'.json')
  if p.exists():shutil.copy2(p,dest/p.name)
 for name in ['xolotl-hostthreads-1-comparison.json','xolotl-hostthreads-4-comparison.json']:
  if (BASE/name).exists():shutil.copy2(BASE/name,dest/name)
result=json.loads((folder/'result.json').read_text());comparison=BASE/'xolotl-mma-v2-model-comparison.json'
profile=dict(upstream='https://github.com/Indras-Mirror/Xolotl',license='MIT',binary=result.get('binaries',{}).get('ds41_generate'),parent_iq_sha256=result.get('parent_iq_source_sha256'),patched_iq_sha256=result.get('patched_iq_source_sha256'),header_sha256=result.get('mma_header_sha256'),default_flag='ASTER_XQ_PTQ_MMA=0',candidate_flag='ASTER_XQ_PTQ_MMA=1',diagnostic_flag='ASTER_XQ_PTQ_MMA_DIAGNOSTICS=1',single_uniform_group_kernel=True,original_weight_format_and_scale_arithmetic_preserved=True,no_auxiliary_weight_cache=True,controls_passed=result.get('passed'),strict_control_cases=sum(len(v)-2 for v in result.get('controls',{}).values()),fixture_gpu_histogram=result.get('diagnostic_fixture_histogram'),adopted=False,stable_model_speed_qualified=False,target_300_met=False,target_500_met=False)
if comparison.exists():
 c=json.loads(comparison.read_text(encoding='utf-8'));profile['full_model_pair']=dict(control_tok_s=c['control']['mixed_tok_s'],candidate_tok_s=c['candidate']['mixed_tok_s'],gain_percent=c['mixed_rate_gain_percent'],all_17_pairs_ids_equal=c['all_17_pairs_ids_equal'],all_34_requests_exited_zero_and_reaped=True)
mfile=WORK/'docs/source-manifest.json';m=json.loads(mfile.read_text(encoding='utf-8'));m['original_xolotl_h200_20261024']['ptq_mma_merged_experiment']=profile;mfile.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path=dest.parent/'OUTCOME.md';s=path.read_text(encoding='utf-8');marker='### Single-kernel PTQ dispatch and GPU group counter (2026-10-24)'
if marker not in s and comparison.exists():
 s+=f'''

{marker}

The new exact-UID continuation follows a fresh terminal predecessor guard;
job13500b32-b68b-4d0f-8c70-08cc1e4e5e7d admits20CPU/220GiB/one H200,
with its own fixed one-hour deadline after the CUDA memory round trip.
The prior job/replica terminal proof, submission, startup image-pull events,
physical GPU UUID and resource result are retained. No jobs overlap.

The candidate merges the previous two launches into one group-uniform kernel.
Original R4 arithmetic is factored into a private inline device body; groups
below4 use it, while larger groups use the unchanged exact INT8 MMA body.
Original PTQ blobs/scales and public interfaces remain. The new kernel uses
128 registers,4096 shared bytes and no stack/spills; standalone R4 uses127
registers. A separate template adds one diagnostic counter per logical group,
not per row block. Default0 keeps the old path, and diagnostics are off in
both timing profiles. All18 strict cases pass (off/on/diagnostic). The device
counter exactly matches1184 logical groups and4928 entries from the fixed
synthetic fixture. It works across graph replay and does not copy routing
metadata back to the host. Histogram bins0..7 are exact group sizes; bin8
is8 or more. Real-model diagnostic counters include prompt and decode calls;
their elapsed rate is not used as model-speed qualification.

Each timing profile finishes17 serial requests, exits0 and reaps. All17 paired
token sequences are equal. The new same-binary result is
{c['control']['mixed_tok_s']:.6f}/{c['candidate']['mixed_tok_s']:.6f} tok/s
({c['mixed_rate_gain_percent']:.6f}%). It is one paired round and provides no
stable gain; the candidate stays off and meets neither300 nor500. This does
not establish a hardware ceiling. Complete sources, patch, compiler/link
commands, archive/binary hashes, exact workers and outputs are retained.

Primary pinned engine source clamps served DSpark depth to5. No depth8 test
is launched or claimed. One/four versus16 host threads are separate pending
profiles on the same binary, with CUDA execution and model/routing unchanged.
The original MTP transfer may launch only after complete local SHA validation;
GPFS upload is followed by another complete SHA and immutable publication.
The four complementary HTTP range probes terminate without any complete
64MiB chunk and are not substituted for the live sequential resume. No
model result is claimed for a partial sidecar. No HTTP listener/key is issued.
''';path.write_text(s,encoding='utf-8')
print(json.dumps(dict(retained=True,strict_controls=profile['strict_control_cases'],adopted=False,model_target_met=False)))
