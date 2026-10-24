@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" > nul
if errorlevel 1 exit /b 1
set "LIB=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6\lib\x64;%LIB%"
set "PATH=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6\bin;%PATH%"
set "NVCC_PREPEND_FLAGS=-allow-unsupported-compiler"
set "CUDA_COMPUTE_CAP=90"
set "CARGO_BUILD_JOBS=8"
cargo test -p a3s-deepseek --locked --offline --features cuda --lib --target-dir D:/code/aster/target/h200-native/cuda-target -- --nocapture
exit /b %errorlevel%
