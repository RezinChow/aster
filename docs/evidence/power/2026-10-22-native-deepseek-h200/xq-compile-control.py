"""Compile the exact XQ control with NVRTC/ptxas; never opens a CUDA device."""
import ctypes as c
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

root = Path.cwd()
source = root / "crates/deepseek/src/cuda/xq.cu"
destination = root / "docs/evidence/power/2026-10-22-native-deepseek-h200"
toolkit = Path("C:/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v12.6/bin")
if os.name != "nt":
    raise RuntimeError("This compiler receipt pins the Windows CUDA 12.6 toolchain")
dll_directory = os.add_dll_directory(str(toolkit))
nv = c.CDLL(str(toolkit / "nvrtc64_120_0.dll"))
nv.nvrtcCreateProgram.argtypes = [c.POINTER(c.c_void_p), c.c_char_p, c.c_char_p, c.c_int, c.c_void_p, c.c_void_p]
nv.nvrtcCompileProgram.argtypes = [c.c_void_p, c.c_int, c.POINTER(c.c_char_p)]
nv.nvrtcGetProgramLogSize.argtypes = [c.c_void_p, c.POINTER(c.c_size_t)]
nv.nvrtcGetProgramLog.argtypes = [c.c_void_p, c.c_void_p]
nv.nvrtcGetPTXSize.argtypes = [c.c_void_p, c.POINTER(c.c_size_t)]
nv.nvrtcGetPTX.argtypes = [c.c_void_p, c.c_void_p]
nv.nvrtcDestroyProgram.argtypes = [c.POINTER(c.c_void_p)]
nv.nvrtcVersion.argtypes = [c.POINTER(c.c_int), c.POINTER(c.c_int)]


def check(code, operation):
    if code != 0:
        raise RuntimeError(f"{operation} failed with NVRTC status {code}")


program = c.c_void_p()
raw = source.read_bytes()
options = [b"--gpu-architecture=compute_90", b"--ftz=false", b"--fmad=false"]
check(nv.nvrtcCreateProgram(c.byref(program), raw, b"xq.cu", 0, None, None), "create")
try:
    args = (c.c_char_p * len(options))(*options)
    status = nv.nvrtcCompileProgram(program, len(options), args)
    size = c.c_size_t()
    check(nv.nvrtcGetProgramLogSize(program, c.byref(size)), "log size")
    log = c.create_string_buffer(size.value)
    check(nv.nvrtcGetProgramLog(program, log), "compile log")
    (destination / "xq-nvrtc.log").write_bytes(log.value)
    check(status, "compile")
    check(nv.nvrtcGetPTXSize(program, c.byref(size)), "PTX size")
    ptx = c.create_string_buffer(size.value)
    check(nv.nvrtcGetPTX(program, ptx), "PTX")
    (destination / "xq-control.ptx").write_bytes(ptx.value)
finally:
    check(nv.nvrtcDestroyProgram(c.byref(program)), "destroy")

major, minor = c.c_int(), c.c_int()
check(nv.nvrtcVersion(c.byref(major), c.byref(minor)), "version")
cubin = destination / "xq-control.cubin"
assembled = subprocess.run([str(toolkit / "ptxas.exe"), "-arch=sm_90", "-v", str(destination / "xq-control.ptx"), "-o", str(cubin)], capture_output=True, timeout=60)
(destination / "xq-ptxas.log").write_bytes(assembled.stdout + assembled.stderr)
if assembled.returncode:
    raise RuntimeError(f"ptxas failed with status {assembled.returncode}")
sass = subprocess.run([str(toolkit / "cuobjdump.exe"), "--dump-sass", str(cubin)], capture_output=True, timeout=60, check=True)
(destination / "xq-control.sass.txt").write_bytes(sass.stdout)
report = {
    "scope": "compile-only; no CUDA device opened and no GPU numeric/performance claim",
    "abi": "aster-sm90-xq-warp-f32-v1",
    "nvrtc_version": [major.value, minor.value],
    "options": [x.decode() for x in options],
    "source_sha256": hashlib.sha256(raw).hexdigest(),
    "ptx_sha256": hashlib.sha256(ptx.value).hexdigest(),
    "cubin_sha256": hashlib.sha256(cubin.read_bytes()).hexdigest(),
    "ptx_bytes": len(ptx.value),
    "ptxas_output": (assembled.stdout + assembled.stderr).decode(errors="replace"),
}
(destination / "xq-cuda-compile.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report))
