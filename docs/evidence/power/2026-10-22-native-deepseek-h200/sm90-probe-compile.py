import ctypes as c
import os
from pathlib import Path
if os.name == 'nt':
    dll = Path('C:/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v12.6/bin')
    os.add_dll_directory(str(dll))
    nv = c.CDLL(str(dll/'nvrtc64_120_0.dll'))
else:
    nv = c.CDLL('libnvrtc.so.12')
program = c.c_void_p()
source = Path('crates/deepseek/src/cuda/group32.cu').read_bytes()
nv.nvrtcCreateProgram(c.byref(program), source, b'group32.cu', 0, None, None)
opts = (c.c_char_p * 3)(b'--gpu-architecture=compute_90', b'--ftz=false', b'--fmad=false')
status = nv.nvrtcCompileProgram(program, 3, opts)
n = c.c_size_t()
nv.nvrtcGetProgramLogSize(program, c.byref(n))
log = c.create_string_buffer(n.value)
nv.nvrtcGetProgramLog(program, log)
print('NVRTC status:', status, 'log:', log.value.decode())
if status: raise SystemExit(status)
nv.nvrtcGetPTXSize(program, c.byref(n))
ptx = c.create_string_buffer(n.value)
nv.nvrtcGetPTX(program, ptx)
Path('target/h200-native/group32-v1.ptx').write_bytes(ptx.value)
nv.nvrtcDestroyProgram(c.byref(program))
print('PTX bytes:',len(ptx.value))
