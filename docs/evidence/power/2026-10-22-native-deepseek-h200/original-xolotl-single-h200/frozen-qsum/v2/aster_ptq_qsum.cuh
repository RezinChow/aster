// Aster V2 experiment derived from MIT Xolotl. Per-entry integer sums in shared memory; default off.
#pragma once
__device__ __forceinline__ float aster_ptq_dot_qsum(const void* __restrict__ vbq, const block_q8_1* __restrict__ bq8_1,
                                                     const int& kbx, const int& iqs, const int32_t* sumu) {
    const strata_block_ptq1_0* bq = (const strata_block_ptq1_0*) vbq + kbx;
    int sumi[4] = {0, 0, 0, 0};
    const uint32_t* qs32 = (const uint32_t*) bq->qs;   // 28-byte blocks of a 4-aligned row: 4-aligned
    // qs[0..15]: element t*16 + m for trit t of byte m
#pragma unroll
    for (int w = 0; w < 4; ++w) {
        const uint32_t packed = qs32[w];
        uint32_t v_lo = __byte_perm(packed, 0, 0x4140);   // [b0, 0, b1, 0]
        uint32_t v_hi = __byte_perm(packed, 0, 0x4342);   // [b2, 0, b3, 0]
#pragma unroll
        for (int t = 0; t < 5; ++t) {
            const uint32_t w_lo = v_lo * 3u, w_hi = v_hi * 3u;
            v_lo = w_lo & 0x00FF00FFu;
            v_hi = w_hi & 0x00FF00FFu;
            const int e = t * 16 + 4 * w;
            const int u = get_int_b4(bq8_1[iqs + (e >> 5)].qs, (e & 31) >> 2);
            const int q = __byte_perm(w_lo, w_hi, 0x7531);
            sumi[e >> 5] = ggml_cuda_dp4a(q, u, sumi[e >> 5]);
        }
    }
    // qs[16..23]: element 80 + t*8 + m
#pragma unroll
    for (int w = 0; w < 2; ++w) {
        const uint32_t packed = qs32[4 + w];
        uint32_t v_lo = __byte_perm(packed, 0, 0x4140);
        uint32_t v_hi = __byte_perm(packed, 0, 0x4342);
#pragma unroll
        for (int t = 0; t < 5; ++t) {
            const uint32_t w_lo = v_lo * 3u, w_hi = v_hi * 3u;
            v_lo = w_lo & 0x00FF00FFu;
            v_hi = w_hi & 0x00FF00FFu;
            const int e = 80 + t * 8 + 4 * w;
            const int u = get_int_b4(bq8_1[iqs + (e >> 5)].qs, (e & 31) >> 2);
            const int q = __byte_perm(w_lo, w_hi, 0x7531);
            sumi[e >> 5] = ggml_cuda_dp4a(q, u, sumi[e >> 5]);
        }
    }
    // qh[0..1]: element 120 + t*2 + h
#pragma unroll
    for (int h = 0; h < 2; ++h) {
        uint32_t v = bq->qh[h];
#pragma unroll
        for (int t = 0; t < 4; ++t) {
            const uint32_t w = v * 3;
            const int q = (int) (w >> 8);
            v = w & 0xFF;
            const int e = 120 + t * 2 + h;
            const int a = (int) bq8_1[iqs + (e >> 5)].qs[e & 31];
            sumi[e >> 5] += q * a;
        }
    }
    float acc = 0.0f;
#pragma unroll
    for (int k = 0; k < 4; ++k) acc += __low2float(bq8_1[iqs + k].ds) * (float) (sumi[k] - sumu[k]);
    return __half2float(bq->d) * acc;
}


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
        float* gate,float* up) {
    const int g=blockIdx.y;if(g>=*ng)return;
    const int lane=threadIdx.x&31,warp=threadIdx.x>>5;
    const int rows=DOWN?(int)l.n_embd:2*(int)l.n_ff;
    const int row0=blockIdx.x*32+warp;
    __shared__ int32_t shared_sums[160];
    const int xb=(int)((DOWN?l.n_ff:l.n_embd)/32),nb=xb/4;
    const uint8_t* blob=(const uint8_t*)ptr[g];const uint8_t* w[4];
#pragma unroll
    for(int i=0;i<4;++i) {
        const int row=row0+8*i<rows?row0+8*i:row0;
        if constexpr(DOWN)w[i]=blob+l.down_off+(size_t)row*l.d_row;
        else {const bool u=row>=l.n_ff;w[i]=blob+(u?l.up_off:0)+(size_t)(u?row-l.n_ff:row)*l.gu_row;}
    }
    for(int e=starts[g];e<starts[g+1];++e) {
        const int xr=DOWN?e:map[e];
        for(int q=threadIdx.x;q<xb;q+=blockDim.x) {
            const block_q8_1& b=x[(size_t)xr*xb+q];int acc=0;
#pragma unroll
            for(int k=0;k<8;++k)acc=ggml_cuda_dp4a(0x01010101,get_int_b4(b.qs,k),acc);
            shared_sums[q]=acc;
        }
        __syncthreads();
        float o[4];aster_ptq_row4(w,x+(size_t)xr*xb,shared_sums,nb,lane,o);
        if(lane==0) {
#pragma unroll
            for(int i=0;i<4;++i) {
                const int row=row0+8*i;if(row>=rows)continue;
                if constexpr(DOWN)gate[(size_t)map[e]*l.n_embd+row]=o[i];
                else {const bool u=row>=l.n_ff;(u?up:gate)[(size_t)e*l.n_ff+(u?row-l.n_ff:row)]=o[i];}
            }
        }
        __syncthreads();
    }
}
