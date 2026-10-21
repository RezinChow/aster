#!/usr/bin/env python3
"""Bounded actual ACP two-turn acceptance; public inference requires --public."""
import argparse
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import queue
import subprocess
import threading
import time

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
BINARY = REPO / 'target/debug/a3s-code-acp.exe'
BINARY_SHA = 'e0f810af8796ca1a0934c503ddbb56034ee10ee2c3b0011e8e5f27fbbb03ae59'
MAX_LINE, MAX_OUTPUT, MAX_FILES = 1024 * 1024, 8 * 1024 * 1024, 512
PROMPTS = ('Remember the synthetic marker ASTER-CONTINUITY-7429. Reply with exactly READY. Do not use tools.',
           'Reply with exactly the synthetic marker from my first message. Do not use tools.')
EXPECTED = ('READY', 'ASTER-CONTINUITY-7429')


class Failure(RuntimeError):
    pass


def digest(data):
    return hashlib.sha256(data).hexdigest()


def child_environment(root, key):
    names = ('SystemRoot', 'WINDIR', 'PATH', 'PATHEXT', 'COMSPEC', 'TEMP', 'TMP',
             'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE')
    env = {name: os.environ[name] for name in names if name in os.environ}
    env.update(USERPROFILE=str(root / 'profile'), APPDATA=str(root / 'appdata'),
               LOCALAPPDATA=str(root / 'localappdata'), A3S_HOME=str(root / 'home'),
               A3S_STATE_HOME=str(root / 'state'), A3S_CODE_LOG_FILE='0', RUST_LOG='off',
               A3S_DISABLE_CC_SWITCH='1', A3S_DISABLE_GROK_ACCOUNT='1', A3S_DISABLE_CURSOR_ACCOUNT='1',
               A3S_GATEWAY_KEY=key)
    return env


def acl(root, base_url):
    path = lambda name: json.dumps(str(root / name).replace('\\', '/'))
    return ('default_model = "gateway/prism-27b"\n'
            'storage_backend = "file"\n'
            f'sessions_dir = {path("sessions")}\nmemory_dir = {path("memory")}\n'
            f'user_instructions_dir = {path("instructions")}\nproject_doc_max_bytes = 0\n'
            'providers "gateway" {\n'
            f'  base_url = {json.dumps(base_url)}\n'
            '  api_key = env("A3S_GATEWAY_KEY")\n'
            '  models "prism-27b" { name = "Prism27B" temperature = true limit = { context = 4096, output = 128 } }\n'
            '}\n')


def secret_variants(key):
    return {key.encode(), key.encode('utf-16le'), key.encode('utf-16be'),
            base64.b64encode(key.encode()), json.dumps(key)[1:-1].encode()}


def scan_state(root, key):
    result, total = [], 0
    for path in root.rglob('*'):
        if path.is_symlink():
            raise Failure('isolated state contains a symlink')
        if not path.is_file():
            continue
        if len(result) >= MAX_FILES or path.stat().st_size > MAX_OUTPUT:
            raise Failure('isolated state exceeds bounded inspection')
        data = path.read_bytes()
        total += len(data)
        if total > 64 * 1024 * 1024:
            raise Failure('isolated state byte bound exceeded')
        if any(needle in data for needle in secret_variants(key)):
            raise Failure('resolved credential found in isolated state')
        result.append({'path': str(path.relative_to(root)), 'bytes': len(data), 'sha256': digest(data)})
    return {'resolved_credential_found': False, 'inspected_files': result, 'total_bytes': total}


def dialogue(root, base_url, key, binary=BINARY, expected_sha=BINARY_SHA, turn_seconds=30, total_seconds=90):
    if root.exists():
        raise Failure('fresh isolated state already exists; no replacement or automatic retry')
    if digest(binary.read_bytes()) != expected_sha:
        raise Failure('actual ACP binary differs from pinned artifact')
    root.mkdir(parents=True)
    for name in ('workspace', 'profile', 'appdata', 'localappdata', 'home', 'state', 'sessions', 'memory', 'instructions'):
        (root / name).mkdir()
    config = root / 'config.acl'
    config.write_text(acl(root, base_url), encoding='utf-8')
    started, messages, diagnostics = time.monotonic(), queue.Queue(), bytearray()
    output_bytes, turns = [0], []
    result = {'scope': 'actual existing Windows ACP/core SDK; one fresh source-review session, no tools',
              'binary_sha256': expected_sha, 'binary': str(binary), 'turn_deadline_seconds': turn_seconds,
              'global_deadline_seconds': total_seconds, 'status': 'failed', 'turns': turns,
              'credential_handling': 'protected SSH pipe to process memory/child environment; ACL retains env expression',
              'underlying_model_http_request_count': None,
              'internal_call_note': 'ACP may make internal model calls; two ACP turns do not mean exactly two HTTP requests.',
              'not_claimed': ['Aster GUI or a real user history', 'ordinary tools-schema ACP mode', 'observed underlying TCP reuse']}
    child = None
    readers = []
    active_text, first_meaningful = [], [None]

    def read_stdout():
        while True:
            raw = child.stdout.readline(MAX_LINE + 1)
            if not raw:
                messages.put(None)
                return
            output_bytes[0] += len(raw)
            if len(raw) > MAX_LINE or output_bytes[0] > MAX_OUTPUT:
                messages.put(Failure('ACP protocol byte bound exceeded'))
                return
            if any(needle in raw for needle in secret_variants(key)):
                messages.put(Failure('resolved credential in ACP protocol'))
                return
            messages.put(raw)

    def read_stderr():
        while True:
            raw = child.stderr.read(4096)
            if not raw:
                return
            if len(diagnostics) + len(raw) > MAX_OUTPUT:
                messages.put(Failure('ACP diagnostic byte bound exceeded'))
                return
            diagnostics.extend(raw)

    def send(message):
        child.stdin.write((json.dumps(message) + '\n').encode())
        child.stdin.flush()

    def response(identifier, seconds):
        deadline = min(started + total_seconds, time.monotonic() + seconds)
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise Failure('absolute ACP response deadline exceeded')
            try:
                raw = messages.get(timeout=remaining)
            except queue.Empty:
                raise Failure('absolute ACP response deadline exceeded') from None
            if raw is None:
                raise Failure('ACP ended before matching response')
            if isinstance(raw, Exception):
                raise raw
            try:
                message = json.loads(raw)
            except (ValueError, UnicodeError):
                raise Failure('invalid ACP JSON protocol') from None
            if not isinstance(message, dict):
                raise Failure('invalid ACP message shape')
            method = message.get('method')
            if method == 'session/update':
                update = message.get('params', {}).get('update', {})
                if update.get('sessionUpdate') in ('tool_call', 'tool_call_update'):
                    raise Failure('unexpected tool activity in no-tools acceptance')
                if update.get('sessionUpdate') == 'agent_message_chunk':
                    content = update.get('content', {})
                    text = content.get('text') if content.get('type') == 'text' else None
                    if not isinstance(text, str):
                        raise Failure('invalid ACP text content')
                    active_text.append(text)
                    if sum(map(len, active_text)) > MAX_OUTPUT:
                        raise Failure('ACP text byte bound exceeded')
                    if text.strip() and first_meaningful[0] is None:
                        first_meaningful[0] = time.monotonic()
            elif method is not None and 'id' in message:
                send({'jsonrpc': '2.0', 'id': message['id'], 'error': {'code': -32601, 'message': 'qualification client refuses host actions'}})
                raise Failure('agent requested an unsupported host action')
            elif message.get('id') == identifier:
                if 'error' in message or not isinstance(message.get('result'), dict):
                    raise Failure('ACP returned a protocol error')
                return message['result']

    try:
        child = subprocess.Popen([str(binary), '--cwd', str(root / 'workspace'), '--config', str(config),
                                  '--model', 'gateway/prism-27b'], cwd=root / 'workspace',
                                 env=child_environment(root, key), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, bufsize=0)
        result['child_pid'] = child.pid
        readers = [threading.Thread(target=read_stdout, daemon=True), threading.Thread(target=read_stderr, daemon=True)]
        for thread in readers:
            thread.start()
        send({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': 1, 'clientCapabilities': {}}})
        response(1, 10)
        send({'jsonrpc': '2.0', 'id': 2, 'method': 'session/new', 'params': {'cwd': str(root / 'workspace'), 'mcpServers': [],
              '_meta': {'a3sEngineering': {'policy': 'none'}, 'a3sHost': {'sourceReview': True}}}})
        opened = response(2, 15)
        session = opened.get('sessionId')
        if not isinstance(session, str) or not session or opened.get('models', {}).get('currentModelId') != 'gateway/prism-27b':
            raise Failure('fresh ACP session or selected model differs')
        result['session_id_sha256'] = digest(session.encode())
        for number, (prompt, expected) in enumerate(zip(PROMPTS, EXPECTED), 1):
            active_text.clear()
            first_meaningful[0] = None
            request_started = time.monotonic()
            send({'jsonrpc': '2.0', 'id': number + 2, 'method': 'session/prompt',
                  'params': {'sessionId': session, 'prompt': [{'type': 'text', 'text': prompt}]}})
            ended = response(number + 2, turn_seconds)
            text = ''.join(active_text)
            if any(needle in text.encode() for needle in secret_variants(key)):
                raise Failure('resolved credential in ACP output')
            row = {'turn': number, 'prompt_sha256': digest(prompt.encode()), 'output_sha256': digest(text.encode()),
                   'output_chars': len(text), 'expected_output': text.strip() == expected,
                   'stop_reason': ended.get('stopReason'), 'elapsed_ms': 1000 * (time.monotonic() - request_started),
                   'first_meaningful_ms': None if first_meaningful[0] is None else 1000 * (first_meaningful[0] - request_started),
                   'usage': {name: value for name, value in ended.get('usage', {}).items()
                             if name in ('inputTokens', 'outputTokens', 'totalTokens', 'cachedReadTokens', 'cachedWriteTokens')
                             and type(value) is int and 0 <= value < 2**64}
                             if isinstance(ended.get('usage'), dict) else None,
                   'same_session': True}
            turns.append(row)
            if not row['expected_output'] or row['stop_reason'] != 'end_turn':
                raise Failure('ACP turn output or completion failed')
        result['status'] = 'passed'
    except Exception as exc:
        result['failure_exception'] = type(exc).__name__
        if isinstance(exc, Failure):
            result['failure_reason'] = str(exc)
    finally:
        if child is not None:
            if child.poll() is None:
                child.terminate()
                try:
                    child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait(timeout=3)
        for thread in readers:
            thread.join(timeout=2)
        if child is not None:
            for stream in (child.stdin, child.stdout, child.stderr):
                stream.close()
        if any(thread.is_alive() for thread in readers):
            result.update(status='failed', cleanup_failure='ACP pipe reader did not terminate')
        result.update(elapsed_seconds=time.monotonic() - started, own_child_reaped=child is None or child.poll() is not None,
                      stdout_bytes=output_bytes[0], stderr_bytes=len(diagnostics), stderr_sha256=digest(diagnostics))
        try:
            if any(needle in diagnostics for needle in secret_variants(key)):
                raise Failure('resolved credential in ACP diagnostics')
            result['state_privacy'] = scan_state(root, key)
        except Exception as exc:
            result.update(status='failed', privacy_failure_exception=type(exc).__name__)
            if isinstance(exc, Failure):
                result['privacy_failure_reason'] = str(exc)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public', action='store_true', required=True)
    parser.add_argument('--tag', required=True)
    args = parser.parse_args()
    if not args.tag or len(args.tag) > 40 or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in args.tag):
        raise Failure('bounded tag required')
    target = HERE / ('aster-acp-' + args.tag + '.json')
    if target.exists():
        raise Failure('existing result; no replacement or automatic retry')
    spec = importlib.util.spec_from_file_location('approved_public_credential', HERE / 'public-frontdoor-qualification.py')
    public = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(public)
    driver_sha = digest(Path(__file__).read_bytes())
    reader_sha = digest(Path(public.__file__).read_bytes())
    key = public.credential()
    result = dialogue(REPO / '.git/optimization-20261021/acp' / args.tag, public.URL, key)
    result['driver_sha256'] = driver_sha
    result['credential_reader_sha256'] = reader_sha
    if digest(Path(__file__).read_bytes()) != driver_sha or digest(Path(public.__file__).read_bytes()) != reader_sha:
        result.update(status='failed', source_identity_changed=True)
    result['url'] = public.URL
    with target.open('x', encoding='utf-8') as stream:
        json.dump(result, stream, indent=2)
        stream.write('\n')
    print(json.dumps(result))
    if result['status'] != 'passed':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
