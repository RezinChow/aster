"""Measure four complementary pinned byte ranges without interrupting the live resume."""
import concurrent.futures,hashlib,json,time,urllib.request,os
from pathlib import Path
from xolotl_trial_common import BASE
intent=BASE/'xolotl-original-mtp-ranged-probe-intent.json'
if intent.exists():raise RuntimeError('ranged intent exists; observe its process and result')
live=json.loads((BASE/'xolotl-original-mtp-windows-resume1-latest.json').read_text())
part=Path(live['part']);total=8421868640;chunk=64*1024**2
if live.get('phase')!='downloading' or not part.is_file():raise RuntimeError('live pinned prefix is unavailable')
start=part.stat().st_size//chunk*chunk
if start+4*chunk>=total:raise RuntimeError('not enough remaining bytes for this fixed probe')
root=BASE/'original-mtp-ranged-probe';root.mkdir(exist_ok=False)
url='https://huggingface.co/IndrasMirror/DeepSeek-V4.1-Flash-1017-XQ-Uncensored/resolve/c66fada630aba9123bd6011731fa83c267027122/V41-MTP-Vision-1017.gguf?download=true'
out=dict(unix=time.time(),phase='running',worker_pid=os.getpid(),root=str(root),chunk_bytes=chunk,expected_total=total,start=start,parts=[],maximum_seconds_per_part=120,main_resume_not_interrupted=True)
intent.write_text(json.dumps(out,indent=2)+'\n');latest=BASE/'xolotl-original-mtp-ranged-probe-latest.json'
def save():
 p=latest.with_suffix('.tmp');p.write_text(json.dumps(out,indent=2)+'\n');p.replace(latest)
save()
def fetch(i):
 a=start+i*chunk;b=a+chunk-1;t=time.time();rout=dict(index=i,start=a,end=b,passed=False,bytes=0)
 try:
  request=urllib.request.Request(url+'&range_part='+str(i),headers={'Range':f'bytes={a}-{b}','Accept-Encoding':'identity'})
  with urllib.request.urlopen(request,timeout=12) as response:
   if response.status!=206 or response.headers.get('Content-Range')!=f'bytes {a}-{b}/{total}':raise RuntimeError('HTTP range semantics differ')
   h=hashlib.sha256();dest=root/f'part-{i}.bin'
   with dest.open('xb') as target:
    while rout['bytes']<chunk:
     if time.time()-t>120:raise TimeoutError('bounded ranged transfer exceeded120 seconds')
     block=response.read(min(1024**2,chunk-rout['bytes']))
     if not block:raise RuntimeError('short ranged response')
     target.write(block);h.update(block);rout['bytes']+=len(block)
   rout.update(passed=True,sha256=h.hexdigest(),file=str(dest))
 except Exception as e:rout['error']=type(e).__name__+': '+str(e)[:160]
 rout['seconds']=time.time()-t;return rout
t=time.time()
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for future in concurrent.futures.as_completed([pool.submit(fetch,i) for i in range(4)]):
  result=future.result();out['parts'].append(result);save();print(json.dumps(result),flush=True)
out.update(phase='complete',all_passed=all(p['passed'] for p in out['parts']),elapsed_seconds=time.time()-t,finished_unix=time.time());save()
print(json.dumps(dict(phase='complete',all_passed=out['all_passed'],elapsed_seconds=out['elapsed_seconds'],complete_bytes=sum(p['bytes'] for p in out['parts'] if p['passed'])),indent=2),flush=True)
