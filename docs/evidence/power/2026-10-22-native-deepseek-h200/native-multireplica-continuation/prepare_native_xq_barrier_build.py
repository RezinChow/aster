"""Build the native streaming runner plus its private replica-barrier tests."""
from pathlib import Path

BASE=Path('D:/code/aster/target/h200-native')
source=(BASE/'prepare_native_xq_runner_build.py').read_text().replace('xq-v15','xq-v18').replace('xq-native-runner-linux','xq-replica-barrier-linux')
needle='"profile.dev.package.a3s-power.opt-level=2"]'
replacement='"profile.dev.package.a3s-power.opt-level=2", "--config", "profile.dev.package.sha2.opt-level=3", "--config", "profile.dev.package.digest.opt-level=3", "--config", "profile.dev.package.block-buffer.opt-level=3", "--config", "profile.dev.package.crypto-common.opt-level=3", "--config", "profile.dev.package.generic-array.opt-level=3"]'
if source.count(needle)!=1:raise RuntimeError('reviewed native runner command changed')
source=source.replace(needle,replacement)
extra='''    barrier_command = runner_command.copy()
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
'''
if source.count('\nneedle=')!=1:raise RuntimeError('reviewed native build extension shape changed')
source=source.replace('\nneedle=','\nextension += '+repr(extra)+'\nneedle=',1)
exec(compile(source,'prepare_native_xq_barrier_build.py','exec'))
