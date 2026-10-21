"""Hermetic publication and integrity checks for the remote artifact fetcher."""

import hashlib
import concurrent.futures
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import prepare_assets


class CDNDownloadTests(unittest.TestCase):
    origin = 'https://huggingface.co/example/model/resolve/pin/part'
    first = 'https://us.aws.cdn.hf.co/object?Signature=synthetic-first'
    second = 'https://us.aws.cdn.hf.co/object?Signature=synthetic-second'
    proxy = 'socks5h://localhost:1'

    def metadata(self, command, location=None, **_kwargs):
        return subprocess.CompletedProcess(command, 0, stdout=(
            f'HTTP/1.1 302 Found\r\nLocation: {location or self.first}\r\n\r\n\n302'))

    def test_resolver_only_sends_head_to_hub(self):
        with patch.object(prepare_assets.subprocess, 'run', side_effect=self.metadata) as run:
            self.assertEqual(prepare_assets.resolve_download_url(self.origin, self.proxy), self.first)
        command = run.call_args.args[0]
        self.assertIn('--head', command)
        self.assertNotIn('--location', command)
        self.assertNotIn(self.first, command)

    def test_cdn_redirect_rejects_untrusted_or_unsafe_locations(self):
        for location in ('http://us.aws.cdn.hf.co/object', 'https://hf.co.example.invalid/object',
                         'https://private@us.aws.cdn.hf.co/object', 'https://us.aws.cdn.hf.co:444/object',
                         'https://us.aws.cdn.hf.co/"injection', 'https://us.aws.cdn.hf.co/\\injection'):
            with self.subTest(location=location), patch.object(prepare_assets.subprocess, 'run',
                    side_effect=lambda command, **kwargs: self.metadata(command, location)):
                with self.assertRaisesRegex(ValueError, 'allowed HTTPS CDN'):
                    prepare_assets.resolve_download_url(self.origin, self.proxy)

    def test_cdn_redirect_is_shared_across_concurrent_ranges(self):
        cache = prepare_assets.ResolvedDownloadURL(self.origin)
        with patch.object(prepare_assets, 'resolve_download_url', return_value=self.first) as resolve:
            with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
                results = list(pool.map(cache.get, [self.proxy]*32))
        self.assertEqual(results, [self.first]*32)
        self.assertEqual(resolve.call_count, 1)

    def test_refresh_ignores_late_old_failures_and_also_expires(self):
        cache = prepare_assets.ResolvedDownloadURL(self.origin)
        clock = [0]
        with patch.object(prepare_assets, 'resolve_download_url',
                          side_effect=[self.first, self.second, self.first]) as resolve, \
                patch.object(prepare_assets.time, 'monotonic', side_effect=lambda: clock[0]):
            self.assertEqual(cache.get(self.proxy), self.first)
            cache.invalidate(self.first)
            self.assertEqual(cache.get(self.proxy), self.second)
            cache.invalidate(self.first)
            self.assertEqual(cache.get(self.proxy), self.second)
            self.assertEqual(resolve.call_count, 2)
            clock[0] = 901
            self.assertEqual(cache.get(self.proxy), self.first)
            self.assertEqual(resolve.call_count, 3)

    def test_direct_cdn_refreshes_403_and_keeps_signed_url_out_of_arguments(self):
        heads, ranges = [], []

        def run(command, **kwargs):
            if '--head' in command:
                heads.append(command)
                return self.metadata(command, self.first if len(heads) == 1 else self.second)
            ranges.append((command, kwargs['input']))
            Path(command[command.index('--output')+1]).write_bytes(b'bad' if len(ranges) == 1 else b'data')
            return subprocess.CompletedProcess(command, 22 if len(ranges) == 1 else 0,
                                               stdout='403' if len(ranges) == 1 else '206')

        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory)/'model.part'
            with patch.object(prepare_assets.subprocess, 'run', side_effect=run), \
                    patch.object(prepare_assets.time, 'sleep'):
                prepare_assets.fetch_large(self.origin, destination, self.proxy,
                    hashlib.sha256(b'data').hexdigest(), 4, direct_cdn=True)
            self.assertEqual(destination.read_bytes(), b'data')
        self.assertEqual(len(heads), 2)
        self.assertEqual(len(ranges), 2)
        for (command, config), url in zip(ranges, (self.first, self.second)):
            self.assertNotIn('Signature=', ' '.join(command))
            self.assertNotIn('--location', command)
            self.assertEqual(config, f'url = "{url}"\n')

    def test_direct_cdn_metadata_failure_retries_without_publishing(self):
        attempts = []

        def run(command, **kwargs):
            if '--head' in command:
                attempts.append(command)
                if len(attempts) == 1:
                    return subprocess.CompletedProcess(command, 28, stdout='\n000')
                return self.metadata(command)
            Path(command[command.index('--output')+1]).write_bytes(b'data')
            return subprocess.CompletedProcess(command, 0, stdout='206')

        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory)/'model.part'
            with patch.object(prepare_assets.subprocess, 'run', side_effect=run), \
                    patch.object(prepare_assets.time, 'sleep'):
                prepare_assets.fetch_large(self.origin, destination, self.proxy,
                    hashlib.sha256(b'data').hexdigest(), 4, direct_cdn=True)
            self.assertEqual(destination.read_bytes(), b'data')
            self.assertEqual(len(attempts), 2)


class NetworkRecoveryTests(unittest.TestCase):
    origin = CDNDownloadTests.origin
    first = CDNDownloadTests.first
    proxy = CDNDownloadTests.proxy
    metadata = CDNDownloadTests.metadata

    def test_network_retry_survives_more_than_twenty_temporary_range_failures(self):
        for returncode, status in ((7, '000'), (97, '000'), (22, '503')):
            with self.subTest(returncode=returncode), tempfile.TemporaryDirectory() as directory:
                destination = Path(directory)/'model.part'
                attempts = []

                def run(command, **_kwargs):
                    attempts.append(command)
                    if len(attempts) <= 21:
                        return subprocess.CompletedProcess(command, returncode, stdout=status)
                    Path(command[command.index('--output')+1]).write_bytes(b'data')
                    return subprocess.CompletedProcess(command, 0, stdout='206')

                with patch.object(prepare_assets.subprocess, 'run', side_effect=run), \
                        patch.object(prepare_assets.time, 'sleep') as sleep:
                    prepare_assets.fetch_large(self.origin, destination, self.proxy,
                        hashlib.sha256(b'data').hexdigest(), 4, retry_network=True)
                self.assertEqual(destination.read_bytes(), b'data')
                self.assertEqual(len(attempts), 22)
                self.assertLessEqual(max(call.args[0] for call in sleep.call_args_list), 30)

    def test_default_range_retry_limit_remains_twenty(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory)/'model.part'
            with patch.object(prepare_assets.subprocess, 'run',
                    return_value=subprocess.CompletedProcess([], 7, stdout='000')) as run, \
                    patch.object(prepare_assets.time, 'sleep'):
                with self.assertRaisesRegex(RuntimeError, 'repeatedly failed'):
                    prepare_assets.fetch_large(self.origin, destination, self.proxy, '0'*64, 4)
            self.assertEqual(run.call_count, 20)
            self.assertFalse(destination.exists())

    def test_network_retry_refuses_certificate_io_and_permanent_http_errors(self):
        for returncode, status in ((60, '000'), (23, '206'), (22, '404'), (67, '000')):
            with self.subTest(returncode=returncode), tempfile.TemporaryDirectory() as directory:
                destination = Path(directory)/'model.part'
                with patch.object(prepare_assets.subprocess, 'run',
                        return_value=subprocess.CompletedProcess([], returncode, stdout=status)) as run:
                    with self.assertRaisesRegex(RuntimeError, 'non-retryable'):
                        prepare_assets.fetch_large(self.origin, destination, self.proxy,
                            '0'*64, 4, retry_network=True)
                self.assertEqual(run.call_count, 1)
                self.assertFalse(destination.exists())

    def test_network_retry_recovers_after_more_than_twenty_metadata_timeouts(self):
        attempts = []

        def run(command, **kwargs):
            if '--head' in command:
                attempts.append(command)
                if len(attempts) <= 21:
                    return subprocess.CompletedProcess(command, 28, stdout='\n000')
                return self.metadata(command)
            Path(command[command.index('--output')+1]).write_bytes(b'data')
            return subprocess.CompletedProcess(command, 0, stdout='206')

        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory)/'model.part'
            with patch.object(prepare_assets.subprocess, 'run', side_effect=run), \
                    patch.object(prepare_assets.time, 'sleep'):
                prepare_assets.fetch_large(self.origin, destination, self.proxy,
                    hashlib.sha256(b'data').hexdigest(), 4, direct_cdn=True, retry_network=True)
            self.assertEqual(destination.read_bytes(), b'data')
            self.assertEqual(len(attempts), 22)

    def test_permanent_or_malformed_metadata_is_refused(self):
        for returncode, output in ((60, '\n000'), (22, '\n404'), (0, ''), (0, 'HTTP/1.1 302 Found\n\n302')):
            with self.subTest(returncode=returncode, output=output), \
                    patch.object(prepare_assets.subprocess, 'run',
                        return_value=subprocess.CompletedProcess([], returncode, stdout=output)):
                with self.assertRaises(ValueError):
                    prepare_assets.resolve_download_url(self.origin, self.proxy)

    def test_permanent_failure_cancels_a_sibling_range_retry(self):
        def run(command, **_kwargs):
            requested = command[command.index('--range')+1]
            return subprocess.CompletedProcess(command, 7 if requested.startswith('0-') else 22,
                                               stdout='000' if requested.startswith('0-') else '404')

        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory)/'model.part'
            with patch.object(prepare_assets.subprocess, 'run', side_effect=run), \
                    patch.object(prepare_assets.time, 'sleep'):
                with self.assertRaisesRegex(RuntimeError, 'non-retryable range response'):
                    prepare_assets.fetch_large(self.origin, destination, self.proxy,
                        '0'*64, 32*1024**2+4, retry_network=True)
            self.assertFalse(destination.exists())


class RangeIntegrityTests(unittest.TestCase):
    def test_all_cached_model_assets_resume_when_manifest_lists_only_weight_parts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            v3 = root/'assets/v3'; v3.mkdir(parents=True)
            payload = b'data'; checksum = hashlib.sha256(payload).hexdigest()
            names = [f'V41-XQ-1017-v3.gguf.part-{index:02d}-of-16' for index in range(1, 17)]
            manifest = v3/'SHA256SUMS'
            manifest.write_text(''.join(f'{checksum}  {name}\n' for name in names))
            for name in names:
                (v3/name).write_bytes(payload)
            tree = root/'assets/v3-tree.json'
            tree.write_text(json.dumps([{'type': 'file', 'path': f'v3/{name}', 'size': 4} for name in names]))
            auxiliary = {name: checksum for name in prepare_assets.MODEL_AUXILIARY_SHA256}
            tokenizer = {name: checksum for name in prepare_assets.TOKENIZER_SHA256}
            for name in auxiliary:
                (v3/name).write_bytes(payload)
            (root/'assets/tokenizer').mkdir()
            for name in tokenizer:
                (root/'assets/tokenizer'/name).write_bytes(payload)
            with patch.object(prepare_assets, 'MODEL_MANIFEST_SHA256', prepare_assets.digest(manifest)), \
                    patch.object(prepare_assets, 'MODEL_TREE_SHA256', prepare_assets.digest(tree)), \
                    patch.object(prepare_assets, 'MODEL_AUXILIARY_SHA256', auxiliary), \
                    patch.object(prepare_assets, 'TOKENIZER_SHA256', tokenizer), \
                    patch.object(prepare_assets.subprocess, 'run', side_effect=AssertionError('unexpected network request')) as network:
                prepare_assets.prepare_model(root, 'socks5h://localhost:1', 2, [])
                network.assert_not_called()

    def test_valid_pinned_metadata_can_resume_without_a_network_request(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory)/'SHA256SUMS'
            destination.write_bytes(b'pinned metadata')
            with patch.object(prepare_assets.subprocess, 'run') as network:
                prepare_assets.fetch('https://example.invalid/manifest', destination,
                                     'socks5h://localhost:1', hashlib.sha256(b'pinned metadata').hexdigest())
                network.assert_not_called()

    def fake_curl(self, payload, status="206"):
        def run(command, **_kwargs):
            Path(command[command.index("--output") + 1]).write_bytes(payload)
            return subprocess.CompletedProcess(command, 0, stdout=status)
        return run

    def test_verified_ranges_publish_the_expected_artifact(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "model.part"
            expected = hashlib.sha256(b"data").hexdigest()
            with patch.object(prepare_assets.subprocess, "run", self.fake_curl(b"data")):
                prepare_assets.fetch_large("https://example.invalid/model", destination, "socks5h://localhost:1", expected, 4)
            self.assertEqual(destination.read_bytes(), b"data")
            self.assertFalse(destination.with_name("model.part.ranges.json").exists())

    def test_a_checksum_failure_never_publishes_the_artifact(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "model.part"
            with patch.object(prepare_assets.subprocess, "run", self.fake_curl(b"bad!")):
                with self.assertRaisesRegex(RuntimeError, "checksum mismatch"):
                    prepare_assets.fetch_large("https://example.invalid/model", destination, "socks5h://localhost:1", "0" * 64, 4)
            self.assertFalse(destination.exists())

    def test_a_server_ignoring_ranges_never_publishes_the_artifact(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "model.part"
            with patch.object(prepare_assets.subprocess, "run", self.fake_curl(b"data", "200")):
                with self.assertRaisesRegex(RuntimeError, "invalid range response"):
                    prepare_assets.fetch_large("https://example.invalid/model", destination, "socks5h://localhost:1", "0" * 64, 4)
            self.assertFalse(destination.exists())

    def test_timeout_progress_resumes_at_the_exact_next_byte(self):
        calls = []

        def interrupted_curl(command, **_kwargs):
            requested = command[command.index("--range") + 1]
            calls.append(requested)
            payload = {"0-5": b"abcd", "4-5": b"ef"}[requested]
            Path(command[command.index("--output") + 1]).write_bytes(payload)
            return subprocess.CompletedProcess(command, 28 if requested == "0-5" else 0, stdout="206")

        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "model.part"
            with patch.object(prepare_assets.subprocess, "run", interrupted_curl):
                prepare_assets.fetch_large("https://example.invalid/model", destination, "socks5h://localhost:1",
                                           hashlib.sha256(b"abcdef").hexdigest(), 6)
            self.assertEqual(calls, ["0-5", "4-5"])
            self.assertEqual(destination.read_bytes(), b"abcdef")


if __name__ == "__main__":
    unittest.main()
