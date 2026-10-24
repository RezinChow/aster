"""One bounded diagnostic CUDA trace of an already owned, ready native service.

This operator neither allocates hardware nor changes the serving profile. Its
request contains only the frozen synthetic prompt, and its key stays in memory.
Profiled timing is diagnostic and cannot promote a performance configuration.
"""
from contextlib import contextmanager
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import time


@contextmanager
def capture(tool):
    try:
        if tool('start'):
            raise RuntimeError('owned diagnostic capture could not start')
        yield
    finally:
        if tool('stop'):
            raise RuntimeError('owned diagnostic capture could not stop; retain exact tool logs')


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as source:
        while chunk := source.read(1024**2):
            value.update(chunk)
    return value.hexdigest()


def main():
    root = Path(__file__).absolute().parent
    if root.resolve() != root or root.stat().st_uid != 10250 or os.getuid() != 10250:
        raise RuntimeError('native diagnostic capture requires its exact owned stage')
    os.umask(0o077)
    path = root / 'profile-inputs.json'
    if path.stat().st_size > 16384:
        raise RuntimeError('profile manifest exceeds its byte bound')
    inputs = json.loads(path.read_text())
    if (set(inputs) != {'schema', 'service_stage', 'server_sha256', 'campaign_stage',
                       'campaign_source_sha256', 'resource_proof', 'worker_sha256'}
            or inputs['schema'] != 'aster-native-diagnostic-profile-v1'
            or digest(Path(__file__)) != inputs['worker_sha256']):
        raise RuntimeError('native diagnostic profile source/schema changed')
    service = Path(inputs['service_stage'])
    campaign = Path(inputs['campaign_stage'])
    proof_path = Path(inputs['resource_proof'])
    for item in [service, campaign, proof_path]:
        if item.resolve() != item or item.stat().st_uid != 10250:
            raise RuntimeError('native diagnostic profile input owner/path changed')
    if root != service / 'full-model-profile':
        raise RuntimeError('diagnostic profile escaped its owned service')
    state = json.loads((service / 'service-result.json').read_text())
    proof = json.loads(proof_path.read_text())
    if (state['phase'] != 'service_listener_verified'
            or state['server_binary_sha256'] != inputs['server_sha256']
            or state['profiler']['session'] != service.name
            or state['profiler']['profile'] != 'nsys-interactive-v1'
            or proof['phase'] != 'passed' or proof['hostname'] != socket.gethostname()
            or min(state['credential_expires_unix'], proof['leaseEndsUnix']) < time.time() + 600):
        raise RuntimeError('exact profiled native listener lacks its required remaining lease')
    source = campaign / 'api_campaign.py'
    if source.stat().st_size > 65536 or digest(source) != inputs['campaign_source_sha256']:
        raise RuntimeError('frozen diagnostic request client changed')
    spec = importlib.util.spec_from_file_location('frozen_native_api_campaign', source)
    client = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(client)
    plan = json.loads((campaign / 'plan.json').read_text())
    client.validate_plan(plan)
    measured = json.loads((campaign / 'measurements/result.json').read_text())
    if (measured['phase'] != 'completed' or len(measured['cells']) != 3
            or any(cell['successful'] != 1 or cell['native_clock_requests'] != 1 for cell in measured['cells'])):
        raise RuntimeError('native diagnostic trace requires the completed unprofiled clock campaign')
    key_path = service / 'auth/api-key.txt'
    metadata = key_path.lstat()
    if (key_path.resolve() != key_path or metadata.st_uid != 10250
            or metadata.st_mode & 0o077 or metadata.st_size > 128):
        raise RuntimeError('native diagnostic credential is not an exact private file')
    key = key_path.read_text().strip()
    plan = dict(plan, base_url='http://127.0.0.1:30003/v1', request_seconds=120)
    client.validate_plan(plan)
    (root / 'request-plan.json').write_text(json.dumps(plan, indent=2) + '\n')
    result = dict(schema='aster-native-diagnostic-profile-result-v1', phase='starting',
                  started_unix=time.time(), performance_promotion_claimed=False,
                  server_binary_sha256=inputs['server_sha256'], tools={})

    def publish():
        temporary = root / 'profile-result.tmp'
        temporary.write_text(json.dumps(result, indent=2) + '\n')
        temporary.replace(root / 'profile-result.json')

    def interrupted(number, _frame):
        raise RuntimeError('owned diagnostic operator interrupted by signal ' + str(number))

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    nsys = '/usr/local/cuda/bin/nsys'

    def tool(action):
        command = [nsys, action, '--session=' + service.name]
        if action == 'start':
            command += ['--sample=none', '--cpuctxsw=none', '--output=' + str(root / 'native-request')]
        with (root / (action + '.stdout.log')).open('x') as stdout, (root / (action + '.stderr.log')).open('x') as stderr:
            process = subprocess.run(command, stdout=stdout, stderr=stderr, timeout=30 if action == 'start' else 120)
        result['tools'][action] = dict(command=command, exit=process.returncode, unix=time.time())
        publish()
        return process.returncode

    try:
        publish()
        with capture(tool):
            result['phase'] = 'capturing'
            publish()
            request = client.request(plan, key, 'diagnostic-single-native-request', time.monotonic() + 120)
            result['request'] = request
            publish()
        trace = root / 'native-request.nsys-rep'
        if (trace.resolve() != trace or trace.stat().st_uid != 10250
                or not 0 < trace.stat().st_size <= 512 * 1024**2):
            raise RuntimeError('native diagnostic trace is missing, foreign or exceeds 512 MiB')
        result['trace'] = dict(file=trace.name, bytes=trace.stat().st_size, sha256=digest(trace))
        reports = ['cuda_api_sum', 'cuda_gpu_kern_sum', 'cuda_gpu_mem_time_sum', 'cuda_gpu_mem_size_sum']
        with (root / 'statistics.stdout.log').open('x') as stdout, (root / 'statistics.stderr.log').open('x') as stderr:
            process = subprocess.run([nsys, 'stats', '--report=' + ','.join(reports), '--format=csv',
                                      '--output=' + str(root / 'statistics'), str(trace)],
                                     stdout=stdout, stderr=stderr, timeout=120)
        result['statistics_exit'] = process.returncode
        if process.returncode or not request['passed']:
            raise RuntimeError('diagnostic request or statistics failed; original trace/journal retained')
        result['phase'] = 'passed'
    except Exception as error:
        result.update(phase='failed', error_type=type(error).__name__, error=str(error))
        raise
    finally:
        result['completed_unix'] = time.time()
        publish()
        print(json.dumps(result), flush=True)


if __name__ == '__main__':
    main()
