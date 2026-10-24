import unittest
from unittest.mock import Mock

from profile_service import capture


class CaptureLifecycleTests(unittest.TestCase):
    def test_request_failure_still_stops_the_owned_capture(self):
        tool = Mock(return_value=0)
        with self.assertRaisesRegex(ValueError, 'request failure'):
            with capture(tool):
                raise ValueError('request failure')
        self.assertEqual([call.args[0] for call in tool.call_args_list], ['start', 'stop'])

    def test_partial_start_failure_still_attempts_stop_and_refuses_request(self):
        tool = Mock(side_effect=[1, 0])
        entered = False
        with self.assertRaisesRegex(RuntimeError, 'could not start'):
            with capture(tool):
                entered = True
        self.assertFalse(entered)
        self.assertEqual([call.args[0] for call in tool.call_args_list], ['start', 'stop'])


if __name__ == '__main__':
    unittest.main()
