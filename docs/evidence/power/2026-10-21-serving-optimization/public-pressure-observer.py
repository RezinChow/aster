#!/usr/bin/env python3
"""Read-only production observations; native counters include unknown natural traffic."""
import argparse
import concurrent.futures
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import threading
import time

HERE = Path('/code/aster/docs/evidence/power/2026-10-21-serving-optimization')
spec = importlib.util.spec_from_file_location('existing_shared_observation_library', HERE / 'eight-card-live-qualification.py')
l = importlib.util.module_from_spec(spec)
spec.loader.exec_module(l)
e, m = l.e, l.m
NATIVE_SHA = '661b413b780759bfa2c9b8fd87608c15fcc3651142d771b1c94d11d01195d298'


def identities():
    result = {}
    for gpu in range(8):
        result[gpu] = {}
        for kind, unit, port, expected in (
                ('native', 'prism-27b@' + str(gpu) + '.service', 18100 + gpu, NATIVE_SHA),
                ('power', 'a3s-power@' + str(gpu) + '.service', 18200 + gpu, l.POWER_SHA)):
            value = m.process_identity(l.systemd_pid(unit), port)
            if value['exe_sha256'] != expected:
                raise m.GuardError('actual production executable differs')
            result[gpu][kind] = value
    return result


def worker(gpu, fixed):
    observed = {name: l.light_stamp(stamp) for name, stamp in fixed.items()}
    counters = l.parse_native_metrics(m.get('/metrics', port=18100 + gpu, timeout=.8))
    health = json.loads(m.get('/health', port=18200 + gpu, timeout=.8))
    admission = health.get('worker', {}).get('admission', {})
    safe_health = {'status': health.get('status') if health.get('status') in ('ok', 'error', 'loading', 'degraded') else 'other',
                   'loaded_models': health.get('loaded_models'),
                   'num_parallel': health.get('inference', {}).get('num_parallel'),
                   'admission': {name: admission.get(name) for name in ('active_limit', 'active', 'waiting')}}
    for value in (safe_health['loaded_models'], safe_health['num_parallel'], *safe_health['admission'].values()):
        if type(value) is not int or not 0 <= value <= 2**64 - 1:
            raise m.GuardError('safe health integer observation malformed')
    gauges = l.power_gauges(m.get('/metrics', port=18200 + gpu, timeout=.8), 2, False)
    return {'identity': observed, 'native_counters': counters, 'power_health': safe_health, 'power_gauges': gauges}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seconds', type=int, default=600)
    parser.add_argument('--tag', choices=('public-pressure-v4-observer1',), required=True)
    args = parser.parse_args()
    if not 1 <= args.seconds <= 600:
        raise SystemExit('bounded duration required')
    directory = m.PRIVATE / args.tag
    directory.mkdir(exist_ok=False)
    started = time.monotonic()
    result = {'scope': __doc__, 'started_utc': datetime.now(timezone.utc).isoformat(), 'status': 'starting',
              'max_seconds': args.seconds, 'sampling_target_seconds': 1, 'samples': 0,
              'counter_attribution': 'UNKNOWN; aggregate native counters include concurrent natural production traffic',
              'model_requests_issued': 0, 'production_mutations': 0}
    stop = threading.Event()
    watchdog = threading.Timer(args.seconds, stop.set)
    watchdog.start()
    fixed, prior, peaks = None, None, {gpu: 0 for gpu in range(8)}
    pool = concurrent.futures.ThreadPoolExecutor(max_workers=8)
    try:
        fixed = identities()
        result['initial_identity'] = fixed
        result['status'] = 'observing'
        m.write_result(directory / 'status.json', result)
        print(json.dumps({'status': 'observing', 'directory': str(directory), 'started_utc': result['started_utc']}), flush=True)
        with (directory / 'samples.jsonl').open('x') as raw:
            while not stop.is_set() and not (directory / 'STOP').exists():
                tick = time.monotonic()
                gpu = e.gpu_samples(list(range(8)))
                row = {'observed_utc': datetime.now(timezone.utc).isoformat(), 'elapsed_s': tick - started, 'gpu': gpu}
                if any(m.vram_exceeded(value) for value in gpu.values()):
                    raise m.GuardError('whole-GPU90percent VRAM guard exceeded')
                futures = {index: pool.submit(worker, index, fixed[index]) for index in range(8)}
                observed = {index: future.result(timeout=4) for index, future in futures.items()}
                if prior is not None:
                    for index in range(8):
                        l.monotonic(prior[index]['native_counters'], observed[index]['native_counters'])
                        if prior[index]['identity'] != observed[index]['identity']:
                            raise m.GuardError('production light identity changed')
                prior = observed
                row.update(workers=observed, sample_elapsed_s=time.monotonic() - tick)
                raw.write(json.dumps(row) + '\n')
                raw.flush()
                for index, value in gpu.items():
                    peaks[index] = max(peaks[index], value['used_mib'] / value['total_mib'])
                result.update(samples=result['samples'] + 1, elapsed_s=time.monotonic() - started,
                              last_sample_elapsed_s=row['sample_elapsed_s'], peak_vram_ratio=peaks)
                m.write_result(directory / 'status.json', result)
                stop.wait(max(0, 1 - (time.monotonic() - tick)))
        result.update(status='completed', final_identity=identities())
        if fixed != result['final_identity']:
            raise m.GuardError('production final identity changed')
    except Exception as exc:
        result.update(status='failed', failure_exception=type(exc).__name__,
                      failure_reason=str(exc) if isinstance(exc, m.GuardError) else 'bounded read-only observation failed')
        print(json.dumps({'status': 'failed', 'failure_exception': result['failure_exception'], 'failure_reason': result['failure_reason']}), flush=True)
    finally:
        stop.set()
        watchdog.cancel()
        watchdog.join(timeout=1)
        pool.shutdown(wait=True, cancel_futures=True)
        result.update(elapsed_s=time.monotonic() - started, last_observed=prior, peak_vram_ratio=peaks)
        m.write_result(directory / 'status.json', result)
        print(json.dumps({'status': result['status'], 'samples': result['samples'], 'elapsed_s': result['elapsed_s']}), flush=True)


if __name__ == '__main__':
    main()
