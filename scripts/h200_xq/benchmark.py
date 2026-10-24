#!/usr/bin/env python3
"""Measure exact API output counts and wall time on the H200 deployment."""

import argparse
import concurrent.futures
import hashlib
import json
import math
import statistics
import threading
import time
import urllib.request
from pathlib import Path

from service import MODEL_NAME, PRIVATE, ROOT, synthetic_usage_mode


def collect_stream(lines, started, clock=time.monotonic):
    first = None
    usage = None
    finished = False
    done = False
    content = []
    reasoning = []
    chunks = 0
    for raw in lines:
        line = raw.decode('utf-8').strip()
        if not line.startswith('data:'):
            continue
        payload = line[5:].strip()
        if payload == '[DONE]':
            done = True
            break
        item = json.loads(payload)
        if item.get('error'):
            raise RuntimeError('inference stream returned an error')
        if item.get('usage') is not None:
            usage = item['usage']
        for choice in item.get('choices', []):
            delta = choice.get('delta') or {}
            text = delta.get('content') or ''
            thought = delta.get('reasoning_content') or ''
            if text or thought or delta.get('tool_calls'):
                if first is None:
                    first = clock()
                chunks += 1
            content.append(text)
            reasoning.append(thought)
            finished |= choice.get('finish_reason') is not None
    ended = clock()
    if not done or not finished:
        raise RuntimeError('inference stream did not terminate normally')
    if not isinstance(usage, dict) or type(usage.get('completion_tokens')) is not int or usage['completion_tokens'] <= 0:
        raise RuntimeError('exact positive completion token usage is required')
    if first is None:
        raise RuntimeError('inference stream returned no output payload')
    if (not all(math.isfinite(value) for value in (started, first, ended))
            or not started <= first <= ended or ended <= started):
        raise RuntimeError('benchmark clocks must be finite and monotonic')
    prompt = usage.get('prompt_tokens')
    if type(prompt) is not int or prompt < 0:
        raise RuntimeError('exact nonnegative prompt token usage is required')
    if 'total_tokens' in usage and (type(usage['total_tokens']) is not int
                                   or usage['total_tokens'] != prompt+usage['completion_tokens']):
        raise RuntimeError('upstream total usage does not match its exact components')
    return {
        'elapsed_s': ended-started, 'ttft_s': first-started,
        'usage': usage, 'payload_chunks': chunks,
        'output_sha256': hashlib.sha256(''.join(content).encode()).hexdigest(),
        'reasoning_sha256': hashlib.sha256(''.join(reasoning).encode()).hexdigest(),
        'content_characters': sum(map(len, content)),
        'reasoning_characters': sum(map(len, reasoning)),
    }


def request(base_url, key, max_tokens, barrier, index, round_index, concurrency, prompt_lines):
    reference = '\n'.join(f'record {row}: key=entry_{row}, value={17*row+73}.' for row in range(prompt_lines))
    prompt = (f'Benchmark cohort {concurrency}, request {index}.\n'+reference+'\n'
              'Write a detailed Python tutorial explaining binary search, invariants, '
              'boundary cases, tests, and complexity. Include complete examples and '
              'continue until all topics are covered. Benchmark request '
              f'{round_index}:{index}.')
    payload = {'model': MODEL_NAME, 'messages': [{'role': 'user', 'content': prompt}],
               'temperature': 0, 'max_tokens': max_tokens, 'stream': True,
               'stream_options': {'include_usage': True}}
    call = urllib.request.Request(base_url+'/v1/chat/completions',
                                  data=json.dumps(payload).encode(),
                                  headers={'Authorization': 'Bearer '+key,
                                           'Content-Type': 'application/json'})
    barrier.wait(timeout=30)
    started = time.monotonic()
    with urllib.request.urlopen(call, timeout=1800) as response:
        if response.headers.get_content_type() != 'text/event-stream':
            raise RuntimeError('expected an SSE inference response')
        result = collect_stream(response, started)
    result.update({'index': index, 'requested_max_tokens': max_tokens})
    return result


def publish(output, report):
    temporary = output.with_suffix(output.suffix+'.tmp')
    temporary.write_text(json.dumps(report, indent=2))
    temporary.replace(output)


def run_campaign(args):
    if not args.exact_benchmark_usage:
        raise RuntimeError('benchmark requires explicit exact-usage mode; rounded counts cannot certify speed')
    if args.url != 'http://127.0.0.1:30002':
        raise ValueError('this benchmark controls only the owned loopback frontend')
    if args.output.exists():
        raise RuntimeError('benchmark evidence already exists; choose a new output path')
    key = args.key_file.read_text().strip()
    profile_path = ROOT/'run/active-profile.json'
    original = json.loads(profile_path.read_text())
    if original.get('exact_benchmark_usage', False) is not False:
        raise RuntimeError('benchmark must begin from the normal privacy profile')
    mode = {}
    report = {'created_unix': time.time(), 'profile': original, 'rounds': [], 'complete': False,
              'normal_privacy_restored': False, 'reference_lines': args.prompt_lines,
              'metric': 'completion_tokens / entire concurrent batch wall time',
              'includes_reasoning_tokens': True,
              'execution_provider': 'Xolotl reference executor through Power',
              'decode_note': 'API chunk counts are not token counts. Executor single-request '
                             'decode timings are recorded separately and are not concurrent throughput.'}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    publish(args.output, report)
    try:
        with synthetic_usage_mode(mode):
            profile = json.loads(profile_path.read_text())
            if profile.get('exact_benchmark_usage') is not True:
                raise RuntimeError('running frontend did not enter exact-usage mode')
            if max(args.concurrency) > profile['max_concurrent']:
                raise RuntimeError('benchmark concurrency exceeds owned admission')
            report['profile'] = profile
            for concurrency in args.concurrency:
                for round_index in range(args.rounds):
                    barrier = threading.Barrier(concurrency+1)
                    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
                        jobs = [pool.submit(request, args.url, key, args.max_tokens, barrier, index, round_index,
                                            concurrency, args.prompt_lines)
                                for index in range(concurrency)]
                        started = time.monotonic()
                        barrier.wait(timeout=30)
                        results = []
                        for index, job in enumerate(jobs):
                            try:
                                results.append({**job.result(), 'outcome': 'success'})
                            except Exception as error:
                                # Never put request headers, credential strings or response
                                # bodies into retained failures.
                                results.append({'index': index, 'outcome': 'failure',
                                                'error_type': type(error).__name__})
                        elapsed = time.monotonic()-started
                    passed = all(row['outcome'] == 'success' for row in results)
                    valid_clock = math.isfinite(elapsed) and elapsed > 0
                    passed = passed and valid_clock
                    tokens = sum(row['usage']['completion_tokens'] for row in results) if passed else None
                    record = {'concurrency': concurrency, 'round': round_index, 'passed': passed,
                              'wall_s': elapsed if valid_clock else None, 'completion_tokens': tokens,
                              'valid_clock': valid_clock,
                              'aggregate_output_tokens_per_second': tokens/elapsed if passed else None,
                              'median_ttft_s': statistics.median(row['ttft_s'] for row in results) if passed else None,
                              'requests': results}
                    report['rounds'].append(record)
                    publish(args.output, report)
                    if not valid_clock:
                        raise RuntimeError('batch elapsed time must be finite and positive')
                    if not passed:
                        raise RuntimeError('a benchmark request failed; partial results were retained')
                    if concurrency == 1:
                        with urllib.request.urlopen('http://127.0.0.1:8150/v1/status', timeout=10) as response:
                            raw = response.read(256*1024+1)
                        if len(raw) > 256*1024:
                            raise RuntimeError('executor timing response exceeds its bound')
                        record['native_last_timings'] = json.loads(raw).get('last_timings')
                    publish(args.output, report)
                    print(json.dumps({k: v for k, v in record.items() if k != 'requests'}), flush=True)
        report['complete'] = True
    except BaseException as error:
        report['failure_type'] = type(error).__name__
        raise
    finally:
        report['finished_unix'] = time.time()
        report['normal_privacy_restored'] = mode.get('normal_privacy_restored', False)
        if 'restoration_error_type' in mode:
            report['restoration_error_type'] = mode['restoration_error_type']
        report['complete'] = bool(report['complete'] and report['normal_privacy_restored'])
        publish(args.output, report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:30002')
    parser.add_argument('--key-file', type=Path, default=PRIVATE/'api.key')
    parser.add_argument('--concurrency', type=int, nargs='+', default=[1, 4, 8])
    parser.add_argument('--rounds', type=int, default=3)
    parser.add_argument('--max-tokens', type=int, default=512)
    parser.add_argument('--prompt-lines', type=int, choices=range(0, 2049), default=0)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--exact-benchmark-usage', action='store_true',
                        help='temporarily use exact accounting for this fixed synthetic workload')
    args = parser.parse_args()
    if not 1 <= args.rounds <= 20 or not 64 <= args.max_tokens <= 8192:
        raise ValueError('rounds or output length is outside the bounded benchmark range')
    if not args.concurrency or any(not 1 <= n <= 128 for n in args.concurrency):
        raise ValueError('concurrency must be between one and 128')
    run_campaign(args)


if __name__ == '__main__':
    main()
