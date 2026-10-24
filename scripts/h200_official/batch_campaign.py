#!/usr/bin/env python3
"""Measure bounded batching, then restore a qualified private Power frontend."""

import json
import shutil
import subprocess
import sys
import time

import validate


def run():
    root = validate.ROOT
    original = json.loads((root/'run/frontend.json').read_text())
    original_limit = original.get('max_concurrent_requests', 4)
    if original.get('exact_benchmark_usage'):
        raise RuntimeError('campaign must start from the normal privacy configuration')
    if validate.active_requests() != 0:
        raise RuntimeError('owned frontend is busy; defer the campaign')
    command = [sys.executable, str(validate.__file__)]
    retained = root/'logs/deepinfer-batching'
    retained.mkdir(exist_ok=True)
    if (retained/'campaign.json').exists():
        raise RuntimeError('campaign evidence already exists; refusing to replace it')
    record = {'started_unix': time.time(), 'complete': False, 'original_limit': original_limit,
              'upstream_engine_restarted': False, 'reference_revision':
              '9bd9cf243fc53ef9afbf8f04d391d989117d6ab9'}
    def publish():
        temporary = retained/'campaign.tmp'
        temporary.write_text(json.dumps(record, indent=2))
        temporary.replace(retained/'campaign.json')
    def call(*arguments, timeout=240):
        subprocess.run([*command, *arguments], check=True, timeout=timeout)
    def retain(name, source):
        shutil.copy2(root/'run'/source, retained/name)
    chosen = original_limit
    publish()
    try:
        call('stop')
        call('start', '--exact-benchmark-usage', '--max-concurrent', '32')
        retain('benchmark-frontend.json', 'frontend.json')
        call('check')
        retain('qualification-exact.json', 'qualification.json')
        call('benchmark', '--concurrency', '1', '4', '8', '16', '32',
             '--output-name', 'deepinfer-batching.json', timeout=1200)
        retain('benchmark.json', 'deepinfer-batching.json')
        report = json.loads((retained/'benchmark.json').read_text())
        if report.get('complete') is not True:
            raise RuntimeError('incomplete benchmark cannot change normal admission')
        rates = report['median_output_tokens_per_second']
        # Retain the established default unless a larger batch improves the
        # observed aggregate rate. This is a serving-capacity choice, not a
        # claim that Power implemented a GPU kernel optimization.
        measured = [n for n in (4, 8, 16, 32) if rates[str(n)] >= rates['4']]
        chosen = max(measured, key=lambda n: rates[str(n)])
        record['median_output_tokens_per_second'] = rates
        record['benchmark_complete'] = True
    except Exception as error:
        record['campaign_error'] = type(error).__name__+': '+str(error)
        source = root/'run/deepinfer-batching.json'
        if source.is_file():
            retain('incomplete-benchmark.json', source.name)
        raise
    finally:
        record['selected_limit'] = chosen
        publish()
        try:
            call('stop')
            call('start', '--max-concurrent', str(chosen))
            retain('normal-frontend.json', 'frontend.json')
            call('check')
            retain('qualification-normal.json', 'qualification.json')
            record['normal_privacy_restored'] = True
        except Exception as error:
            record['restoration_error'] = type(error).__name__+': '+str(error)
            raise
        finally:
            record['finished_unix'] = time.time()
            record['complete'] = bool(record.get('benchmark_complete') and record.get('normal_privacy_restored'))
            publish()
    print(json.dumps(record), flush=True)


if __name__ == '__main__':
    run()
