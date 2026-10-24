"""Bounded independent ABI probe; not full Rust/model/service qualification."""
import ctypes as c
import hashlib
import json
import math
from pathlib import Path
import time
import torch

ROOT = Path(__file__).resolve().parent
START = time.time()
def check(status):
    if status != 0:
        raise RuntimeError('CUDA driver status ' + str(status))

torch.cuda.init()
if torch.cuda.get_device_capability(0) != (9, 0):
    raise RuntimeError('owned H200 SM90 required')
torch.empty(1,device='cuda')
driver=c.CDLL('libcuda.so.1')
module=c.c_void_p(); function=c.c_void_p()
ptx=(ROOT/'group32-v1.ptx').read_bytes()
check(driver.cuModuleLoadDataEx(c.byref(module), c.c_char_p(ptx), 0, None, None))
driver.cuLaunchKernel.argtypes=[c.c_void_p]+[c.c_uint]*7+[c.c_void_p,c.POINTER(c.c_void_p),c.c_void_p]
def fp8(i):
    e=(i>>3)&15; f=i&7
    return math.copysign(math.ldexp(float(f),-9) if e==0 else math.ldexp(1+f/8,e-7), -1 if i&128 else 1)
def decode(values,scales,m,k,fp4=False,block=False):
    lut = [0,.5,1,1.5,2,3,4,6]
    return torch.tensor([[(((-1 if (values[r*k+q]&8) else 1)*lut[values[r*k+q]&7]) if fp4 else fp8(values[r*k+q])) * math.ldexp(1.,scales[(r//32 if block else r)*(k//32)+q//32]-127) for q in range(k)] for r in range(m)],dtype=torch.float64)

cases=[]
for symbol in [b'aster_group32_mma_v1',b'aster_raw_f32_v1']:
    check(driver.cuModuleGetFunction(c.byref(function), module, symbol))
    attributes={}
    for key,code in [('static_shared_bytes',1),('local_bytes_per_thread',3),('registers_per_thread',4),('ptx_version',5),('binary_version',6)]:
        value=c.c_int();check(driver.cuFuncGetAttribute(c.byref(value),code,function));attributes[key]=value.value
    if attributes['local_bytes_per_thread'] or attributes['static_shared_bytes']:raise RuntimeError('unexpected zero-workspace allocation')
    configurations=[(fp4,m,n,k,False) for fp4 in [False,True] for m,n,k in [(1,1,32),(3,9,64),(17,33,96),(16,32,128),(1,64,4096)]]
    if symbol==b'aster_raw_f32_v1':configurations.append((False,1,1,32,True))
    for fp4,m,n,k,tiny in configurations:
        ac=[([0,1,0x28,0x38,0x42,0xb8,0xc0][i%7]) for i in range(m*k)]
        asc=[120+i%9 for i in range(m*k//32)]
        wc=[(i%16 if fp4 else [0,0x30,0x38,0x40,0xb0,0xc0][i%6]) for i in range(n*k)]
        wr=n if fp4 else (n+31)//32
        wsc=[121+i%8 for i in range(wr*k//32)]
        wb=[wc[i]|(wc[i+1]<<4) for i in range(0,len(wc),2)] if fp4 else wc
        if tiny:ac=[1]*32;asc=[0];wc=[0x38]*32;wb=wc;wsc=[247]
        expected=decode(ac,asc,m,k) @ decode(wc,wsc,n,k,fp4,not fp4).t()
        tensors=[torch.tensor(v,dtype=torch.uint8,device='cuda') for v in [ac,asc,wb,wsc]]
        torch.cuda.synchronize(); baseline=torch.cuda.memory_allocated(); torch.cuda.reset_peak_memory_stats()
        out=torch.full((m,n),float('nan'),dtype=torch.float32,device='cuda')
        arguments=[c.c_void_p(t.data_ptr()) for t in tensors+[out]]+[c.c_uint(v) for v in [m,n,k,int(fp4)]]
        pointers=(c.c_void_p*len(arguments))(*[c.cast(c.byref(v),c.c_void_p) for v in arguments])
        check(driver.cuLaunchKernel(function,(n+7)//8,(m+15)//16,1,32,1,1,0,c.c_void_p(torch.cuda.current_stream().cuda_stream),pointers,None))
        torch.cuda.synchronize()
        peak_delta=torch.cuda.max_memory_allocated()-baseline
        actual=out.cpu().double(); delta=actual-expected
        l2=float(torch.linalg.vector_norm(delta)/torch.linalg.vector_norm(expected).clamp_min(1e-300))
        cosine=float(torch.dot(actual.flatten(),expected.flatten())/(torch.linalg.vector_norm(actual)*torch.linalg.vector_norm(expected)).clamp_min(1e-300))
        zero_max=float(delta[expected==0].abs().max()) if bool((expected==0).any()) else 0.
        case={'kernel':symbol.decode(),'attributes':attributes,'tiny_checkpoint_product':tiny,'layout':'mxfp4_block32' if fp4 else 'fp8_block32','m':m,'n':n,'k':k,'normalized_l2':l2,'cosine':cosine,'max_abs':float(delta.abs().max()),'zero_ref_max_abs':zero_max,'finite':bool(torch.isfinite(actual).all()),'kernel_scratch_bytes':0,'output_bytes':m*n*4,'allocator_peak_delta':peak_delta}
        case['passed']=case['finite'] and l2<=.02 and cosine>=.999 and zero_max<=.0001
        cases.append(case)
        print(json.dumps({'case':case}),flush=True)
        if not case['passed']: raise RuntimeError('frozen operator numerical budget exceeded')
        if tiny and actual.item()!=2**-11:raise RuntimeError('checkpoint subnormal product was lost')
        del tensors,out
check(driver.cuModuleUnload(module))
result={'scope':'independent CUDA driver ABI microfixtures; not Rust adapter, official operator activations or full model','device':torch.cuda.get_device_name(0),'capability':list(torch.cuda.get_device_capability(0)),'torch':torch.__version__,'torch_cuda':torch.version.cuda,'abi':'aster-sm90-group32-mma-v1','source_sha256':hashlib.sha256((ROOT/'group32.cu').read_bytes()).hexdigest(),'ptx_sha256':hashlib.sha256(ptx).hexdigest(),'cases':cases,'all_passed':all(x['passed'] for x in cases),'duration_seconds':time.time()-START}
(ROOT/'result.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'completed':True,'all_passed':result['all_passed']}),flush=True)
