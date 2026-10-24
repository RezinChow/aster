"""Four complete two-H200 replicas; resident barrier and bounded native generation.

This is a frozen qualification operator, not a serving configuration or a
performance campaign. It starts no allocation and never touches other jobs.
"""
import gzip
import hashlib
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import time
import uuid

MODEL_SHA = '73df1934302f867601dd27f7fca59109d9b11674f50cc60526ec2a1cd4f3d389'


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as source:
        while chunk := source.read(1024**2):
            result.update(chunk)
    return result.hexdigest()


def read_json(path, maximum=65536):
    metadata = path.lstat()
    if (path.resolve() != path or not path.is_file() or path.is_symlink()
            or metadata.st_uid != os.getuid() or metadata.st_size > maximum):
        raise RuntimeError('qualification artifact violates exact owner/path/byte bounds')
    return json.loads(path.read_text())


def validate_ready(value, expected):
    if value.get('phase') != 'model_loaded' or value.get('model_sha256') != MODEL_SHA:
        raise RuntimeError('replica did not load the complete pinned model')
    admissions = value.get('device_admissions', [])
    if len(admissions) != 2 or len(set(expected)) != 2:
        raise RuntimeError('replica requires exactly two distinct admitted devices')
    for ordinal, (admission, identity) in enumerate(zip(admissions, expected)):
        actual = 'GPU-' + str(uuid.UUID(bytes=bytes(admission['uuid'])))
        if (admission['ordinal'] != ordinal or actual != identity
                or admission['capability'] != [9, 0]
                or not 0 < admission['residentUpperBytes']
                < admission['totalBytes']
                or admission['residentUpperBytes'] + admission['stateAndDriverReserve']
                > admission['freeBytesAtLoad']):
            raise RuntimeError('replica admission differs from its physical H200 pair')


def validate_generation(value):
    if (value.get('phase') != 'generated' or value.get('model_sha256') != MODEL_SHA
            or value.get('native_execution') is not True or value.get('group_width') != '2'):
        raise RuntimeError('replica lacks a complete native generation receipt')
    generation = value['generation']
    stats = generation['stats']
    if (not 1 <= len(generation['tokens']) <= 2 or stats['modelSteps'] < 1
            or stats['executedLayersByOrdinal'] != [20 * stats['modelSteps']] * 2 + [0] * 6):
        raise RuntimeError('replica did not execute all forty layers on its exact pair')
    return generation['tokens']


def gpu_snapshot():
    command = ['nvidia-smi', '--query-gpu=uuid,memory.used,memory.total,utilization.gpu',
               '--format=csv,noheader,nounits']
    result = subprocess.run(command, capture_output=True, text=True, check=True, timeout=15)
    if len(result.stdout) > 16384:
        raise RuntimeError('GPU observation exceeds its byte bound')
    return result.stdout


def main():
    root = Path(__file__).absolute().parent
    if root.resolve() != root or root.stat().st_uid != 10250 or os.getuid() != 10250:
        raise RuntimeError('replica probe requires its exact owned private stage')
    os.umask(0o077)
    children = []
    handles = []
    result = dict(schema='aster-native-xq-four-replicas-v1', phase='preflight', unix=time.time(),
                  service_deployment_claimed=False, quality_or_performance_qualification_claimed=False)

    def publish():
        temporary = root / 'replica-result.tmp'
        temporary.write_text(json.dumps(result, indent=2) + '\n')
        temporary.replace(root / 'replica-result.json')

    def interrupted(number, _frame):
        raise RuntimeError('owned replica qualification interrupted by signal ' + str(number))

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    try:
        inputs = read_json(root / 'replica-inputs.json')
        if (set(inputs) != {'schema', 'worker_sha256', 'native_runner', 'source_archive_sha256',
                           'resource_proof', 'payload_root', 'official_blob_root', 'single_probe'}
                or inputs['schema'] != 'aster-native-xq-four-replica-inputs-v1'
                or inputs['worker_sha256'] != digest(Path(__file__))):
            raise RuntimeError('replica probe input contract or source identity changed')
        prerequisite = read_json(Path(inputs['single_probe']))
        if (prerequisite['phase'] != 'passed'
                or prerequisite['inputs']['native_runner'] != inputs['native_runner']):
            raise RuntimeError('the exact native runner must pass its single full-model probe first')
        validate_generation(prerequisite['generation_receipt'])
        proof = read_json(Path(inputs['resource_proof']))
        if (proof['phase'] != 'passed' or proof['hostname'] != socket.gethostname()
                or proof['expectedGpus'] != 8):
            raise RuntimeError('replica probe requires the verified owned eight-H200 lease')
        deadline_seconds = min(3600, int(proof['leaseEndsUnix'] - time.time() - 120))
        if deadline_seconds < 1800:
            raise RuntimeError('four-replica probe requires at least thirty minutes of owned lease')
        deadline = time.monotonic() + deadline_seconds
        identities = [gpu['uuid'] for gpu in proof['gpus']]
        if len(identities) != 8 or len(set(identities)) != 8:
            raise RuntimeError('allocation GPU identities are not eight distinct physical devices')
        busy = subprocess.run(['nvidia-smi', '--query-compute-apps=pid,gpu_uuid',
                               '--format=csv,noheader,nounits'], capture_output=True,
                              text=True, check=True, timeout=15).stdout
        if busy.strip():
            raise RuntimeError('owned allocation already has a CUDA workload')
        artifact = inputs['native_runner']
        archive = root / 'run-xq-native.gz'
        if (not 0 < artifact['archive_bytes'] <= 128 * 1024**2
                or archive.stat().st_size != artifact['archive_bytes']
                or digest(archive) != artifact['archive_sha256']
                or not 0 < artifact['binary_bytes'] <= 256 * 1024**2):
            raise RuntimeError('frozen native archive identity or size changed')
        work = Path('/tmp') / root.name
        work.mkdir(mode=0o700, exist_ok=False)
        binary = work / 'run-xq-native'
        count = 0
        with gzip.open(archive, 'rb') as source, binary.open('xb') as target:
            while chunk := source.read(1024**2):
                count += len(chunk)
                if count > artifact['binary_bytes']:
                    raise RuntimeError('native archive exceeds its expansion bound')
                target.write(chunk)
        if count != artifact['binary_bytes'] or digest(binary) != artifact['binary_sha256']:
            raise RuntimeError('expanded native executable identity changed')
        binary.chmod(0o700)
        environment = dict(os.environ)
        paths = [value for value in environment.get('LD_LIBRARY_PATH', '').split(':') if value]
        if any('stubs' in Path(value).parts for value in paths):
            raise RuntimeError('CUDA linker stubs cannot execute a native model')
        environment['LD_LIBRARY_PATH'] = ':'.join(['/usr/local/cuda/lib64'] + paths)
        result.update(phase='loading_four_complete_replicas', deadline_seconds=deadline_seconds,
                      inputs=inputs, replicas=[], gpu_before=gpu_snapshot())
        publish()
        for index in range(4):
            pair = identities[index * 2:index * 2 + 2]
            barrier = root / ('replica-' + str(index))
            barrier.mkdir(mode=0o700, exist_ok=False)
            stdout = (barrier / 'native.stdout.log').open('x')
            stderr = (barrier / 'native.stderr.log').open('x')
            handles.extend([stdout, stderr])
            command = [str(binary), inputs['payload_root'], inputs['official_blob_root'],
                       '2', '0,7,8,9', '2', str(barrier)]
            child = subprocess.Popen(command, stdout=stdout, stderr=stderr,
                                     env=environment | {'CUDA_VISIBLE_DEVICES': ','.join(pair)})
            children.append(child)
            ticks = int(Path('/proc/' + str(child.pid) + '/stat').read_text().split(') ', 1)[1].split()[19])
            result['replicas'].append(dict(index=index, pair=pair, command=command,
                                           pid=child.pid, start_ticks=ticks, uid=os.getuid()))
            publish()
        while True:
            if time.monotonic() >= deadline:
                raise TimeoutError('four native replicas exceeded the frozen qualification deadline')
            ready = []
            for index, child in enumerate(children):
                barrier = root / ('replica-' + str(index))
                for name in ['native.stdout.log', 'native.stderr.log']:
                    if (barrier / name).stat().st_size > 4 * 1024**2:
                        raise RuntimeError('native replica logs exceed the receipt byte bound')
                if child.poll() is not None:
                    raise RuntimeError('native replica exited before all replicas were resident')
                if (barrier / 'ready.json').exists():
                    receipt = read_json(barrier / 'ready.json')
                    validate_ready(receipt, result['replicas'][index]['pair'])
                    ready.append(receipt)
            result['ready_replicas'] = len(ready)
            result['observed_unix'] = time.time()
            publish()
            if len(ready) == 4:
                result.update(phase='all_four_complete_replicas_resident', readiness=ready,
                              all_resident_unix=time.time(), gpu_all_resident=gpu_snapshot())
                publish()
                break
            time.sleep(5)
        for index in range(4):
            barrier = root / ('replica-' + str(index))
            with (barrier / 'go.tmp').open('x') as gate:
                gate.write(json.dumps(dict(operation='generate', model_sha256=MODEL_SHA)) + '\n')
                gate.flush()
                os.fsync(gate.fileno())
            (barrier / 'go.tmp').replace(barrier / 'go.json')
        result.update(phase='generating_on_four_complete_replicas', released_unix=time.time())
        publish()
        receipts = []
        for index, child in enumerate(children):
            status = child.wait(timeout=max(0.001, deadline - time.monotonic()))
            result['replicas'][index]['exit_code'] = status
            publish()
            if status:
                raise RuntimeError('native full-model replica failed after barrier release')
            output = root / ('replica-' + str(index)) / 'native.stdout.log'
            if output.stat().st_size > 4 * 1024**2:
                raise RuntimeError('native generation receipt exceeds its byte bound')
            events = [json.loads(line) for line in output.read_text().splitlines() if line.strip()]
            validate_generation(events[-1])
            receipts.append(events[-1])
        if any(receipt['generation']['tokens'] != receipts[0]['generation']['tokens'] for receipt in receipts):
            raise RuntimeError('deterministic complete replicas disagree on output token IDs')
        result.update(phase='passed', generation_receipts=receipts, gpu_after=gpu_snapshot(),
                      completed_unix=time.time())
        publish()
    except Exception as error:
        result.update(phase='failed', error_type=type(error).__name__, error=str(error),
                      completed_unix=time.time())
        publish()
        raise
    finally:
        for child in children:
            if child.poll() is None:
                child.kill()
            child.wait()
        for handle in handles:
            handle.close()
        print(json.dumps(result), flush=True)


if __name__ == '__main__':
    main()
