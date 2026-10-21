#!/usr/bin/env python3
"""Measure exact API output counts and wall time on the H200 deployment."""

import argparse
import concurrent.futures
import hashlib
import json
import statistics
import threading
import time
import urllib.request
from pathlib import Path

from service import MODEL_NAME, PRIVATE, ROOT


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
    if not usage or type(usage.get('completion_tokens')) is not int or usage['completion_tokens'] <= 0:
        raise RuntimeError('exact positive completion token usage is required')
    if first is None:
        raise RuntimeError('inference stream returned no output payload')
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:30002')
    parser.add_argument('--key-file', type=Path, default=PRIVATE/'api.key')
    parser.add_argument('--concurrency', type=int, nargs='+', default=[1, 4, 8])
    parser.add_argument('--rounds', type=int, default=3)
    parser.add_argument('--max-tokens', type=int, default=512)
    parser.add_argument('--prompt-lines', type=int, choices=range(0, 2049), default=0)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if not 1 <= args.rounds <= 20 or not 64 <= args.max_tokens <= 8192:
        raise ValueError('rounds or output length is outside the bounded benchmark range')
    if not args.concurrency or any(not 1 <= n <= 128 for n in args.concurrency):
        raise ValueError('concurrency must be between one and 128')
    key = args.key_file.read_text().strip()
    profile_path = ROOT/'run/active-profile.json'
    profile = json.loads(profile_path.read_text())
    report = {'created_unix': time.time(), 'profile': profile, 'rounds': [],
              'reference_lines': args.prompt_lines,
              'metric': 'completion_tokens / entire concurrent batch wall time',
              'includes_reasoning_tokens': True,
              'decode_note': 'API chunk counts are not token counts. Native single-request '
                             'decode timings are recorded separately and are not concurrent throughput.'}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    for concurrency in args.concurrency:
        for round_index in range(args.rounds):
            barrier = threading.Barrier(concurrency+1)
            with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
                jobs = [pool.submit(request, args.url, key, args.max_tokens, barrier, index, round_index,
                                    concurrency, args.prompt_lines)
                        for index in range(concurrency)]
                started = time.monotonic()
                barrier.wait(timeout=30)
                results = [job.result() for job in jobs]
                elapsed = time.monotonic()-started
            tokens = sum(result['usage']['completion_tokens'] for result in results)
            record = {'concurrency': concurrency, 'round': round_index,
                      'wall_s': elapsed, 'completion_tokens': tokens,
                      'aggregate_output_tokens_per_second': tokens/elapsed,
                      'median_ttft_s': statistics.median(result['ttft_s'] for result in results),
                      'requests': results}
            if concurrency == 1:
                with urllib.request.urlopen('http://127.0.0.1:8150/v1/status', timeout=10) as response:
                    status = json.load(response)
                record['native_last_timings'] = status.get('last_timings')
            report['rounds'].append(record)
            temporary = args.output.with_suffix(args.output.suffix+'.tmp')
            temporary.write_text(json.dumps(report, indent=2))
            temporary.replace(args.output)
            print(json.dumps({k: v for k, v in record.items() if k != 'requests'}), flush=True)


if __name__ == '__main__':
    main()
