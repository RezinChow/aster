"""Retain public operators, receipts and short load evidence, never credential content."""
import base64,hashlib,json,shutil,time
from pathlib import Path
from xolotl_trial_common import BASE,WORK,jump
d=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200';dest=d/'stable-serving';dest.mkdir(parents=True,exist_ok=True)
ops=['prepare_xolotl_stable_serving.py','submit_xolotl_single_serving_lease.frozen.py','xolotl_serving_common.py','prepare_xolotl_serving_bundle.py','stage_xolotl_serving_bundle.py','xolotl_stable_service_worker.py','launch_xolotl_stable_service.py','observe_xolotl_stable_service.py','repair_xolotl_serving_artifacts_v2.py','xolotl_stable_service_worker_v2.frozen.py','observe_xolotl_stable_service_v2.frozen.py','xolotl_serving_tunnel_worker.py','launch_xolotl_serving_tunnel.py','qualify_xolotl_stable_service.py','loadtest_xolotl_stable_windows.py','persist_xolotl_stable_delivery.py','retain_xolotl_stable_service.py']
for n in ops:shutil.copy2(BASE/n,d/'operators'/n)
files=['xolotl-two-role-deployment-plan.json','xolotl-single-serving-lease-pending.json','xolotl-serving-resource-latest.json','xolotl-serving-bundle-manifest.json','xolotl-stable-service-stage.json','xolotl-stable-service-intent.json','xolotl-stable-service-v2-intent.json','xolotl-stable-service-latest.json','xolotl-stable-service-v2-latest.json','xolotl-stable-access-tunnel-intent.json','xolotl-stable-access-tunnel-plan.json','xolotl-stable-access-tunnel-status.json','xolotl-stable-service-windows-qualification.json','xolotl-stable-service-gpu-inspection.json','xolotl-stable-service-live-gpu-proof.json','xolotl-stable-service-delivery.json','xolotl-stable-windows-loadtest.json','xolotl-serving-active-state-updates.json','old-native-endpoint-live-check.json']
for n in files:
 p=BASE/n
 if p.exists():
  if p.stat().st_size>2*1024**2:raise RuntimeError('bounded public service receipt exceeded')
  shutil.copy2(p,dest/n)
r=json.loads((BASE/'xolotl-stable-service-v2-intent.json').read_text())
names=['service-worker.py','service-worker-v2.py','service-plan.json','server-config.json','public-manifest.json','service-result.json','service-v2-result.json','service-process.json','service-v2-process.json','service-worker.log','service-worker-v2.log','security-tests.stderr.log','security-tests-v2.stderr.log','ds41-api-tests-v2.stdout.log','ds41-api-tests-v2.stderr.log','prompt-id-tests-v2.stdout.log','prompt-id-tests-v2.stderr.log','api-v2-attempt1.stdout.log','api-v2-attempt1.stderr.log']
for i in range(0,len(names),6):
 code='''from pathlib import Path
import json,base64
root=Path(@ROOT@);out={}
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('retained service root differs')
for n in @NAMES@:
 p=root/n
 if not p.exists():continue
 if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>512*1024:raise RuntimeError('bounded retained service file differs')
 out[n]=base64.b64encode(p.read_bytes()).decode()
print(json.dumps(out))
'''.replace('@ROOT@',repr(r['root'])).replace('@NAMES@',repr(names[i:i+6]))
 for n,b in jump(code).items():(dest/n).write_bytes(base64.b64decode(b))
load=json.loads((BASE/'xolotl-stable-windows-loadtest.json').read_text());delivery=json.loads((BASE/'xolotl-stable-service-delivery.json').read_text());qualification=json.loads((BASE/'xolotl-stable-service-windows-qualification.json').read_text())
summary={k:v for k,v in delivery.items() if k!='credential_file'};summary['windows_short_load_test']=dict(phase=load['phase'],passed=load['passed'],measured_requests=load.get('measured_requests'),warmup_requests=load.get('warmup_requests'),levels=[{k:v for k,v in row.items() if k!='requests'} for row in load['levels']],soak_test_claimed=False)
(dest/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# An actual API key must never be retained in this worktree/checkpoint.
secret=Path(r['credential_file']).read_bytes().strip();hits=[]
for p in d.rglob('*'):
 if p.is_file() and p.stat().st_size<=32*1024**2 and secret in p.read_bytes():hits.append(p.relative_to(d).as_posix())
if hits:raise RuntimeError('private key unexpectedly appears in public evidence: '+str(hits))
manifest=WORK/'docs/source-manifest.json';m=json.loads(manifest.read_text(encoding='utf-8'));m['original_xolotl_h200_20261024']['stable_serving']=dict(source_revision='e9d0826d71c59072cbff77d2a31dd51f27ab7a12',binary_sha256=r['plan']['binary_sha256'],allocation_uid=r['allocation_uid'],gpu_uuid=r['gpu_uuid'],separate_optimization_gpu_uuid=delivery['separate_optimization_gpu_uuid'],bundle_manifest='docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200/stable-serving/xolotl-serving-bundle-manifest.json',public_artifacts_sha256=json.loads((BASE/'xolotl-serving-bundle-manifest.json').read_text())['archive_sha256'],api_template_tokenizer_controls_passed=True,windows_end_to_end_qualification_passed=qualification['passed'],windows_load_summary=summary['windows_short_load_test'],secret_retained=False,implementation='Original Xolotl; not a3s-power Rust native',lease_ends_unix=delivery['credential_lease_expires_unix'],target300_met=False,target500_met=False);manifest.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
path=d.parent/'OUTCOME.md';text=path.read_text(encoding='utf-8');marker='### Separate stable single-H200 API delivery (2026-10-24)'
if marker not in text:
 text+='''

### Separate stable single-H200 API delivery (2026-10-24)

The user explicitly requests one serving H200 and a different H200 for
optimization, and chooses this Windows computer as the client. Their two
physical GPU UUIDs and exact allocation/replica identities are retained.
The serving allocation is bounded to six hours from its successful resource
probe, with access expiring at 2026-10-25 00:37:50 Asia/Shanghai. It is never
used for the experimental dense-chain candidate. The qualified e9433050
baseline runs with the pinned upstream Xolotl API, official template and
tokenizer, ctx4096, DSpark depth5/conf0.45, PTQ R4 and Q3 split11. This is
the original Xolotl implementation, not completion of the a3s-power Rust
native engine. One request executes at a time; other clients queue.

The first service attempt fails its CPU security tests before GPU startup
because the public bundle omitted upstream serve/chat_template.jinja. Its
failure and exact worker are preserved. V2 supplies the two upstream data
files, passes all23 security tests, the upstream DS41 API/tokenizer/tool
tests, and exact five-prompt template/token-ID identity before model load.
The real Windows SSH path then passes model-list authentication, rejection
of absent/wrong/old keys, arithmetic, code, Chinese SSE and two simultaneous
clients' output isolation. The key is generated into owner-restricted private
files only. No credential content is copied into evidence or checkpoints.
The local loopback tunnel is hidden, bounded to the access window and retries
SSH failures. The server supervisor has a bounded restart budget.

An actual short API load test then warms four fixed synthetic prompts and
runs16 requests at each client concurrency1/2/4/8: all64 measured requests
succeed, with zero errors or timeouts. Aggregate end-to-end throughput is
90.0238/91.8880/92.3623/91.9693 completion tokens/s. TTFT P95 is
0.18375/1.76975/4.30025/8.06625s and total request P95 is
1.64775/3.08275/4.547/9.08975s. The request mix emits32 or128 tokens.
These are Windows/API wall-clock measurements, including queue/network
costs. They are not a long soak or a300/500 token/s qualification. Raising
client concurrency leaves throughput almost unchanged and increases queue
delay, as expected for the single active engine request.
''';path.write_text(text,encoding='utf-8')
print(json.dumps(dict(retained=True,windows_api_passed=True,load_requests=load.get('measured_requests'),private_key_occurrences_in_evidence=len(hits),serving_kept_running=True)))
