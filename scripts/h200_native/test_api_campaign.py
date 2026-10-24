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
    def test_native_clock_requires_real_model_step_intervals_and_explicit_eos_policy(self):
        usage = dict(prompt_tokens=16, completion_tokens=3, total_tokens=19)
        native = dict(clock='monotonic-nanoseconds',
                      decoding_algorithm='greedy-one-selected-id-per-model-step',
                      origin='greedy-loop-after-request-state-allocation',
                      choice_boundary='complete-model-step-and-cache-commit-before-id-callback',
                      includes_prior_callback_backpressure=True, decode_intervals=2,
                      terminal_eos_included=False, replica_index=0, stats_ordinal_scope='replica-local',
                      stats=dict(modelSteps=4, executedLayersByOrdinal=[80,80,0,0,0,0,0,0]),
                      timings=dict(firstTokenNs=1000,lastTokenNs=3000,finishedNs=4000))
        result = campaign.native_measurement(native, usage)
        self.assertEqual(result['decode_tokens_per_second'], 1_000_000)
        self.assertFalse(result['single_request_1000_qualification_claimed'])
        counted = native | dict(finite_validation_policy='step-local-immutable-tensor-cache-v1',
                                stats=native['stats'] | dict(finiteValidationChecks=4, finiteValidationCacheHits=8))
        self.assertEqual(campaign.native_measurement(counted, usage)['finite_validation'],
                         dict(policy='step-local-immutable-tensor-cache-v1', actual_checks=4, cache_hits=8))
        for policy in ['force-copy-v1', 'borrow-contiguous-copy-strided-v1']:
            self.assertEqual(campaign.native_measurement(native | dict(readonly_kernel_input_policy=policy), usage)['readonly_kernel_input_policy'], policy)
        for policy in ['automatic', '', None, True]:
            with self.assertRaises(ValueError):
                campaign.native_measurement(native | dict(readonly_kernel_input_policy=policy), usage)
        for change in [dict(finite_validation_policy='unknown'),
                       dict(finite_validation_policy='immediate-per-call'),
                       dict(stats=counted['stats'] | dict(finiteValidationChecks=0)),
                       dict(stats=counted['stats'] | dict(finiteValidationCacheHits=True))]:
            with self.assertRaises(ValueError):
                campaign.native_measurement(counted | change, usage)
        stream = (event({'choices':[{'index':0,'delta':{'content':'1,2'}}]})
                  + event({'choices':[{'index':0,'delta':{},'finish_reason':'length'}]})
                  + event({'usage':usage,'prism_upstream':{
                      'source':'power-native-token-ids','timings':{'native_generation':native}}})
                  + b'data: [DONE]\n\n')
        parsed = campaign.parse_sse(io.BytesIO(stream), lambda:None, 0, 8, lambda:1)
        self.assertEqual(parsed['native_generation_measurement']['replica_index'], 0)
        eos = campaign.native_measurement(native | dict(terminal_eos_included=True), usage)
        self.assertIsNone(eos['decode_tokens_per_second'])
        for change in [dict(decode_intervals=3), dict(terminal_eos_included=1),
                       dict(timings=dict(firstTokenNs=100,lastTokenNs=99,finishedNs=200)),
                       dict(timings=dict(firstTokenNs=100,lastTokenNs=100,finishedNs=200)),
                       dict(stats=dict(modelSteps=1,executedLayersByOrdinal=[40,0,0,0,0,0,0,0])),
                       dict(origin='first-sse-fragment'), dict(decoding_algorithm='speculative-burst')]:
            with self.assertRaises(ValueError):
                campaign.native_measurement(native | change, usage)

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
        single = plan | dict(schema='aster-native-api-campaign-plan-v2',
                             measurement_profile='single-request-v1', require_native_timings=True,
                             concurrency=[1])
        campaign.validate_plan(single)
        warmed = single | dict(schema='aster-native-api-campaign-plan-v3',
                              measurement_profile='single-request-warmed-replicas-v1', warmup_requests=4)
        campaign.validate_plan(warmed)
        for change in [dict(warmup_requests=True), dict(warmup_requests=100), dict(require_native_timings=False)]:
            with self.assertRaises(ValueError):
                campaign.validate_plan(warmed | change)
        for change in [dict(concurrency=[1,4,8]), dict(require_native_timings=1),
                       dict(measurement_profile='aggregate'), dict(measurement_profile=None)]:
            with self.assertRaises(ValueError):
                campaign.validate_plan(single | change)
        for change in [dict(concurrency=[128]), dict(repeats=1000), dict(campaign_seconds=True),
                       dict(base_url='http://example.com:30003/v1'), dict(extra=1),
                       dict(credential_expires_unix=3000), dict(max_tokens=33)]:
            with self.assertRaises(ValueError):
                campaign.validate_plan(plan | change)

    def test_warmup_records_failures_and_requires_all_four_owners_without_retry(self):
        def run(values):
            records = iter(values)
            journal = io.StringIO()
            def request(*args):
                return next(records)
            return journal, lambda: campaign.warm_replicas(dict(warmup_requests=4), 'private', 100, journal, request)
        good = [dict(passed=True, native_generation_measurement=dict(replica_index=n)) for n in range(4)]
        journal, warm = run(good)
        self.assertEqual(warm(), [0, 1, 2, 3])
        self.assertEqual(len(journal.getvalue().splitlines()), 4)
        journal, warm = run([good[0], dict(passed=False, error_type='TimeoutError')])
        with self.assertRaises(ValueError): warm()
        self.assertEqual(len(journal.getvalue().splitlines()), 2)
        self.assertNotIn('private', journal.getvalue())
        journal, warm = run([good[0]] * 4)
        with self.assertRaises(ValueError): warm()
        self.assertEqual(len(journal.getvalue().splitlines()), 4)


if __name__ == '__main__':
    unittest.main()
