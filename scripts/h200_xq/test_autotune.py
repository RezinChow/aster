import unittest
from unittest.mock import patch

import autotune


class WinnerQualificationTests(unittest.TestCase):
    def test_separate_single_and_aggregate_winners_both_require_long_context(self):
        aggregate = {'case': ('replica8x1', 'kv4', 131072, 4),
                     'warm_median_output_tokens_per_second': 1200,
                     'warm_median_single_api_tokens_per_second': 80}
        single = {'case': ('replica4x2', 'kv4', 131072, 1),
                  'warm_median_output_tokens_per_second': 600,
                  'warm_median_single_api_tokens_per_second': 150}
        results = [aggregate, single]
        with patch.object(autotune, 'activate') as activate, \
                patch.object(autotune, 'qualify_long_context', return_value={'passed': True}) as check, \
                patch.object(autotune.subprocess, 'run') as benchmark:
            self.assertIs(autotune.select_qualified_candidate(
                results, 'warm_median_output_tokens_per_second'), aggregate)
            self.assertIs(autotune.select_qualified_candidate(
                results, 'warm_median_single_api_tokens_per_second'), single)
            self.assertEqual(activate.call_count, 2)
            self.assertEqual(check.call_count, 2)
            self.assertEqual(benchmark.call_count, 2)
            for record in results:
                self.assertTrue(record['long_context_qualification']['passed'])
                self.assertIn('long_context_benchmark', record)

    def test_failed_long_context_winner_cannot_reappear_under_another_metric(self):
        invalid = {'case': ('replica8x1', 'kv4', 32768, 4),
                   'warm_median_output_tokens_per_second': 1400,
                   'warm_median_single_api_tokens_per_second': 200}
        valid = {'case': ('replica4x2', 'exact', 131072, 1),
                 'warm_median_output_tokens_per_second': 700,
                 'warm_median_single_api_tokens_per_second': 120}
        results = [invalid, valid, {'case': ('split8', 'exact', 131072, 1), 'failed': 'not measured'}]
        with patch.object(autotune, 'activate') as activate, \
                patch.object(autotune, 'qualify_long_context', side_effect=[{'passed': False}, {'passed': True}]) as check, \
                patch.object(autotune.subprocess, 'run') as benchmark:
            for metric in ('warm_median_output_tokens_per_second', 'warm_median_single_api_tokens_per_second'):
                self.assertIs(autotune.select_qualified_candidate(results, metric), valid)
            self.assertEqual(activate.call_count, 2)
            self.assertEqual(check.call_count, 2)
            self.assertEqual(benchmark.call_count, 1)
            self.assertIn('long_context_failure', invalid)
            self.assertNotIn('long_context_benchmark', invalid)

    def test_passing_copy_check_without_a_successful_benchmark_is_not_qualified(self):
        candidate = {'case': ('split8', 'exact', 131072, 1),
                     'warm_median_single_api_tokens_per_second': 100}
        with patch.object(autotune, 'activate'), \
                patch.object(autotune, 'qualify_long_context', return_value={'passed': True}) as check, \
                patch.object(autotune.subprocess, 'run', side_effect=RuntimeError('stream ended early')) as benchmark:
            self.assertIsNone(autotune.select_qualified_candidate(
                [candidate], 'warm_median_single_api_tokens_per_second'))
            self.assertIsNone(autotune.select_qualified_candidate(
                [candidate], 'warm_median_single_api_tokens_per_second'))
            self.assertTrue(candidate['long_context_qualification']['passed'])
            self.assertNotIn('long_context_benchmark', candidate)
            self.assertIn('stream ended early', candidate['long_context_failure'])
            check.assert_called_once()
            benchmark.assert_called_once()


if __name__ == '__main__':
    unittest.main()
