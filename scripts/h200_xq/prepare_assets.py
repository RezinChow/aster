#!/usr/bin/env python3
"""Prepare pinned upstream artifacts on the jump host; never runs inference locally."""

import argparse
import concurrent.futures
import hashlib
import json
import os
import subprocess
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

from download_auth import curl_environment, PROXY_PORTS

MODEL_REPOSITORY = "IndrasMirror/DeepSeek-V4.1-Flash-1017-XQ-Uncensored"
MODEL_REVISION = "9d3c01d86709261e51d566b02e1dda75f40d009a"
MODEL_MANIFEST_SHA256 = "0fb5396dd132bd987a587ed79d1988fb84f035bf14a7d59f06e377ca10059fc0"
MODEL_TREE_SHA256 = "2e069b379507b6800d6d46c8052f67e8c36fdee256efcfa22d3ec53c060f0117"
MODEL_AUXILIARY_SHA256 = {
    "rank-1017-v3.bin": "6b7771aabc739b636a83e7d8c0da086734c0d1328779f5942cac87239e68ec27",
    "V41-XQ-1017-v3.gguf.experts.json": "1668115fac6a61559ee02f172c2f64b35dcd3eca3f2fb6d6893589252e73fe99",
}
XOLOTL_REVISION = "b3452666e07a6374d06bb8c2185dffa271e8f65f"
LLAMA_REVISION = "3cf03257f219afbe7334045ff7c6a06ac68c627d"
XOLOTL_SHA256 = "faf35a4a783a6f95f8bafa39c4004d3b97dce93b4b36c5128c9663531005eadc"
SIDECAR_SHA256 = "5f92242e2ebed06e6831bbcae4e35e679c9138cdf6df0c8b36e8013c99c79a34"
SIDECAR_SIZE = 5661492320
TOKENIZER_SHA256 = {
    "vocab.json": "2f0bf5b31f4aa191d5d0d78291927a4f28c9ceb498a5e345b97e926c4cb99c1a",
    "merges.txt": "547bace837acea98652eef5669c9b01cee1c73ad1d2a44d6fdce9e6a81c22147",
    "token_type.json": "50bd0c477193145a1cd597623fe7d842e609e6b787ad49b7819cadca09a18ed6",
    "chat_template.jinja": "fd11177c081d8f1fe8f74302ce8d08e840bb5f07ba1cbfb93a2a1e8583c3ec5e",
}


class DownloadURLUnavailable(RuntimeError):
    pass


def transient_transfer(returncode, status):
    # curl's documented DNS, connection, timeout, partial-transfer and transport
    # failures, including SOCKS handshake interruption during SSH reconnect.
    # Certificate, local I/O, explicit login denial and unknown errors stop.
    # https://curl.se/docs/manpage.html#EXIT-CODES
    return (returncode in (5, 6, 7, 16, 18, 28, 35, 52, 55, 56, 92, 95, 96, 97)
            or (returncode in (0, 22)
                and (status in ('408', '429') or status in {str(n) for n in range(500, 600)})))


def retry_download(failures, persistent, description):
    if failures >= 20 and not persistent:
        raise RuntimeError(description)
    if persistent and (failures == 1 or failures % 20 == 0):
        print(json.dumps({'event': 'download_retry', 'failures': failures,
                          'reason': description}), flush=True)
    time.sleep(min(30, 3 * (1 + failures // 20)) if persistent else 3)


def resolve_download_url(original, proxy):
    """Read the Hub's redirect without sending HEAD to its GET-signed CDN URL."""
    source = urlsplit(original)
    if source.scheme != 'https' or source.hostname != 'huggingface.co':
        raise ValueError('download metadata must come from the HTTPS Hub origin')
    result = subprocess.run(
        ['curl', '--proxy', proxy, '--fail', '--silent', '--show-error',
         '--connect-timeout', '30', '--max-time', '60', '--head', '--dump-header', '-',
         '--output', os.devnull, '--write-out', '\n%{http_code}', original],
        check=False, capture_output=True, text=True, env=curl_environment(proxy),
    )
    status = result.stdout.rsplit('\n', 1)[-1].strip()
    if transient_transfer(result.returncode, status):
        raise DownloadURLUnavailable('temporary download metadata transport failure')
    if result.returncode or '\n' not in result.stdout or len(result.stdout) > 65536:
        raise ValueError('download metadata request failed or returned malformed headers')
    headers, status = result.stdout.rsplit('\n', 1)
    locations = [line.partition(':')[2].strip() for line in headers.splitlines()
                 if line.partition(':')[0].lower() == 'location']
    if status not in ('302', '303', '307', '308') or len(locations) != 1:
        raise ValueError('download metadata did not provide one redirect')
    location = locations[0]
    # The value stays in memory and curl stdin. Do not put signed query data in
    # process arguments, progress state, exception messages, or shared logs.
    try:
        target = urlsplit(location)
        allowed = (location.isascii() and len(location) <= 32768
                   and not any(ord(c) < 33 or c in ('"', '\\') for c in location)
                   and target.scheme == 'https' and target.port in (None, 443)
                   and target.username is None and target.password is None
                   and not target.fragment and target.hostname is not None
                   and (target.hostname == 'hf.co' or target.hostname.endswith('.hf.co')))
    except ValueError:
        allowed = False
    if not allowed:
        raise ValueError('download redirect is outside the allowed HTTPS CDN hosts')
    return location


class ResolvedDownloadURL:
    def __init__(self, original):
        self.original = original
        self.lock = threading.Lock()
        self.location = None
        self.refresh_after = 0

    def get(self, proxy):
        with self.lock:
            if self.location is None or time.monotonic() >= self.refresh_after:
                self.location = resolve_download_url(self.original, proxy)
                self.refresh_after = time.monotonic()+900
            return self.location

    def invalidate(self, observed):
        with self.lock:
            if self.location == observed:
                self.location = None


def digest(path):
    checksum = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            checksum.update(block)
    return checksum.hexdigest()


def fetch(url, destination, proxy, expected=None, git_sha1=None):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and expected and digest(destination) == expected:
        print(f"verified {destination.name}", flush=True)
        return
    if destination.exists() and git_sha1:
        data = destination.read_bytes()
        if hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest() == git_sha1:
            return
    partial = destination.with_name(destination.name + ".download")
    started = time.monotonic()
    subprocess.run(
        ["curl", "--proxy", proxy, "--location", "--fail", "--silent", "--show-error",
         "--connect-timeout", "30", "--retry", "20", "--retry-all-errors",
         "--retry-delay", "5", "--continue-at", "-", "--output", str(partial), url],
        check=True,
        env=curl_environment(proxy),
    )
    actual = digest(partial)
    if expected and actual != expected:
        raise RuntimeError(f"checksum mismatch for {destination.name}: {actual} != {expected}")
    if git_sha1:
        data = partial.read_bytes()
        if hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest() != git_sha1:
            raise RuntimeError(f"Git blob identity mismatch for {destination.name}")
    partial.replace(destination)
    print(json.dumps({"file": destination.name, "bytes": destination.stat().st_size,
                      "sha256": actual, "elapsed_s": round(time.monotonic()-started, 3)}), flush=True)


def prepare_model(root, proxy, workers, range_proxies, direct_cdn=False, retry_network=False):
    url = f"https://huggingface.co/{MODEL_REPOSITORY}/resolve/{MODEL_REVISION}"
    v3 = root / "assets" / "v3"
    fetch(f"{url}/v3/SHA256SUMS", v3 / "SHA256SUMS", proxy, MODEL_MANIFEST_SHA256)
    checksums = {}
    for line in (v3 / "SHA256SUMS").read_text().splitlines():
        checksum, name = line.split(maxsplit=1)
        name = name.lstrip("*")
        if len(checksum) != 64 or any(c not in "0123456789abcdef" for c in checksum):
            raise ValueError("invalid SHA256SUMS digest")
        if Path(name).name != name or name in checksums:
            raise ValueError("invalid or duplicate SHA256SUMS path")
        checksums[name] = checksum
    for name, expected in MODEL_AUXILIARY_SHA256.items():
        if name in checksums and checksums[name] != expected:
            raise ValueError("auxiliary checksum manifest entry contradicts the pinned artifact")
        fetch(f"{url}/v3/{name}", v3 / name, proxy, expected)
    for name, expected in TOKENIZER_SHA256.items():
        fetch(f"{url}/tokenizer/{name}", root / "assets" / "tokenizer" / name, proxy, expected)
    names = [f"V41-XQ-1017-v3.gguf.part-{i:02d}-of-16" for i in range(1, 17)]
    if any(name not in checksums for name in names):
        raise ValueError("pinned checksum manifest is missing a model part")
    metadata = root / "assets" / "v3-tree.json"
    fetch(f"https://huggingface.co/api/models/{MODEL_REPOSITORY}/tree/{MODEL_REVISION}/v3",
          metadata, proxy, MODEL_TREE_SHA256)
    sizes = {Path(item["path"]).name: item["size"] for item in json.loads(metadata.read_text())
             if item["type"] == "file"}
    cancelled = threading.Event()
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(fetch_large, f"{url}/v3/{name}", v3 / name, proxy,
                               checksums[name], sizes[name], range_proxies, direct_cdn,
                               retry_network, cancelled)
                   for name in names]
        try:
            for future in concurrent.futures.as_completed(futures):
                future.result()
        except BaseException:
            cancelled.set()
            for future in futures:
                future.cancel()
            raise
    print("MODEL_PARTS_VERIFIED", flush=True)


def fetch_large(url, destination, proxy, expected, size, range_proxies=None, direct_cdn=False,
                retry_network=False, cancelled=None):
    """Independent ranges avoid one long-haul connection limiting a 10 GiB part."""
    if not isinstance(size, int) or not 0 < size <= 16 * 1024**3:
        raise ValueError("invalid pinned model part size")
    if destination.exists() and destination.stat().st_size == size and digest(destination) == expected:
        print(f"verified {destination.name}", flush=True)
        return
    chunk_size = 32 * 1024**2
    count = (size + chunk_size - 1) // chunk_size
    partial = destination.with_name(destination.name + ".download")
    state_path = destination.with_name(destination.name + ".ranges.json")
    completed = set()
    if state_path.exists():
        state = json.loads(state_path.read_text())
        if state.get("sha256") != expected or state.get("size") != size or state.get("chunk_size") != chunk_size:
            raise ValueError("range resume identity does not match pinned artifact")
        completed = set(state["completed"])
        if not partial.exists() or partial.stat().st_size != size:
            raise ValueError("range resume file is absent or has the wrong size")
        if any(type(i) is not int or not 0 <= i < count for i in completed):
            raise ValueError("invalid completed range index")
    elif partial.exists():
        # A stopped sequential curl wrote a contiguous prefix before range mode.
        completed = set(range(min(partial.stat().st_size, size) // chunk_size))
    with partial.open("ab") as stream:
        stream.truncate(size)

    def save_state():
        temporary = state_path.with_suffix(".tmp")
        temporary.write_text(json.dumps({"sha256": expected, "size": size,
                                         "chunk_size": chunk_size, "completed": sorted(completed)}))
        temporary.replace(state_path)

    save_state()
    resolved_url = ResolvedDownloadURL(url) if direct_cdn else None
    cancelled = cancelled if cancelled is not None else threading.Event()

    def download_range(index):
        start = index * chunk_size
        end = min(size, start + chunk_size) - 1
        chunk = destination.with_name(destination.name + f".chunk-{index:04d}")
        range_proxy = (range_proxies or [proxy])[index % len(range_proxies or [proxy])]
        tail = chunk.with_name(chunk.name + ".tail")
        failures = 0
        while not chunk.exists() or chunk.stat().st_size < end-start+1:
            if cancelled.is_set():
                raise concurrent.futures.CancelledError('another range or part failed')
            have = chunk.stat().st_size if chunk.exists() else 0
            request_url = None
            if resolved_url is not None:
                try:
                    request_url = resolved_url.get(range_proxy)
                except DownloadURLUnavailable:
                    failures += 1
                    retry_download(failures, retry_network,
                                   f'download metadata repeatedly failed for {destination.name}')
                    continue
            target_arguments = ['--config', '-'] if request_url else ['--location', url]
            result = subprocess.run(
                ["curl", "--proxy", range_proxy, "--fail", "--silent", "--show-error",
                 "--connect-timeout", "30", "--max-time", "180", "--range", f"{start+have}-{end}",
                 "--max-filesize", str(end-start+1-have), "--output", str(tail), "--write-out", "%{http_code}",
                 *target_arguments],
                check=False, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                input=f'url = "{request_url}"\n' if request_url else None,
                env=curl_environment(range_proxy),
            )
            status = result.stdout.strip()
            if resolved_url is not None and status in ('401', '403'):
                resolved_url.invalidate(request_url)
            received = tail.stat().st_size if tail.exists() else 0
            if status == "200":
                raise RuntimeError(f"invalid range response for {destination.name} at {index}: server ignored Range")
            temporary = transient_transfer(result.returncode, status)
            if retry_network and result.returncode not in (0, 22) and not temporary:
                raise RuntimeError(f'non-retryable curl error {result.returncode} for {destination.name} at {index}')
            if status == "206" and 0 < received <= end-start+1-have:
                with chunk.open("ab") as output, tail.open("rb") as source:
                    for block in iter(lambda: source.read(8 * 1024**2), b""):
                        output.write(block)
                    output.flush()
                    os.fsync(output.fileno())
                failures = 0
            else:
                failures += 1
                if retry_network and not temporary and not (resolved_url is not None and status in ('401', '403')):
                    raise RuntimeError(f'non-retryable range response for {destination.name} at {index}, HTTP {status}')
                retry_download(failures, retry_network and temporary,
                               f'range transfer repeatedly failed for {destination.name} at {index}, HTTP {status}')
            if tail.exists():
                tail.unlink()
        if chunk.stat().st_size != end-start+1:
            raise RuntimeError(f"invalid range size for {destination.name} at {index}")
        return index, start, chunk

    started = time.monotonic()
    with partial.open("r+b", buffering=0) as output:
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
            pending = [pool.submit(download_range, index) for index in range(count) if index not in completed]
            try:
                for future in concurrent.futures.as_completed(pending):
                    index, start, chunk = future.result()
                    output.seek(start)
                    with chunk.open("rb") as source:
                        for block in iter(lambda: source.read(8 * 1024**2), b""):
                            output.write(block)
                    output.flush()
                    os.fsync(output.fileno())
                    completed.add(index)
                    save_state()
                    chunk.unlink()
                    if len(completed) % 8 == 0 or len(completed) == count:
                        print(json.dumps({"file": destination.name, "ranges": len(completed),
                                          "total_ranges": count, "elapsed_s": round(time.monotonic()-started, 1)}), flush=True)
            except BaseException:
                cancelled.set()
                for future in pending:
                    future.cancel()
                raise
    actual = digest(partial)
    if actual != expected:
        raise RuntimeError(f"checksum mismatch for {destination.name}: {actual} != {expected}")
    partial.replace(destination)
    state_path.unlink()
    print(f"VERIFIED {destination.name} {expected}", flush=True)


def prepare_sources(root, proxy):
    source = root / "source"
    fetch(f"https://codeload.github.com/Indras-Mirror/Xolotl/tar.gz/{XOLOTL_REVISION}",
          source / "xolotl.tar.gz", proxy, XOLOTL_SHA256)
    tree_path = source / "llama-tree.json"
    fetch(f"https://api.github.com/repos/ggml-org/llama.cpp/git/trees/{LLAMA_REVISION}?recursive=1",
          tree_path, proxy)
    tree = json.loads(tree_path.read_text())
    if tree.get("truncated") or tree.get("sha") != LLAMA_REVISION:
        raise ValueError("llama source tree is truncated or has the wrong revision")
    blobs = [item for item in tree["tree"] if item["type"] == "blob" and item["path"].startswith("ggml/")]
    if not blobs or any(item["mode"] not in ("100644", "100755") for item in blobs):
        raise ValueError("ggml source tree is empty or has unsupported file modes")
    print("GGML_SOURCE_FILES", len(blobs), "BYTES", sum(item["size"] for item in blobs), flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        futures = []
        for item in blobs:
            path = Path(item["path"])
            if path.is_absolute() or ".." in path.parts:
                raise ValueError("unsafe upstream tree path")
            futures.append(pool.submit(fetch,
                f"https://raw.githubusercontent.com/ggml-org/llama.cpp/{LLAMA_REVISION}/{item['path']}",
                source / "llama" / path, proxy, None, item["sha"]))
        for future in concurrent.futures.as_completed(futures):
            future.result()
    (source / "SOURCES_READY").write_text(f"{XOLOTL_REVISION}\n{LLAMA_REVISION}\n")
    print("SOURCES_DOWNLOADED", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["model", "sources", "sidecar"])
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--proxy", default=f"socks5h://127.0.0.1:{PROXY_PORTS[0]}")
    parser.add_argument("--workers", type=int, choices=range(1, 17), default=4)
    parser.add_argument("--range-proxies", nargs="+", default=[])
    parser.add_argument("--direct-cdn", action="store_true",
                        help="reuse a validated CDN redirect across ranges; experimental")
    parser.add_argument("--retry-network", action="store_true",
                        help="keep retrying recognized temporary network failures with capped backoff")
    args = parser.parse_args()
    if args.action == "model":
        prepare_model(args.root, args.proxy, args.workers, args.range_proxies,
                      args.direct_cdn, args.retry_network)
    elif args.action == "sources":
        prepare_sources(args.root, args.proxy)
    else:
        name = "V41-MTP-Vision-1017.Q2_K.gguf"
        fetch_large(f"https://huggingface.co/{MODEL_REPOSITORY}/resolve/{MODEL_REVISION}/{name}",
                    args.root/"assets"/name, args.proxy, SIDECAR_SHA256, SIDECAR_SIZE,
                    args.range_proxies, args.direct_cdn, args.retry_network)


if __name__ == "__main__":
    main()
