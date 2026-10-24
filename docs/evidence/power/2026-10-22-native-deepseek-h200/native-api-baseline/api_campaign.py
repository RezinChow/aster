"""Bounded native API measurements. Exact SSE usage; no rounded token counts.

This client does not allocate hardware, alter a serving profile, or qualify a
deployment from a short measurement. Every completed failure is journaled.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import http.client
import ipaddress
import json
import math
import os
from pathlib import Path
import time
from urllib.parse import urlsplit

PROMPT = '按顺序列出从1到20的整数，用逗号分隔，不要解释。'
ALIAS = 'deepseek-v4.1-flash-1017-xq'


def positive_integer(value, maximum):
    return type(value) is int and 1 <= value <= maximum


def validate_plan(plan):
    fields = {'schema', 'base_url', 'model', 'server_binary_sha256', 'concurrency',
              'repeats', 'max_tokens', 'campaign_seconds', 'request_seconds',
              'credential_expires_unix', 'resource_lease_ends_unix', 'prompt_sha256'}
    if set(plan) != fields or plan['schema'] != 'aster-native-api-campaign-plan-v1':
        raise ValueError('campaign plan has unknown or missing fields')
    url = urlsplit(plan['base_url'])
    if (url.scheme != 'http' or url.username or url.password or url.query or url.fragment
            or url.path != '/v1' or url.port != 30003):
        raise ValueError('campaign endpoint must be the declared native HTTP listener')
    host = ipaddress.ip_address(url.hostname)
    if host.version != 4 or not host.is_private or host.is_unspecified or host.is_multicast:
        raise ValueError('campaign endpoint must be an explicit private IPv4 address')
    if plan['model'] != ALIAS or plan['concurrency'] != [1, 4, 8] or plan['repeats'] != 3:
        raise ValueError('campaign requires the frozen model and three 1/4/8 cells')
    if (not positive_integer(plan['max_tokens'], 32)
            or not positive_integer(plan['campaign_seconds'], 900)
            or not positive_integer(plan['request_seconds'], 300)
            or plan['request_seconds'] > plan['campaign_seconds']
            or plan['prompt_sha256'] != hashlib.sha256(PROMPT.encode()).hexdigest()
            or not isinstance(plan['server_binary_sha256'], str)
            or len(plan['server_binary_sha256']) != 64
            or any(c not in '0123456789abcdef' for c in plan['server_binary_sha256'])):
        raise ValueError('campaign budgets, prompt or build identity are invalid')
    for field in ['credential_expires_unix', 'resource_lease_ends_unix']:
        if not positive_integer(plan[field], 9_007_199_254_740_991):
            raise ValueError('campaign requires absolute integer lease deadlines')
    if plan['credential_expires_unix'] >= plan['resource_lease_ends_unix']:
        raise ValueError('credential must end before the allocation')
    return url


def exact_usage(value, maximum):
    if not isinstance(value, dict):
        raise ValueError('SSE terminal usage is missing')
    prompt = value.get('prompt_tokens')
    completion = value.get('completion_tokens')
    total = value.get('total_tokens')
    if (not positive_integer(prompt, 256)
            or not positive_integer(completion, maximum)
            or type(total) is not int or total != prompt + completion):
        raise ValueError('SSE token counts are rounded, invalid or inconsistent')
    return dict(prompt_tokens=prompt, completion_tokens=completion, total_tokens=total)


def parse_sse(response, before_read, started, maximum, clock=time.monotonic):
    size = 0
    fragments = []
    usage = None
    finish = None
    for _ in range(512):
        before_read()
        line = response.readline(65537)
        size += len(line)
        if len(line) > 65536 or size > 262144:
            raise ValueError('SSE exceeds line/event/byte bounds')
        if not line:
            raise ValueError('SSE closed before DONE')
        if not line.startswith(b'data:'):
            continue
        data = line[5:].strip()
        if data == b'[DONE]':
            counts = exact_usage(usage, maximum)
            if not fragments or finish not in ('stop', 'length'):
                raise ValueError('SSE has no text or terminal finish reason')
            return dict(text=''.join(item['text'] for item in fragments),
                        text_fragments=fragments, first_text_seconds=fragments[0]['seconds'],
                        elapsed_seconds=clock() - started, finish_reason=finish,
                        usage=counts, sse_bytes=size, done=True)
        event = json.loads(data)
        if event.get('error'):
            raise ValueError('SSE contains a terminal server error')
        if event.get('usage') is not None:
            if usage is not None:
                raise ValueError('SSE repeats terminal usage')
            usage = event['usage']
        for choice in event.get('choices', []):
            if choice.get('index') != 0:
                raise ValueError('SSE contains an unexpected choice')
            delta = choice.get('delta', {})
            if delta.get('tool_calls') or delta.get('reasoning_content'):
                raise ValueError('text-only campaign received an unexpected output kind')
            text = delta.get('content')
            if text:
                if not isinstance(text, str):
                    raise ValueError('SSE text is not a string')
                fragments.append(dict(seconds=clock() - started, text=text))
            if choice.get('finish_reason') is not None:
                if finish is not None:
                    raise ValueError('SSE repeats its terminal finish reason')
                finish = choice['finish_reason']
    raise ValueError('SSE exceeds the finite event limit')


def request(plan, key, identity, campaign_deadline, clock=time.monotonic):
    started = clock()
    result = dict(request_id=identity, started_unix=time.time(), passed=False)
    connection = None
    try:
        deadline = min(campaign_deadline, started + plan['request_seconds'])

        def remaining():
            value = deadline - clock()
            if value <= 0:
                raise TimeoutError('native API request reached its frozen deadline')
            return value

        url = urlsplit(plan['base_url'])
        connection = http.client.HTTPConnection(url.hostname, url.port, timeout=remaining())
        connection.connect()
        transport = connection.sock
        body = dict(model=plan['model'], messages=[dict(role='user', content=PROMPT)],
                    temperature=0, max_tokens=plan['max_tokens'], stream=True,
                    stream_options=dict(include_usage=True))
        connection.request('POST', url.path + '/chat/completions',
                           body=json.dumps(body, ensure_ascii=False).encode(),
                           headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
        transport.settimeout(remaining())
        response = connection.getresponse()
        result['status'] = response.status
        if response.status != 200:
            # The status is sufficient; do not echo arbitrary server bodies or keys.
            raise RuntimeError('native API returned HTTP ' + str(response.status))
        if response.getheader('Content-Type', '').split(';')[0] != 'text/event-stream':
            raise ValueError('native stream response has an unexpected content type')

        def before_read():
            transport.settimeout(remaining())

        result.update(parse_sse(response, before_read, started, plan['max_tokens'], clock))
        result['passed'] = True
    except Exception as error:
        # Exception strings can contain values from external responses. Keep the
        # closed type and known HTTP status; never serialize a credential.
        result.update(error_type=type(error).__name__, elapsed_seconds=clock() - started)
    finally:
        if connection is not None:
            connection.close()
    return result


def percentile(values, fraction):
    if not values:
        return None
    ordered = sorted(values)
    return ordered[max(0, math.ceil(len(ordered) * fraction) - 1)]


def summarize(records, elapsed):
    good = [item for item in records if item['passed']]
    tokens = sum(item['usage']['completion_tokens'] for item in good)
    return dict(requests=len(records), successful=len(good), failed=len(records) - len(good),
                elapsed_seconds=elapsed, actual_completion_tokens=tokens,
                aggregate_output_tokens_per_second=tokens / elapsed if elapsed > 0 else None,
                ttft_p50=percentile([x['first_text_seconds'] for x in good], .5),
                ttft_p95=percentile([x['first_text_seconds'] for x in good], .95),
                latency_p50=percentile([x['elapsed_seconds'] for x in good], .5),
                latency_p95=percentile([x['elapsed_seconds'] for x in good], .95),
                token_itl_claimed=False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--key-file', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    if args.plan.stat().st_size > 16384 or args.key_file.stat().st_size > 128:
        raise RuntimeError('campaign input exceeds byte limits')
    for path in [args.plan, args.key_file]:
        metadata = path.lstat()
        if (path.is_symlink() or not path.is_file() or path.resolve() != path
                or metadata.st_uid != os.getuid() or metadata.st_mode & 0o077):
            raise RuntimeError('campaign input is not an exact private owned file')
    plan_bytes = args.plan.read_bytes()
    plan = json.loads(plan_bytes)
    validate_plan(plan)
    key = args.key_file.read_text().strip()
    if not key.startswith('sk-aster-') or len(key) > 100 or any(c.isspace() for c in key):
        raise RuntimeError('campaign key format is invalid')
    if time.time() + plan['campaign_seconds'] + 60 >= plan['credential_expires_unix']:
        raise RuntimeError('campaign does not fit the frozen credential/resource window')
    os.umask(0o077)
    args.output_dir.mkdir(mode=0o700, exist_ok=False)
    result = dict(schema='aster-native-api-campaign-result-v1', phase='running',
                  started_unix=time.time(), plan_sha256=hashlib.sha256(plan_bytes).hexdigest(),
                  production_or_performance_promotion_claimed=False, cells=[])
    started = time.monotonic()
    deadline = started + plan['campaign_seconds']

    def publish():
        temporary = args.output_dir / 'result.tmp'
        temporary.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
        temporary.replace(args.output_dir / 'result.json')

    publish()
    with (args.output_dir / 'requests.jsonl').open('x', buffering=1) as journal:
        try:
            for repeat in range(plan['repeats']):
                levels = plan['concurrency'] if repeat % 2 == 0 else list(reversed(plan['concurrency']))
                for concurrency in levels:
                    if time.monotonic() >= deadline:
                        raise TimeoutError('campaign reached its frozen total budget')
                    cell_started = time.monotonic()
                    records = []
                    with ThreadPoolExecutor(max_workers=concurrency) as pool:
                        futures = [pool.submit(request, plan, key,
                            f'r{repeat + 1}-c{concurrency}-{index}', deadline) for index in range(concurrency)]
                        for future in as_completed(futures):
                            value = future.result()
                            records.append(value)
                            journal.write(json.dumps(value, ensure_ascii=False) + '\n')
                    cell = summarize(records, time.monotonic() - cell_started)
                    cell.update(repeat=repeat + 1, concurrency=concurrency)
                    result['cells'].append(cell)
                    publish()
            result['phase'] = 'completed'
        except Exception as error:
            result.update(phase='failed', error_type=type(error).__name__)
            raise
        finally:
            result.update(completed_unix=time.time(), elapsed_seconds=time.monotonic() - started)
            publish()
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
