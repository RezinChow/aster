#!/usr/bin/env python3
"""Offline audit of fixed public artifacts; no credential reader or network calls."""
import collections
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent


def read(path):
    with path.open('rb') as stream:
        raw = stream.read(32 * 1024 * 1024 + 1)
    assert len(raw) <= 32 * 1024 * 1024
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def same(actual, expected):
    if type(expected) is float:
        assert type(actual) in (int, float) and math.isfinite(actual) and math.isclose(actual, expected, rel_tol=1e-12, abs_tol=1e-6)
    elif isinstance(expected, dict):
        assert isinstance(actual, dict) and set(actual) == set(expected)
        for name in expected:
            same(actual[name], expected[name])
    else:
        assert actual == expected


def validate_record(row, item, timeout):
    assert row['case'] == item['name']
    if row['outcome'] == 'refused':
        assert row['http_status'] == 429
        return
    assert row['outcome'] == 'success' and row['http_status'] == 200 and row['error'] is None
    assert row['finish_observed'] is True and row['terminal_observed'] is True
    assert type(row['meaningful_deltas']) is int and row['meaningful_deltas'] > 0
    assert 0 < row['elapsed_ms'] < timeout * 1000
    usage = row['usage']
    assert isinstance(usage, dict) and set(usage) == {'prompt_tokens', 'completion_tokens', 'total_tokens'}
    assert all(type(value) is int and 0 <= value < 2**64 for value in usage.values())
    assert usage['completion_tokens'] > 0 and usage['total_tokens'] == usage['prompt_tokens'] + usage['completion_tokens']
    assert row['usage_source'].startswith('upstream-') and row['wire_usage'] == usage and row['wire_usage_mismatch'] is False
    if 'tool' in item['expect']:
        assert row['quality_source'] == 'expected-tool' and row['tool_calls'] == 1 and row['tool_valid'] is True
    else:
        assert row['quality_source'] == 'expected-text'
    if item['request'].get('stream'):
        assert row['timing_observation'] == 'sse-incremental' and 0 <= row['ttft_ms'] <= row['elapsed_ms']
    else:
        assert row['timing_observation'] == 'buffered-completion'
        assert row['ttft_ms'] is None and row['first_tool_ms'] is None and row['output_delta_interval_ms'] is None


def main():
    w = load('selected_interface_offline_identity', HERE / 'public-selected-interface.py')
    q = load('frozen_runner_offline_summary', w.PINS['runner'][0])
    originals = w.original_pins()
    wrapper, wrapper_hash = read(HERE / 'public-selected-interface-v4-summary.json')
    assert wrapper['qualification_status'] == 'passed' and wrapper['wrapper_sha256'] == w.digest(Path(w.__file__))
    assert wrapper['original_pins'] == originals and wrapper['selection_proof_sha256'] == w.PROOF_SHA
    assert wrapper['causal_software_speedup'] is False
    selection, _ = w.selection_proof()
    assert wrapper['selection'] == selection
    observation = wrapper['socket_observation']
    assert observation['fallback_used'] is False and observation['global_route_or_proxy_changes'] is False
    for sample in observation['samples']:
        assert sample == {'set_network_order_hex': '00000004', 'get_host_order': selection['interface_index'],
                          'source_sha256': selection['source_ip_sha256'], 'family': 'AF_INET', 'target': list(w.TARGET)}
    corpus = [json.loads(line) for line in w.PINS['corpus'][0].read_text(encoding='utf-8').splitlines() if line.strip()]
    assert [cell['concurrency'] for cell in wrapper['cells']] == [1, 8, 16, 32]
    result = {'status': 'passed', 'scope': __doc__, 'files': {'public-selected-interface-v4-summary.json': wrapper_hash},
              'original_pins': originals, 'network_factor': wrapper['network_factor'], 'cells': [],
              'public_429_classification': 'HTTP429 only; the frozen runner does not retain refusal error codes',
              'quality_evidence': 'frozen expected-output predicates, indexed tool validation and content-free output hashes',
              'not_claimed': ['software-only WAN speedup', 'default-route repair', 'native-exclusive capacity', 'Work UI/Darwin acceptance']}
    totals, sockets = collections.Counter(), collections.Counter()
    for cell in wrapper['cells']:
        concurrency = cell['concurrency']
        assert cell['file'] == f'public-selected-interface-v4-c{concurrency}-attempt1.json' and cell['exit_code'] == 0
        value, sha = read(HERE / cell['file'])
        result['files'][cell['file']] = sha
        assert value['qualification_status'] == 'passed' and value['corpus_sha256'] == originals['corpus']
        assert value['tool_identity']['runner_sha256'] == originals['runner'] and value['tool_identity']['matrix_sha256'] == originals['matrix']
        assert value['models']['http_status'] == 200 and 'prism-27b' in value['models']['model_ids']
        functional, campaign = value['records'], value['campaign']
        assert len(functional) == len(corpus) == 4
        for row, item in zip(functional, corpus):
            validate_record(row, item, 30)
            assert row['outcome'] == 'success'
        records = campaign['records']
        assert campaign['limits'] == {'seconds': 60.0, 'request_timeout': 120, 'concurrency': concurrency, 'max_requests': 10000}
        assert campaign['aborted'] is False and campaign['request_budget_exhausted'] is False
        assert [row['request_index'] for row in records] == list(range(len(records)))
        for row in records:
            validate_record(row, corpus[row['request_index'] % len(corpus)], 120)
            assert row['endpoint_index'] == 0
        summary = campaign['summary']
        same(summary, q.summarize(records, summary['wall_seconds_including_drain']))
        assert set(campaign['case_summaries']) == {item['name'] for item in corpus}
        for name, case_summary in campaign['case_summaries'].items():
            same(case_summary, q.summarize([row for row in records if row['case'] == name], summary['wall_seconds_including_drain']))
        counts = collections.Counter(row['outcome'] for row in records)
        assert set(counts) <= {'success', 'refused'} and counts['success'] > 0
        delta = cell['socket_counts_delta']
        expected_sockets = 1 + len(functional) + len(records)
        assert delta == {'target_attempts': expected_sockets, 'set_verified': expected_sockets, 'connected_verified': expected_sockets, 'failures': 0}
        totals.update(counts)
        sockets.update(delta)
        result['cells'].append({'concurrency': concurrency, 'functional_successes': len(functional), 'measured_outcomes': dict(counts),
                                'authoritative_output_tokens': summary['authoritative_output_tokens'],
                                'verified_output_tokens_per_second': summary['successful_output_tokens_per_second'],
                                'verified_requests_per_second': summary['successful_requests_per_second'],
                                'wall_seconds_including_drain': summary['wall_seconds_including_drain'],
                                'p95_ttft_ms': summary['ttft_ms']['p95'], 'p95_completion_ms': summary['elapsed_ms']['p95'],
                                'p95_first_tool_ms': summary['first_tool_ms']['p95'], 'selected_interface_sockets': expected_sockets})
    assert dict(sockets) == observation['counts']
    result.update(measured_outcomes=dict(totals), measured_authoritative_output_tokens=sum(x['authoritative_output_tokens'] for x in result['cells']),
                  separate_functional_successes=16, separate_authenticated_models_requests=4, validated_socket_counts=dict(sockets),
                  audit_source_sha256=w.digest(Path(__file__)), original_acp_failure_sha256=w.digest(HERE / 'aster-acp-final-v4.json'),
                  retained_default_public_failure_sha256=w.digest(HERE / 'public-wan-v4-c1-attempt1.json'))
    with (HERE / 'public-selected-interface-v4-audit.json').open('x', encoding='utf-8') as stream:
        json.dump(result, stream, indent=2)
        stream.write('\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
