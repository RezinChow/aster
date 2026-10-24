"""Retain exact standalone MMA sources, strict numerical gates, and regressions."""
import base64,hashlib,json,shutil,statistics
from xolotl_trial_common import BASE,WORK,jump
dest=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200'
versions=['prototype','v2','v3','v4','v5','v6','v7','v8','v9','v10','v11','v12','v13','v14','v15'];records=[]
for version in versions:
 prefix='xolotl-ptq-mma-'+version
 for suffix in ['intent','latest']:
  p=BASE/(prefix+'-'+suffix+'.json')
  if p.stat().st_size>2*1024**2:raise RuntimeError('MMA evidence bound exceeded')
  shutil.copy2(p,dest/p.name)
 r=json.loads((BASE/(prefix+'-intent.json')).read_text());records.append(dict(version=version,root=r['root'],files=r['files']))
code='''from pathlib import Path
import json,hashlib,base64
records=@RECORDS@;out={}
for r in records:
 root=Path(r['root'])
 if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('MMA source owner differs')
 expected={m['file']:m for m in r['files']};data={}
 for name in ['prototype.cu','worker.py','plan.json','result.json','process.json','worker.log','compile.stdout.log','compile.stderr.log','link.stderr.log','gpu.stdout.log','gpu.stderr.log']:
  p=root/name
  if not p.exists():continue
  if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>262144:raise RuntimeError('frozen MMA artifact bound differs')
  raw=p.read_bytes()
  if name in expected and (len(raw)!=expected[name]['bytes'] or hashlib.sha256(raw).hexdigest()!=expected[name]['sha256']):raise RuntimeError('frozen MMA input SHA differs')
  data[name]=base64.b64encode(raw).decode()
 out[r['version']]=data
print(json.dumps(out))
'''.replace('@RECORDS@',repr(records))
raw=jump(code)
for version,files in raw.items():
 folder=dest/'frozen-mma'/version;folder.mkdir(parents=True,exist_ok=True)
 for name,data in files.items():(folder/name).write_bytes(base64.b64decode(data))
ops=['inspect_xolotl_mma_build_commands.py','aster_ptq_mma_prototype.cu','stage_xolotl_ptq_mma_prototype.py','observe_xolotl_ptq_mma_prototype.py','xolotl_ptq_mma_prototype_worker.frozen.py','retain_xolotl_mma_prototypes.py','prepare_xolotl_single500_cont1.py','prepare_xolotl_single500_cont1.frozen.py','submit_xolotl_single500_cont1_lease.frozen.py','retire_xolotl_single300_for_cont1.py','retire_xolotl_single300_for_cont1.frozen.py','persist_xolotl_300_next_iteration.py','check_xolotl_original_mtp_windows.py','fetch_xolotl_original_mtp_windows.py','probe_xolotl_original_mtp_ranges.py','probe_xolotl_mtp_cdn_jump.py','resume_xolotl_original_mtp_windows.py']
for version in versions[1:]:
 ops+=['aster_ptq_mma_prototype_'+version+'.cu','prepare_xolotl_ptq_mma_'+version+'.py','stage_xolotl_ptq_mma_'+version+'.frozen.py','observe_xolotl_ptq_mma_'+version+'.frozen.py','xolotl_ptq_mma_'+version+'_worker.frozen.py']
ops+=['retain_xolotl_frozen_workers.py','retain_xolotl_trial_evidence.py']
for name in ops:
 if (BASE/name).exists():shutil.copy2(BASE/name,dest/'operators'/name)
for name in ['xolotl-mma-parent-build-commands.json','xolotl-single300-retired-for-cont1.json','xolotl-single500-cont1-lease-pending.json','xolotl-trial-resource-latest.json','xolotl-original-mtp-windows-network-check.json','xolotl-300-next-iteration.json','xolotl-original-mtp-range-probe.json','xolotl-original-mtp-windows-download-intent.json','xolotl-original-mtp-windows-download-latest.json','xolotl-original-mtp-cdn-jump-probe.json','xolotl-original-mtp-windows-resume1-intent.json','xolotl-original-mtp-windows-resume1-latest.json']:
 if (BASE/name).exists():shutil.copy2(BASE/name,dest/name)
results={v:json.loads((BASE/('xolotl-ptq-mma-'+v+'-latest.json')).read_text())['result.json'] for v in versions}
passed=sum(len(r.get('cases',[])) for r in results.values() if r.get('passed'))
summary=dict(versions={v:dict(phase=r['phase'],passed=r['passed'],binary=r.get('binary'),cases=r.get('cases',[]),timing_scope=r.get('timing_scope')) for v,r in results.items()},strict_hardware_cases_passed=passed,integrated_into_model_engine=False,model_speed_qualified=False,target_300_met=False,target_500_met=False)
summary['v13_l2_evicted_summary']=[dict(H=c['H'],FF=c['FF'],groups=c['groups'],tokens=c['tokens'],pairs=len(c['cold_reference_us']),reference_median_us=statistics.median(c['cold_reference_us']),candidate_median_us=statistics.median(c['cold_mma_us']),median_rate_gain_percent=100*(statistics.median(c['cold_reference_us'])/statistics.median(c['cold_mma_us'])-1),eviction_bytes=c['l2_eviction_bytes']) for c in results['v13']['cases']]
(BASE/'xolotl-mma-prototype-comparison.json').write_text(json.dumps(summary,indent=2)+'\n');shutil.copy2(BASE/'xolotl-mma-prototype-comparison.json',dest/'xolotl-mma-prototype-comparison.json')
path=WORK/'docs/source-manifest.json';m=json.loads(path.read_text(encoding='utf-8'))
m['original_xolotl_h200_20261024']['ptq_mma_research']=dict(upstream='https://github.com/Indras-Mirror/Xolotl',ggml_revision='3cf03257f219afbe7334045ff7c6a06ac68c627d',license='MIT',reference='https://docs.nvidia.com/cuda/parallel-thread-execution/index.html#matrix-multiply-accumulate-operation-using-mma-instruction',scope='Standalone SM90 PTQ1_0 gate/up phase1; FP16 or INT8 encodes exact integer codes, original FP32 scales and reduction order retained; V6+ reports auxiliary code-cache bytes/preparation separately from warm timing',versions=list(results),strict_hardware_cases_passed=passed,integrated_into_model_engine=False,adopted=False,single_h200_300_tok_s_qualified=False,single_h200_500_tok_s_qualified=False)
path.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path=dest.parent/'OUTCOME.md';s=path.read_text(encoding='utf-8');marker='### Standalone SM90 TensorCore ternary-code prototype (2026-10-24)'
if marker not in s:
 s+='''

### Standalone SM90 TensorCore ternary-code prototype (2026-10-24)

The previous goal turn made progress through actual same-binary full-model
tests; no300/500 milestone was met. This turn changes no model-serving path.
A standalone CUDA prototype uses `mma.sync.aligned.m16n8k16` with FP16
representations of integer ternary/q8 codes, original FP32 scales, and the
old per-lane block pairing/butterfly. Parent Xolotl/ggml MIT notices remain.
The exact parent fixture, libraries, compile/link commands, source hashes,
worker, outputs and receipts are retained. Compilation is GPU-free,
CUDA12.6.20, C++20, O3, SM90; GPU controls expose exactly one H200.

V1 refuses at compilation because NVCC cannot deduce a mixed initializer-list
range. V2 uses an explicit typed shape array in a separate fresh root; no GPU
result is claimed for V1. V2..V5 each pass all6 controls (24 total): actual
5120x2304 and1024x512 expert geometries, zero-sized groups, scattered input
tokens, unused output rows, and windows1/3/5/8. Every gate/up float is bitwise
equal to the existing R4 path; post-SwiGLU q8 bytes are identical; finite and
NaN sentinel checks pass. No tolerance is loosened. These are synthetic
phase1 results, not generated-token/model quality qualification.

Same phase1 functionality includes input quantization, gate/up, SwiGLU and
q8 output; the candidate additionally writes a temporary h row. One warm
launch plus20 CUDA-event timed repeats per side are retained; no model tok/s
is inferred. At7 groups/window5, baseline/candidate microseconds:
V2 138.2896/330.2976; V3 138.6832/322.3936;
V4 138.3072/337.5040; V5 138.3248/335.2896. All are slower.

V2 retains a512-byte local frame on the main shape. V3 makes reduction
indices compile-time constants, removes local frames/spills, but uses254
registers. V4 keeps only five pending binary-tree levels in bit-reversed
leaf order; every numerical gate still passes, but the compiler spills
1092 bytes at128 registers (736-byte stack). V5 adds a compiler memory
clobber at the MMA operand boundary; it does not remove those spills or
reverse the regression. It uses shorter120/30/90-second compile/link/GPU
budgets and300-second outer cleanup, retaining all6 cases and20 repeats
inside the current immutable resource deadline.

The prototypes are not integrated or adopted. The broad single-request
 baseline remains about95 tok/s in the last full-model test (transport single-pair
96.2650 is still not stable-speed qualification).300 and500 remain unmet.
Next investigation must separate packed-weight decoding from matrix work;
the current tests do not establish a hardware upper bound or that Tensor
Cores alone can deliver either target. No endpoint/key is delivered.
'''
 path.write_text(s,encoding='utf-8')
marker='### Exact INT8 MMA and L2-evicted controls (2026-10-24)'
s=path.read_text(encoding='utf-8')
if marker not in s:
 s+='''

### Exact INT8 MMA and L2-evicted controls (2026-10-24)

V6..V9 retain all six strict cases, but regress. V6/V7 predecode synthetic
GU codes to FP16, excluding preparation from timing and reporting the extra
332881920-byte seven-group footprint. Window5 reference/candidate times
are138.9008/238.8208us and138.6400/215.4160us. These expanded diagnostics
do not fit an all-model single-H200 cache and are not adopted. V8 stores
two ternary codes per nibble, retaining original half scales:34/28 of
the original GU bytes,43868160 bytes for seven full-size experts. A shared
lookup causes severe spills and138.9920/1238.6912us at window5. V9 switches
to a warp-register lookup but still spills:138.9296/1223.0719us. Neither
enters the model engine.

V10 uses exact INT8 codes/INT32 MMA, retaining original FP32 scale arithmetic
and old leaf pairing/butterfly in a bounded loop. No model weights/scales
are rounded or changed. It removes spills but window5 is138.4016/147.3360us.
V11 partitions that same tree among four cooperating warps:64 registers,
4096 shared bytes, no spills; window5 is138.7792/123.8512us. V12 losslessly
uses signed two-bit code fields and shift/mask expansion instead of base3
division. All81 valid four-code word combinations pass a host exhaust.
Its window5 is138.4624/92.9808us and window8 is209.2240/93.5856us; window1
and3 remain slower. V10..V12 each pass all six strict GPU cases unchanged.

V13 keeps V12 arithmetic unchanged. It reads twice the device-reported L2
size through a volatile global buffer, with an observable atomic result,
before each CUDA-event interval;125829120 bytes are read. Eviction cost is
excluded. All ten alternating reference/candidate pairs in each of six
cases are retained. This is a cache-eviction control, not a full-model
working-set or token-speed test. All six strict checks pass. Window5
medians are in the retained comparison JSON (about140.8/97.1us), window8
about211.7/97.6us; small windows1/3 still regress. Preparation (~0.45ms for
seven groups) and the21.4% larger GU code-cache bytes remain outside these
phase1 intervals and must be included in any model integration decision.

V2..V13 now retain72 strict GPU cases: zero differing gate/up floats,
identical post-SwiGLU q8 bytes, finite written outputs and untouched NaN
sentinels. These prototypes change no serving path and qualify neither300
nor500 tok/s. The last full-model measurements remain94.9975 control and
96.2650 transport experiment on the previous single-H200 allocation;
the latter is one pair and is not a stable speed qualification.

The previous single-H200 job/replica reached Stopped before submission
of the continuation job. The new exact-UID single-H200 allocation proof
and immutable15:21:12 +08 deadline are retained; there is no resource
overlap, HTTP listener or API key. An anonymous Windows metadata probe
can now reach the pinned public original MTP sidecar (8421868640 bytes).
Download/hash/transfer and model qualification have separate receipts;
this HEAD response alone establishes none of them.
'''
 path.write_text(s,encoding='utf-8')
print(json.dumps(dict(retained=True,versions=len(results),strict_gpu_cases=passed,adopted=False,model_target_met=False)))
