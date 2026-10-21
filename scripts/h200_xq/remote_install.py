#!/usr/bin/env python3
"""Rebuild on an allocated H200 node, activate verified weights, and tune."""

import gzip
import json
import shutil
import subprocess
import sys
import time
import urllib.request

from prepare_assets import XOLOTL_SHA256, digest
from service import ROOT, STAGING, require_hardware

POWER_SHA256 = '62c33ee45f97a62fe5b39571294b9b6dbb645754b04faba53aab4e4ba1a81e63'
ENGRAM_SHA256 = {
    1: '5cc4ca3be6302a50597684d234dd47ae7ff7b3a5b42d386515b58f4ecd17662b',
    14: '35c6bb1c15139a691d530c4ea469d1983031074c1a84b4e7f7668fef2015b68b',
}
SNAPSHOT = '/mnt/shared-storage-gpfs2/gpfs2-shared-public/huggingface/hub/models--deepseek-ai--DeepSeek-V4.1-Flash-1017/snapshots/1bae0e1088993b9b82de08f59de5be5a34e42170'


def main():
    require_hardware()
    mount = subprocess.check_output(['findmnt', '--target', '/nvme', '--noheadings', '--output', 'TARGET'], text=True).strip()
    if mount != '/nvme' or shutil.disk_usage('/nvme').free < 500 * 1024**3:
        raise RuntimeError('deployment requires the host NVMe mount with at least 500 GiB free')
    for directory in ('logs', 'models', 'engram-a', 'engram-b', 'source/xolotl', 'run', 'bench', 'bin'):
        (ROOT/directory).mkdir(parents=True, exist_ok=True)
    source = STAGING/'source/xolotl.tar.gz'
    if digest(source) != XOLOTL_SHA256:
        raise RuntimeError('Xolotl source archive failed the pinned SHA-256 gate')
    subprocess.run(['tar', '--no-same-owner', '--strip-components=1', '-xzf', str(source),
                    '-C', str(ROOT/'source/xolotl')], check=True)
    power = ROOT/'bin/a3s-power'
    with gzip.open(STAGING/'a3s-power-glibc235.gz', 'rb') as compressed, power.open('wb') as output:
        shutil.copyfileobj(compressed, output)
    if digest(power) != POWER_SHA256:
        raise RuntimeError('Power binary failed the pinned SHA-256 gate')
    power.chmod(0o755)
    subprocess.run([str(power), '--version'], check=True)
    extractor = ROOT/'source/xolotl/tools/v41/extract_engram.py'
    if digest(extractor) != 'f14c1bc89749d301b1074197aeb16669d1b62acb414f31eca952f8a177bb8432':
        raise RuntimeError('Engram extractor failed the pinned SHA-256 gate')
    extracts = []
    for layer, directory in [(1, 'engram-a'), (14, 'engram-b')]:
        existing = ROOT/directory/f'engram-L{layer}.safetensors'
        if existing.is_file():
            if digest(existing) != ENGRAM_SHA256[layer] or not (existing.parent/'model.safetensors.index.json').is_file():
                raise RuntimeError('existing Engram data is incomplete or has a different identity')
            continue
        log = (ROOT/f'logs/extract-{layer}.log').open('ab', buffering=0)
        extracts.append(subprocess.Popen([sys.executable, str(extractor), SNAPSHOT,
                                          '--to', f'layers.{layer}={ROOT/directory}'],
                                         stdout=log, stderr=subprocess.STDOUT))
        log.close()
    with (ROOT/'logs/build-engine.log').open('ab', buffering=0) as log:
        build = subprocess.run(['bash', str(STAGING/'build_engine.sh')], stdout=log, stderr=subprocess.STDOUT)
    statuses = [process.wait() for process in extracts]
    if build.returncode or any(statuses):
        raise RuntimeError(f'preparation failed: build={build.returncode}, extracts={statuses}')
    for layer, directory in [(1, 'engram-a'), (14, 'engram-b')]:
        if digest(ROOT/directory/f'engram-L{layer}.safetensors') != ENGRAM_SHA256[layer]:
            raise RuntimeError('extracted Engram data failed its pinned SHA-256 gate')
    subprocess.run([sys.executable, str(STAGING/'frontend_smoke.py')], check=True)
    subprocess.run([sys.executable, str(STAGING/'bootstrap.py')], check=True)
    subprocess.run([sys.executable, str(STAGING/'autotune.py')], check=True)
    campaign = json.loads((ROOT/'bench/campaign.json').read_text())
    if campaign['best_warm_median_output_tokens_per_second'] < 0:
        raise RuntimeError('no inference profile passed qualification')
    for filename in ('campaign.json',):
        shutil.copy2(ROOT/'bench'/filename, STAGING/'logs'/filename)
    print('QUALIFIED_H200_SERVICE_RUNNING', flush=True)
    while True:
        time.sleep(60)
        with urllib.request.urlopen('http://127.0.0.1:8150/health', timeout=10) as response:
            if json.load(response).get('loaded') is not True:
                raise RuntimeError('upstream engine stopped being loaded')
        with urllib.request.urlopen('http://127.0.0.1:30002/health', timeout=10) as response:
            if response.status != 200:
                raise RuntimeError('Power frontend stopped being healthy')


if __name__ == '__main__':
    main()
