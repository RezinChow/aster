"""Anonymous public artifact reachability; never expose signed redirects."""
import json
from xolotl_trial_common import BASE,jump
code='''import urllib.request,json,time,socket
socket.setdefaulttimeout(8)
url='https://huggingface.co/IndrasMirror/DeepSeek-V4.1-Flash-1017-XQ-Uncensored/resolve/c66fada630aba9123bd6011731fa83c267027122/V41-MTP-Vision-1017.gguf?download=true'
out=dict(unix=time.time(),operation='anonymous public HEAD from dev jump; no download',expected_bytes=8421868640)
try:
 with urllib.request.urlopen(urllib.request.Request(url,method='HEAD'),timeout=8) as r:out.update(status=r.status,content_length=r.headers.get('Content-Length'))
except Exception as e:out.update(error_type=type(e).__name__)
print(json.dumps(out))
'''
r=jump(code,25);(BASE/'xolotl-original-mtp-jump-network.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
