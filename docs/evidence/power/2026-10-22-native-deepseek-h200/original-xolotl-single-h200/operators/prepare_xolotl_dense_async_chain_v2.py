"""Fence partial dispatch failures too, before any live-model use of this experiment."""
import ast,json,hashlib
from xolotl_trial_common import BASE
p=BASE/'aster_dense_async_chain_v2.cpp'
if p.exists():raise RuntimeError('dense-chain V2 already frozen')
s=(BASE/'aster_dense_async_chain.cpp').read_text();a='    if (compute_status != GGML_STATUS_SUCCESS) { err = "graph compute failed"; return false; }'
if s.count(a)!=1:raise RuntimeError('dense dispatch failure anchor differs')
s=s.replace(a,'''    if (compute_status != GGML_STATUS_SUCCESS) {
        // A failed async submission may have queued partial work. Retire it
        // before any caller can destroy graph metadata or allocation buffers.
        ggml_backend_synchronize(backend);
        async_finish_fence.completed();
        err = "graph compute failed";
        return false;
    }''');p.write_text(s)
stage=(BASE/'stage_xolotl_dense_async_chain.py').read_text()
for a,b in [('xolotl-dense-chain-build-intent.json','xolotl-dense-chain-v2-build-intent.json'),("+'/xolotl-dense-async-chain'","+'/xolotl-dense-async-chain-v2'"),("BASE/'aster_dense_async_chain.cpp'","BASE/'aster_dense_async_chain_v2.cpp'")]:
 if stage.count(a)!=1:raise RuntimeError('dense V2 stage anchor differs')
 stage=stage.replace(a,b)
ast.parse(stage);(BASE/'stage_xolotl_dense_async_chain_v2.frozen.py').write_text(stage)
obs=(BASE/'observe_xolotl_dense_chain_build.py').read_text().replace('xolotl-dense-chain-build-intent.json','xolotl-dense-chain-v2-build-intent.json').replace('xolotl-dense-chain-build-latest.json','xolotl-dense-chain-v2-build-latest.json');ast.parse(obs);(BASE/'observe_xolotl_dense_chain_v2_build.frozen.py').write_text(obs)
for n in ['prepare_xolotl_dense_chain_trials.py','launch_xolotl_dense_chain_trial.frozen.py']:
 q=BASE/n;s=q.read_text()
 if s.count('xolotl-dense-chain-build-latest.json')!=1:raise RuntimeError('dense V2 profile build gate differs')
 s=s.replace('xolotl-dense-chain-build-latest.json','xolotl-dense-chain-v2-build-latest.json');ast.parse(s);q.write_text(s)
plan=json.loads((BASE/'xolotl-dense-async-chain-source-plan.json').read_text());plan.update(source_sha256=hashlib.sha256(p.read_bytes()).hexdigest(),dispatch_failure_fenced=True,supersedes_before_gpu_use='V1 compiled and host-tested only; no live model used it',built=False,host_tests_passed=False,gpu_quality_passed=False,performance_claimed=False)
(BASE/'xolotl-dense-async-chain-v2-source-plan.json').write_text(json.dumps(plan,indent=2)+'\n');print(json.dumps(dict(prepared_only=True,dispatch_failure_fenced=True,sha256=plan['source_sha256'])))
