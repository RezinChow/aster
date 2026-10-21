#!/usr/bin/env python3
"""Run bounded remote H200 comparisons after verified bootstrap finishes."""

import fcntl
import json
import statistics
import subprocess
import sys
import time

from qualify import qualify, qualify_long_context
from service import ROOT, STAGING, PROFILES


def activate(case):
    if len(case) not in (4, 5):
        raise ValueError('a tuning case requires layout, profile, context, parallel, and optional draft depth')
    layout, profile, context, parallel = case[:4]
    depth = case[4] if len(case) == 5 else 4
    subprocess.run([sys.executable, str(STAGING/'service.py'), 'start', '--layout', layout,
                    '--profile', profile, '--context', str(context), '--parallel', str(parallel),
                    '--draft-depth', str(depth)], check=True)


def main():
    with (ROOT/'run/autotune.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        run_campaign()


def qualify_long_candidate(candidate):
    if candidate.get('long_context_qualification', {}).get('passed') and candidate.get('long_context_benchmark'):
        return True
    if 'long_context_failure' in candidate:
        return False
    case = tuple(candidate['case'])
    try:
        activate(case)
        checks = qualify_long_context()
        candidate['long_context_qualification'] = checks
        if not checks['passed']:
            raise RuntimeError('long-context copy checks failed')
        capacity = {'split8': 1, 'replica4x2': 4, 'replica8x1': 8}[case[0]]*case[3]
        output = ROOT/('bench/'+'-'.join(map(str, case))+'-long.json')
        subprocess.run([sys.executable, str(STAGING/'benchmark.py'), '--rounds', '2',
                        '--max-tokens', '512', '--prompt-lines', '512',
                        '--concurrency', '1', str(max(8, capacity)), '--output', str(output)], check=True)
        candidate['long_context_benchmark'] = str(output)
        return True
    except Exception as error:
        candidate['long_context_failure'] = type(error).__name__+': '+str(error)
        return False


def select_qualified_candidate(results, metric):
    ranked = sorted((record for record in results if metric in record),
                    key=lambda record: record[metric], reverse=True)
    return next((candidate for candidate in ranked if qualify_long_candidate(candidate)), None)


def run_campaign():
    while not (ROOT/'run/active-profile.json').is_file():
        print('WAITING_FOR_VERIFIED_BOOTSTRAP', time.time(), flush=True)
        time.sleep(30)
    baseline = ('split8', 'exact', 131072, 1)
    best = baseline
    best_score = -1
    cases = [baseline, ('split8', 'kv4-keep', 131072, 1),
             ('replica4x2', 'exact', 131072, 1), ('replica4x2', 'kv4-keep', 131072, 1),
             ('replica4x2', 'kv4-keep-ram', 131072, 1),
             ('replica8x1', 'exact', 131072, 1), ('replica8x1', 'kv4', 131072, 1),
             ('replica8x1', 'kv4-keep', 131072, 1), ('replica8x1', 'kv4-keep', 131072, 2),
             ('replica8x1', 'kv4-keep', 131072, 4), ('replica8x1', 'kv4-keep', 32768, 4),
             ('replica8x1', 'kv4-keep-ram', 131072, 1), ('replica8x1', 'kv4-keep-ram', 131072, 2),
             ('replica8x1', 'kv4-keep-ram', 131072, 4), ('replica8x1', 'kv4-keep-ram', 32768, 4),
             ('replica8x1', 'kv4-keep', 131072, 8), ('replica8x1', 'kv4-keep', 131072, 16),
             ('replica8x1', 'kv4-keep-ram', 131072, 8), ('replica8x1', 'kv4-keep-ram', 131072, 16),
             ('replica8x1', 'kv4-keep-ram', 32768, 8), ('replica8x1', 'kv4-keep-ram', 32768, 16)]
    results = []
    index = 0
    depth_sweep_done = False
    while index < len(cases):
        case = cases[index]
        tag = '-'.join(map(str, case))
        record = {'case': case, 'started_unix': time.time()}
        try:
            if case != baseline:
                activate(case)
            qualification = qualify()
            record['qualification'] = qualification
            if not qualification['passed']:
                raise RuntimeError('real-model correctness checks failed')
            capacity = {'split8': 1, 'replica4x2': 4, 'replica8x1': 8}[case[0]]*case[3]
            output = ROOT/f'bench/{tag}.json'
            subprocess.run([sys.executable, str(STAGING/'benchmark.py'), '--rounds', '3',
                            '--max-tokens', '512', '--concurrency', '1', str(max(8, capacity)),
                            '--output', str(output)], check=True)
            report = json.loads(output.read_text())
            if PROFILES[case[1]][1]:
                single = [row for row in report['rounds'] if row['concurrency'] == 1]
                if not any((row.get('native_last_timings') or {}).get('draft_n', 0) > 0 for row in single):
                    raise RuntimeError('DSpark was requested but native single-request timings reported no drafts')
            warm = [row['aggregate_output_tokens_per_second'] for row in report['rounds']
                    if row['round'] > 0 and row['concurrency'] == max(8, capacity)]
            score = statistics.median(warm)
            single = [row for row in report['rounds'] if row['concurrency'] == 1 and row['round'] > 0]
            single_api = statistics.median(row['requests'][0]['usage']['completion_tokens'] /
                                           row['requests'][0]['elapsed_s'] for row in single)
            native_decode = [(row.get('native_last_timings') or {}).get('predicted_per_second') for row in single]
            native_decode = [value for value in native_decode if isinstance(value, (int, float)) and value > 0]
            record.update({'benchmark': str(output), 'warm_median_output_tokens_per_second': score,
                           'warm_median_single_api_tokens_per_second': single_api,
                           'warm_median_native_decode_tokens_per_second': statistics.median(native_decode) if native_decode else None,
                           'target_output_tokens_per_second': 1000})
            if score > best_score:
                best, best_score = case, score
        except Exception as error:
            record['failed'] = type(error).__name__+': '+str(error)
            print('CANDIDATE_FAILED', tag, record['failed'], flush=True)
            # A rejected candidate cannot leave the known working endpoint down.
            activate(best)
        results.append(record)
        (ROOT/'bench/campaign.json').write_text(json.dumps(
            {'cases': results, 'best_case': best, 'best_warm_median_output_tokens_per_second': best_score,
             'complete': False}, indent=2))
        index += 1
        sidecar = STAGING/'assets/V41-MTP-Vision-1017.Q2_K.gguf'
        if index == len(cases) and sidecar.is_file() and not any(PROFILES[item[1]][1] for item in cases):
            cases += [('split8', 'dspark-keep', 131072, 1),
                      ('replica8x1', 'dspark', 131072, 1),
                      ('replica8x1', 'dspark-keep', 131072, 1),
                      ('replica4x2', 'dspark-keep', 131072, 1),
                      ('replica8x1', 'dspark-keep-ram', 131072, 1)]
            # Native slots use DSpark for a request alone and ordinary batch
            # windows under load. Compare that combination on the measured
            # best batch layout rather than discarding either workload.
            batched = [record for record in results if 'warm_median_output_tokens_per_second' in record
                       and record['case'][0] == 'replica8x1' and record['case'][3] > 1
                       and record['case'][1] in ('kv4-keep', 'kv4-keep-ram')]
            if batched:
                layout, profile, context, parallel = max(
                    batched, key=lambda record: record['warm_median_output_tokens_per_second'])['case'][:4]
                cases.append((layout, 'dspark-keep-ram' if profile.endswith('-ram') else 'dspark-keep',
                              context, parallel))
        elif index == len(cases) and not depth_sweep_done:
            depth_sweep_done = True
            drafts = [item for item in results if PROFILES[item['case'][1]][1]
                      and 'warm_median_single_api_tokens_per_second' in item]
            if drafts:
                leaders = {tuple(max(drafts, key=lambda item: item[metric])['case'][:4])
                           for metric in ('warm_median_single_api_tokens_per_second',
                                          'warm_median_output_tokens_per_second')}
                cases += [leader+(depth,) for leader in sorted(leaders) for depth in (2, 8, 12)]
    # A short-output winner must also preserve long-context correctness and run
    # the larger-prompt benchmark. Try the next measured candidate if it fails.
    aggregate_winner = select_qualified_candidate(results, 'warm_median_output_tokens_per_second')
    qualified = aggregate_winner is not None
    single_winner = None
    if qualified:
        best = tuple(aggregate_winner['case'])
        best_score = aggregate_winner['warm_median_output_tokens_per_second']
        single_winner = select_qualified_candidate(results, 'warm_median_single_api_tokens_per_second')
    else:
        best, best_score = baseline, -1
    # Single-request qualification may have activated another profile, including
    # a rejected one. Always restore the qualified serving choice afterward.
    activate(best)
    result = {'cases': results, 'best_case': best, 'best_warm_median_output_tokens_per_second': best_score,
              'long_context_qualified': qualified,
              'complete': True, 'target_reached': best_score >= 1000,
              'active_optimization_metric': 'aggregate_output_tokens_per_second',
              'aggregate_target_reached': best_score >= 1000,
              'single_request_target_reached': single_winner is not None and
                  single_winner['warm_median_single_api_tokens_per_second'] >= 1000,
              'note': 'All speeds are measured API output throughput. No target guarantee is inferred.'}
    singles = [record for record in results if 'warm_median_single_api_tokens_per_second' in record]
    if singles:
        fastest_single = max(singles, key=lambda record: record['warm_median_single_api_tokens_per_second'])
        result['best_measured_single_case'] = fastest_single['case']
        result['best_measured_single_api_tokens_per_second'] = fastest_single['warm_median_single_api_tokens_per_second']
        result['best_measured_single_long_context_qualified'] = bool(
            fastest_single.get('long_context_qualification', {}).get('passed') and
            fastest_single.get('long_context_benchmark') and 'long_context_failure' not in fastest_single)
    if single_winner is not None:
        result['best_qualified_single_case'] = single_winner['case']
        result['best_qualified_single_api_tokens_per_second'] = single_winner['warm_median_single_api_tokens_per_second']
        result['best_qualified_single_long_context_benchmark'] = single_winner['long_context_benchmark']
    (ROOT/'bench/campaign.json').write_text(json.dumps(result, indent=2))
    print('CAMPAIGN_FINISHED', json.dumps({key: value for key, value in result.items() if key != 'cases'}), flush=True)


if __name__ == '__main__':
    main()
