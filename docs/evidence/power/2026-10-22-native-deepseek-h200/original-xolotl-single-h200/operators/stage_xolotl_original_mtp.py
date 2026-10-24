"""Upload the verified public sidecar once, then hash it on GPFS before publication."""
import hashlib,json,os,shutil,subprocess,time
from pathlib import Path
from xolotl_trial_common import BASE,SSH,jump
intent=BASE/'xolotl-original-mtp-stage-intent.json'
if intent.exists():raise RuntimeError('sidecar staging intent exists; inspect its process and remote result')
download_receipt=BASE/'xolotl-original-mtp-windows-resume2-latest.json'
if not download_receipt.exists():download_receipt=BASE/'xolotl-original-mtp-windows-resume1-latest.json'
receipt=json.loads(download_receipt.read_text())
expected=8421868640;sha='6f3d5b8611ddb3954bb89c09e8890806225715fea90868a6d7ec0ffee5c72082'
source=BASE/'original-mtp-c66fada630ab/V41-MTP-Vision-1017.gguf'
if receipt.get('phase')!='verified' or not receipt.get('verified') or receipt.get('observed_sha256')!=sha or not source.is_file() or source.is_symlink() or source.stat().st_size!=expected:raise RuntimeError('complete local sidecar verification is required before staging')
h=hashlib.sha256()
with source.open('rb') as f:
 while b:=f.read(8*1024**2):h.update(b)
if h.hexdigest()!=sha:raise RuntimeError('local sidecar SHA changed since download')
source_stat=source.stat();scp=shutil.which('scp.exe')
if not scp:raise RuntimeError('OpenSSH scp executable missing')
remote='/mnt/shared-storage-user/yangchao/Workspace/aster-h200-xq/assets/original-mtp-6f3d5b8611dd'
worker='''from pathlib import Path
import hashlib,json,os,time
root=Path(__file__).resolve().parent
out=dict(phase='hashing',unix=time.time(),verified=False)
def save():
 p=root/'result.tmp';p.write_text(json.dumps(out,indent=2)+'\\n');p.replace(root/'result.json')
save()
try:
 if root.resolve()!=root or root.stat().st_uid!=10250 or os.getuid()!=10250:raise RuntimeError('sidecar owner differs')
 p=root/'V41-MTP-Vision-1017.gguf.part';st=p.stat()
 if p.is_symlink() or st.st_uid!=10250 or st.st_size!=8421868640:raise RuntimeError('sidecar upload size/owner differs')
 h=hashlib.sha256()
 with p.open('rb') as f:
  while b:=f.read(8*1024**2):h.update(b)
 out['observed_sha256']=h.hexdigest()
 if h.hexdigest()!='6f3d5b8611ddb3954bb89c09e8890806225715fea90868a6d7ec0ffee5c72082':raise RuntimeError('uploaded sidecar SHA differs')
 now=p.stat()
 if (st.st_ino,st.st_mtime_ns,st.st_size)!=(now.st_ino,now.st_mtime_ns,now.st_size):raise RuntimeError('sidecar changed during hashing')
 final=root/'V41-MTP-Vision-1017.gguf'
 if final.exists():raise RuntimeError('verified sidecar destination exists')
 p.rename(final);out.update(phase='verified',verified=True,path=str(final),bytes=now.st_size)
except Exception as e:out.update(phase='failed',error=str(e))
finally:out['finished_unix']=time.time();save()
'''
compile(worker,'sidecar-hash-worker.py','exec')
r=dict(unix=time.time(),phase='prepared',worker_pid=os.getpid(),source=str(source),source_bytes=expected,source_sha256=sha,source_mtime_ns=source_stat.st_mtime_ns,root=remote,maximum_upload_seconds=1800,maximum_hash_seconds=180,hash_worker_sha256=hashlib.sha256(worker.encode()).hexdigest(),model_speed_claimed=False)
intent.write_text(json.dumps(r,indent=2)+'\n')
code='''from pathlib import Path
import os,json,hashlib
r=@R@;root=Path(r['root'])
if root.parent.resolve()!=root.parent or root.parent.stat().st_uid!=10250 or os.getuid()!=10250:raise RuntimeError('sidecar stage parent differs')
root.mkdir(mode=0o700,exist_ok=False);p=root/'V41-MTP-Vision-1017.gguf.part';p.touch(mode=0o600,exist_ok=False)
worker=@WORKER@
if hashlib.sha256(worker.encode()).hexdigest()!=r['hash_worker_sha256']:raise RuntimeError('sidecar hasher differs')
(root/'worker.py').write_text(worker);(root/'source.json').write_text(json.dumps(r,indent=2)+'\\n')
print(json.dumps(dict(staged=True,part_inode=p.stat().st_ino)))
'''.replace('@R@',repr(r)).replace('@WORKER@',repr(worker))
r['stage']=jump(code);r['phase']='upload_requested';intent.write_text(json.dumps(r,indent=2)+'\n')
try:
 args=[scp,'-q']+SSH[1:-1]+[source.name,SSH[-1]+':'+remote+'/V41-MTP-Vision-1017.gguf.part']
 with (BASE/'xolotl-original-mtp-scp.stderr.log').open('xb') as err:
  p=subprocess.Popen(args,cwd=source.parent,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
  r.update(phase='uploading',scp_pid=p.pid,scp_started_unix=time.time());intent.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(dict(phase='uploading',pid=p.pid,bytes=expected)),flush=True)
  try:r['upload_exit']=p.wait(timeout=1800)
  except subprocess.TimeoutExpired:p.kill();p.wait(timeout=15);raise TimeoutError('bounded upload exceeded1800 seconds; partial retained')
 if r['upload_exit']!=0:raise RuntimeError('SCP failed; retain partial file and inspect instead of restarting')
 if (source.stat().st_size,source.stat().st_mtime_ns)!=(expected,source_stat.st_mtime_ns):raise RuntimeError('local sidecar changed during transfer')
 code='''from pathlib import Path
import json,os,time,subprocess
root=Path(@ROOT@);p=root/'V41-MTP-Vision-1017.gguf.part'
if root.resolve()!=root or root.stat().st_uid!=os.getuid() or os.getuid()!=10250 or p.is_symlink() or p.stat().st_size!=8421868640 or (root/'process.json').exists():raise RuntimeError('uploaded sidecar identity differs')
with (root/'worker.log').open('xb') as f:child=subprocess.Popen(['timeout','--signal=TERM','--kill-after=15','180','python3','-u',str(root/'worker.py')],cwd=root,stdin=subprocess.DEVNULL,stdout=f,stderr=f,start_new_session=True)
out=dict(pid=child.pid,start_ticks=int(Path('/proc/'+str(child.pid)+'/stat').read_text().split(') ',1)[1].split()[19]),uid=os.getuid(),unix=time.time(),deadline_seconds=180)
(root/'process.json').write_text(json.dumps(out,indent=2)+'\\n');print(json.dumps(out))
'''.replace('@ROOT@',repr(remote))
 r['phase']='hash_launch_requested';intent.write_text(json.dumps(r,indent=2)+'\n');r['hash_process']=jump(code);r['phase']='hashing'
except Exception as e:r.update(phase='failed',error=str(e));raise
finally:r['last_observed_unix']=time.time();intent.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2),flush=True)
