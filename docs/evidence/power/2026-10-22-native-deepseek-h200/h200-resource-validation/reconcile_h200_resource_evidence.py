"""Retain exact owned-job observations without claiming scheduling is CUDA proof."""
import hashlib
import json
from pathlib import Path
import shutil
import time

BASE=Path('D:/code/aster/target/h200-native')
WORK=Path('D:/code/aster/.wt-h200-native-deploy')
EVIDENCE=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200'
DEST=EVIDENCE/'h200-resource-validation'
intent=json.loads((BASE/'h200-resource-validation-8-attempt2-pending.json').read_text())
observations=[json.loads(path.read_text()) | {'_path':path} for path in BASE.glob('h200-resource-attempt2-observation-*.json')]
latest=max(observations,key=lambda value:value['observedAtEpoch'])
assert latest['uid']==intent['submitted']['uid']=='a29adaab-b2bd-4c66-8b70-e330d1ec6dec'
proof=latest['artifacts'].get('resource-result.json',{}).get('content',{})
passed=proof.get('phase')=='passed'
if passed:
    assert proof['expectedGpus']==8 and proof['modelExecutionClaimed'] is False
    assert len(proof['gpus'])==len({gpu['uuid'] for gpu in proof['gpus']})==8
    assert all(gpu['name']=='NVIDIA H200' and gpu['totalMiB']-gpu['usedMiB']>=128*1024 for gpu in proof['gpus'])
    assert proof['cuda']['capability']==[9,0] and proof['cuda']['memoryRoundTrips']==8
    assert set(proof['cuda']['cudaGpuUuids'])=={gpu['uuid'] for gpu in proof['gpus']}
    directions=proof['cuda']['completedPeerDirections']
    assert len(directions)==56 and set(map(tuple,directions))=={(source,target) for source in range(8) for target in range(8) if source!=target}
manifest=json.loads((DEST/'manifest.json').read_text())
paths=[BASE/'h200-resource-validation-8-attempt2-pending.json',latest['_path']]
for pattern in ['h200-resource-observation-1792789104.json','h200-resource-runtime-diagnostic-*.json','h200-resource-one-superseded-*.json','h200-resource-retry-capacity-*.json','h200-resource-current-capacity-*.json','h200-resource-permissions-helper.json','h200-resource-container-limits-*.json','h200-resource-attempt2-events-*.json']:
    paths.extend(BASE.glob(pattern))
for name in ['submit_h200_resource_validation.py','observe_h200_resource_attempt2.py','check_h200_resource_capacity.py','test_resource_bootstrap_uid.py','reconcile_h200_resource_evidence.py','checkpoint_h200_resource_worktree.py']:
    paths.append(BASE/name)
for path in paths:
    assert path.is_file() and not path.is_symlink() and path.stat().st_size<=1048576
    shutil.copyfile(path,DEST/path.name)
for pattern in ['h200-resource-bootstrap-uid-contract*.log']:
    for path in EVIDENCE.glob(pattern):shutil.copyfile(path,DEST/path.name)
replica=latest['replicas'][0]
scheduled=any(condition['type']=='PodScheduled' and condition['status']=='True' for condition in replica['status'].get('conditions',[]))
manifest.update(schema='aster-h200-resource-validation-evidence-v2',unix=time.time(),
    first_eight_gpu_attempt=dict(name='aster-h200-resource-8-17bb05a770ee-152107',uid='49747c8a-bf48-4941-b780-b3427b510a9e',phase='Failed',scheduled=True,node='gpu-lg-cmc-h-h200-3058.host.h.pjlab.org.cn',probe_passed=False,failure='root image UID did not equal artifact-owner UID; guard refused before CUDA initialization'),
    corrected_eight_gpu_job=dict(name=latest['name'],uid=latest['uid']),
    corrected_eight_gpu_job_status=latest['status']['phase'],
    eight_gpu_scheduling_passed=scheduled,eight_gpu_node=replica['status'].get('nodeName'),
    eight_gpu_allocation_passed=passed,one_gpu_job_status='Failed',one_gpu_cuda_probe_passed=False,
    latest_observation=latest['_path'].name,latest_observed_epoch=latest['observedAtEpoch'],
    bootstrap_uid_contract_tests_passed=3,bootstrap_uid=10250,
    bootstrap_test_harness_correction='intercept only the exact 600-second diagnostic sleep; preserve subprocess timeout polling sleeps; isolated failure reproduced then passed',
    worker_sha256=intent['worker_sha256'],diagnostic_hold_seconds_on_failure=600,
    lease_seconds_after_pass=3600,model_execution_claimed=False,
    cpu_only_helper_admission='rejected by GPU-pool policy; no helper job created',
    explicitly_not_claimed=['full native model execution','NCCL or inference throughput','production endpoint or key']+([] if passed else ['eight physical H200 devices passing CUDA/peer validation']))
if passed:
    manifest['resource_proof']=proof
    (DEST/'resource-result.json').write_text(json.dumps(proof,indent=2)+'\n')
limits_records=[json.loads(path.read_text()) for path in BASE.glob('h200-resource-container-limits-*.json')]
if limits_records:
    limits=max(limits_records,key=lambda value:value['observedAtEpoch'])
    assert limits['uid']==latest['uid'] and limits['container']['hostname']==replica['status']['nodeName']
    values=limits['container']['limits']
    assert int(values['/sys/fs/cgroup/cpu/cpu.cfs_quota_us'])/int(values['/sys/fs/cgroup/cpu/cpu.cfs_period_us'])==160
    assert int(values['/sys/fs/cgroup/memory/memory.limit_in_bytes'])==1760*1024**3
    manifest['runtime_container_limits_verified']=dict(cpu_quota_cores=160,memory_gib=1760,node_gpu_allocatable=limits['node']['gpuAllocatable'],node_unschedulable=limits['node']['unschedulable'],evidence_epoch=limits['observedAtEpoch'])
manifest['files']=[dict(file=path.name,bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest()) for path in sorted(DEST.iterdir()) if path.is_file() and path.name!='manifest.json']
(DEST/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({key:manifest[key] for key in ['latest_observed_epoch','corrected_eight_gpu_job_status','eight_gpu_scheduling_passed','eight_gpu_allocation_passed','eight_gpu_node']}))
