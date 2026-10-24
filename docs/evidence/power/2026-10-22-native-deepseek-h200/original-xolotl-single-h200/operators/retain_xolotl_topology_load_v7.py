"""Retain exact current topology/load observations and failed GPU tool qualification."""
import hashlib
import json
import time
from pathlib import Path

BASE = Path(__file__).resolve().parent
WORK = Path('D:/code/aster/.wt-h200-native-deploy')
ROOT = WORK / 'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200'
DEST = ROOT / 'server-access-131k'
service = json.loads((BASE / 'xolotl-stable-service-v4-intent.json').read_text())
validation = json.loads((BASE / 'xolotl-json-runtime-v6b-intent.json').read_text())
secret = Path(service['credential_file']).read_bytes().strip()
load = json.loads((BASE / 'xolotl-server-v4-131k-windows-loadtest.json').read_text())
qualification = json.loads(json.loads((BASE / 'xolotl-json-runtime-v6b-qualification-latest.json').read_text())['request-result.json'])
if not load['passed'] or load['measured_requests'] != 64 or qualification['phase'] != 'failed':
    raise RuntimeError('exact observed outcomes changed')

def copy_public(source, target):
    if source.is_symlink() or not source.is_file() or source.stat().st_size > 4 * 1024**2:
        raise RuntimeError('public artifact bounds changed: ' + source.name)
    raw = source.read_bytes()
    if secret in raw:
        raise RuntimeError('private key must not enter public evidence')
    target.write_bytes(raw)

operators = '''prepare_xolotl_dsml_json_fix_v6b.py serve_ds41_dsml_json_v6b.frozen.py test_xolotl_dsml_json_v6b.frozen.py stage_xolotl_json_runtime_v6b.py stage_xolotl_json_runtime_v6b_r2.frozen.py xolotl_strict_json_worker_v6b.frozen.py xolotl_json_preflight_worker_v6b.py drain_xolotl_prefill_v5.py launch_xolotl_json_runtime_v6b.py launch_xolotl_json_runtime_v6b_qualification.frozen.py loadtest_xolotl_server_v4_131k_windows.frozen.py workbuddy_stream_e2e_worker_v2.py launch_workbuddy_stream_e2e_v2.py retain_xolotl_topology_load_v7.py'''.split()
receipts = '''xolotl-dsml-json-fix-v6b-plan.json xolotl-json-runtime-v6b-stage.json xolotl-json-runtime-v6b-r2-stage.json xolotl-json-runtime-v6b-cpu-latest.json xolotl-prefill-cache-qualification-v5-latest.json xolotl-prefill-v5-drain.json xolotl-json-runtime-v6b-intent.json xolotl-json-runtime-v6b-latest.json xolotl-json-runtime-v6b-qualification-intent.json xolotl-json-runtime-v6b-qualification-latest.json xolotl-server-topology-v4-131k-observation.json xolotl-server-v4-131k-windows-loadtest.json xolotl-server-v4-131k-post-load-health.json workbuddy-stream-e2e-v2-result.json'''.split()
for name in operators:
    copy_public(BASE / name, ROOT / 'operators' / name)
for name in receipts:
    copy_public(BASE / name, DEST / name)

active_path = BASE / 'active-worktree.json'
active = json.loads(active_path.read_text())
active.update(current_service_basic_chat_verified=True, current_service_fully_verified=False,
              current_original_engine_trial_phase='strict_tool_json_gpu_qualification_failed',
              current_original_engine_candidate_adopted=False,
              latest_current_service_load_test=str(BASE / 'xolotl-server-v4-131k-windows-loadtest.json'),
              latest_current_topology=str(BASE / 'xolotl-server-topology-v4-131k-observation.json'))
active_path.write_text(json.dumps(active, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
rp = BASE / 'xolotl-serving-and-optimization-next-iteration.json'
record = json.loads(rp.read_text())
record.update(unix=time.time(), active_worktree_updates=active)
record['optimization'].update(trial='xolotl-json-runtime-v6b-intent.json',
                              phase='strict_tool_json_gpu_qualification_failed',
                              adopted=False)
record['workbuddy'].update(
    bundled_same_process_two_turns_passed=True,
    same_process_first_output_seconds=[42.4554, 6.77186],
    same_process_result='workbuddy-stream-e2e-v2-result.json',
    strict_json_overlay_cpu_tests_passed=True,
    strict_json_overlay_gpu_qualification_passed=False,
    known_tool_defect='Production V4 still returns empty tool arguments for JSON-inside-DSML. V6b strict overlay is deployed only on validation GPU: cold/cache controls pass, but forced native tool stream has no finish/usage. Do not promote; exact failure remains unresolved.')
record['current_131k_short_load'] = dict(
    file='xolotl-server-v4-131k-windows-loadtest.json',
    passed=True, measured_requests=64, warmup_requests=4,
    completion_tokens=6656, context_tokens=131072,
    concurrency_levels=[{k: x[k] for k in ('concurrency', 'successes', 'failures',
                        'aggregate_end_to_end_completion_tok_s', 'ttft_p95_seconds',
                        'request_p95_seconds')} for x in load['levels']],
    scope='Direct Windows -> server VIP; four short public prompts,32/128 output tokens,16 requests per level. Not long-context concurrency or soak. API wall throughput, not isolated decode.',
    improved_over_historical_4k=False,
    regression_cause_proven=False)
record['next_action'] = ('Keep V4 public service and two physical H200 maximum. V6b GPU tool qualification failed; do not promote. Inspect only bounded public-test error metadata and the exact emitted grammar before another fix. Current131K short API throughput68-72tok/s is lower than historical4096-context90-92tok/s; no isolated-cause or speedup claim. WorkBuddy first cold turn remains~42s and second same-process turn~6.77s; latency and GUI/tool acceptance remain unpassed. Continue exact single-request acceleration toward300/500, with fair same-version comparisons.')
rp.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
copy_public(rp, ROOT / rp.name)

sp = WORK / 'docs/source-manifest.json'
manifest = json.loads(sp.read_text(encoding='utf-8'))
entry = manifest['original_xolotl_h200_20261024']
entry['current_serving_optimization_roles'] = record
entry['server_access_131k']['workbuddy_acceptance'] = record['workbuddy']
entry['server_access_131k']['current_short_load'] = record['current_131k_short_load']
entry['server_access_131k']['strict_tool_json_overlay'] = dict(
    original_sha256='5180c184d1a421dd5b56e799360fe6306b96d41da2d443d0bb68dae6714f2e5d',
    candidate_sha256='b204c4af684f771a13b5889f62d9fe38b029f9f5af05e78747df10f406758b75',
    cpu_tests_passed=True, gpu_tool_qualification_passed=False, promoted=False)
sp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

outcome = ROOT.parent / 'OUTCOME.md'
body = outcome.read_text(encoding='utf-8')
marker = '### Current topology and131K short load (2026-10-24,20:50 CST)'
if marker not in body:
    body += '\n\n' + marker + '''

Fresh cluster identities confirm exactly two separate one-H200 allocations:
GPU117a serves the single V4 replica on node10.102.214.86/pod100.97.136.42;
GPU0349 validates V6b on node10.102.204.31/pod100.97.24.7. VIP10.102.93.68:80
selects only the first replica, target30003. There is no a3s-gateway in the
serving path, no multi-replica load balancing and no Windows forwarding.

Current V4 uses context131072, prefill batches8192 and RAM KV caching8192MiB
with8 conversation slots, but executes only one model request at a time.
Direct Windows/proxies-disabled SSE short pressure testing uses four fixed
public prompts,32/128 output tokens, four warmups and16 measured requests for
each concurrency1/2/4/8. All64 measured requests succeed,6656 completion tokens,
zero observed errors/timeouts. Aggregate API wall throughput is respectively
68.22/69.88/71.52/70.57tok/s; P95 first output0.282/2.414/5.555/17.691seconds;
P95 total duration2.222/3.996/5.910/19.035seconds. Post-load health is200,
loaded=true, context131072. This is not a long-context concurrency/soak test
or isolated single-request decode measurement. Current throughput is lower
than historical4096-context90-92tok/s; causal attribution is still unproven.

The actual bundled WorkBuddy streaming client completes two hi turns in the
same process, first output42.46s then6.77s; latency acceptance and GUI acceptance
remain false. V5chunk512 gives no improvement and is drained. Strict V6b tool
JSON parsing passes CPU controls and is loaded only on the validation GPU.
Real GPU cold35700/side/restore controls pass, but the native tool stream lacks
finish/usage and qualification fails. It is not promoted. No300/500tok/s target
or Rust-native completion is claimed.
'''
    outcome.write_text(body, encoding='utf-8')

mp = ROOT / 'manifest.json'
evidence = json.loads(mp.read_text())
rows = []
total = 0
for p in sorted(ROOT.rglob('*')):
    if not p.is_file() or p == mp:
        continue
    if p.is_symlink() or p.stat().st_size > 32 * 1024**2:
        raise RuntimeError('public evidence bounds changed')
    raw = p.read_bytes()
    total += len(raw)
    if total > 128 * 1024**2 or secret in raw:
        raise RuntimeError('public evidence size/key guard failed')
    rows.append(dict(file=p.relative_to(ROOT).as_posix(), bytes=len(raw),
                     sha256=hashlib.sha256(raw).hexdigest()))
if len(rows) > 8192:
    raise RuntimeError('evidence count exceeds bound')
evidence.update(files=rows, updated_unix=time.time())
mp.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(dict(retained=True, files=len(rows), bytes=total,
                      private_key_occurrences=0, current_short_load_passed=True,
                      gpu_tool_candidate_promoted=False)))
