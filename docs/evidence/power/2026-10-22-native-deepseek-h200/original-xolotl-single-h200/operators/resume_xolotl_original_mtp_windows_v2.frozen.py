"""Resume only the completed bounded fetch, preserving and hashing its prefix."""
import ctypes,hashlib,json,os,shutil,subprocess,time
from ctypes import wintypes
from pathlib import Path
from xolotl_trial_common import BASE
intent=BASE/'xolotl-original-mtp-windows-resume2-intent.json'
latest=BASE/'xolotl-original-mtp-windows-resume2-latest.json'
if intent.exists():raise RuntimeError('resume intent exists; inspect it instead of restarting')
old=json.loads((BASE/'xolotl-original-mtp-windows-resume1-latest.json').read_text())
if old.get('phase')!='failed' or old.get('download_exit')!=28 or not old.get('finished_unix'):raise RuntimeError('prior bounded curl has not completed with timeout')
kernel=ctypes.WinDLL('kernel32',use_last_error=True)
kernel.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD];kernel.OpenProcess.restype=wintypes.HANDLE
kernel.GetExitCodeProcess.argtypes=[wintypes.HANDLE,ctypes.POINTER(wintypes.DWORD)];kernel.CloseHandle.argtypes=[wintypes.HANDLE]
handle=kernel.OpenProcess(0x1000,False,old['pid'])
if handle:
 status=wintypes.DWORD()
 try:
  if not kernel.GetExitCodeProcess(handle,ctypes.byref(status)) or status.value==259:raise RuntimeError('prior curl PID is active or has been reused; refuse overlap')
 finally:kernel.CloseHandle(handle)
elif ctypes.get_last_error()!=87:raise RuntimeError('cannot establish prior curl terminal identity')
part=Path(old['part']);final=Path(old['final']);folder=BASE/'original-mtp-c66fada630ab'
if part.resolve()!=folder/'V41-MTP-Vision-1017.gguf.part' or part.is_symlink() or not part.is_file() or final.exists():raise RuntimeError('partial artifact identity differs')
initial=part.stat().st_size;expected=8421868640
if not 0<initial<expected:raise RuntimeError('partial size is not a resumable prefix')
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  while b:=f.read(8*1024**2):h.update(b)
 return h.hexdigest()
out=dict(unix=time.time(),phase='prepared',worker_pid=os.getpid(),previous_finished_unix=old['finished_unix'],previous_curl_pid=old['pid'],initial_bytes=initial,initial_prefix_sha256=sha(part),part=str(part),final=str(final),maximum_seconds=300,expected_bytes=expected,expected_sha256=old['expected_sha256'],revision=old['revision'],no_gpu_allocation_dependency=True,verified=False)
intent.write_text(json.dumps(out,indent=2)+'\n')
def save():
 p=latest.with_suffix('.tmp');p.write_text(json.dumps(out,indent=2)+'\n');p.replace(latest)
try:
 if part.stat().st_size!=initial:raise RuntimeError('partial artifact changed during resume preparation')
 curl=shutil.which('curl.exe')
 if not curl:raise RuntimeError('curl executable missing')
 url='https://huggingface.co/IndrasMirror/DeepSeek-V4.1-Flash-1017-XQ-Uncensored/resolve/c66fada630aba9123bd6011731fa83c267027122/V41-MTP-Vision-1017.gguf?download=true'
 args=[curl,'--location','--fail','--silent','--show-error','--connect-timeout','12','--max-time','300','--speed-limit','65536','--speed-time','45','--continue-at',str(initial),'--output',str(part),url]
 with (folder/'resume2.stderr.log').open('xb') as err:
  p=subprocess.Popen(args,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=err);out.update(phase='downloading',pid=p.pid);save();print(json.dumps(dict(phase='downloading',pid=p.pid,initial_bytes=initial,maximum_seconds=300)),flush=True)
  while p.poll() is None:
   time.sleep(2);out.update(observed_unix=time.time(),bytes_downloaded=part.stat().st_size);save()
  out.update(download_exit=p.returncode,bytes_downloaded=part.stat().st_size)
 if p.returncode:raise RuntimeError('bounded resume failed; preserve partial file and do not blindly restart')
 if part.stat().st_size!=expected:raise RuntimeError('resumed byte count differs')
 out.update(phase='hashing');save();print(json.dumps(dict(phase='hashing',bytes=expected)),flush=True)
 out['observed_sha256']=sha(part)
 if out['observed_sha256']!=out['expected_sha256']:raise RuntimeError('complete sidecar SHA256 differs')
 part.rename(final);out.update(phase='verified',verified=True)
except Exception as e:out.update(phase='failed',verified=False,error=str(e))
finally:out['finished_unix']=time.time();save();print(json.dumps(out,indent=2),flush=True)
if not out['verified']:raise SystemExit(1)
