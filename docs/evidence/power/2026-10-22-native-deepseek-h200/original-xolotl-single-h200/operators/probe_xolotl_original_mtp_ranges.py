"""Check four bounded public HTTP byte ranges; retain no private headers."""
import concurrent.futures,json,time,urllib.request
from xolotl_trial_common import BASE
root=BASE/'original-mtp-range-probe';root.mkdir(exist_ok=False)
url='https://huggingface.co/IndrasMirror/DeepSeek-V4.1-Flash-1017-XQ-Uncensored/resolve/c66fada630aba9123bd6011731fa83c267027122/V41-MTP-Vision-1017.gguf?download=true'
total=8421868640;n=8*1024*1024
def probe(index):
 start=index*1024*1024*1024;end=start+n-1;t=time.time();out=dict(index=index,start=start,end=end,passed=False)
 try:
  req=urllib.request.Request(url+'&range_probe='+str(index),headers={'Range':f'bytes={start}-{end}','Accept-Encoding':'identity'})
  with urllib.request.urlopen(req,timeout=12) as r:
   out.update(status=r.status,content_range=r.headers.get('Content-Range'))
   if r.status!=206 or r.headers.get('Content-Range')!=f'bytes {start}-{end}/{total}':raise RuntimeError('range semantics refused')
   data=r.read(n+1)
   if len(data)!=n:raise RuntimeError('range length differs')
   (root/f'part-{index}.bin').write_bytes(data);out['passed']=True
 except Exception as e:out['error']=type(e).__name__+': '+str(e)[:160]
 out['seconds']=time.time()-t;return out
t=time.time()
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:rows=list(pool.map(probe,range(4)))
out=dict(unix=time.time(),elapsed_seconds=time.time()-t,rows=rows,all_passed=all(r['passed'] for r in rows))
(BASE/'xolotl-original-mtp-range-probe.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
