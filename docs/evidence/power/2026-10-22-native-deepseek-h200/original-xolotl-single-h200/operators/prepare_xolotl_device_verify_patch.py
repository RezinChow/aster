"""Default-off device-resident batched expert input; no model or math change."""
import difflib,hashlib,json
from xolotl_trial_common import BASE
root=BASE/'xolotl-trial-source-e9d0826d71c5/source'
changes={}
def edit(path):return (root/path).read_text(encoding='utf-8')
def once(s,a,b):
 if s.count(a)!=1:raise RuntimeError('device verify source anchor differs: '+a[:100])
 return s.replace(a,b)
p='tools/v41/engine/ds41_dense.hpp';s=edit(p)
a='    bool attn_router(int il, int * ids, float * wts, const float ** fn_host, ggml_tensor ** fn_dev = nullptr);'
s=once(s,a,a+'\n    /// Device-input verify experiment: routes on host, activations on CUDA; backend is fenced before return.\n    bool attn_router_device(int il, int * ids, float * wts, ggml_tensor ** fn_dev);')
s=once(s,'private:\n    std::unique_ptr<Impl> p_;','private:\n    bool attn_router_impl(int il, int * ids, float * wts, const float ** fn_host, ggml_tensor ** fn_dev, bool device_only);\n    std::unique_ptr<Impl> p_;');changes[p]=s
p='tools/v41/engine/ds41_dense.cpp';s=edit(p)
a='bool Ds41Dense::attn_router(int il, int * ids, float * wts, const float ** fn_host, ggml_tensor ** fn_dev) {\n    Impl & im = *p_;'
b='''bool Ds41Dense::attn_router(int il, int * ids, float * wts, const float ** fn_host, ggml_tensor ** fn_dev) {
    return attn_router_impl(il, ids, wts, fn_host, fn_dev, false);
}

bool Ds41Dense::attn_router_device(int il, int * ids, float * wts, ggml_tensor ** fn_dev) {
    return attn_router_impl(il, ids, wts, nullptr, fn_dev, true);
}

bool Ds41Dense::attn_router_impl(int il, int * ids, float * wts, const float ** fn_host, ggml_tensor ** fn_dev, bool device_only) {
    Impl & im = *p_;
    if (device_only) {
#ifdef DS41_HAVE_CUDA
        if (!fn_dev || !ggml_backend_is_cuda(im.backend)) { im.err = "device verify requires a CUDA backend and output tensor"; return false; }
#else
        im.err = "device verify requires CUDA"; return false;
#endif
    }'''
s=once(s,a,b)
s=once(s,'    ggml_backend_tensor_get_async(im.backend, im.o_fn, im.host_fn.data(), 0, (size_t) (im.D * n) * 4);','    if (!device_only) ggml_backend_tensor_get_async(im.backend, im.o_fn, im.host_fn.data(), 0, (size_t) (im.D * n) * 4);')
s=once(s,'    *fn_host = im.host_fn.data();','    if (fn_host) *fn_host = im.host_fn.data();');changes[p]=s
p='tools/v41/engine/ds41_moe.hpp';s=edit(p)
a='    bool run_multi_to_dev(int64_t layer, int nt, const int32_t* ids, const float* w, const float* x, void* out_dev);'
s=once(s,a,a+'\n    /// CUDA-only, per-expert, local-device input/output. Copies input to host only for actual CPU jobs.\n    bool run_multi_dev_to_dev(int64_t layer, int nt, const int32_t* ids, const float* w, const void* x_dev, void* out_dev);');changes[p]=s
p='tools/v41/engine/ds41_moe.cpp';s=edit(p)
s=once(s,'                  const float* x_host, float* out, void* out_dev) {','                  const float* x_host, float* out, void* out_dev, const void* x_dev = nullptr) {')
a='''    std::memcpy(gp.h_x, x_host, (size_t) nt * (size_t) H * 4);
    ck(cudaMemcpyAsync(gp.d_x, gp.h_x, (size_t) nt * (size_t) H * 4, cudaMemcpyHostToDevice, gp.s), "x h2d");
    quantize_rows_q8_1((const float*) gp.d_x, gp.d_xq, H, nt, gp.s);   // > 8 rows: 8 per quantizer call'''
# The identical activation block also exists in the uniform-class path: change ONLY the per-expert function.
start=s.index('bool gpu_run_n_ex(');end=s.index('\nbool remote_chunk_post(',start) if '\nbool remote_chunk_post(' in s[start:] else s.index('\nbool gpu_run_chunk(',start)
before,body,after=s[:start],s[start:end],s[end:]
b='''    if (x_dev) {
        // attn_router_device fenced the dense backend; the same float bits enter the same quantizer.
        quantize_rows_q8_1((const float*) x_dev, gp.d_xq, H, nt, gp.s);
    } else {
        std::memcpy(gp.h_x, x_host, (size_t) nt * (size_t) H * 4);
        ck(cudaMemcpyAsync(gp.d_x, gp.h_x, (size_t) nt * (size_t) H * 4, cudaMemcpyHostToDevice, gp.s), "x h2d");
        quantize_rows_q8_1((const float*) gp.d_x, gp.d_xq, H, nt, gp.s);
    }'''
body=once(body,a,b)
a='    { int nc = 0; for (int u = 0; u < nu; ++u) nc += cls[u] == CPU; reserve_ftmp(im, nc); }'
b='''    { int nc = 0; for (int u = 0; u < nu; ++u) nc += cls[u] == CPU;
      if (x_dev && nc > 0) {
          ck(cudaMemcpyAsync(gp.h_x, x_dev, (size_t) nt * (size_t) H * 4, cudaMemcpyDeviceToHost, gp.s), "device verify CPU input");
          ck(cudaStreamSynchronize(gp.s), "device verify CPU input sync");
      }
      reserve_ftmp(im, nc); }'''
body=once(body,a,b);s=before+body+after
a='bool Ds41MoeTier::build_arena_from_routes('
b='''bool Ds41MoeTier::run_multi_dev_to_dev(int64_t layer, int nt, const int32_t* ids, const float* w, const void* x_dev, void* out_dev) {
    if (!im_->inited || !im_->pool || !ids || !w || !x_dev || !out_dev || nt < 1 || nt > kMaxTok) return false;
    if (layer < 0 || layer >= im_->g.n_layers || !im_->g.routed(layer) || im_->cfg.cpu_only || !im_->g.per_expert()) return false;
#if defined(DS4_MOE_CUDA)
    // RemoteScope's scalar input staging is not a batched device-input contract. Refuse both remote mechanisms.
    if (!im_->gpu || im_->remote || im_->gpu->remote) return false;
    rebal_count(*im_, layer, ids, (int64_t) nt * im_->g.top_k);
    return gpu_run_n_ex(*im_, layer, nt, ids, w, nullptr, nullptr, out_dev, x_dev);
#else
    return false;
#endif
}

bool Ds41MoeTier::build_arena_from_routes('''
s=once(s,a,b);changes[p]=s
p='tools/v41/engine/ds41_generate.cpp';s=edit(p)
a='    auto pass_v = [&](const int * toks, int m, int pos) -> bool {'
b='''    auto pass_v = [&](const int * toks, int m, int pos) -> bool {
        static const bool device_verify = [] {
            const char* v = std::getenv("ASTER_XQ_DEVICE_VERIFY");
            if (!v || std::strcmp(v, "0") == 0) return false;
            if (std::strcmp(v, "1") == 0) return true;
            std::fprintf(stderr, "ASTER_XQ_DEVICE_VERIFY must be 0 or 1\\n"); std::abort();
        }();'''
s=once(s,a,b)
a='''            const float * fn = nullptr;
            if (!d.attn_router(l, mids.data(), mw.data(), &fn)) { ferr = d.last_error(); return false; }
            lap(0);'''
b='''            const float * fn = nullptr;
            ggml_tensor * fn_dev = nullptr;
            if (device_verify && (!rdev || no_tier_batch)) { ferr = "device verify requires batched GPU experts"; return false; }
            const bool routed_ok = device_verify ? d.attn_router_device(l, mids.data(), mw.data(), &fn_dev)
                                                 : d.attn_router(l, mids.data(), mw.data(), &fn);
            if (!routed_ok) { ferr = d.last_error(); return false; }
            if (device_verify && (!fn_dev || !fn_dev->data)) { ferr = "device verify has no CUDA activations"; return false; }
            lap(0);'''
s=once(s,a,b)
a='''                    if (!tr.run_multi_to_dev(l, chunk, mids.data() + (size_t) off * top_k, mw.data() + (size_t) off * top_k,
                                               fn + (size_t) off * n_embd, rdev + (size_t) off * n_embd)) {'''
b='''                    const bool tier_ok = device_verify
                        ? tr.run_multi_dev_to_dev(l, chunk, mids.data() + (size_t) off * top_k, mw.data() + (size_t) off * top_k,
                                                  (const float*) fn_dev->data + (size_t) off * n_embd, rdev + (size_t) off * n_embd)
                        : tr.run_multi_to_dev(l, chunk, mids.data() + (size_t) off * top_k, mw.data() + (size_t) off * top_k,
                                              fn + (size_t) off * n_embd, rdev + (size_t) off * n_embd);
                    if (!tier_ok) {'''
s=once(s,a,b);changes[p]=s
patch=''.join(''.join(difflib.unified_diff(edit(p).splitlines(True),s.splitlines(True),fromfile='a/'+p,tofile='b/'+p,n=2)) for p,s in changes.items())
path=BASE/'xolotl-h200-device-verify.patch'
if path.exists():raise RuntimeError('device verify patch exists; preserve immutable trial source')
path.write_text(patch,encoding='utf-8',newline='\n')
plan=dict(default='off',flag='ASTER_XQ_DEVICE_VERIFY=0|1',upstream_revision='e9d0826d71c59072cbff77d2a31dd51f27ab7a12',patch_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),mathematical_ops_unchanged=True,removed='per-layer verify activation D2H and H2D plus host memcpy',preserved='host routes and weights, existing dense/tier fences, CPU fallback exact D2H only when CPU jobs exist',refused='CPU dense backend, unbatched experts, either remote mechanism',build_completed=False,hardware_qualified=False,full_model_speed_qualified=False,target_tok_s=300,target_met=False)
(BASE/'xolotl-h200-device-verify-plan.json').write_text(json.dumps(plan,indent=2)+'\n')
print(json.dumps(dict(prepared_only=True,patch=str(path),bytes=path.stat().st_size,sha256=plan['patch_sha256']),indent=2))
