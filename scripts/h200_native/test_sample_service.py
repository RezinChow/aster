import unittest

from sample_service import parse_gpus


class TelemetryTests(unittest.TestCase):
    def test_exact_eight_uuid_order_and_mib_percent_bounds(self):
        identities = ['GPU-' + str(i) for i in range(8)]
        text = '\n'.join(f'{identity}, 80000, 143771, 45' for identity in identities)
        parsed = parse_gpus(text, identities)
        self.assertEqual(parsed[0]['used_mib'], 80000)
        for invalid in [text.replace('143771', '10'), text.replace(', 45', ', 101'),
                        text.replace('GPU-7', 'GPU-0'), '\n'.join(reversed(text.splitlines()))]:
            with self.assertRaises(ValueError):
                parse_gpus(invalid, identities)


if __name__ == '__main__':
    unittest.main()
