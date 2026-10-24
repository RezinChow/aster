"""Free the qualification GPU after the original serving GPU is ready at131072 context."""
import json,time
from xolotl_longctx_common import BASE,observe,owned
ip=BASE/'xolotl-longctx-shadow-v1-drain.json'
if ip.exists():raise RuntimeError('shadow drain intent exists; inspect it')
r=json.loads((BASE/'xolotl-longctx-shadow-v1-intent.json').read_text());stable=json.loads((BASE/'xolotl-stable-service-v3-intent.json').read_text());o=observe()
if o['job_uid']!=r['allocation_uid'] or o['phase']!='Running' or stable['gpu_uuid']==r['gpu_uuid']:raise RuntimeError('separate shadow and serving identities differ')
code='''import json,os,signal,time
from pathlib import Path
r=@R@;stable=@STABLE@
q=json.loads((Path(stable['root'])/'service-longctx-v1-result.json').read_text())
if q['phase']!='serving' or q['context_tokens']!=131072 or q['gpu_uuid']!=stable['gpu_uuid']:raise RuntimeError('formal stable131072service is not ready')
p=r['process'];stat=Path('/proc/'+str(p['pid'])+'/stat')
if stat.stat().st_uid!=10250 or int(stat.read_text().split(') ',1)[1].split()[19])!=p['start_ticks']:raise RuntimeError('shadow supervisor lifetime differs')
os.kill(p['pid'],signal.SIGTERM)
print(json.dumps(dict(unix=time.time(),signal='SIGTERM',exact_process=p,formal_serving_gpu=stable['gpu_uuid'],formal_context_tokens=q['context_tokens'])))
'''.replace('@R@',repr(r)).replace('@STABLE@',repr(stable))
compile(code,'exact-shadow-service-drain','exec');rec=dict(unix=time.time(),phase='drain_requested');ip.write_text(json.dumps(rec,indent=2)+'\n');rec['signal']=owned(code);ip.write_text(json.dumps(rec,indent=2)+'\n');print(json.dumps(rec,indent=2))
