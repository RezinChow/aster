"""Build the XQ CUDA qualifier in the exact owned GPU-free build container."""
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tarfile
import time

ROOT = Path(__file__).resolve().parent
START = time.time()
RESULT = {"schema": "aster-xq-replica-barrier-linux-cuda-build-v1", "gpu_execution_claimed": False, "tests_ran_on_gpu": False}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def publish():
    temporary = ROOT / "xq-build-result.tmp"
    temporary.write_text(json.dumps(RESULT, indent=2) + "\n")
    temporary.replace(ROOT / "xq-build-result.json")


def main():
    inputs = json.loads((ROOT / "xq-build-inputs.json").read_text())
    if digest(ROOT / inputs["source_archive"]) != inputs["source_archive_sha256"]:
        raise RuntimeError("XQ source archive identity mismatch")
    if digest(Path(__file__)) != inputs["worker_sha256"]:
        raise RuntimeError("XQ build worker identity mismatch")
    work = Path("/tmp/output")
    if work.is_symlink() or work.stat().st_uid != os.getuid():
        raise RuntimeError("owned build directory changed")
    source = work / "source.xq-v18"
    source.mkdir(mode=0o700)
    with tarfile.open(ROOT / inputs["source_archive"], "r:gz") as archive:
        members = archive.getmembers()
        if len(members) > 32768 or sum(x.size for x in members) > 128 * 1024**2:
            raise RuntimeError("XQ source snapshot exceeds build bounds")
        for item in members:
            name = PurePosixPath(item.name)
            if name.is_absolute() or ".." in name.parts or not item.isfile():
                raise RuntimeError("XQ source requires bounded regular relative paths")
            target = source.joinpath(*name.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("xb") as output:
                shutil.copyfileobj(archive.extractfile(item), output)
            target.chmod(0o600)
    for item in inputs["files"]:
        if digest(source / item["file"]) != item["sha256"]:
            raise RuntimeError("XQ extracted source mismatch: " + item["file"])
    env = dict(os.environ)
    env.update(PATH=str(work / "rust/bin") + ":/usr/local/cuda/bin:" + env.get("PATH", ""),
               CARGO_HOME=str(work / "cargo-home"), RUSTC=str(work / "rust/bin/rustc"),
               CARGO_TARGET_DIR=str(work / "target"), CARGO_BUILD_JOBS="8", CUDA_COMPUTE_CAP="90",
               CUDA_HOME="/usr/local/cuda", CUDA_ROOT="/usr/local/cuda",
               LIBRARY_PATH="/usr/local/cuda/lib64/stubs:/usr/local/cuda/lib64:" + env.get("LIBRARY_PATH", ""))
    versions = {}
    for name, command in [("rust", ["rustc", "--version"]), ("cargo", ["cargo", "--version"]), ("nvcc", ["nvcc", "--version"]), ("glibc", ["getconf", "GNU_LIBC_VERSION"])]:
        result = subprocess.run(command, env=env, capture_output=True, text=True, timeout=15, check=True)
        versions[name] = result.stdout
    if versions["rust"].split()[1] != "1.97.1":
        raise RuntimeError("pinned Rust toolchain differs")
    RESULT.update(unix=time.time(), phase="compiling", source_archive_sha256=inputs["source_archive_sha256"], root_identity=inputs["root_identity"], versions=versions)
    publish()
    command = ["cargo", "test", "-p", "a3s-deepseek", "--locked", "--offline", "--features", "cuda", "--lib", "--no-run", "--message-format=json"]
    with (ROOT / "xq-build.stdout.jsonl").open("w") as stdout, (ROOT / "xq-build.stderr.log").open("w") as stderr:
        result = subprocess.run(command, cwd=source, env=env, stdout=stdout, stderr=stderr, timeout=900)
    RESULT.update(command=command, build_exit_code=result.returncode)
    publish()
    if result.returncode:
        raise RuntimeError("XQ Linux CUDA build failed; retain exact compiler output")
    artifacts = []
    for line in (ROOT / "xq-build.stdout.jsonl").read_text().splitlines():
        record = json.loads(line)
        if record.get("reason") == "compiler-artifact" and record.get("target", {}).get("name") == "a3s_deepseek" and record.get("profile", {}).get("test") and record.get("executable"):
            artifacts.append(Path(record["executable"]))
    if len(artifacts) != 1 or not artifacts[0].resolve().is_relative_to(work / "target"):
        raise RuntimeError("expected one owned XQ CUDA test executable")
    binary = artifacts[0]
    compressed = ROOT / "xq-a3s-deepseek-cuda-tests.gz"
    with binary.open("rb") as source_stream, gzip.open(compressed, "wb", compresslevel=1) as output:
        shutil.copyfileobj(source_stream, output)
    runner_command = ["cargo", "build", "-p", "a3s-deepseek", "--locked", "--offline", "--features", "cuda", "--example", "run_xq_native", "--message-format=json", "--config", "profile.dev.package.a3s-deepseek.opt-level=3", "--config", "profile.dev.package.a3s-power.opt-level=2", "--config", "profile.dev.package.sha2.opt-level=3", "--config", "profile.dev.package.digest.opt-level=3", "--config", "profile.dev.package.block-buffer.opt-level=3", "--config", "profile.dev.package.crypto-common.opt-level=3", "--config", "profile.dev.package.generic-array.opt-level=3"]
    with (ROOT/"native-runner-build.stdout.jsonl").open("w") as stdout, (ROOT/"native-runner-build.stderr.log").open("w") as stderr:
        runner_result = subprocess.run(runner_command, cwd=source, env=env, stdout=stdout, stderr=stderr, timeout=900)
    RESULT["native_runner_command"] = runner_command
    if runner_result.returncode:
        raise RuntimeError("native full-model runner failed to build")
    runners = []
    for line in (ROOT/"native-runner-build.stdout.jsonl").read_text().splitlines():
        item = json.loads(line)
        if item.get("reason")=="compiler-artifact" and item.get("target",{}).get("name")=="run_xq_native" and item.get("executable"):
            runners.append(Path(item["executable"]))
    if len(runners)!=1 or not runners[0].resolve().is_relative_to(work/"target"):
        raise RuntimeError("expected one owned native full-model runner artifact")
    runner = runners[0]
    runner_archive = ROOT/"run-xq-native.gz"
    with runner.open("rb") as native_source, gzip.open(runner_archive,"wb",compresslevel=1) as output:
        shutil.copyfileobj(native_source,output)
    RESULT["native_runner"] = dict(binary_sha256=digest(runner),binary_bytes=runner.stat().st_size,archive_sha256=digest(runner_archive),archive_bytes=runner_archive.stat().st_size,execution_claimed=False)
    barrier_command = runner_command.copy()
    barrier_command[1] = "test"
    barrier_command.append("--no-run")
    with (ROOT/"barrier-tests-build.stdout.jsonl").open("w") as stdout, (ROOT/"barrier-tests-build.stderr.log").open("w") as stderr:
        barrier_result = subprocess.run(barrier_command,cwd=source,env=env,stdout=stdout,stderr=stderr,timeout=300)
    RESULT["barrier_test_build_command"] = barrier_command
    if barrier_result.returncode:raise RuntimeError("native replica barrier tests failed to compile")
    barriers=[]
    for line in (ROOT/"barrier-tests-build.stdout.jsonl").read_text().splitlines():
        item=json.loads(line)
        if item.get("reason")=="compiler-artifact" and item.get("target",{}).get("name")=="run_xq_native" and item.get("profile",{}).get("test") and item.get("executable"):
            barriers.append(Path(item["executable"]))
    if len(barriers)!=1 or not barriers[0].resolve().is_relative_to(work/"target"):
        raise RuntimeError("expected one owned native replica barrier test executable")
    barrier=barriers[0];barrier_archive=ROOT/"native-barrier-tests.gz"
    with barrier.open("rb") as barrier_source,gzip.open(barrier_archive,"wb",compresslevel=1) as output:
        shutil.copyfileobj(barrier_source,output)
    RESULT["barrier_tests"] = dict(binary_sha256=digest(barrier),binary_bytes=barrier.stat().st_size,archive_sha256=digest(barrier_archive),archive_bytes=barrier_archive.stat().st_size,tests_ran=False,expected_tests=2)
    RESULT.update(phase="built", binary_sha256=digest(binary), binary_bytes=binary.stat().st_size,
                  archive_sha256=digest(compressed), archive_bytes=compressed.stat().st_size)
    publish()
    RESULT.update(elapsed_seconds=time.time() - START, finished_unix=time.time())
    publish()



try:
    main()
except Exception as error:
    RESULT.update(phase="failed", error_type=type(error).__name__, error=str(error), finished_unix=time.time())
    publish()
    raise
finally:
    print(json.dumps(RESULT), flush=True)
