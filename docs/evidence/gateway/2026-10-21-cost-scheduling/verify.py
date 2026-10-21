"""Reproduce distinct baseline failures alone and retain owner check logs."""
import json
import os
from pathlib import Path
import subprocess
from runtime import BASE, save

repo=Path('/code/aster')
names=[
'entrypoint::platform_model_tests::embedding_and_rerank_suppliers_replace_the_platform_model',
'entrypoint::platform_model_tests::platform_aliases_fail_closed_without_weights_but_proxy_aliases_still_route',
'gateway::tests::test_gateway_keeps_serving_when_the_management_plane_cannot_start',
'inference::openai_request::tests::matches_only_the_closed_endpoint_and_method_set',
'inference::standards_tests::admission_keeps_only_the_openai_core_and_platform_models',
]
executables=sorted([path for path in (repo/'target/debug/deps').glob('a3s_gateway-*') if path.is_file() and os.access(path,os.X_OK)],key=lambda path:path.stat().st_mtime,reverse=True)
test=next(path for path in executables if names[0] in subprocess.run([str(path),'--list'],capture_output=True,text=True).stdout)
records=[]
for index,name in enumerate(names):
    result=subprocess.run([str(test),'--exact',name,'--test-threads=1'],capture_output=True,text=True)
    assert result.returncode!=0 and '1 failed' in result.stdout
    (BASE/f'failure-alone-{index}.log').write_text(result.stdout+result.stderr)
    records.append({'name':name,'returncode':result.returncode,'baseline_reproduced_alone':True})
patch=Path((BASE/'current-patch.txt').read_text().strip()).read_text()
files=[line.split(' b/',1)[1] for line in patch.splitlines() if line.startswith('diff --git ') and line.endswith('.rs')]
commands=[('owner-format',['/home/user/.cargo/bin/rustfmt','--check','--edition','2021','--config','skip_children=true',*files]),
('workspace-dependencies',['python3','tests/workspace_dependencies.py']),
('crate-drift',['python3','tests/crate_drift_report.py']),
('workspace-format',['/home/user/.cargo/bin/cargo','fmt','--all','--','--check'])]
checks=[]
for name,command in commands:
    result=subprocess.run(command,cwd=repo,capture_output=True,text=True)
    (BASE/f'{name}.log').write_text(result.stdout+result.stderr)
    checks.append({'name':name,'returncode':result.returncode})
save('verification.json',{'failures_alone':records,'checks':checks,'full_library':{'passed':2065,'failed':5,'ignored':5},'focused':{'passed':42,'failed':0}})
print(json.dumps(checks))
