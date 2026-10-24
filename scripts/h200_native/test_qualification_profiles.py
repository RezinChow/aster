import unittest

from qualify_peer_pipeline import EXPECTED_TESTS, PEER_TEST, PAIR_TEST, qualification_profile


class QualificationProfileTests(unittest.TestCase):
    def test_legacy_inventory_stays_fixed_and_new_profile_adds_real_gpu_cases(self):
        old, old_controls = qualification_profile('xq-control-v17')
        new, new_controls = qualification_profile('xq-fused-sinkhorn-validation-v24')
        self.assertEqual((len(old), old_controls), (13, 431))
        self.assertEqual((len(new), new_controls), (15, 444))
        self.assertTrue(old < new)
        self.assertTrue({PEER_TEST, PAIR_TEST} <= new)
        timed, timed_controls = qualification_profile('xq-private-clock-fused-v27')
        control, control_count = qualification_profile('xq-private-clock-control-v28')
        self.assertEqual((timed, timed_controls), (new, 447))
        self.assertEqual((control, control_count), (new, 447))
        for name in ['xq-validation-cache-v29', 'xq-validation-cache-control-v30']:
            cached, controls = qualification_profile(name)
            self.assertEqual((len(cached), controls), (16, 451))
            self.assertTrue(new < cached)
        for name in ['xq-activation-codecs-v31', 'xq-activation-codecs-control-v32',
                     'xq-activation-codecs-v33', 'xq-activation-codecs-control-v34']:
            codecs, controls = qualification_profile(name)
            self.assertEqual((len(codecs), controls), (17, 452))
            self.assertTrue(cached < codecs)
        for name in ['xq-readonly-inputs-v35', 'xq-readonly-inputs-control-v36']:
            inputs, controls = qualification_profile(name)
            self.assertEqual((inputs, controls), (codecs, 454))
        old.clear()
        self.assertEqual(len(EXPECTED_TESTS), 13)
        for unknown in ['', 'cuda', 'latest', 'xq-fused-validation']:
            with self.assertRaises(RuntimeError):
                qualification_profile(unknown)


if __name__ == '__main__':
    unittest.main()
