import json
import unittest

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


if __name__ == '__main__':
    unittest.main()
