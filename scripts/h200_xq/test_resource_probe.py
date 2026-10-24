import unittest
from contextlib import redirect_stderr
from io import StringIO
from resource_probe import parse_arguments, parse_gpus


class AllocationInventoryTests(unittest.TestCase):
    def test_optimization_session_lease_is_closed_and_parsed_before_any_allocation_work(self):
        common = ['--expected-gpus', '8', '--worker-sha256', 'a' * 64]
        args = parse_arguments(common + ['--lease-seconds', '21600'])
        self.assertEqual(args.lease_seconds, 6 * 3600)
        for invalid in ['-1', '1', '21601', '86400', 'true']:
            with redirect_stderr(StringIO()), self.assertRaises(SystemExit) as error:
                parse_arguments(common + ['--lease-seconds', invalid])
            self.assertEqual(error.exception.code, 2)

    def inventory(self, count):
        return '\n'.join(f'{i}, NVIDIA H200, GPU-00000000-0000-0000-0000-{i+1:012d}, 143771, 0, 580.1' for i in range(count))

    def test_eight_distinct_full_devices_are_required_for_eight_card_proof(self):
        self.assertEqual(len(parse_gpus(self.inventory(8), 8)), 8)
        with self.assertRaisesRegex(RuntimeError, 'GPU count'):
            parse_gpus(self.inventory(1), 8)
        repeated='\n'.join([self.inventory(1)]*8)
        with self.assertRaisesRegex(RuntimeError, 'repeats'):
            parse_gpus(repeated,8)

    def test_wrong_model_partial_hbm_invalid_uuid_and_wrong_schema_refuse(self):
        valid=self.inventory(1)
        for changed in [valid.replace('H200','H100'), valid.replace('143771','81920'),
                        valid.replace('143771, 0','143771, 20000'),valid.replace('GPU-','MIG-'),
                        valid+', unexpected']:
            with self.assertRaises(RuntimeError):
                parse_gpus(changed,1)


if __name__=='__main__':
    unittest.main()
