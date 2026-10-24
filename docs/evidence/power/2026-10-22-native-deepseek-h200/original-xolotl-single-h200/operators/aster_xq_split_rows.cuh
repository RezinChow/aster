// Aster experiment derived from MIT-licensed Xolotl grouped expert kernels.
// Preserve lane accumulation/reduction order; reuse a decoded block across tokens
// while interleaving independent output rows. Selection defaults to zero (off).
#pragma once

static int aster_xq_split_rows() {
    static const int rows = [] {
        const char* value = std::getenv("ASTER_XQ_SPLIT_ROWS");
        if (!value || std::strcmp(value, "0") == 0) return 0;
        if (std::strcmp(value, "2") == 0) return 2;
        if (std::strcmp(value, "4") == 0) return 4;
        std::fprintf(stderr, "ASTER_XQ_SPLIT_ROWS must be 0, 2 or 4\n");
        std::abort();
    }();
    return rows;
}

template<int TY, int RPW>
__device__ __forceinline__ void aster_xq_rows_dot(
        const uint8_t* const* rows, const block_q8_1* input, const int* offsets,
        int count, int blocks, int lane, float (&sum)[RPW][GRP_NC]) {
    static_assert(RPW == 2 || RPW == 4, "closed row interleave set");
    using F = Fmt<TY>;
#pragma unroll
    for (int r = 0; r < RPW; ++r)
#pragma unroll
        for (int c = 0; c < GRP_NC; ++c) sum[r][c] = 0.0f;
    // Exactly the old per-lane k sequence; do not reassociate the float sums.
    for (int k = lane; k < blocks * F::ipb; k += 32) {
        const int block = k / F::ipb;
        const int part = F::step * (k % F::ipb);
#pragma unroll
        for (int r = 0; r < RPW; ++r) {
            const auto decoded = Split<TY>::template load<false>(rows[r], block, part);
#pragma unroll
            for (int c = 0; c < GRP_NC; ++c)
                if (c < count)
                    sum[r][c] += Split<TY>::apply(decoded, input + offsets[c] + block * (F::qk / 32), part);
        }
    }
#pragma unroll
    for (int r = 0; r < RPW; ++r)
#pragma unroll
        for (int c = 0; c < GRP_NC; ++c)
            if (c < count) sum[r][c] = warp_sum(sum[r][c]);
}

template<int TY, int RPW>
__global__ void __launch_bounds__(256) aster_xq_gu_rows_kernel(
        const unsigned long long* __restrict__ pointers, const int32_t* __restrict__ starts,
        const int32_t* __restrict__ n_groups, const int32_t* __restrict__ tokens,
        const block_q8_1* __restrict__ input, NativeExpertLayout layout,
        float* __restrict__ gate, float* __restrict__ up) {
    const int groups = *n_groups;
    if (blockIdx.y >= groups) return;
    const int lane = threadIdx.x & 31, warp = threadIdx.x >> 5;
    const int first = blockIdx.x * (8 * RPW) + warp;
    const int rows_total = 2 * (int) layout.n_ff;
    if (first >= rows_total) return;
    const int blocks = layout.n_embd / Fmt<TY>::qk;
    const int stride = layout.n_embd / 32;
    for (int group = blockIdx.y; group < groups; group += gridDim.y) {
        const uint8_t* blob = (const uint8_t*) pointers[group];
        const uint8_t* weights[RPW];
        float scales[RPW];
#pragma unroll
        for (int r = 0; r < RPW; ++r) {
            const int row = first + 8 * r < rows_total ? first + 8 * r : first;
            const bool is_up = row >= layout.n_ff;
            const int index = is_up ? row - layout.n_ff : row;
            weights[r] = blob + (is_up ? layout.up_off : 0) + (size_t) index * layout.gu_row;
            scales[r] = layout.tail_off ? ((const float*) (blob + layout.tail_off))[is_up ? 1 : 0] : 1.0f;
        }
        for (int entry = starts[group]; entry < starts[group + 1]; entry += GRP_NC) {
            const int count = min(GRP_NC, starts[group + 1] - entry);
            int offsets[GRP_NC] = {};
#pragma unroll
            for (int c = 0; c < GRP_NC; ++c)
                if (c < count) offsets[c] = tokens[entry + c] * stride;
            float sums[RPW][GRP_NC];
            aster_xq_rows_dot<TY, RPW>(weights, input, offsets, count, blocks, lane, sums);
#pragma unroll
            for (int r = 0; r < RPW; ++r) {
                const int row = first + 8 * r;
                if (row >= rows_total) continue;
                const bool is_up = row >= layout.n_ff;
                const int index = is_up ? row - layout.n_ff : row;
#pragma unroll
                for (int c = 0; c < GRP_NC; ++c)
                    if (c < count && lane == c)
                        (is_up ? up : gate)[(size_t) (entry + c) * layout.n_ff + index] = sums[r][c] * scales[r];
            }
        }
    }
}

template<int TY, int RPW>
__global__ void __launch_bounds__(256) aster_xq_down_rows_kernel(
        const unsigned long long* __restrict__ pointers, const int32_t* __restrict__ starts,
        const int32_t* __restrict__ n_groups, const int32_t* __restrict__ destinations,
        const block_q8_1* __restrict__ input, NativeExpertLayout layout, float* __restrict__ output) {
    const int groups = *n_groups;
    if (blockIdx.y >= groups) return;
    const int lane = threadIdx.x & 31, warp = threadIdx.x >> 5;
    const int first = blockIdx.x * (8 * RPW) + warp;
    const int rows_total = layout.n_embd;
    if (first >= rows_total) return;
    const int blocks = layout.n_ff / Fmt<TY>::qk;
    const int stride = layout.n_ff / 32;
    for (int group = blockIdx.y; group < groups; group += gridDim.y) {
        const uint8_t* blob = (const uint8_t*) pointers[group];
        const uint8_t* weights[RPW];
#pragma unroll
        for (int r = 0; r < RPW; ++r) {
            const int row = first + 8 * r < rows_total ? first + 8 * r : first;
            weights[r] = blob + layout.down_off + (size_t) row * layout.d_row;
        }
        for (int entry = starts[group]; entry < starts[group + 1]; entry += GRP_NC) {
            const int count = min(GRP_NC, starts[group + 1] - entry);
            int offsets[GRP_NC] = {};
#pragma unroll
            for (int c = 0; c < GRP_NC; ++c)
                if (c < count) offsets[c] = (entry + c) * stride;
            float sums[RPW][GRP_NC];
            aster_xq_rows_dot<TY, RPW>(weights, input, offsets, count, blocks, lane, sums);
#pragma unroll
            for (int r = 0; r < RPW; ++r) {
                const int row = first + 8 * r;
                if (row >= rows_total) continue;
#pragma unroll
                for (int c = 0; c < GRP_NC; ++c)
                    if (c < count && lane == c)
                        output[(size_t) destinations[entry + c] * layout.n_embd + row] = sums[r][c];
            }
        }
    }
}
