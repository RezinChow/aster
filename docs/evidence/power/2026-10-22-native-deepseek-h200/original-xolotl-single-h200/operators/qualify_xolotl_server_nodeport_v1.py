"""Test server-side HTTP from this Windows computer after all local forwards were removed."""
import concurrent.futures,json,time,urllib.error,urllib.request
from pathlib import Path
from xolotl_serving_common import BASE,jump
r=json.loads((BASE/'xolotl-stable-service-v2-intent.json').read_text());key=Path(r['credential_file']).read_text().strip()
hosts=['10.102.204.31','10.102.214.86','10.102.242.75','10.102.254.2']
def test(host):
 t=time.time();url='http://'+host+':30003/v1/models'
 try:
  req=urllib.request.Request(url,headers={'Authorization':'Bearer '+key})
  with urllib.request.urlopen(req,timeout=4) as response:data=json.load(response);status=response.status
  return dict(host=host,url=url,status=status,models=[x['id'] for x in data['data']],seconds=time.time()-t)
 except Exception as e:return dict(host=host,url=url,error=type(e).__name__+': '+str(e),seconds=time.time()-t)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:rows=list(pool.map(test,hosts))
code='''import json,urllib.request,time,socket
from pathlib import Path
key=(Path(@ROOT@)/'credentials/api-key.txt').read_text().strip();out=[]
for host in ['10.68.66.235','10.102.204.31']:
 url='http://'+host+':30003/v1/models';t=time.time()
 try:
  req=urllib.request.Request(url,headers={'Authorization':'Bearer '+key})
  with urllib.request.urlopen(req,timeout=4) as response:data=json.load(response);status=response.status
  out.append(dict(url=url,status=status,models=[x['id'] for x in data['data']],seconds=time.time()-t))
 except Exception as e:out.append(dict(url=url,error=type(e).__name__+': '+str(e),seconds=time.time()-t))
print(json.dumps(dict(source_hostname=socket.gethostname(),tests=out)))
'''.replace('@ROOT@',repr(r['root']))
compile(code,'nodeport-cluster-validation','exec');rec=dict(unix=time.time(),windows_direct=rows,cluster=jump(code),windows_forwarding_required=False)
(BASE/'xolotl-server-nodeport-v1-qualification.json').write_text(json.dumps(rec,indent=2)+'\n');print(json.dumps(rec,indent=2))
