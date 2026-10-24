"""Fence all explicit external state access before retrying the rejected async path."""
import ast,hashlib,json
from xolotl_trial_common import BASE
target=BASE/'aster_dense_async_chain_v3.cpp'
if target.exists():raise RuntimeError('V3 source already frozen')
parent=BASE/'aster_dense_async_chain_v2.cpp';s=parent.read_text()
meta=json.loads((BASE/'xolotl-dense-async-chain-v2-source-plan.json').read_text())
if hashlib.sha256(parent.read_bytes()).hexdigest()!=meta['source_sha256']:raise RuntimeError('V2 source identity differs')
signatures=[
'bool Ds41Dense::read_state(std::vector<float> & x, std::vector<float> & pre)',
'bool Ds41Dense::read_state_cols(int c0, int n, std::vector<float> & x)',
'bool Ds41Dense::snapshot(int pos)',
'bool Ds41Dense::restore()',
'bool Ds41Dense::begin(const int * tids, int n, int pos0)',
'bool Ds41Dense::begin_rows(const Row * rows, int n)',
'bool Ds41Dense::begin_batch(const int * tids, int B, int pos0)',
'bool Ds41Dense::begin_continued(const int * tids, int n, int pos0)',
'bool Ds41Dense::begin_batch_continued(const int * tids, int B, int pos0)',
'void Ds41Dense::release_pass()',
'void Ds41Dense::set_route_bias(int il, const float * bias)',
'bool Ds41Dense::set_route_select(int protect, int pool)',
'bool Ds41Dense::export_handoff(int col0, int n, float * dst) const',
'bool Ds41Dense::import_handoff(int col0, int n, const float * src)',
'bool Ds41Dense::read_sel(int il, std::vector<int> & sel, std::vector<float> & mask, int * K)',
'bool Ds41Dense::capture_conversation(int64_t positions, std::vector<uint8_t> & out) const',
'bool Ds41Dense::restore_conversation(const std::vector<uint8_t> & in)',
'void Ds41Dense::pool_regions(bool snap, std::vector<PoolRegion> & streams, std::vector<PoolRegion> & regions) const',
'std::vector<Ds41Dense::StateRegion> Ds41Dense::state_regions(int64_t positions) const',
'bool Ds41Dense::import_layer_cache_from(const Ds41Dense & src, int64_t global_layer, int col0, int n)',
'bool Ds41Dense::import_cand_from(const Ds41Dense & src, int col0, int n)',
]
fence='\n    p_->async_finish_fence.invalidate([&] { ggml_backend_synchronize(p_->backend); });'
for signature in signatures:
 a=signature+' {'
 if s.count(a)!=1:raise RuntimeError('explicit external-access source anchor differs: '+signature)
 s=s.replace(a,a+fence)
# The existing handoff code already synchronizes its source. Fence its destination
# before a distinct stream can write the same state as a queued finish.
a='''bool Ds41Dense::import_handoff_from(const Ds41Dense & src, int src_cuda_device, int dst_cuda_device, int col0, int n,
                                    void * cuda_stream, std::vector<float> & pinned_host) {'''
if s.count(a)!=1:raise RuntimeError('handoff external-access source anchor differs')
s=s.replace(a,a+fence)
a='''    // H200 experiment: only attn_router opts in, and it queues all readbacks on
    // this same backend then fences before exposing host routes/activations.
    // No asynchronous finish, snapshot, allocator reset or caller-owned graph.'''
b='''    // Persistent single-sequence finish may queue work on this backend. Route
    // readbacks fence the same stream; external state access, invalidation and
    // unstable allocation explicitly retire pending finish work first.'''
if s.count(a)!=1:raise RuntimeError('async scope comment differs')
s=s.replace(a,b);target.write_text(s)
stage=(BASE/'stage_xolotl_dense_async_chain_v2.frozen.py').read_text()
for a,b in [('xolotl-dense-chain-v2-build-intent.json','xolotl-dense-chain-v3-build-intent.json'),('xolotl-dense-async-chain-v2','xolotl-dense-async-chain-v3'),('aster_dense_async_chain_v2.cpp','aster_dense_async_chain_v3.cpp')]:
 if stage.count(a)!=1:raise RuntimeError('V3 stage anchor differs: '+a)
 stage=stage.replace(a,b)
ast.parse(stage);(BASE/'stage_xolotl_dense_async_chain_v3.frozen.py').write_text(stage)
obs=(BASE/'observe_xolotl_dense_chain_v2_build.frozen.py').read_text().replace('xolotl-dense-chain-v2-build-intent.json','xolotl-dense-chain-v3-build-intent.json').replace('xolotl-dense-chain-v2-build-latest.json','xolotl-dense-chain-v3-build-latest.json')
ast.parse(obs);(BASE/'observe_xolotl_dense_chain_v3_build.frozen.py').write_text(obs)
meta.update(source_sha256=hashlib.sha256(target.read_bytes()).hexdigest(),v2_parent_sha256=hashlib.sha256(parent.read_bytes()).hexdigest(),external_access_fenced=signatures+['import_handoff_from'],v2_rejected_comparison='xolotl-dense-chain-normal-comparison.json',gpu_quality_passed=False,performance_claimed=False,built=False,host_tests_passed=False)
(BASE/'xolotl-dense-async-chain-v3-source-plan.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps(dict(prepared=True,source_sha256=meta['source_sha256'],external_boundaries=len(meta['external_access_fenced']),gpu_quality_claimed=False)))
