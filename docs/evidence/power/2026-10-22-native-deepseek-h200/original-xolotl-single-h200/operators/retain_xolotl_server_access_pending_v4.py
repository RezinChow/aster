"""Retain server-access recovery and honest pending WorkBuddy acceptance; never copy private client logs or keys."""
import hashlib,json,shutil,time
from pathlib import Path
BASE=Path(__file__).resolve().parent;WORK=Path('D:/code/aster/.wt-h200-native-deploy')
ROOT=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200';DEST=ROOT/'server-access-131k';DEST.mkdir(exist_ok=True)
service=json.loads((BASE/'xolotl-stable-service-v4-intent.json').read_text());opt=json.loads((BASE/'xolotl-prefill-shadow-v5-intent.json').read_text());a=json.loads((BASE/'active-worktree.json').read_text());secret=Path(service['credential_file']).read_bytes().strip()
ops='''launch_xolotl_longctx_shadow_v1.py xolotl_longctx_common.py xolotl_longctx_shadow_worker_v1.frozen.py xolotl_longctx_request_worker_v1.py launch_xolotl_longctx_request_v1.py configure_xolotl_windows_access_v1.ps1 remove_xolotl_windows_forwarding_v1.py remove_xolotl_windows_network_v1.ps1 inspect_xolotl_server_ingress_v1.py inspect_xolotl_platform_ingress_v2.py probe_xolotl_nodeport_admission_v1.py publish_xolotl_nodeport_v1.py publish_xolotl_loadbalancer_v1.py prepare_xolotl_loadbalancer_v2.py publish_xolotl_loadbalancer_v2.frozen.py qualify_xolotl_server_nodeport_v1.py qualify_xolotl_server_vip_v1.py drain_xolotl_stable_4k_v1.py launch_xolotl_stable_longctx_v3.py xolotl_stable_service_worker_v3.frozen.py qualify_xolotl_direct_windows_worker_v1.py launch_xolotl_direct_windows_qualification_v1.py drain_xolotl_longctx_shadow_v1.py finalize_xolotl_server_access_v1.py launch_xolotl_prefill_shadow_v4.py xolotl_prefill_shadow_worker_v4.frozen.py xolotl_prefill_cache_worker_v4.py launch_xolotl_prefill_cache_qualification_v4.py diagnose_xolotl_tool_stream_v4.py promote_xolotl_prefill_cache_v4.py xolotl_serving_original_common_v3.py xolotl_serving_common.py xolotl_trial_common.py workbuddy_builtin_e2e_worker_v1.py launch_workbuddy_builtin_e2e_v1.py xolotl_server_vip_cleanup_worker_v4.py launch_xolotl_server_vip_cleanup_v4.py drain_xolotl_previous_serving_v3.py restore_xolotl_two_roles_v4.py launch_xolotl_prefill_shadow_v5.py xolotl_prefill_shadow_worker_v5.frozen.py diagnose_xolotl_raw_tool_body_v5.py diagnose_xolotl_truncated_tool_v5.py launch_xolotl_prefill_cache_qualification_v5.frozen.py prepare_xolotl_dsml_json_fix_v6.py serve_ds41_dsml_json_v6.frozen.py test_xolotl_dsml_json_v6.frozen.py retain_xolotl_server_access_pending_v4.py'''.split()
receipts='''xolotl-longctx-resource-latest.json xolotl-longctx-shadow-v1-intent.json xolotl-longctx-request-v1-intent.json xolotl-longctx-shadow-v1-drain.json xolotl-windows-shared-access-network-v1.json xolotl-windows-forwarding-removed-v1.json xolotl-nodeport-admission-v1.json xolotl-server-nodeport-v1-intent.json xolotl-server-nodeport-v1-qualification.json xolotl-server-loadbalancer-v1-intent.json xolotl-server-loadbalancer-v1-latest.json xolotl-server-loadbalancer-v2-intent.json xolotl-server-loadbalancer-v2-latest.json xolotl-stable-4k-drain-v1.json xolotl-stable-service-v3-intent.json xolotl-server-vip-v1-qualification.json xolotl-direct-windows-qualification-v1-plan.json xolotl-direct-windows-qualification-v1-intent.json xolotl-direct-windows-qualification-v1-result.json xolotl-server-access-finalization-v1.json xolotl-shadow-serving-reservation-v1.frozen.json xolotl-prefill-shadow-v4-intent.json xolotl-prefill-cache-qualification-v4-intent.json xolotl-prefill-cache-qualification-v4-latest.json xolotl-native-tool-stream-v4-diagnostic.json xolotl-prefill-cache-v4-promotion.json xolotl-pre-v4-serving-reservation.frozen.json xolotl-stable-service-v4-intent.json xolotl-current-serving-lease.json xolotl-original-serving-resource-v3-latest.json xolotl-active-serving-reservation.json xolotl-current-optimization-lease.json xolotl-two-role-v4-restoration.json workbuddy-builtin-e2e-v1-plan.json workbuddy-builtin-e2e-v1-intent.json workbuddy-builtin-e2e-v1-result.json xolotl-server-vip-cleanup-v4-intent.json xolotl-previous-serving-v3-drain.json xolotl-prefill-shadow-v5-intent.json xolotl-raw-tool-body-v5-diagnostic.json xolotl-truncated-tool-v5-diagnostic.json xolotl-prefill-cache-qualification-v5-intent.json xolotl-dsml-json-fix-v6-plan.json'''.split()
def copy(p,d):
 if p.is_symlink() or not p.is_file() or p.stat().st_size>4*1024**2:raise RuntimeError('public recovery file exceeds bound: '+p.name)
 raw=p.read_bytes()
 if secret in raw:raise RuntimeError('private credential in prospective public recovery artifact: '+p.name)
 d.write_bytes(raw)
for name in ops:copy(BASE/name,ROOT/'operators'/name)
for name in receipts:
 if (BASE/name).exists():copy(BASE/name,DEST/name)
prior=BASE/'xolotl-serving-and-optimization-next-iteration.json';archive=BASE/'xolotl-pre-server-access-recovery.frozen.json'
if not archive.exists():
 with archive.open('xb') as f:f.write(prior.read_bytes())
record=dict(unix=time.time(),goal_turn_classification='PROGRESS',milestone300_met=False,full_goal500_met=False,active_service=dict(base_url='http://10.102.93.68/v1',intent='xolotl-stable-service-v4-intent.json',allocation_uid=service['allocation_uid'],replica_uid=service['replica_uid'],gpu_uuid=service['gpu_uuid'],context_tokens=131072,prefill_batch_tokens=8192,prefill_chunk_tokens=128,conversation_cache_mib=8192,conversation_cache_slots=8,lease_ends_unix=service['plan']['lease_ends_unix'],windows_forwarding=False,service_uid='1f968a8d-4ddc-4cee-b32a-390cd44210c7',server_side_expiry_cleanup='xolotl-server-vip-cleanup-v4-intent.json'),optimization=dict(allocation_uid=opt['allocation_uid'],replica_uid=opt['replica_uid'],gpu_uuid=opt['gpu_uuid'],current_lease='xolotl-current-optimization-lease.json',trial='xolotl-prefill-shadow-v5-intent.json',phase='prefill_chunk512_and_native_tool_diagnostic',lease_ends_unix=opt['plan']['lease_ends_unix']),maximum_allocated_h200=2,eight_h200_admission_verified=False,workbuddy=dict(actual_models_json_metadata_verified=True,bundled_client_two_new_sessions_received_hi=True,new_session_first_output_seconds=[60.7737557888031,41.960718631744385],gui_test_passed=False,gui_automation_error='node_repl initialization twice failed to write kernel assets: Windows path not found (os error3)',latency_acceptance_passed=False,tool_call_acceptance_passed=False,known_tool_defect='Model emits a complete JSON object inside native DSML invoke; upstream adapter drops it into empty arguments. Strict JSON-object overlay prepared inV6, not deployed.'),active_worktree_updates=a,next_action='Keep actual service oncont5 GPU117a with131072context,8192batch/8192MiB8-slotRAMcache,VIP10.102.93.68. Optimization is now the old serving allocation GPU0349, pinned by current-optimization-lease; V5chunk512 shadow is active there. Observe V5 qualification (do not relaunch), qualify and deploy strict native DSML JSON-object parsing without renaming/inference, then test the actual WorkBuddy bundled client in one persistent streaming session plus tool roundtrip. Do not claim GUI or WorkBuddy latency acceptance from API-only tests. GUI tool node_repl unavailable after two initialization failures; no alternative Windows UI automation is authorized by the skill. Keep two H200 maximum. No8-card admission,300 or500tok/s claim. The dense-chain7c9 optimization baseline remains a separate decode optimization control; service uses e943 stable binary.')
prior.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');copy(prior,ROOT/prior.name)
copy(BASE/'xolotl-trial-resource-latest.json',ROOT/'xolotl-trial-resource-latest.json')
sp=WORK/'docs/source-manifest.json';m=json.loads(sp.read_text(encoding='utf-8'));m['original_xolotl_h200_20261024']['current_serving_optimization_roles']=record;m['original_xolotl_h200_20261024']['server_access_131k']=dict(base_url=record['active_service']['base_url'],active_service=record['active_service'],workbuddy_acceptance=record['workbuddy'],evidence=DEST.relative_to(WORK).as_posix(),secret_retained=False);sp.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
p=ROOT.parent/'OUTCOME.md';text=p.read_text(encoding='utf-8');marker='### Server VIP,131K context and pending WorkBuddy acceptance (2026-10-24)'
if marker not in text:
 text+='\n\n'+marker+'''\n\nThe4096-context service rejected the user WorkBuddy35700-token request.
A shadow exact stable e943 binary qualifies131072 context;35,700 actual prompt
tokens return42 with HTTP200, without truncation. The old service is gracefully
replaced; original processes are reaped. At the user's explicit request all
Windows forwarding processes, the temporary /32 alias and the task firewall
rule are removed. A separate owned MetalLB VIP10.102.93.68:80, pool bgp-pool-v3,
is directly reachable from this Windows with HTTP proxies disabled and from
the other physical H200 node. No other physical LAN machine or absence of VPN
is claimed. Superseded NodePort and default-pool VIP are removed with atomic UID
preconditions. API keys stay in restricted runtime files only.

Actual WorkBuddy requests carry~35K-37K tokens and27 tools even for hi, and a
37388-token request is cancelled after127seconds before generation. Increasing
prefill batches256to8192 and enabling8192MiB/8-slot RAM conversation caching
qualifies a public35700-token cold request with48.02s first output, an unrelated
side request, then exact35700-token cached-prefix restore with0.0501s first
output (actual usage reports35700 cached tokens). This is adopted for cache
settings only; cold latency is still slow. Serving/optimization roles are
swapped within the same two physical H200 allocations, with exact drain/idle
proof before the previous serving GPU becomes the optimization GPU. A bounded
server-side worker retires the owned VIP at its current immutable lease end,
unless service ownership/deadline has since been reassigned.

The installed WorkBuddy bundled lite-wb client loads the user's actual approved
models.json and returns hi successfully in two new non-persistent sessions:
first output60.77s/41.96s, not a latency acceptance. GUI automation initialization
fails twice with Windows path-not-found error3, so no GUI end-to-end pass is
claimed. A real native tool-call test fails: the model writes a complete JSON
object inside a DSML invoke; upstream's parameter-tag-only adapter silently
returns empty arguments. Truncated public model output proves the JSON syntax.
A strict JSON parser overlay is prepared with bounded hermetic controls and is
not yet deployed. V5chunk512 prefill validation is in progress on the separate
optimization GPU. No8-card resource admission,8-card load test,300/500decode
target or completion of the Rust-native engine is claimed.
''';p.write_text(text,encoding='utf-8')
mp=ROOT/'manifest.json';manifest=json.loads(mp.read_text());rows=[];total=0
for p in sorted(ROOT.rglob('*')):
 if not p.is_file() or p==mp:continue
 if p.is_symlink() or p.stat().st_size>32*1024**2:raise RuntimeError('public evidence bound changed')
 raw=p.read_bytes();total+=len(raw)
 if total>128*1024**2 or secret in raw:raise RuntimeError('public evidence size/credential guard failed')
 rows.append(dict(file=p.relative_to(ROOT).as_posix(),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest()))
if len(rows)>8192:raise RuntimeError('public evidence count bound exceeded')
manifest['files']=rows;manifest['updated_unix']=time.time();mp.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(retained=True,files=len(rows),bytes=total,private_key_occurrences=0,workbuddy_latency_acceptance=False,current_service='http://10.102.93.68/v1',two_physical_h200_only=True)))
