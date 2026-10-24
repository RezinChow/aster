"""Add only lock-checksummed public crates and run CUDA-disabled storage tests."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tarfile
import time

root = Path(__file__).resolve().parent
work = Path("/tmp/output")
inputs = json.loads((root / "xq-storage-cache-inputs.json").read_text())
if hashlib.sha256((root / "xq-storage-public-crates.tar.gz").read_bytes()).hexdigest() != inputs["archive_sha256"]:
    raise RuntimeError("public cache supplement archive mismatch")
if work.is_symlink() or work.stat().st_uid != os.getuid():
    raise RuntimeError("owned build directory changed")
source = work / "source.xq-v4"
snapshot = json.loads((root / "xq-build-inputs.json").read_text())
for record in snapshot["files"]:
    if hashlib.sha256((source / record["file"]).read_bytes()).hexdigest() != record["sha256"]:
        raise RuntimeError("frozen XQ build source changed")
cache_roots = list((work / "cargo-home/registry/cache").iterdir())
if len(cache_roots) != 1 or cache_roots[0].is_symlink():
    raise RuntimeError("expected one owned crates.io cache")
expected = {record["file"]: record["sha256"] for record in inputs["files"]}
with tarfile.open(root / "xq-storage-public-crates.tar.gz", "r:gz") as archive:
    members = archive.getmembers()
    if len(members) != len(expected) or len(members) > 512 or sum(x.size for x in members) > 128 * 1024**2:
        raise RuntimeError("public cache supplement exceeds its exact bound")
    for item in members:
        if not item.isfile() or "/" in item.name or "\\" in item.name or item.name not in expected:
            raise RuntimeError("public cache entry is outside its frozen file set")
        raw = archive.extractfile(item).read()
        if hashlib.sha256(raw).hexdigest() != expected[item.name]:
            raise RuntimeError("public crate differs from Cargo.lock checksum")
        target = cache_roots[0] / item.name
        if target.exists():
            if target.is_symlink() or hashlib.sha256(target.read_bytes()).hexdigest() != expected[item.name]:
                raise RuntimeError("existing public crate cache differs")
        else:
            with target.open("xb") as output:
                output.write(raw)
env = dict(os.environ)
env.update(PATH=str(work / "rust/bin") + ":" + env.get("PATH", ""), CARGO_HOME=str(work / "cargo-home"),
           RUSTC=str(work / "rust/bin/rustc"), CARGO_TARGET_DIR=str(work / "target"), CARGO_BUILD_JOBS="8")
command = ["cargo", "test", "-p", "a3s-power", "--locked", "--offline", "--no-default-features", "--features", "embedded-inference", "--lib", "raw_file::tests", "--", "--nocapture"]
start = time.time()
with (root / "xq-power-storage-linux-resumed.log").open("w") as output:
    result = subprocess.run(command, cwd=source, env=env, stdout=output, stderr=output, timeout=900)
report = {"schema": "aster-xq-linux-storage-resume-v1", "unix": time.time(), "command": command,
          "exit_code": result.returncode, "elapsed_seconds": time.time() - start,
          "gpu_requested": 0, "source_archive_sha256": snapshot["source_archive_sha256"],
          "public_cache_supplement_sha256": inputs["archive_sha256"]}
(root / "xq-storage-linux-result.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report), flush=True)
raise SystemExit(result.returncode)
