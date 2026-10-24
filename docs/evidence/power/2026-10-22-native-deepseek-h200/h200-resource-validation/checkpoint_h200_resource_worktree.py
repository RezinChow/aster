"""Archive only the previous reviewed task scope and its new evidence files."""
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import tarfile
import time

BASE=Path('D:/code/aster/target/h200-native')
WORK=Path('D:/code/aster/.wt-h200-native-deploy')
PREVIOUS=BASE/'xq-peer-resource-worktree-checkpoint-1792788842.json'
previous=json.loads(PREVIOUS.read_text())
pointer=BASE/'native-worktree-checkpoint-latest.json'
before=pointer.read_bytes()
if json.loads(before)['manifest']!=str(PREVIOUS):
    raise RuntimeError('another checkpoint was published; inspect before replacing its pointer')
names={entry['file'] for entry in previous['files']}
evidence=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200'
for path in evidence.rglob('*'):
    if path.is_file():names.add(path.relative_to(WORK).as_posix())
files={}
for name in sorted(names):
    relative=PurePosixPath(name)
    if relative.is_absolute() or '..' in relative.parts or relative.parts[:2]==('apps','studio'):
        raise RuntimeError('checkpoint scope escaped the owned task')
    path=WORK/name
    if not path.is_file() or path.is_symlink() or path.resolve()!=WORK.resolve().joinpath(*relative.parts):
        raise RuntimeError('checkpoint input disappeared or changed type: '+name)
    if path.stat().st_size>32*1024**2:raise RuntimeError('checkpoint input exceeds file bound')
    files[name]=path.read_bytes()
if len(files)>8192 or sum(map(len,files.values()))>128*1024**2:
    raise RuntimeError('checkpoint source/evidence scope exceeds archive bound')
stamp=int(time.time());archive=BASE/('h200-resource-validated-worktree-checkpoint-'+str(stamp)+'.tar.gz')
manifest_path=archive.with_name(archive.name.removesuffix('.tar.gz')+'.json')
if archive.exists() or manifest_path.exists():raise RuntimeError('checkpoint identity collision')
with tarfile.open(archive,'x:gz',compresslevel=1) as output:
    for name,data in files.items():
        entry=tarfile.TarInfo(name);entry.size=len(data);entry.mode=0o600;entry.mtime=0
        output.addfile(entry,io.BytesIO(data))
manifest=dict(unix=time.time(),worktree=str(WORK),scope='previous bounded native task plus current resource acquisition and UID-bootstrap evidence; no private Studio sources, credentials or user state',archive=str(archive),archive_sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),archive_bytes=archive.stat().st_size,file_count=len(files),previous_checkpoint_manifest=str(PREVIOUS),user_goal_complete=False,files=[dict(file=name,bytes=len(data),sha256=hashlib.sha256(data).hexdigest()) for name,data in files.items()])
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
if pointer.read_bytes()!=before:raise RuntimeError('checkpoint pointer changed concurrently; archive retained, pointer not changed')
summary={key:value for key,value in manifest.items() if key!='files'}|dict(manifest=str(manifest_path))
pointer.write_text(json.dumps(summary,indent=2)+'\n')
active=BASE/'active-worktree.json';record=json.loads(active.read_text())
if Path(record['active_worktree'])!=WORK:raise RuntimeError('active worktree changed; checkpoint retained')
record['latest_checkpoint']=str(manifest_path);active.write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(summary,indent=2))
