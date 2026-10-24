"""Qualify one frozen experimental binary beside this task's resident service.

No allocation, service restart, credential access, or profile promotion.
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

CASES = [
    'cuda::sinkhorn::tests::gpu::h200_xq_sinkhorn_fused_matches_f64_tensor_control_and_reports_alternating_cost',
    'layers::xq::text::tests::gpu::h200_xq_embedding_shifted_f32_mhc_and_output_head_match_independent_math',
    'layers::xq::moe::tests::gpu::h200_xq_mixed_experts_and_shifted_ffn_match_independent_f64_math',
    'layers::xq::attention::tests::gpu::h200_xq_f32_projections_codecs_rope_and_sparse_attention_match_stage_oracles',
    'layers::xq::indexer::tests::gpu::h200_xq_f32_compression_index_projections_and_atomic_cache_match_stage_oracles',
    'layers::xq::engram::tests::gpu::h200_xq_engram_packed_lookup_f16_projection_f32_gate_and_carried_mix_match_oracles',
    'weights::xq::load::tests::gpu::h200_xq_loaded_source_consumer_f32_attention_ffn_and_atomic_prefix_match_chunked_execution',
]


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as source:
        while data := source.read(1024**2):
            value.update(data)
    return value.hexdigest()


def verify_service_process(process):
    path = Path('/proc') / str(process['pid'])
    fields = (path / 'stat').read_text().split(') ', 1)[1].split()
    if path.stat().st_uid != 10250 or int(fields[19]) != process['start_ticks']:
        raise RuntimeError('resident service process identity changed')


def main():
    root = Path(__file__).absolute().parent
    if root.resolve() != root or root.stat().st_uid != 10250 or os.getuid() != 10250:
        raise RuntimeError('fused qualification requires the exact owned private stage')
    os.umask(0o077)
    inputs = json.loads((root / 'inputs.json').read_text())
    result = dict(schema='aster-xq-fused-sinkhorn-qualification-v1', phase='preflight',
                  started_unix=time.time(), full_model_or_performance_promotion_claimed=False, cases=[])
    child = None

    def publish():
        temporary = root / 'result.tmp'
        temporary.write_text(json.dumps(result, indent=2) + '\n')
        temporary.replace(root / 'result.json')

    def interrupted(number, _frame):
        raise RuntimeError('owned qualification interrupted by signal ' + str(number))

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    publish()
    try:
        deadline = time.monotonic() + 600
        if inputs['worker_sha256'] != digest(Path(__file__)):
            raise RuntimeError('frozen fused qualification operator changed')
        proof = json.loads(Path(inputs['resource_proof']).read_text())
        if proof['phase'] != 'passed' or proof['expectedGpus'] != 8 or proof['hostname'] != socket.gethostname():
            raise RuntimeError('candidate requires this exact proven eight-H200 allocation')
        if time.time() + 650 >= proof['leaseEndsUnix']:
            raise RuntimeError('candidate qualification does not fit the resource deadline')
        service = json.loads(Path(inputs['service_stage']).joinpath('service-result.json').read_text())
        if service['phase'] != 'service_listener_verified' or service['server_binary_sha256'] != inputs['resident_server_sha256']:
            raise RuntimeError('resident control service identity changed')
        verify_service_process(service['native_process'])
        baseline = json.loads(Path(inputs['baseline_stage']).joinpath('measurements/result.json').read_text())
        if baseline['phase'] != 'completed':
            raise RuntimeError('do not contaminate the running baseline with GPU qualification')
        expected = [gpu['uuid'] for gpu in proof['gpus']]
        visible = subprocess.run(['nvidia-smi', '--query-gpu=uuid', '--format=csv,noheader,nounits'],
                                 check=True, capture_output=True, text=True, timeout=15)
        if visible.stdout.splitlines() != expected:
            raise RuntimeError('candidate GPU visibility differs from the owned allocation')
        source = root / 'tests.gz'
        if source.stat().st_size != inputs['archive_bytes'] or digest(source) != inputs['archive_sha256']:
            raise RuntimeError('candidate executable archive changed')
        work = Path('/tmp') / root.name
        work.mkdir(mode=0o700, exist_ok=False)
        binary = work / 'native-tests'
        copied = 0
        with gzip.open(source, 'rb') as archive, binary.open('xb') as output:
            while data := archive.read(1024**2):
                copied += len(data)
                if copied > inputs['binary_bytes']:
                    raise RuntimeError('candidate executable exceeded its pinned size')
                output.write(data)
        if copied != inputs['binary_bytes'] or digest(binary) != inputs['binary_sha256']:
            raise RuntimeError('candidate executable identity changed')
        binary.chmod(0o700)
        environment = dict(os.environ)
        paths = [x for x in environment.get('LD_LIBRARY_PATH', '').split(':') if x]
        if any('stubs' in Path(x).parts for x in paths):
            raise RuntimeError('CUDA linker stubs cannot qualify the candidate')
        environment.update(LD_LIBRARY_PATH=':'.join(['/usr/local/cuda/lib64'] + paths),
                           CUDA_VISIBLE_DEVICES=','.join(expected))
        result.update(source_archive_sha256=inputs['source_archive_sha256'],
                      test_binary_sha256=inputs['binary_sha256'], gpu_uuids=expected)
        sequence = [('controls', [str(binary), '--test-threads=1'], 120)]
        sequence += [('gpu-' + str(index), [str(binary), name, '--exact', '--ignored', '--nocapture', '--test-threads=1'], 120)
                     for index, name in enumerate(CASES)]
        for name, command, budget in sequence:
            verify_service_process(service['native_process'])
            result.update(phase='qualifying', current_case=name)
            publish()
            with (root / (name + '.stdout.log')).open('x') as stdout, (root / (name + '.stderr.log')).open('x') as stderr:
                child = subprocess.Popen(command, env=environment, stdout=stdout, stderr=stderr)
                started = time.monotonic()
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError('candidate reached its frozen 600-second total budget')
                status = child.wait(timeout=min(budget, remaining))
            output = (root / (name + '.stdout.log')).read_text()
            expected_summary = ('443 passed; 0 failed; 14 ignored;' if name == 'controls'
                                else '1 passed; 0 failed; 0 ignored;')
            passed = status == 0 and expected_summary in output
            result['cases'].append(dict(name=name, command=command, exit=status, passed=passed,
                                        elapsed_seconds=time.monotonic() - started))
            publish()
            if not passed:
                raise RuntimeError('candidate case failed; retain exact output and original numeric budgets')
        verify_service_process(service['native_process'])
        result.update(phase='passed', controls_passed=443, hardware_cases_passed=len(CASES))
    except Exception as error:
        result.update(phase='failed', error_type=type(error).__name__, error=str(error))
        raise
    finally:
        if child is not None:
            if child.poll() is None:
                child.kill()
            child.wait()
        result['completed_unix'] = time.time()
        publish()
        print(json.dumps(result), flush=True)


if __name__ == '__main__':
    main()
