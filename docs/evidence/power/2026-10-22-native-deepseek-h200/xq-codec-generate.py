"""Generate hermetic XQ vectors with the pinned upstream NumPy codec.

Run with NumPy 1.26.4. The source is an operator-supplied public reference,
not imported by the Rust runtime. No model payloads or credentials are used.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np

SOURCE_SHA256 = 'beb83fb64b7790a53ff55b117eb3d0d4db5970ffd3d059ae69b0bfe3bd5083bc'
REVISION = 'b3452666e07a6374d06bb8c2185dffa271e8f65f'


def build(source):
    if hashlib.sha256(source.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise RuntimeError('reference source hash mismatch')
    if np.__version__ != '1.26.4':
        raise RuntimeError('reference requires frozen NumPy 1.26.4')
    spec = importlib.util.spec_from_file_location('pinned_v41_formats', source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    cases = []

    def add(name, kind, raw, columns):
        decoded = np.asarray(module.decode(kind, raw, columns), dtype='<f4')
        cases.append({'name': name, 'type_id': kind, 'columns': columns,
                      'raw_hex': bytes(raw).hex(),
                      'expected_bits': decoded.view('<u4').tolist()})

    scale_bits = np.array([0, 0x8000, 1, 0x8001, 0x3555, 0xbe00, 0x7bff, 0xfbff], np.uint16)
    scales = scale_bits.view(np.float16).astype(np.float32).reshape(1, -1)
    codes = ((np.arange(1024) * 17 + np.arange(1024) // 3) % 3 - 1).astype(np.int8).reshape(1, -1)
    add('ptq1_all_sections_signed_zero_subnormal_scales', module.PTQ1_0,
        module.pack_ptq1_0(codes, scales).tobytes(), codes.size)
    codes = ((np.arange(512) * 13 + np.arange(512) // 5) % 4 - 1).astype(np.int8).reshape(1, -1)
    add('q2_adjacent_pairs_signed_scales', module.Q2_0,
        module.pack_q2_0(codes, scales).tobytes(), codes.size)
    codes = ((np.arange(2048) * 7 + np.arange(2048) // 17) % 8 - 4).astype(np.int8).reshape(1, -1)
    subscales = ((np.arange(128) * 19 + 7) % 64 - 32).astype(np.int16).reshape(1, -1)
    add('q3_all_six_bit_subscales_and_hmask_lanes', module.Q3_K,
        module.pack_q3_k(codes, scales, subscales).tobytes(), codes.size)
    q8 = np.empty((8, 34), np.uint8)
    q8[:, :2] = scale_bits.reshape(-1, 1).view(np.uint8)
    q8[:, 2:] = np.arange(256, dtype=np.uint8).reshape(8, 32)
    add('q8_all_signed_byte_codes', module.Q8_0, q8.tobytes(), 256)
    add('f16_exponent_boundaries', module.F16,
        np.array([0, 0x8000, 1, 0x3ff, 0x400, 0x3555, 0x3c00, 0xbc00, 0x7bff, 0xfbff], '<u2').tobytes(), 10)
    add('f32_exact_bits', module.F32,
        np.array([0, 0x80000000, 1, 0x80000001, 0x7fffff, 0x800000, 0x3f800000,
                  0xbfaaaaab, 0x7f7fffff, 0xff7fffff], '<u4').tobytes(), 10)

    rng = np.random.default_rng(20261023)
    for kind in [module.PTQ1_0, module.Q2_0, module.Q3_K, module.Q8_0]:
        count, size = module.BLOCK[kind]
        raw = rng.integers(0, 256, 3 * size, dtype=np.uint8).reshape(3, size)
        offset = {module.PTQ1_0: 26, module.Q2_0: 0, module.Q3_K: 108, module.Q8_0: 0}[kind]
        raw[:, offset:offset+2] = np.array([0x3555, 0xbe00, 1], '<u2').reshape(-1, 1).view(np.uint8)
        add(f'random_packed_{kind}', kind, raw.tobytes(), 3 * count)

    hashes = {}
    for kind, size, scale_offset in [(module.PTQ1_0, 28, 26), (module.Q2_0, 18, 0)]:
        raw = np.repeat(np.arange(256, dtype=np.uint8)[:, None], size, axis=1)
        raw[:, scale_offset:scale_offset+2] = np.array([0x3c00], '<u2').view(np.uint8)
        decoded = np.asarray(module.decode(kind, raw.tobytes(), 256 * module.BLOCK[kind][0]), '<f4')
        hashes[str(kind)] = hashlib.sha256(decoded.tobytes()).hexdigest()
    finite_bits = np.arange(65536, dtype='<u2')
    finite_bits = finite_bits[(finite_bits & 0x7c00) != 0x7c00]
    hashes['all_finite_f16'] = hashlib.sha256(finite_bits.view(np.float16).astype('<f4').tobytes()).hexdigest()
    return {'schema': 'aster.xq-codec-golden.v1', 'revision': REVISION,
            'reference_source_sha256': SOURCE_SHA256, 'numpy': np.__version__,
            'cases': cases, 'exhaustive_hashes': hashes}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = build(args.source)
    args.output.write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({'cases': len(result['cases']), 'exhaustive_hashes': result['exhaustive_hashes'],
                      'fixture_sha256': hashlib.sha256(args.output.read_bytes()).hexdigest()}))
