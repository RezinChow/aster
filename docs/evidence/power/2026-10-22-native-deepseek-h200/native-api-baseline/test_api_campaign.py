"""Hermetic transport/measurement checks; no model or external service."""
import hashlib
from http.server import BaseHTTPRequestHandler, HTTPServer
import io
import json
import threading
import time
import unittest
from unittest.mock import patch

import api_campaign as campaign


def event(value):
    return b'data: ' + json.dumps(value).encode() + b'\n\n'


STREAM = (event({'choices': [{'index': 0, 'delta': {'content': '1,2'}}]})
          + event({'choices': [{'index': 0, 'delta': {}, 'finish_reason': 'length'}]})
          + event({'usage': {'prompt_tokens': 16, 'completion_tokens': 3, 'total_tokens': 19}})
          + b'data: [DONE]\n\n')


class CampaignTests(unittest.TestCase):
    def test_usage_requires_exact_non_boolean_counts_and_terminal_stream(self):
        parsed = campaign.parse_sse(io.BytesIO(STREAM), lambda: None, 1, 8, lambda: 2)
        self.assertEqual(parsed['usage']['completion_tokens'], 3)
        self.assertEqual(parsed['text'], '1,2')
        for invalid in [dict(prompt_tokens=True, completion_tokens=2, total_tokens=3),
                        dict(prompt_tokens=16, completion_tokens=100, total_tokens=116),
                        dict(prompt_tokens=16, completion_tokens=2, total_tokens=100),
                        dict(prompt_tokens=16., completion_tokens=2, total_tokens=18)]:
            with self.assertRaises(ValueError):
                campaign.exact_usage(invalid, 8)
        for invalid in [STREAM.replace(b'data: [DONE]', b''), b'data: [DONE]\n',
                        b'data: ' + b'x' * 65537]:
            with self.assertRaises(ValueError):
                campaign.parse_sse(io.BytesIO(invalid), lambda: None, 1, 8, lambda: 2)

    def test_real_socket_stream_close_and_http_failure_are_bounded_and_key_free(self):
        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                self.rfile.read(int(self.headers['Content-Length']))
                status = 200 if self.headers['Authorization'] == 'Bearer owned-test' else 429
                self.send_response(status)
                self.send_header('Content-Type', 'text/event-stream')
                self.send_header('Connection', 'close')
                self.end_headers()
                if status == 200:
                    self.wfile.write(STREAM)

            def log_message(self, *_):
                pass

        server = HTTPServer(('127.0.0.1', 0), Handler)
        worker = threading.Thread(target=server.serve_forever)
        worker.start()
        try:
            plan = dict(base_url=f'http://127.0.0.1:{server.server_port}/v1', model=campaign.ALIAS,
                        max_tokens=8, request_seconds=2)
            good = campaign.request(plan, 'owned-test', 'one', time.monotonic() + 5)
            denied = campaign.request(plan, 'never-print-this', 'two', time.monotonic() + 5)
            self.assertTrue(good['passed'])
            self.assertFalse(denied['passed'])
            self.assertEqual(denied['status'], 429)
            self.assertNotIn('never-print-this', json.dumps(denied))
        finally:
            server.shutdown()
            worker.join(timeout=2)
            server.server_close()

    def test_failure_accounting_deadline_and_nearest_rank_percentiles(self):
        plan = dict(base_url='http://127.0.0.1:1/v1', model=campaign.ALIAS, max_tokens=8, request_seconds=1)
        expired = campaign.request(plan, 'private-test', 'expired', 0)
        self.assertEqual(expired['error_type'], 'TimeoutError')
        summary = campaign.summarize([expired], 2)
        self.assertEqual(summary['failed'], 1)
        self.assertEqual(summary['actual_completion_tokens'], 0)
        self.assertIsNone(summary['ttft_p95'])
        self.assertEqual(campaign.percentile([4, 1, 2, 3], .95), 4)
        self.assertFalse(summary['token_itl_claimed'])

    def test_frozen_plan_refuses_unknown_endpoints_and_unbounded_load(self):
        plan = dict(schema='aster-native-api-campaign-plan-v1', base_url='http://10.1.2.3:30003/v1',
                    model=campaign.ALIAS, server_binary_sha256='a' * 64, concurrency=[1, 4, 8],
                    repeats=3, max_tokens=16, campaign_seconds=900, request_seconds=180,
                    credential_expires_unix=2000, resource_lease_ends_unix=2060,
                    prompt_sha256=hashlib.sha256(campaign.PROMPT.encode()).hexdigest())
        campaign.validate_plan(plan)
        for change in [dict(concurrency=[128]), dict(repeats=1000), dict(campaign_seconds=True),
                       dict(base_url='http://example.com:30003/v1'), dict(extra=1),
                       dict(credential_expires_unix=3000), dict(max_tokens=33)]:
            with self.assertRaises(ValueError):
                campaign.validate_plan(plan | change)


if __name__ == '__main__':
    unittest.main()
