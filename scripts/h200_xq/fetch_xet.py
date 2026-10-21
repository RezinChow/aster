#!/usr/bin/env python3
"""Try the native Xet transport without changing verified range-download files."""

import argparse
import json
import os
import threading
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--part', type=int, default=16)
    parser.add_argument('--concurrency', type=int, choices=(1, 2, 4, 8, 16, 32), default=4)
    parser.add_argument('--all-parts', action='store_true')
    args = parser.parse_args()
    if not 1 <= args.part <= 16:
        raise ValueError('part must be between 1 and 16')
    os.environ.update({
        'HTTPS_PROXY': 'http://127.0.0.1:18088',
        'HTTP_PROXY': 'http://127.0.0.1:18088',
        'HF_HOME': str(args.root/'hf-xet-cache'),
        'HF_XET_HIGH_PERFORMANCE': '0',
        'HF_XET_FIXED_DOWNLOAD_CONCURRENCY': str(args.concurrency),
        'HF_HUB_DISABLE_IMPLICIT_TOKEN': '1',
        'HF_HUB_DISABLE_TELEMETRY': '1',
        'HF_HUB_DOWNLOAD_TIMEOUT': '180',
        'HF_HUB_ETAG_TIMEOUT': '30',
    })
    from huggingface_hub import hf_hub_download
    from huggingface_hub.utils import tqdm
    from prepare_assets import digest, MODEL_REPOSITORY, MODEL_REVISION, SIDECAR_SHA256

    class Progress(tqdm):
        def __init__(self, *values, **kwargs):
            self.completed_bytes = 0
            self.transferred_bytes = 0
            self.started = time.monotonic()
            self.previous_write = 0
            self.progress_lock = threading.Lock()
            kwargs['disable'] = True
            super().__init__(*values, **kwargs)

        def save_progress(self):
            now = time.monotonic()
            if now-self.previous_write < 1:
                return
            self.previous_write = now
            value = {'unix': time.time(), 'elapsed_s': now-self.started,
                     'reconstructed_bytes': self.completed_bytes,
                     'network_bytes': self.transferred_bytes, 'total_bytes': self.total}
            destination = args.root/'logs/xet-progress.json'
            temporary = destination.with_suffix('.tmp')
            temporary.write_text(json.dumps(value))
            temporary.replace(destination)

        def update(self, count=1):
            with self.progress_lock:
                self.completed_bytes += count
                self.save_progress()
            return super().update(count)

        def update_transfer(self, count):
            with self.progress_lock:
                self.transferred_bytes += count
                self.save_progress()

        def set_transfer_postfix_str(self, *_args, **_kwargs):
            pass

    checksums = {}
    for line in (args.root/'assets/v3/SHA256SUMS').read_text().splitlines():
        checksum, name = line.split(maxsplit=1)
        checksums[name.lstrip('*')] = checksum
    names = ([f'v3/V41-XQ-1017-v3.gguf.part-{index:02d}-of-16' for index in range(1, 17)]
             if args.all_parts else [f'v3/V41-XQ-1017-v3.gguf.part-{args.part:02d}-of-16'])
    if args.all_parts:
        names.insert(0, 'V41-MTP-Vision-1017.Q2_K.gguf')
    for filename in names:
        expected = SIDECAR_SHA256 if filename.endswith('Q2_K.gguf') else checksums[Path(filename).name]
        destination = args.root/'assets'/filename
        if destination.is_file() and digest(destination) == expected:
            print('ALREADY_VERIFIED', filename, flush=True)
            continue
        started = time.monotonic()
        print(json.dumps({'transport': 'hf-xet-fixed', 'concurrency': args.concurrency,
                          'file': filename, 'started': time.time()}), flush=True)
        path = Path(hf_hub_download(MODEL_REPOSITORY, filename=filename,
                    revision=MODEL_REVISION, token=False, local_dir=args.root/'assets-xet',
                    tqdm_class=Progress))
        size = path.stat().st_size
        if digest(path) != expected:
            raise RuntimeError('native Xet file failed the pinned SHA-256 gate')
        destination.parent.mkdir(parents=True, exist_ok=True)
        path.replace(destination)
        print(json.dumps({'verified_file': filename, 'bytes': size, 'sha256': expected,
                          'elapsed_s': time.monotonic()-started}), flush=True)


if __name__ == '__main__':
    main()
