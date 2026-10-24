#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
if test -f /output/resume-source-v3.json; then
    printf 'BUILDING_VERIFIED_CURRENT_ROOT_SNAPSHOT\n'
    exec python3 -u /output/linux_cuda_build_verified_source.py
fi
if test -f /output/resume-source-v2.json; then
    printf 'RESUMING_WITH_COMPLETE_SOURCE_TARGET_ENTRIES\n'
    exec python3 -u /output/linux_cuda_build_resume_worker.py
fi
printf 'PREPARING_UBUNTU_BUILD_TOOLS\n'
test -f /output/offline-apt-ready
(cd /output/debs && sha256sum --strict --check SHA256SUMS) > /output/apt-package-verification.log
find /output/debs -maxdepth 1 -type f -name '*.deb' -exec cp -n '{}' /var/cache/apt/archives/ ';'
timeout --signal=TERM --kill-after=10 300 apt-get --no-download install -y --no-install-recommends g++ binutils python3 ca-certificates pkg-config > /output/apt-install-offline.log 2>&1
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
