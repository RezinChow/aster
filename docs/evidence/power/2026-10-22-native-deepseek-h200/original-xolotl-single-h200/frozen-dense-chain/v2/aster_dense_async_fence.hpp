// Aster private experiment: guard queued dense work before allocator invalidation.
#pragma once
struct AsterDenseAsyncFence {
    bool pending = false;
    template<class Fence> void before_allocation(bool stable, Fence fence) {
        if (pending && !stable) { fence(); pending = false; }
    }
    template<class Fence> void invalidate(Fence fence) {
        if (pending) { fence(); pending = false; }
    }
    void submitted(bool asynchronous, bool finish_scope) {
        if (!asynchronous) pending = false;
        else if (finish_scope) pending = true;
    }
    void completed() { pending = false; }
};
