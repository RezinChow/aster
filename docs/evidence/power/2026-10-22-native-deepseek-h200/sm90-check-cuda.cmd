@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" > nul
if errorlevel 1 exit /b 1
set "NVCC_PREPEND_FLAGS=-allow-unsupported-compiler"
set "CUDA_COMPUTE_CAP=90"
set "CARGO_BUILD_JOBS=8"
cargo check -p a3s-deepseek --locked --offline --features cuda --all-targets --target-dir target/h200-native/cuda-target
exit /b %errorlevel%
