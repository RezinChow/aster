"""Read only the bounded GGUF header of the completed, split XQ artifact.

Independent observation code, executed on the jump host. Does not merge or
hash model payloads and does not open a GPU or modify any remote file.
"""
import collections
import hashlib
import json
import math
import struct
import time
from pathlib import Path

ROOT = Path('/mnt/shared-storage-user/yangchao/Workspace/aster-h200-xq')
PARTS = [ROOT/f'assets/v3/V41-XQ-1017-v3.gguf.part-{i:02d}-of-16' for i in range(1, 17)]
MAX_HEADER = 32*1024**2
BLOCKS = {0: (1, 4), 1: (1, 2), 8: (32, 34), 11: (256, 110),
          24: (1, 1), 26: (1, 4), 42: (64, 18), 143: (128, 28)}


def inspect():
    if not all(p.is_file() and not p.is_symlink() for p in PARTS):
        raise RuntimeError('all regular final parts are required')
    file_bytes = sum(p.stat().st_size for p in PARTS)
    if file_bytes != 162954903552:
        raise RuntimeError('pinned split artifact size mismatch')
    digest = hashlib.sha256()
    with PARTS[0].open('rb') as source:
        def read(n):
            if n < 0 or source.tell()+n > MAX_HEADER:
                raise RuntimeError('GGUF header exceeds audit byte bound')
            raw = source.read(n)
            if len(raw) != n:
                raise RuntimeError('truncated GGUF header')
            digest.update(raw)
            return raw

        def scalar(fmt):
            return struct.unpack('<'+fmt, read(struct.calcsize('<'+fmt)))[0]

        def string():
            length = scalar('Q')
            if length > 1024**2:
                raise RuntimeError('GGUF string exceeds audit bound')
            return read(length).decode('utf-8')

        def value(kind, depth=0):
            if kind in {0: 'B', 1: 'b', 2: 'H', 3: 'h', 4: 'I', 5: 'i', 6: 'f', 10: 'Q', 11: 'q', 12: 'd'}:
                result = scalar({0: 'B', 1: 'b', 2: 'H', 3: 'h', 4: 'I', 5: 'i', 6: 'f', 10: 'Q', 11: 'q', 12: 'd'}[kind])
                if isinstance(result, float) and not math.isfinite(result):
                    raise RuntimeError('nonfinite GGUF metadata')
                return result
            if kind == 7:
                result = scalar('B')
                if result not in (0, 1):
                    raise RuntimeError('invalid GGUF boolean')
                return bool(result)
            if kind == 8:
                return string()
            if kind == 9 and depth == 0:
                element, count = scalar('I'), scalar('Q')
                if element == 9 or count > 2*1024**2:
                    raise RuntimeError('nested or oversized GGUF array')
                sample = []
                for i in range(count):
                    item = value(element, depth+1)
                    if i < 128:
                        sample.append(item)
                return sample if count <= 128 else {'element_type': element, 'length': count, 'sample': sample[:4]}
            raise RuntimeError('unsupported GGUF metadata type '+str(kind))

        if read(4) != b'GGUF' or scalar('I') != 3:
            raise RuntimeError('expected little-endian GGUF v3')
        tensor_count, metadata_count = scalar('Q'), scalar('Q')
        if not 0 < tensor_count <= 100000 or not 0 < metadata_count <= 4096:
            raise RuntimeError('GGUF table count exceeds audit bound')
        metadata = {}
        for _ in range(metadata_count):
            key = string()
            if not key or key in metadata:
                raise RuntimeError('empty or duplicate metadata key')
            metadata[key] = value(scalar('I'))
        alignment = metadata.get('general.alignment', 32)
        # Pinned v41_gguf_meta.py declares 16384, allowing separate Engram extents.
        if type(alignment) is not int or alignment != 16384:
            raise RuntimeError('unsupported GGUF alignment: '+repr(alignment))
        tensors, names = [], set()
        for _ in range(tensor_count):
            name, rank = string(), scalar('I')
            if not name or len(name) > 512 or name in names or not 1 <= rank <= 4:
                raise RuntimeError('tensor name/rank exceeds audit contract')
            names.add(name)
            shape = [scalar('Q') for _ in range(rank)]
            kind, offset = scalar('I'), scalar('Q')
            if kind not in BLOCKS or not all(shape):
                raise RuntimeError('unsupported XQ type or empty tensor')
            elements, stored = BLOCKS[kind]
            if shape[0] % elements or offset % alignment:
                raise RuntimeError('partial quantized row or unaligned tensor')
            size = shape[0]//elements*stored*math.prod(shape[1:])
            tensors.append({'name': name, 'shape': shape, 'type_id': kind, 'relative_offset': offset, 'bytes': size})
        table_end = source.tell()
        data_start = (table_end+alignment-1)//alignment*alignment
        if any(read(data_start-table_end)):
            raise RuntimeError('nonzero GGUF header padding')
        previous_end = data_start
        for tensor in sorted(tensors, key=lambda t: t['relative_offset']):
            start = data_start+tensor['relative_offset']
            if start < previous_end or start+tensor['bytes'] > file_bytes:
                raise RuntimeError('overlapping or out-of-file tensor range')
            previous_end = start+tensor['bytes']
    totals = collections.defaultdict(lambda: {'tensors': 0, 'bytes': 0})
    for tensor in tensors:
        totals[str(tensor['type_id'])]['tensors'] += 1
        totals[str(tensor['type_id'])]['bytes'] += tensor['bytes']
    return {'unix': time.time(), 'file_bytes': file_bytes, 'header_bytes': data_start,
            'header_sha256': digest.hexdigest(), 'alignment': alignment,
            'metadata': metadata, 'tensor_count': tensor_count, 'type_totals': dict(totals),
            'tensors': tensors, 'payload_hashed_by_this_audit': False,
            'maximum_tensor_end': previous_end}


if __name__ == '__main__':
    print(json.dumps(inspect()))
