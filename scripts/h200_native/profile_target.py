"""Owned Nsight target shim: keep native JSON separate from profiler output."""
import json
import os
from pathlib import Path
import sys


def main():
    if len(sys.argv) != 5:
        raise RuntimeError('profile target requires its exact stage, binary and two ACL paths')
    root, binary, power, native = map(Path, sys.argv[1:])
    if (root.resolve() != root or root.stat().st_uid != 10250 or os.getuid() != 10250
            or binary.resolve() != binary or binary.stat().st_uid != 10250
            or binary.parent != Path('/tmp') / root.name
            or [power, native] != [root / 'power.acl', root / 'native.acl']):
        raise RuntimeError('profile target escaped its frozen owned serving composition')
    os.umask(0o077)
    stdout = os.open(root / 'native.stdout.log', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    stderr = os.open(root / 'native.stderr.log', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    os.dup2(stdout, 1)
    os.dup2(stderr, 2)
    os.close(stdout)
    os.close(stderr)
    pid = os.getpid()
    fields = Path('/proc/' + str(pid) + '/stat').read_text().split(') ', 1)[1].split()
    receipt = dict(pid=pid, start_ticks=int(fields[19]), uid=os.getuid(), binary=str(binary))
    temporary = root / 'profile-target-process.tmp'
    with temporary.open('x') as output:
        output.write(json.dumps(receipt) + '\n')
    temporary.replace(root / 'profile-target-process.json')
    os.execv(binary, [str(binary), str(power), str(native)])


if __name__ == '__main__':
    main()
