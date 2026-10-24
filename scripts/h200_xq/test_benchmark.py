import json
import unittest
import tempfile
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import benchmark

from benchmark import collect_stream


def event(value):
    return ('data: '+json.dumps(value)+'\n\n').encode()


class BenchmarkAccountingTests(unittest.TestCase):
    def test_usage_is_the_token_count_and_multiple_tokens_may_share_one_chunk(self):
        lines = [event({'choices': [{'delta': {'reasoning_content': 'think first'}}]}),
                 event({'choices': [{'delta': {'content': 'several tokens at once'}}]}),
                 event({'choices': [{'delta': {}, 'finish_reason': 'length'}],
                        'usage': {'completion_tokens': 17, 'prompt_tokens': 8}}), b'data: [DONE]\n\n']
        result = collect_stream(lines, 10, clock=lambda: 12)
        self.assertEqual(result['usage']['completion_tokens'], 17)
        self.assertEqual(result['payload_chunks'], 2)
        self.assertGreater(result['reasoning_characters'], 0)

    def test_truncation_and_missing_exact_usage_are_not_successful_benchmarks(self):
        output = event({'choices': [{'delta': {'content': 'hello'}, 'finish_reason': 'stop'}]})
        for lines in ([output], [output, b'data: [DONE]\n\n']):
            with self.subTest(lines=lines), self.assertRaises(RuntimeError):
                collect_stream(lines, 0, clock=lambda: 1)

    def test_error_event_invalidates_the_measurement(self):
        with self.assertRaisesRegex(RuntimeError, 'returned an error'):
            collect_stream([event({'error': {'message': 'upstream failed'}})], 0)

    def test_invalid_usage_components_and_clocks_are_refused(self):
        def stream(usage):
            return [event({'choices': [{'delta': {'content': 'answer'}, 'finish_reason': 'stop'}],
                           'usage': usage}), b'data: [DONE]\n\n']
        for usage in ({'completion_tokens': True, 'prompt_tokens': 0},
                      {'completion_tokens': 1.0, 'prompt_tokens': 0},
                      {'completion_tokens': 1, 'prompt_tokens': -1},
                      {'completion_tokens': 1, 'prompt_tokens': True},
                      {'completion_tokens': 1, 'prompt_tokens': 0, 'total_tokens': True},
                      {'completion_tokens': 1, 'prompt_tokens': 2, 'total_tokens': 4}):
            with self.subTest(usage=usage), self.assertRaises(RuntimeError):
                collect_stream(stream(usage), 0, clock=lambda: 1)
        for clock in (0, -1, float('nan'), float('inf')):
            with self.subTest(clock=clock), self.assertRaises(RuntimeError):
                collect_stream(stream({'completion_tokens': 1, 'prompt_tokens': 2}), 0,
                               clock=lambda: clock)


class CampaignRetentionTests(unittest.TestCase):
    def environment(self, directory):
        root = Path(directory)
        (root/'run').mkdir()
        profile = root/'run/active-profile.json'
        profile.write_text(json.dumps({'exact_benchmark_usage': False, 'max_concurrent': 2}))
        key = root/'synthetic.key'
        key.write_text('synthetic-private-credential')
        args = SimpleNamespace(exact_benchmark_usage=True, url='http://127.0.0.1:30002',
                               key_file=key, output=root/'bench/result.json', concurrency=[2],
                               rounds=1, max_tokens=64, prompt_lines=0)

        @contextmanager
        def mode(state):
            profile.write_text(json.dumps({'exact_benchmark_usage': True, 'max_concurrent': 2}))
            state['enabled'] = True
            try:
                yield
            finally:
                profile.write_text(json.dumps({'exact_benchmark_usage': False, 'max_concurrent': 2}))
                state['normal_privacy_restored'] = True
        return root, profile, args, mode

    def result(self, index):
        return {'index': index, 'usage': {'completion_tokens': 17, 'prompt_tokens': 8},
                'ttft_s': 0.01, 'elapsed_s': 0.1}

    def test_rounded_normal_mode_cannot_start_a_speed_measurement(self):
        with patch.object(benchmark, 'synthetic_usage_mode') as mode:
            with self.assertRaisesRegex(RuntimeError, 'explicit exact-usage'):
                benchmark.run_campaign(SimpleNamespace(exact_benchmark_usage=False))
            mode.assert_not_called()

    def test_partial_failure_is_retained_and_normal_privacy_is_restored(self):
        with tempfile.TemporaryDirectory() as directory:
            root, profile, args, mode = self.environment(directory)
            def request(url, key, maximum, barrier, index, *remaining):
                barrier.wait(timeout=2)
                if index == 1:
                    raise TimeoutError('synthetic-private-credential must not enter the report')
                return self.result(index)
            with patch.object(benchmark, 'ROOT', root), patch.object(benchmark, 'synthetic_usage_mode', mode), \
                    patch.object(benchmark.time, 'monotonic', side_effect=[10., 12.]), \
                    patch.object(benchmark, 'request', side_effect=request):
                with self.assertRaisesRegex(RuntimeError, 'partial results'):
                    benchmark.run_campaign(args)
            report = json.loads(args.output.read_text())
            self.assertFalse(report['complete'])
            self.assertTrue(report['normal_privacy_restored'])
            self.assertEqual([r['outcome'] for r in report['rounds'][0]['requests']], ['success', 'failure'])
            self.assertIsNone(report['rounds'][0]['aggregate_output_tokens_per_second'])
            self.assertFalse(json.loads(profile.read_text())['exact_benchmark_usage'])
            self.assertNotIn('synthetic-private-credential', args.output.read_text())

    def test_success_requires_complete_exact_counts_and_restoration(self):
        with tempfile.TemporaryDirectory() as directory:
            root, profile, args, mode = self.environment(directory)
            def request(url, key, maximum, barrier, index, *remaining):
                barrier.wait(timeout=2)
                return self.result(index)
            with patch.object(benchmark, 'ROOT', root), patch.object(benchmark, 'synthetic_usage_mode', mode), \
                    patch.object(benchmark.time, 'monotonic', side_effect=[10., 12.]), \
                    patch.object(benchmark, 'request', side_effect=request):
                report = benchmark.run_campaign(args)
            self.assertTrue(report['complete'])
            self.assertTrue(report['normal_privacy_restored'])
            row = report['rounds'][0]
            self.assertEqual(row['completion_tokens'], 34)
            self.assertEqual(row['aggregate_output_tokens_per_second'], 34/row['wall_s'])
            self.assertFalse(json.loads(profile.read_text())['exact_benchmark_usage'])
            with patch.object(benchmark, 'synthetic_usage_mode') as enable:
                with self.assertRaisesRegex(RuntimeError, 'evidence already exists'):
                    benchmark.run_campaign(args)
                enable.assert_not_called()

    def test_invalid_batch_clock_keeps_completed_requests_without_a_rate(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _, args, mode = self.environment(directory)
            def request(url, key, maximum, barrier, index, *remaining):
                barrier.wait(timeout=2)
                return self.result(index)
            with patch.object(benchmark, 'ROOT', root), patch.object(benchmark, 'synthetic_usage_mode', mode), \
                    patch.object(benchmark.time, 'monotonic', side_effect=[10., 10.]), \
                    patch.object(benchmark, 'request', side_effect=request):
                with self.assertRaisesRegex(RuntimeError, 'finite and positive'):
                    benchmark.run_campaign(args)
            report = json.loads(args.output.read_text())
            self.assertFalse(report['complete'])
            self.assertTrue(report['normal_privacy_restored'])
            row = report['rounds'][0]
            self.assertEqual(len(row['requests']), 2)
            self.assertFalse(row['valid_clock'])
            self.assertIsNone(row['aggregate_output_tokens_per_second'])


if __name__ == '__main__':
    unittest.main()
