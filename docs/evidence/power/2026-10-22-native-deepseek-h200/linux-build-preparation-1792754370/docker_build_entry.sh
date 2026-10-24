#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
printf 'PREPARING_UBUNTU_BUILD_TOOLS\n'
printf '%s\n' 'deb http://archive.ubuntu.com/ubuntu jammy main' 'deb http://archive.ubuntu.com/ubuntu jammy-updates main' 'deb http://security.ubuntu.com/ubuntu jammy-security main' > /etc/apt/sources.list
timeout --signal=TERM --kill-after=10 600 apt-get -o Acquire::Languages=none -o Acquire::Retries=0 update > /output/apt-update-main.log 2>&1
timeout --signal=TERM --kill-after=10 600 apt-get -o Acquire::Retries=0 install -y --no-install-recommends g++ binutils python3 ca-certificates pkg-config > /output/apt-install.log 2>&1
printf 'VERIFYING_CUDA_BUILD_TOOL_ARCHIVE\n'
printf '%s  %s\n' 7f19675f84ae19e8368b9319fde4ae70cfbc6f7b94f10745adde83dfab6c3658 /inputs/linux-cuda126-build-tools.tar.gz | sha256sum --check
mkdir /usr/local/cuda
tar --no-same-owner -xzf /inputs/linux-cuda126-build-tools.tar.gz -C /usr/local/cuda
for native_archive in linux-rust1971.tar.gz native-public-cargo-cache.tar.gz native-root-source.tar.gz; do
    ln -s "/inputs/$native_archive" "/output/$native_archive"
done
cp /inputs/build-inputs.json /output/build-inputs.json
cp /inputs/linux_cuda_build_worker.py /output/linux_cuda_build_worker.py
printf 'STARTING_ROOT_WORKSPACE_CUDA_BUILD\n'
exec python3 -u /output/linux_cuda_build_worker.py
