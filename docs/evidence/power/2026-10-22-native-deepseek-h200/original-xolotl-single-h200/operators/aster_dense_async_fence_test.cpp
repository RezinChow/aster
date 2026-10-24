// Hermetic lifetime/order tests. CUDA equivalence requires a separate live model run.
#include "aster_dense_async_fence.hpp"
#include <cstdio>
#include <cstdlib>
#include <vector>
static void require(bool value) { if (!value) std::abort(); }
int main() {
    AsterDenseAsyncFence f; int waits = 0; std::vector<int> order;
    auto wait = [&] { ++waits; order.push_back(1); };
    f.before_allocation(false, wait); require(waits == 0);
    f.submitted(true, true); require(f.pending);
    f.before_allocation(true, wait); require(waits == 0 && f.pending);
    f.submitted(true, false); require(f.pending);
    f.before_allocation(false, wait); order.push_back(2);
    require(waits == 1 && !f.pending && order == std::vector<int>({1,2}));
    f.submitted(true, true); f.completed(); f.invalidate(wait); require(waits == 1);
    f.submitted(true, true); order.clear(); f.invalidate(wait); order.push_back(3);
    require(waits == 2 && !f.pending && order == std::vector<int>({1,3}));
    f.submitted(true, true); f.submitted(false, false); require(!f.pending);
    f.invalidate(wait); f.before_allocation(false, wait); require(waits == 2);
    for (int stable = 0; stable < 2; ++stable) {
        f.submitted(true, true); int before = waits;
        f.before_allocation(stable != 0, wait);
        require(waits == before + (stable ? 0 : 1));
        f.completed();
    }
    std::puts("PASS: ordered fence before allocation/free, retained same-stream work, readback and synchronous completion");
}
