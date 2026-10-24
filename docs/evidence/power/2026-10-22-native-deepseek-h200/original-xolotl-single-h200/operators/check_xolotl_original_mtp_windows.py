"""Bounded anonymous metadata probe from the local workstation; no download."""
import json,time,urllib.request
from xolotl_trial_common import BASE
url='https://huggingface.co/IndrasMirror/DeepSeek-V4.1-Flash-1017-XQ-Uncensored/resolve/c66fada630aba9123bd6011731fa83c267027122/V41-MTP-Vision-1017.gguf?download=true'
out=dict(unix=time.time(),operation='anonymous HEAD only from Windows; no body/download',expected_bytes=8421868640,expected_sha256='6f3d5b8611ddb3954bb89c09e8890806225715fea90868a6d7ec0ffee5c72082')
try:
 with urllib.request.urlopen(urllib.request.Request(url,method='HEAD'),timeout=12) as r:
  out.update(status=r.status,content_length=r.headers.get('Content-Length'),content_type=r.headers.get('Content-Type'))
except Exception as e:out.update(error=type(e).__name__+': '+str(e)[:200])
(BASE/'xolotl-original-mtp-windows-network-check.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))
