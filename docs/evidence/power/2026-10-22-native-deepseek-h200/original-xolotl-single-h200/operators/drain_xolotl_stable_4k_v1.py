"""Gracefully drain only the exact supervised four-kilobyte-context service, preserving its pod/IP."""
import json,time
from xolotl_serving_common import BASE,observe,owned
ip=BASE/'xolotl-stable-4k-drain-v1.json'
if ip.exists():raise RuntimeError('stable 4K drain intent exists; inspect its receipt')
o=observe();r=json.loads((BASE/'xolotl-stable-service-v2-intent.json').read_text())
if o['job_uid']!=r['allocation_uid'] or o['phase']!='Running':raise RuntimeError('exact stable allocation changed')
q=json.loads((BASE/'xolotl-longctx-request-v1-intent.json').read_text())
code='''import json,os,signal,time
from pathlib import Path
r=@R@;q=@Q@;root=Path(r['root'])
qualification=json.loads((Path(q['root'])/'request-result.json').read_text())
if qualification['phase']!='passed' or qualification['prompt_tokens_verified']<35700 or qualification['usage']['prompt_tokens']!=35700 or qualification['context_tokens']!=131072:raise RuntimeError('actual long-context request qualification is missing')
state=json.loads((root/'service-v2-result.json').read_text());p=json.loads((root/'service-v2-process.json').read_text())
if state['phase']!='serving' or state['gpu_uuid']!=r['gpu_uuid'] or p!=r['process']:raise RuntimeError('stable service receipt/process identity changed')
stat=Path('/proc/'+str(p['pid'])+'/stat')
if stat.stat().st_uid!=10250 or int(stat.read_text().split(') ',1)[1].split()[19])!=p['start_ticks']:raise RuntimeError('exact stable supervisor lifetime changed')
os.kill(p['pid'],signal.SIGTERM)
print(json.dumps(dict(unix=time.time(),signal='SIGTERM',exact_supervisor=p,old_pod_retained=True,old_pod_ip=r['pod_ip'],reason='qualified131072contextreplaces4096')))
'''.replace('@R@',repr(r)).replace('@Q@',repr(q))
compile(code,'exact-four-k-context-drain','exec');rec=dict(phase='drain_requested',unix=time.time(),old_intent='xolotl-stable-service-v2-intent.json');ip.write_text(json.dumps(rec,indent=2)+'\n');rec['signal']=owned(code);ip.write_text(json.dumps(rec,indent=2)+'\n');print(json.dumps(rec,indent=2))
