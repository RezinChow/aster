#!/usr/bin/env bash
set -euo pipefail
native_root=/mnt/d/code/aster/target/h200-native
native_name="$1"
native_image="$2"
if docker container inspect "$native_name" >/dev/null 2>&1; then
    printf 'Refusing duplicate native build container\n' >&2
    exit 1
fi
native_mounts=()
for native_input in linux-rust1971.tar.gz native-public-cargo-cache.tar.gz native-root-source.tar.gz linux-cuda126-build-tools.tar.gz linux_cuda_build_worker.py build-inputs.json docker_build_entry.sh; do
    native_mounts+=(--mount "type=bind,source=$native_root/$native_input,target=/inputs/$native_input,readonly")
done
exec docker run --detach --init --restart=no --name "$native_name" --label aster.task=native-h200-cuda-build --cpus=8 --memory=20g --pids-limit=512 --env CUDA_VISIBLE_DEVICES= "${native_mounts[@]}" --mount "type=bind,source=$native_root/$native_name,target=/output" --workdir /output "$native_image" timeout --signal=TERM --kill-after=30 2400 bash /inputs/docker_build_entry.sh
