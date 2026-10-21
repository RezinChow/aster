#!/usr/bin/env python3
"""Report real downloaded ranges, never the size of sparse destination files."""

import argparse
import json
import stat
import time
from pathlib import Path


def regular_file_size(path):
    try:
        metadata = path.stat()
    except FileNotFoundError:
        return 0
    return metadata.st_size if stat.S_ISREG(metadata.st_mode) else 0


def progress(directory):
    published = set(directory.glob('*.gguf.part-??-of-16'))
    sidecar = directory/'V41-MTP-Vision-1017.Q2_K.gguf'
    if sidecar.is_file():
        published.add(sidecar)
    complete = sum(regular_file_size(path) for path in published)
    inflight = 0
    for path in directory.glob('*.ranges.json'):
        try:
            state = json.loads(path.read_text())
        except FileNotFoundError:
            continue
        destination = path.with_name(path.name.removesuffix('.ranges.json'))
        if destination.exists():
            continue
        complete += sum(min(state['chunk_size'], state['size']-i*state['chunk_size'])
                        for i in state['completed'])
        inflight += sum(regular_file_size(chunk) for chunk in directory.glob(destination.name+'.chunk-*'))
    return {'completed_range_bytes': complete, 'unverified_inflight_bytes': inflight,
            'transferred_bytes': complete+inflight}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    args = parser.parse_args()
    result = {'unix': time.time(), 'model': progress(args.root/'assets/v3'),
              'sidecar': progress(args.root/'assets')}
    result['verified_model_parts'] = len(list((args.root/'assets/v3').glob('*.gguf.part-??-of-16')))
    destination = args.root/'logs/download-progress.jsonl'
    with destination.open('a') as stream:
        stream.write(json.dumps(result)+'\n')
    print(json.dumps(result), flush=True)


if __name__ == '__main__':
    main()
