#!/usr/bin/env python3
"""Wait for all pinned model parts, assemble on H200 NVMe, then activate Power."""

import hashlib
import json
import shutil
import subprocess
import sys
import time

from service import ROOT, STAGING, MODEL_SHA256


def main():
    parts = [STAGING/f'assets/v3/V41-XQ-1017-v3.gguf.part-{i:02d}-of-16' for i in range(1, 17)]
    while not all(path.is_file() for path in parts):
        print(json.dumps({'waiting_for_parts': sum(path.is_file() for path in parts),
                          'expected': len(parts), 'time_unix': time.time()}), flush=True)
        time.sleep(30)
    destination = ROOT/'models/V41-XQ-1017-v3.gguf'
    temporary = destination.with_name(destination.name+'.assembling')
    if destination.exists():
        raise RuntimeError('joined destination already exists; refusing to overwrite it')
    checksum = hashlib.sha256()
    started = time.monotonic()
    with temporary.open('wb') as output:
        for part in parts:
            with part.open('rb') as source:
                for block in iter(lambda: source.read(32 * 1024**2), b''):
                    checksum.update(block)
                    output.write(block)
            print('ASSEMBLED', part.name, flush=True)
    if checksum.hexdigest() != MODEL_SHA256:
        raise RuntimeError('assembled model failed the pinned SHA-256 gate')
    temporary.replace(destination)
    destination.chmod(0o444)
    stat = destination.stat()
    identity = {'sha256': MODEL_SHA256, 'size': stat.st_size, 'mtime_ns': stat.st_mtime_ns}
    (ROOT/'models/verified-model.json').write_text(json.dumps(identity))
    print('JOINED_MODEL_VERIFIED', json.dumps(identity), 'elapsed_s', time.monotonic()-started, flush=True)
    shutil.copy2(STAGING/'assets/v3/V41-XQ-1017-v3.gguf.experts.json', ROOT/'models/V41-XQ-1017-v3.gguf.experts.json')
    while not (ROOT/'build-h200/ds41_generate').is_file():
        print('WAITING_FOR_H200_ENGINE_BUILD', flush=True)
        time.sleep(30)
    subprocess.run([sys.executable, str(STAGING/'service.py'), 'start', '--layout', 'split8', '--profile', 'exact'], check=True)


if __name__ == '__main__':
    main()
