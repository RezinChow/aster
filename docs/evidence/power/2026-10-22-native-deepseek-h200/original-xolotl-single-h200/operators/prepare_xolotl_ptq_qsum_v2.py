"""Fuse exact q8 sums into each uniform group block; remove the extra launches."""
import ast,json,hashlib
from xolotl_trial_common import BASE
p=BASE/'aster_ptq_qsum_v2.cuh'
if p.exists():raise RuntimeError('V2 already frozen; create a new experiment')
h=(BASE/'aster_ptq_qsum.cuh').read_text()
a=h.index('template<bool TOK>');b=h.index('__device__ __forceinline__ void aster_ptq_row4',a);h=h[:a]+h[b:]
def once(s,a,b):
 if s.count(a)!=1:raise RuntimeError('V2 anchor differs: '+a[:80])
 return s.replace(a,b)
h=once(h,'        const int32_t* sums,float* gate,float* up) {','        float* gate,float* up) {')
h=once(h,'    const int row0=blockIdx.x*32+warp;if(row0>=rows)return;','    const int row0=blockIdx.x*32+warp;\n    __shared__ int32_t shared_sums[160];')
h=once(h,'        float o[4];const int xr=DOWN?e:map[e];\n        aster_ptq_row4(w,x+(size_t)xr*xb,sums+(size_t)e*xb,nb,lane,o);',r'''        const int xr=DOWN?e:map[e];
        for(int q=threadIdx.x;q<xb;q+=blockDim.x) {
            const block_q8_1& b=x[(size_t)xr*xb+q];int acc=0;
#pragma unroll
            for(int k=0;k<8;++k)acc=ggml_cuda_dp4a(0x01010101,get_int_b4(b.qs,k),acc);
            shared_sums[q]=acc;
        }
        __syncthreads();
        float o[4];aster_ptq_row4(w,x+(size_t)xr*xb,shared_sums,nb,lane,o);''')
a=h.index('__global__ __launch_bounds__(256) void aster_ptq_qsum_r4');tail=h[a:]
tail=once(tail,'        }\n    }\n}\n','        }\n        __syncthreads();\n    }\n}\n');h=h[:a]+tail
h=h.replace('// Aster experiment derived from MIT Xolotl fork_vecdot.cuh. Default off.','// Aster V2 experiment derived from MIT Xolotl. Per-entry integer sums in shared memory; default off.')
p.write_text(h)
s=(BASE/'aster_ptq_qsum_iq_kernels.cu').read_text()
a='''        const int xb=(int)(L.n_embd/32);
        static_assert(sizeof(int32_t)<=sizeof(float));
        if((size_t)cap_entries*xb*sizeof(int32_t)>fa){std::fprintf(stderr,"qsum GU scratch bound differs\\n");std::exit(1);}
        auto* sums=(int32_t*)h;
        aster_ptq_qsum_kernel<true><<<(unsigned)(((int64_t)cap_entries*xb+255)/256),256,0,s>>>(X,grp_start,n_groups,ent_tok,xb,(int)cap_entries,sums);
        aster_ptq_qsum_r4<false><<<ggu_amd,256,0,s>>>(grp_ptr,grp_start,n_groups,ent_tok,X,L,sums,gate,up);'''
s=once(s,a,'        aster_ptq_qsum_r4<false><<<ggu_amd,256,0,s>>>(grp_ptr,grp_start,n_groups,ent_tok,X,L,gate,up);')
a='''        const int xb=(int)(L.n_ff/32);
        if((size_t)cap_entries*xb*sizeof(int32_t)>fa){std::fprintf(stderr,"qsum Down scratch bound differs\\n");std::exit(1);}
        auto* sums=(int32_t*)h;
        aster_ptq_qsum_kernel<false><<<(unsigned)(((int64_t)cap_entries*xb+255)/256),256,0,s>>>(hq,grp_start,n_groups,nullptr,xb,(int)cap_entries,sums);
        aster_ptq_qsum_r4<true><<<gd_amd,256,0,s>>>(grp_ptr,grp_start,n_groups,ent_dst,hq,L,sums,out,nullptr);'''
s=once(s,a,'        aster_ptq_qsum_r4<true><<<gd_amd,256,0,s>>>(grp_ptr,grp_start,n_groups,ent_dst,hq,L,out,nullptr);')
(BASE/'aster_ptq_qsum_v2_iq_kernels.cu').write_text(s)
stage=(BASE/'stage_xolotl_ptq_qsum.py').read_text()
for a,b in [('xolotl-ptq-qsum-intent.json','xolotl-ptq-qsum-v2-intent.json'),("+'/xolotl-ptq-qsum'","+'/xolotl-ptq-qsum-v2'"),("BASE/'aster_ptq_qsum.cuh'","BASE/'aster_ptq_qsum_v2.cuh'"),("BASE/'aster_ptq_qsum_iq_kernels.cu'","BASE/'aster_ptq_qsum_v2_iq_kernels.cu'")]:stage=once(stage,a,b)
ast.parse(stage);(BASE/'stage_xolotl_ptq_qsum_v2.frozen.py').write_text(stage)
obs=(BASE/'observe_xolotl_ptq_qsum.py').read_text().replace('xolotl-ptq-qsum-intent.json','xolotl-ptq-qsum-v2-intent.json').replace('xolotl-ptq-qsum-latest.json','xolotl-ptq-qsum-v2-latest.json');ast.parse(obs);(BASE/'observe_xolotl_ptq_qsum_v2.frozen.py').write_text(obs)
out=dict(prepared_only=True,header_sha256=hashlib.sha256(p.read_bytes()).hexdigest(),patched_iq_sha256=hashlib.sha256((BASE/'aster_ptq_qsum_v2_iq_kernels.cu').read_bytes()).hexdigest(),shared_bytes=640,no_extra_weights=True,no_extra_launches=True,no_h_scratch_reuse=True,geometry='5120x2304 only; both output row extents divisible by32, no warp exits before barriers',hardware_controls_passed=False,model_gain_claimed=False)
(BASE/'xolotl-ptq-qsum-v2-source-plan.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
