#!/usr/bin/env python3
"""Offline full-eight archive and final production receipt audit; never call services."""
import collections
import hashlib
import importlib.util
import json
from pathlib import Path, PurePosixPath
import sys
import tarfile

HERE = Path(__file__).resolve().parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    spec = importlib.util.spec_from_file_location('public_offline_audit_library', HERE / 'audit-public-selected-interface.py')
    a = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(a)
    q = a.load('frozen_summary_final_audit', HERE.parents[3] / 'scripts/power_serving_qualification.py')
    corpus = {x['name']: x for x in (json.loads(line) for line in (HERE / 'eight-card-corpus.jsonl').read_text(encoding='utf-8').splitlines())}
    archive = HERE / 'live-v4-v2-full1.tar.gz'
    manifest = json.loads((HERE / 'live-v4-v2-full1-archive-manifest.json').read_text(encoding='utf-8'))
    assert digest(archive) == 'a9dfe1aa92c84763a9097607d459fc55e1daa9017ed1a030ab453ccfbcbc39a0'
    outcomes, warm, tokens, cells = collections.Counter(), 0, 0, []
    with tarfile.open(archive) as tar:
        assert len(tar.getmembers()) == 34
        for entry in tar.getmembers():
            path = PurePosixPath(entry.name)
            assert entry.isfile() and not path.is_absolute() and '..' not in path.parts
        for entry in manifest['files']:
            raw = tar.extractfile(entry['member']).read()
            assert len(raw) == entry['size'] and hashlib.sha256(raw).hexdigest() == entry['sha256']
        for name in sorted(x.name for x in tar.getmembers() if x.name.startswith('raw/shared-')):
            value = json.load(tar.extractfile(name))
            assert value['qualification_status'] == 'passed' and value['selected_gpus'] == list(range(8))
            assert value['own_http_complete'] is True and value['own_power_permits_zero'] is True
            assert value['native_exclusive_capacity'] is False and value['native_exclusive_tokens_per_second'] is None
            assert value['authenticated_public_frontdoor_pressure'] == 'not_tested_by_this_private_wrapper_tool'
            assert value['monitor_errors'] == [] and value['monitor_terminated'] is True
            assert value['observations'] and value['vram_guard_samples']
            assert value['native_process_control'] == 'never; guard shuts down helper-owned private HTTP sockets only'
            measured, warmup = value['records'], value['warmup_records']
            assert len(warmup) == 32
            for row in warmup + measured:
                a.validate_record(row, corpus[row['case']], 120)
                if row['outcome'] == 'refused':
                    assert row['admission_refusal_code'] in ('admission_queue_full', 'admission_queue_timeout')
            for gpu in range(8):
                owned_warm = [x for x in warmup if x['endpoint_index'] == gpu]
                assert {x['case'] for x in owned_warm} == set(corpus) and all(x['outcome'] == 'success' for x in owned_warm)
                own = [x for x in measured if x['endpoint_index'] == gpu and x['outcome'] == 'success']
                assert own
                for before, after, records in ((value['before_warmup'], value['before_measurement'], owned_warm),
                                                (value['before_measurement'], value['after_measurement'], own)):
                    first, last = before['native_counters'][str(gpu)], after['native_counters'][str(gpu)]
                    for metric in first:
                        assert last[metric] >= 0
                        if metric not in ('llamacpp:requests_processing', 'llamacpp:requests_deferred'):
                            assert last[metric] >= first[metric]
                    delta = last['llamacpp:tokens_predicted_total'] - first['llamacpp:tokens_predicted_total']
                    assert delta == sum(x['usage']['completion_tokens'] for x in records)
            summary = value['summary']
            a.same(summary, q.summarize(measured, summary['wall_seconds_including_drain']))
            outcomes.update(x['outcome'] for x in measured)
            warm += len(warmup)
            tokens += summary['authoritative_output_tokens']
            cells.append(name)
    assert len(cells) == 12 and outcomes == {'success': 4747, 'refused': 1631} and warm == 384 and tokens == 468683
    fleet = json.loads((HERE / 'production-final-v4-readiness.json').read_text(encoding='utf-8'))
    assert fleet['status'] == 'passed' and fleet['credentials_exported'] is False and fleet['production_changes_performed'] is False
    assert fleet['gateway_protected_configuration_unchanged'] is True and fleet['production_workers_same_as_gateway_cutover'] is True
    assert sorted(x['gpu'] for x in fleet['gpus']) == list(range(8))
    for gpu in fleet['gpus']:
        probe, ready = gpu['current_authenticated_probe'], gpu['runtime_readiness']
        assert probe['status'] == 'worker-recovery-passed' and probe['actual_production_worker_loaded'] is True
        assert probe['models_http_status'] == probe['completion_http_status'] == probe['health_http_status'] == 200
        assert probe['exact_alias_present'] is True and probe['expected_output'] is True and probe['credentials_output'] is False
        assert ready['slots'] == 2 and ready['health_200'] is True and ready['candidate_observability_geometry_checked'] is True
        assert ready['cuda_visible_devices'] == str(gpu['gpu'])
        assert ready['whole_gpu_memory_mib']['used'] / ready['whole_gpu_memory_mib']['total'] < .9
        for kind in ('native', 'power'):
            assert all(probe[kind][key] == ready[kind][key] for key in ('pid', 'start_ticks'))
        assert probe['power']['exe_sha256'] == '75afe5de8d423547fdb9b9bb302b17ca9e168d6f6fe13a18d29fbce9492bf1c1'
    assert fleet['gateway']['exe_sha256'] == 'eaf9f4ca8baf38074d1548badebbd3b42bd08ab5174e2f9136101ccbcfb6c1fd'
    assert fleet['gateway']['listener8080_inodes'] and fleet['gateway']['unauthenticated_models']['http_status'] == 401
    result = {'status': 'passed', 'scope': __doc__, 'archive_members_verified': 34, 'full_shared_cells': len(cells),
              'measured_outcomes': dict(outcomes), 'warmups': warm, 'authoritative_measured_completion_tokens': tokens,
              'per_gpu_warmup_and_measured_completion_delta_equality': True, 'final_authenticated_worker_probes': 8,
              'final_production_units': 17, 'no_service_calls': True, 'no_credential_reads': True,
              'archive_sha256': digest(archive), 'production_receipt_sha256': digest(HERE / 'production-final-v4-readiness.json'),
              'public_audit_sha256': digest(HERE / 'public-selected-interface-v4-audit.json'), 'source_sha256': digest(Path(__file__)),
              'limits': ['shared goodput uses a private second admission pool', 'public specified-interface condition differs from default route',
                         'repository global format/full CI remain non-green from recorded baseline failures', 'Work UI and original Darwin/default-route failure are not proved repaired']}
    with (HERE / 'final-operational-audit.json').open('x', encoding='utf-8') as stream:
        json.dump(result, stream, indent=2)
        stream.write('\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
