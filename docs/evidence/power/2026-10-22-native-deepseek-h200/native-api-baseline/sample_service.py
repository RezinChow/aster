"""Read-only telemetry for one exact owned native process and its eight GPUs."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import time


def parse_gpus(text, identities):
    rows = []
    for line in text.splitlines():
        values = [x.strip() for x in line.split(',')]
        if len(values) != 4:
            raise ValueError('GPU telemetry has an invalid column count')
        identity, used, total, utilization = values
        used, total, utilization = int(used), int(total), int(utilization)
        if used < 0 or total <= 0 or used > total or not 0 <= utilization <= 100:
            raise ValueError('GPU telemetry has invalid units or values')
        rows.append(dict(uuid=identity, used_mib=used, total_mib=total, utilization_percent=utilization))
    if [row['uuid'] for row in rows] != identities or len(set(identities)) != 8:
        raise ValueError('GPU telemetry differs from the exact eight-card allocation')
    return rows


def process_snapshot(pid, start_ticks, owner):
    root = Path('/proc') / str(pid)
    metadata = root.stat()
    fields = (root / 'stat').read_text().split(') ', 1)[1].split()
    if metadata.st_uid != owner or int(fields[19]) != start_ticks:
        raise RuntimeError('native process identity changed; stop telemetry')
    io = {line.split(':', 1)[0]: int(line.split(':', 1)[1]) for line in (root / 'io').read_text().splitlines()}
    return dict(state=fields[0], user_ticks=int(fields[11]), system_ticks=int(fields[12]),
                rss_pages=int(fields[21]), io=io)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--inputs', type=Path, required=True)
    args = parser.parse_args()
    inputs = json.loads(args.inputs.read_text())
    root = args.inputs.parent
    if root.resolve() != root or root.stat().st_uid != 10250 or os.getuid() != 10250:
        raise RuntimeError('telemetry requires its owned canonical stage')
    if set(inputs) != {'pid', 'start_ticks', 'uuids', 'ends_unix'} or not time.time() < inputs['ends_unix'] <= time.time() + 960:
        raise RuntimeError('telemetry input fields or frozen deadline are invalid')
    os.umask(0o077)
    result = dict(schema='aster-native-service-telemetry-v1', phase='sampling', samples=0,
                  nsys=shutil.which('nsys'), ncu=shutil.which('ncu'),
                  ticks_per_second=os.sysconf('SC_CLK_TCK'), page_bytes=os.sysconf('SC_PAGE_SIZE'))
    try:
        with (root / 'telemetry.jsonl').open('x', buffering=1) as output:
            while time.time() < inputs['ends_unix']:
                final = root / 'measurements/result.json'
                if final.exists() and json.loads(final.read_text()).get('phase') in ('completed', 'failed'):
                    break
                sample = dict(unix=time.time(), monotonic=time.monotonic(),
                              process=process_snapshot(inputs['pid'], inputs['start_ticks'], 10250))
                query = subprocess.run(['nvidia-smi', '--query-gpu=uuid,memory.used,memory.total,utilization.gpu',
                                        '--format=csv,noheader,nounits'], capture_output=True, text=True, check=True, timeout=10)
                if len(query.stdout) > 16384:
                    raise RuntimeError('GPU telemetry response exceeds its byte bound')
                sample['gpus'] = parse_gpus(query.stdout, inputs['uuids'])
                output.write(json.dumps(sample) + '\n')
                result['samples'] += 1
                time.sleep(min(2, max(0, inputs['ends_unix'] - time.time())))
        result['phase'] = 'completed'
    except Exception as error:
        result.update(phase='failed', error_type=type(error).__name__)
        raise
    finally:
        result['completed_unix'] = time.time()
        (root / 'telemetry-result.json').write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps(result))


if __name__ == '__main__':
    main()
