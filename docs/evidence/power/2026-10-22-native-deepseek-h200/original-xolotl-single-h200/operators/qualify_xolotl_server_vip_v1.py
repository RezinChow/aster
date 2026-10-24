"""Validate the exact new VIP from Windows with proxies disabled; retain no auth header."""
import ipaddress,json,time,urllib.error,urllib.request
from pathlib import Path
from xolotl_serving_common import BASE,jump
r=json.loads((BASE/'xolotl-server-loadbalancer-v2-intent.json').read_text());stable=json.loads((BASE/'xolotl-stable-service-v3-intent.json').read_text())
code='''import json,shlex,subprocess,time
r=@R@
p=subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(['brainctl','get','service',r['service']['metadata']['name'],'-n','ailab-hrprdduanyan','-o','json'])],capture_output=True,text=True,check=True,timeout=20)
s=json.loads(p.stdout)
if s['metadata']['uid']!=r['created']['service']['metadata']['uid'] or s['spec']['selector']!=r['service']['spec']['selector']:raise RuntimeError('exact owned VIP identity changed')
print(json.dumps(s))
'''.replace('@R@',repr(r))
compile(code,'current-owned-vip-read','exec');s=jump(code);(BASE/'xolotl-server-loadbalancer-v2-latest.json').write_text(json.dumps(s,indent=2)+'\n')
v=s.get('status',{}).get('loadBalancer',{}).get('ingress',[])
if len(v)!=1 or not ipaddress.ip_address(v[0]['ip']).is_private:raise RuntimeError('one private server VIP has not been allocated')
url='http://'+v[0]['ip'];opener=urllib.request.build_opener(urllib.request.ProxyHandler({}));key=Path(stable['credential_file']).read_text().strip()
tests=[]
for path,headers in [('/v1/models',{'Authorization':'Bearer '+key}),('/health',{'Authorization':'Bearer '+key}),('/props',{'Authorization':'Bearer '+key}),('/v1/models',{})]:
 t=time.time()
 try:
  with opener.open(urllib.request.Request(url+path,headers=headers),timeout=5) as response:status=response.status;data=json.load(response)
  tests.append(dict(path=path,authorized=bool(headers),status=status,body=data,seconds=time.time()-t))
 except urllib.error.HTTPError as e:tests.append(dict(path=path,authorized=bool(headers),status=e.code,seconds=time.time()-t))
 except Exception as e:tests.append(dict(path=path,authorized=bool(headers),error=type(e).__name__+': '+str(e),seconds=time.time()-t))
rec=dict(unix=time.time(),source='Windows direct; HTTP proxies disabled; no local tunnels',base_url=url+'/v1',service_uid=s['metadata']['uid'],tests=tests,windows_forwarding_required=False)
(BASE/'xolotl-server-vip-v1-qualification.json').write_text(json.dumps(rec,indent=2)+'\n');print(json.dumps(rec,indent=2))
