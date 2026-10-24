"""One bounded anonymous fetch of the pinned public original MTP sidecar."""
import hashlib,json,shutil,subprocess,time
from pathlib import Path
from xolotl_trial_common import BASE
intent=BASE/'xolotl-original-mtp-windows-download-intent.json'
if intent.exists():raise RuntimeError('download intent exists; inspect its result and process instead of restarting')
url='https://huggingface.co/IndrasMirror/DeepSeek-V4.1-Flash-1017-XQ-Uncensored/resolve/c66fada630aba9123bd6011731fa83c267027122/V41-MTP-Vision-1017.gguf?download=true'
expected=8421868640;sha='6f3d5b8611ddb3954bb89c09e8890806225715fea90868a6d7ec0ffee5c72082'
folder=BASE/'original-mtp-c66fada630ab';folder.mkdir(exist_ok=False)
part=folder/'V41-MTP-Vision-1017.gguf.part';final=folder/'V41-MTP-Vision-1017.gguf'
curl=shutil.which('curl.exe')
if not curl:raise RuntimeError('curl executable missing')
out=dict(unix=time.time(),phase='prepared',revision='c66fada630aba9123bd6011731fa83c267027122',expected_bytes=expected,expected_sha256=sha,part=str(part),final=str(final),maximum_seconds=600,download_only=True,model_qualification_claimed=False)
intent.write_text(json.dumps(out,indent=2)+'\n')
latest=BASE/'xolotl-original-mtp-windows-download-latest.json'
def save():latest.write_text(json.dumps(out,indent=2)+'\n')
try:
 args=[curl,'--location','--fail','--silent','--show-error','--connect-timeout','12','--max-time','600','--speed-limit','65536','--speed-time','45','--output',str(part),url]
 with (folder/'download.stderr.log').open('xb') as err:
  p=subprocess.Popen(args,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=err)
  out.update(phase='downloading',pid=p.pid);save();last=0
  while p.poll() is None:
   time.sleep(2);now=time.time()
   if now-last>=10:
    out.update(observed_unix=now,bytes_downloaded=part.stat().st_size if part.exists() else 0);save();print(json.dumps(dict(phase=out['phase'],bytes=out['bytes_downloaded'],percent=round(100*out['bytes_downloaded']/expected,2))),flush=True);last=now
  out['download_exit']=p.returncode
 if p.returncode:raise RuntimeError('curl failed; retain partial bytes and stderr, do not blindly restart')
 if part.stat().st_size!=expected:raise RuntimeError('sidecar byte count differs')
 out.update(phase='hashing',bytes_downloaded=expected);save();print(json.dumps(dict(phase='hashing',bytes=expected)),flush=True)
 h=hashlib.sha256()
 with part.open('rb') as f:
  while block:=f.read(8*1024*1024):h.update(block)
 out['observed_sha256']=h.hexdigest()
 if h.hexdigest()!=sha:raise RuntimeError('sidecar SHA256 differs')
 part.rename(final);out.update(phase='verified',verified=True)
except Exception as e:out.update(phase='failed',verified=False,error=str(e))
finally:out['finished_unix']=time.time();save();print(json.dumps(out,indent=2),flush=True)
if not out.get('verified'):raise SystemExit(1)
