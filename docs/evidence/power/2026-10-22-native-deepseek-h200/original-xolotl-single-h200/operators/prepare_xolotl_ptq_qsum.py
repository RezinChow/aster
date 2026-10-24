"""Prepare an opt-in exact-int activation-sum experiment, without a GPU allocation."""
import ast,hashlib,json
from xolotl_trial_common import BASE,WORK
header=BASE/'aster_ptq_qsum.cuh'
if header.exists():raise RuntimeError('qsum source already frozen; use a new version')
src=BASE/'xolotl-trial-source-e9d0826d71c5/source'
v=(src/'src/kernels/cuda/fork/fork_vecdot.cuh').read_text()
a=v.index('__device__ __forceinline__ float vec_dot_ptq1_0_q8_1(');b=v.index('// Strata-DS4 fork: ONE QUARTER',a)
dot=v[a:b].replace('vec_dot_ptq1_0_q8_1(', 'aster_ptq_dot_qsum(')
dot=dot.replace('const int& kbx, const int& iqs) {','const int& kbx, const int& iqs, const int32_t* sumu) {')
for old in ['    int sumu[4] = {0, 0, 0, 0};\n','            sumu[e >> 5] = ggml_cuda_dp4a(0x01010101, u, sumu[e >> 5]);\n','            sumu[e >> 5] += a;\n']:
 if dot.count(old) not in [1,2]:raise RuntimeError('PTQ sum removal anchor differs')
 dot=dot.replace(old,'')
if 'sumu[e >> 5]' in dot:raise RuntimeError('PTQ sum computation remains')
extra=r'''
static_assert(Fmt<143>::ipb==1 && Fmt<143>::qk==128,"qsum requires original PTQ block geometry");
static int aster_ptq_qsum_mode() {
    static const int mode=[] {
        const char* v=std::getenv("ASTER_XQ_PTQ_QSUM");
        if(!v || std::strcmp(v,"0")==0)return 0;
        if(std::strcmp(v,"gu")==0)return 1;
        if(std::strcmp(v,"both")==0)return 2;
        std::fprintf(stderr,"ASTER_XQ_PTQ_QSUM must be0,gu or both\n");std::exit(1);
    }();return mode;
}
template<bool TOK>
__global__ void aster_ptq_qsum_kernel(const block_q8_1* x,const int32_t* starts,const int32_t* ng,
        const int32_t* tok,int xb,int cap,int32_t* sums) {
    const int64_t i=(int64_t)blockIdx.x*blockDim.x+threadIdx.x;
    const int e=(int)(i/xb),q=(int)(i%xb);
    if(e>=cap || e>=starts[*ng])return;
    const int row=TOK?tok[e]:e;
    const block_q8_1& b=x[(size_t)row*xb+q];
    int acc=0;
#pragma unroll
    for(int k=0;k<8;++k)acc=ggml_cuda_dp4a(0x01010101,get_int_b4(b.qs,k),acc);
    sums[i]=acc;
}
__device__ __forceinline__ void aster_ptq_row4(const uint8_t* const* r,const block_q8_1* x,
        const int32_t* sums,int nb,int lane,float* o) {
    float acc[4]={};
    for(int k=lane;k<nb;k+=32) {
        const block_q8_1* xk=x+4*k;
        float d[4];
#pragma unroll
        for(int i=0;i<4;++i)d[i]=aster_ptq_dot_qsum(r[i],xk,k,0,sums+4*k);
#pragma unroll
        for(int i=0;i<4;++i)acc[i]+=d[i];
    }
#pragma unroll
    for(int i=0;i<4;++i)o[i]=warp_sum(acc[i]);
}
template<bool DOWN>
__global__ __launch_bounds__(256) void aster_ptq_qsum_r4(const unsigned long long* ptr,const int32_t* starts,
        const int32_t* ng,const int32_t* map,const block_q8_1* x,NativeExpertLayout l,
        const int32_t* sums,float* gate,float* up) {
    const int g=blockIdx.y;if(g>=*ng)return;
    const int lane=threadIdx.x&31,warp=threadIdx.x>>5;
    const int rows=DOWN?(int)l.n_embd:2*(int)l.n_ff;
    const int row0=blockIdx.x*32+warp;if(row0>=rows)return;
    const int xb=(int)((DOWN?l.n_ff:l.n_embd)/32),nb=xb/4;
    const uint8_t* blob=(const uint8_t*)ptr[g];const uint8_t* w[4];
#pragma unroll
    for(int i=0;i<4;++i) {
        const int row=row0+8*i<rows?row0+8*i:row0;
        if constexpr(DOWN)w[i]=blob+l.down_off+(size_t)row*l.d_row;
        else {const bool u=row>=l.n_ff;w[i]=blob+(u?l.up_off:0)+(size_t)(u?row-l.n_ff:row)*l.gu_row;}
    }
    for(int e=starts[g];e<starts[g+1];++e) {
        float o[4];const int xr=DOWN?e:map[e];
        aster_ptq_row4(w,x+(size_t)xr*xb,sums+(size_t)e*xb,nb,lane,o);
        if(lane==0) {
#pragma unroll
            for(int i=0;i<4;++i) {
                const int row=row0+8*i;if(row>=rows)continue;
                if constexpr(DOWN)gate[(size_t)map[e]*l.n_embd+row]=o[i];
                else {const bool u=row>=l.n_ff;(u?up:gate)[(size_t)e*l.n_ff+(u?row-l.n_ff:row)]=o[i];}
            }
        }
    }
}
'''
header.write_text('// Aster experiment derived from MIT Xolotl fork_vecdot.cuh. Default off.\n#pragma once\n'+dot+extra)
parent=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200/frozen-mma/integrated-v3/iq_kernels.original.cu'
raw=parent.read_bytes()
if hashlib.sha256(raw).hexdigest()!='230d47355c244f5d9b0a4a75b08c902579601f6da8391112761275d4b3d9a46a':raise RuntimeError('parent exact source SHA differs')
s=raw.decode()
def once(a,b):
 global s
 if s.count(a)!=1:raise RuntimeError('qsum integration anchor differs: '+a[:70])
 s=s.replace(a,b)
anchor='void native_expert_grouped(const NativeExpertLayout& L, const unsigned long long* grp_ptr, const int32_t* grp_start,'
once(anchor,'#if defined(__CUDACC__) && !defined(__HIPCC__)\n#include "aster_ptq_qsum.cuh"\n#endif\n\n'+anchor)
gu=r'''#if defined(__CUDACC__) && !defined(__HIPCC__)
    const bool aster_qsum_gu=aster_ptq_qsum_mode()>0 && !g_old_kernels && em==4 &&
        L.gu_type==143 && (L.up_type<0 || L.up_type==143) && L.n_embd==5120 && L.n_ff==2304 && lora==nullptr;
    if(aster_qsum_gu) {
        const int xb=(int)(L.n_embd/32);
        static_assert(sizeof(int32_t)<=sizeof(float));
        if((size_t)cap_entries*xb*sizeof(int32_t)>fa){std::fprintf(stderr,"qsum GU scratch bound differs\n");std::exit(1);}
        auto* sums=(int32_t*)h;
        aster_ptq_qsum_kernel<true><<<(unsigned)(((int64_t)cap_entries*xb+255)/256),256,0,s>>>(X,grp_start,n_groups,ent_tok,xb,(int)cap_entries,sums);
        aster_ptq_qsum_r4<false><<<ggu_amd,256,0,s>>>(grp_ptr,grp_start,n_groups,ent_tok,X,L,sums,gate,up);
    } else
#endif
'''
anchor='    if ((em == 1 || em == 2 || em == 4) && amd_gu && (L.up_type < 0 || L.up_type == L.gu_type)) {'
once(anchor,gu+anchor)
down=r'''#if defined(__CUDACC__) && !defined(__HIPCC__)
    const bool aster_qsum_down=aster_ptq_qsum_mode()==2 && !g_old_kernels && em==4 &&
        L.d_type==143 && L.n_embd==5120 && L.n_ff==2304 && lora==nullptr;
    if(aster_qsum_down) {
        const int xb=(int)(L.n_ff/32);
        if((size_t)cap_entries*xb*sizeof(int32_t)>fa){std::fprintf(stderr,"qsum Down scratch bound differs\n");std::exit(1);}
        auto* sums=(int32_t*)h;
        aster_ptq_qsum_kernel<false><<<(unsigned)(((int64_t)cap_entries*xb+255)/256),256,0,s>>>(hq,grp_start,n_groups,nullptr,xb,(int)cap_entries,sums);
        aster_ptq_qsum_r4<true><<<gd_amd,256,0,s>>>(grp_ptr,grp_start,n_groups,ent_dst,hq,L,sums,out,nullptr);
    } else
#endif
'''
anchor='    if ((em == 1 || em == 2 || em == 4) &&\n        (L.d_type == 20 || L.d_type == 23 || L.d_type == 42 || L.d_type == 143 || L.d_type == 11)) {'
once(anchor,down+anchor)
(BASE/'aster_ptq_qsum_iq_kernels.cu').write_text(s)
out=dict(prepared_only=True,parent_iq_sha256=hashlib.sha256(raw).hexdigest(),header_sha256=hashlib.sha256(header.read_bytes()).hexdigest(),patched_iq_sha256=hashlib.sha256((BASE/'aster_ptq_qsum_iq_kernels.cu').read_bytes()).hexdigest(),flag='ASTER_XQ_PTQ_QSUM=0|gu|both',extra_weight_bytes=0,scratch_reused='float-h, no LoRA',hardware_tests_executed=False,model_gain_claimed=False)
(BASE/'xolotl-ptq-qsum-source-plan.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
