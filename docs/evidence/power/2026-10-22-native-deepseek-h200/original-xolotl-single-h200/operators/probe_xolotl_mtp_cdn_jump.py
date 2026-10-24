"""Test anonymous public-asset redirect egress; do not retain signed URLs."""
import json,time,urllib.request,urllib.parse
from xolotl_trial_common import BASE,jump
url='https://huggingface.co/IndrasMirror/DeepSeek-V4.1-Flash-1017-XQ-Uncensored/resolve/c66fada630aba9123bd6011731fa83c267027122/V41-MTP-Vision-1017.gguf?download=true'
with urllib.request.urlopen(urllib.request.Request(url,method='HEAD'),timeout=12) as r:redirect=r.geturl()
host=urllib.parse.urlparse(redirect).hostname
if not host or not host.endswith('.hf.co'):raise RuntimeError('unexpected public asset CDN host')
code='''import urllib.request,json,time
t=time.time();out=dict(unix=t,operation='anonymous HEAD of ephemeral public-asset CDN redirect; URL not retained')
try:
 with urllib.request.urlopen(urllib.request.Request(@URL@,method='HEAD'),timeout=10) as r:out.update(status=r.status,content_length=r.headers.get('Content-Length'))
except Exception as e:out['error']=type(e).__name__
out['seconds']=time.time()-t;print(json.dumps(out))
'''.replace('@URL@',repr(redirect))
out=jump(code,35);out['cdn_host']=host
(BASE/'xolotl-original-mtp-cdn-jump-probe.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
