"""Stage a small Engram index and inspect exact job events; no GPU execution."""
import json
from xolotl_trial_common import BASE,lease,jump
intent=lease(); stage=json.loads((BASE/'xolotl-b345-stage-result.json').read_text())
code='''import json,os,subprocess,shlex,struct,time
from pathlib import Path
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('owned engine stage changed')
blobs=Path('/mnt/shared-storage-gpfs2/gpfs2-shared-public/huggingface/hub/models--deepseek-ai--DeepSeek-V4.1-Flash-1017/blobs')
eng=root/'engram'
if eng.exists():raise RuntimeError('Engram inputs already frozen')
eng.mkdir(mode=0o700)
table={}; descriptors={}
for digest,nbytes in [('76a05106ece259be83d1bfea0dcb54f23377864ee60fd321690f35e6698a2af5',101535150936),('9dc51433e195bc78b5ad846b68643cc0351d3b174e5e4309222d3b7402c83afd',101537926640)]:
 src=blobs/digest
 if src.stat().st_size!=nbytes:raise RuntimeError('official Engram blob size changed')
 with src.open('rb') as f:
  size=struct.unpack('<Q',f.read(8))[0]
  if not 0<size<=1048576:raise RuntimeError('Engram header exceeds bound')
  header=json.loads(f.read(size))
 keys=[k for k in header if k in ['layers.1.engram.embed.weight','layers.1.engram.embed.scale','layers.14.engram.embed.weight','layers.14.engram.embed.scale']]
 if len(keys)!=2:raise RuntimeError('unexpected exact Engram table names')
 filename=digest+'.safetensors'
 (eng/filename).symlink_to(src)
 for k in keys:table[k]=filename;descriptors[k]=header[k]
if len(table)!=4:raise RuntimeError('Engram table set incomplete')
(eng/'model.safetensors.index.json').write_text(json.dumps(dict(weight_map=table),indent=2)+'\\n')
out=dict(unix=time.time(),engram=str(eng),table=table,descriptors=descriptors)
for label,py in [('system','python3'),('fetch',str(root.parent.parent/'fetch-venv/bin/python'))]:
 p=subprocess.run([py,'-c','import importlib.util,json; print(json.dumps({m:bool(importlib.util.find_spec(m)) for m in ["tokenizers","regex","numpy","aiohttp"]}))'],capture_output=True,text=True,timeout=10)
 out[label+'_python']=dict(path=py,exit=p.returncode,stdout=p.stdout[:2000],stderr=p.stderr[-1000:])
job=@JOB@
p=subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(['brainctl','get','replicas','-n','ailab-hrprdduanyan','-l','rjob.brainpp.cn/rjob-name='+job,'-o','json'])],capture_output=True,text=True,timeout=20,check=True)
rs=json.loads(p.stdout)['items']
if len(rs)!=1:raise RuntimeError('trial replica count changed')
uid=rs[0]['metadata']['uid']
p=subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(['brainctl','get','events','-n','ailab-hrprdduanyan','--field-selector','involvedObject.uid='+uid,'-o','json'])],capture_output=True,text=True,timeout=20,check=True)
out['events']=[dict(time=e.get('lastTimestamp'),reason=e.get('reason'),message=e.get('message')) for e in json.loads(p.stdout).get('items',[])]
(root/'inputs-result.json').write_text(json.dumps(out,indent=2)+'\\n')
print(json.dumps(out))
'''.replace('@ROOT@',repr(stage['root'])).replace('@JOB@',repr(intent['submitted']['rjob']))
v=jump(code,80)
(BASE/'xolotl-trial-inputs-result.json').write_text(json.dumps(v,indent=2)+'\n')
print(json.dumps(v,indent=2))
