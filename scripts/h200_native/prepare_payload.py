"""Concatenate pinned XQ parts once, verifying each part and the full payload."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import time


def merge_files(parts, temporary, destination, expected_bytes, expected_sha256,
                deadline, progress=lambda value: None):
    if destination.exists() or temporary.exists():
        raise RuntimeError('payload output already exists; inspect the original operation')
    if not parts or sum(part['bytes'] for part in parts) != expected_bytes:
        raise RuntimeError('part byte sum differs from the pinned complete payload')
    if shutil.disk_usage(destination.parent).free < expected_bytes + 64*1024**3:
        raise RuntimeError('payload preparation requires its complete size plus 64 GiB free reserve')
    total = 0
    whole = hashlib.sha256()
    with temporary.open('xb') as target:
        for index, part in enumerate(parts):
            path = Path(part['path'])
            if path.is_symlink() or not path.is_file() or path.resolve() != path:
                raise RuntimeError('payload part must be an exact canonical regular file')
            before = path.stat()
            if before.st_size != part['bytes']:
                raise RuntimeError('payload part byte count differs from its pinned manifest')
            identity = (before.st_dev, before.st_ino, before.st_mtime_ns, before.st_size)
            digest = hashlib.sha256()
            copied = 0
            with path.open('rb') as source:
                while chunk := source.read(8*1024**2):
                    if time.monotonic() >= deadline:
                        raise RuntimeError('payload preparation exceeded its bounded deadline')
                    copied += len(chunk)
                    if copied > part['bytes']:
                        raise RuntimeError('payload part grew while it was being verified')
                    digest.update(chunk)
                    whole.update(chunk)
                    target.write(chunk)
                    total += len(chunk)
            after = path.stat()
            if (after.st_dev, after.st_ino, after.st_mtime_ns, after.st_size) != identity:
                raise RuntimeError('payload part identity changed during preparation')
            if copied != part['bytes'] or digest.hexdigest() != part['sha256']:
                raise RuntimeError('payload part failed its complete SHA256 verification')
            progress(dict(completed_parts=index+1, copied_bytes=total, last_part_sha256=digest.hexdigest()))
        target.flush()
        os.fsync(target.fileno())
    if total != expected_bytes or whole.hexdigest() != expected_sha256:
        raise RuntimeError('complete XQ payload failed its pinned size/SHA256 verification')
    # The private stage is single-owner; refuse accidental replacement even
    # after the expensive read. Retain the temporary on any failure.
    if destination.exists():
        raise RuntimeError('payload publication would replace an existing artifact')
    temporary.rename(destination)
    return dict(bytes=total, sha256=whole.hexdigest(), completed_parts=len(parts))


def main():
    root = Path(__file__).absolute().parent
    if root.resolve() != root or root.stat().st_uid != os.getuid() or os.getuid() != 10250:
        raise RuntimeError('payload preparation requires the exact owned private stage')
    os.umask(0o077)
    manifest_path = root/'payload-inputs.json'
    if manifest_path.stat().st_size > 65536:
        raise RuntimeError('payload manifest exceeds byte bound')
    inputs = json.loads(manifest_path.read_text())
    if hashlib.sha256(Path(__file__).read_bytes()).hexdigest() != inputs['worker_sha256']:
        raise RuntimeError('payload preparation source identity changed')
    if inputs['schema'] != 'aster-native-xq-v3-payload-inputs-v1' or len(inputs['parts']) != 16:
        raise RuntimeError('unknown XQ payload preparation contract')
    result = dict(schema='aster-native-xq-v3-payload-result-v1', unix=time.time(),
                  phase='merging', complete_model_execution_claimed=False)
    def publish(update):
        result.update(update)
        temporary = root/'payload-result.tmp'
        temporary.write_text(json.dumps(result, indent=2)+'\n')
        temporary.replace(root/'payload-result.json')
    publish({})
    try:
        merged = merge_files(inputs['parts'], root/'V41-XQ-1017-v3.gguf.incomplete',
                             root/'V41-XQ-1017-v3.gguf', inputs['bytes'], inputs['sha256'],
                             time.monotonic()+3300, publish)
        publish(dict(phase='passed', completed_unix=time.time(), **merged))
    except Exception as error:
        publish(dict(phase='failed', error_type=type(error).__name__, error=str(error),
                     completed_unix=time.time()))
        raise
    print(json.dumps(result), flush=True)


if __name__ == '__main__':
    main()
