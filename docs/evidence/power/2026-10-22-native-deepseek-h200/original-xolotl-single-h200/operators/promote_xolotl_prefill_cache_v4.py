"""Switch the owned server VIP to validated cache settings; preserve the independent tool-call defect as unresolved."""
import ast,hashlib,json,time,urllib.request
from pathlib import Path
from xolotl_longctx_common import BASE,jump,observe
ip=BASE/'xolotl-prefill-cache-v4-promotion.json'
if ip.exists():raise RuntimeError('V4 promotion intent exists; inspect it')
r=json.loads((BASE/'xolotl-prefill-shadow-v4-intent.json').read_text());old=json.loads((BASE/'xolotl-stable-service-v3-intent.json').read_text());ingress=json.loads((BASE/'xolotl-server-loadbalancer-v2-intent.json').read_text());qual=json.loads((BASE/'xolotl-prefill-cache-qualification-v4-latest.json').read_text());q=json.loads(qual['request-result.json']);o=observe()
if o['job_uid']!=r['allocation_uid'] or o['phase']!='Running' or len(q['tests'])!=4:raise RuntimeError('exact live shadow/qualification differs')
cold,side,warm,tool=q['tests']
if [x['name'] for x in q['tests'][:3]]!=['cold35700','interleaved-short','restored35700'] or any(x['status']!=200 or not x['done'] or x['content']!='42' for x in q['tests'][:3]) or warm['usage']['prompt_tokens_details']['cached_tokens']!=35700 or warm['seconds']>2:raise RuntimeError('bounded cache adoption controls failed')
if q['phase']!='failed' or q['error']!='RuntimeError: native tool-call parse/arguments failed':raise RuntimeError('known independent tool-call defect scope changed')
rec=dict(unix=time.time(),phase='prepared',base_url='http://10.102.93.68/v1',old_allocation_uid=old['allocation_uid'],new_allocation_uid=r['allocation_uid'],adopted_scope='8192-token prefill batches and8192MiB RAM conversation cache only; same e9433050 executable, weights, context and credentials',tool_call_end_to_end_passed=False,workbuddy_gui_end_to_end_passed=False,public_cache_controls=q['tests'][:3],known_tool_defect=q['error'],lease_ends_unix=r['plan']['lease_ends_unix']);ip.write_text(json.dumps(rec,indent=2)+'\n')
# Prevent trial helpers from computing on the newly promoted serving GPU.
reservation=json.loads((BASE/'xolotl-active-serving-reservation.json').read_text());(BASE/'xolotl-pre-v4-serving-reservation.frozen.json').write_text(json.dumps(reservation,indent=2)+'\n')
(BASE/'xolotl-active-serving-reservation.json').write_text(json.dumps(dict(schema='aster-serving-reservation-v1',unix=time.time(),allocation_uid=r['allocation_uid'],gpu_uuid=r['gpu_uuid'],purpose='active131072context server with bounded RAM KV pool; optimization prohibited',old_serving_allocation_to_drain=old['allocation_uid']),indent=2)+'\n')
code='''import json,shlex,subprocess,time
from pathlib import Path
r=@R@;old=@OLD@;expected=@INGRESS@
def cli(args,data=None):return subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(['brainctl']+args)],input=data,capture_output=True,text=True,timeout=20)
for kind,name,uid in [('rjob',r['allocation_job'],r['allocation_uid']),('replica',r['replica'],r['replica_uid'])]:
 p=cli(['get',kind,name,'-n','ailab-hrprdduanyan','-o','json']);p.check_returncode();j=json.loads(p.stdout)
 if j['metadata']['uid']!=uid or j['status']['phase']!='Running':raise RuntimeError('fresh target allocation identity differs')
state=json.loads((Path(r['root'])/'service-longctx-v1-result.json').read_text())
if state['phase']!='serving' or state['context_tokens']!=131072 or state['binary_sha256']!=r['plan']['binary_sha256']:raise RuntimeError('new target is not ready')
p=cli(['get','service',expected['metadata']['name'],'-n','ailab-hrprdduanyan','-o','json']);p.check_returncode();before=json.loads(p.stdout)
if before['metadata']['uid']!=expected['metadata']['uid'] or before['spec']['selector']!={'rjob.brainpp.cn/rjob-name':old['allocation_job']} or before['status']['loadBalancer']['ingress']!=[dict(ip='10.102.93.68')]:raise RuntimeError('original exact VIP backend changed')
after=json.loads(json.dumps(before));after.pop('status',None);after['metadata'].pop('managedFields',None)
after['metadata']['annotations']['aster.serving/allocation-uid']=r['allocation_uid'];after['metadata']['annotations']['aster.serving/lease-ends-unix']=str(r['plan']['lease_ends_unix'])
after['metadata']['ownerReferences']=[dict(apiVersion='rjob.brainpp.cn/v1alpha1',kind='RJob',name=r['allocation_job'],uid=r['allocation_uid'],controller=False,blockOwnerDeletion=False)]
after['spec']['selector']={'rjob.brainpp.cn/rjob-name':r['allocation_job']}
p=cli(['apply','-f','-','-o','json'],json.dumps(after));p.check_returncode();result=json.loads(p.stdout)
if result['metadata']['uid']!=before['metadata']['uid'] or result['spec']['clusterIP']!=before['spec']['clusterIP'] or result['spec']['selector']!=after['spec']['selector']:raise RuntimeError('VIP promotion result differs')
print(json.dumps(dict(unix=time.time(),before=before,after=result,resource_version_precondition=before['metadata']['resourceVersion'])))
'''.replace('@R@',repr(r)).replace('@OLD@',repr(old)).replace('@INGRESS@',repr(ingress['created']['service']))
compile(code,'owned-VIP-cache-promotion','exec');rec['phase']='switch_requested';ip.write_text(json.dumps(rec,indent=2)+'\n');rec['switch']=jump(code,95);rec['phase']='switched';ip.write_text(json.dumps(rec,indent=2)+'\n')
# Freeze the old transport before changing the current serving pin.
source=(BASE/'xolotl_serving_common.py').read_text();frozen=source.replace('xolotl-serving-resource-latest.json','xolotl-original-serving-resource-v3-latest.json');ast.parse(frozen);(BASE/'xolotl_serving_original_common_v3.py').write_text(frozen)
(BASE/'xolotl-original-serving-resource-v3-latest.json').write_bytes((BASE/'xolotl-serving-resource-latest.json').read_bytes())
current=json.loads((BASE/'xolotl-single500-cont5-lease-pending.json').read_text());(BASE/'xolotl-current-serving-lease.json').write_text(json.dumps(current,indent=2)+'\n')
anchor="current=json.loads((BASE/'xolotl-single-serving-lease-pending.json').read_text())"
if source.count(anchor)!=1:raise RuntimeError('current serving lease pin anchor differs')
source=source.replace(anchor,"current=json.loads((BASE/'xolotl-current-serving-lease.json').read_text())");ast.parse(source);(BASE/'xolotl_serving_common.py').write_text(source)
r.update(promoted=True,promotion=ip.name,phase='serving',workbuddy_end_to_end_passed=False,tool_call_end_to_end_passed=False);(BASE/'xolotl-stable-service-v4-intent.json').write_text(json.dumps(r,indent=2)+'\n')
key=Path(r['credential_file']).read_text().strip();opener=urllib.request.build_opener(urllib.request.ProxyHandler({}));req=urllib.request.Request('http://10.102.93.68/health',headers={'Authorization':'Bearer '+key})
with opener.open(req,timeout=8) as response:health=json.load(response);status=response.status
if status!=200 or health['max_context']!=131072 or not health['loaded']:raise RuntimeError('promoted API health failed')
rec.update(phase='promoted_cache_settings_only',windows_direct_health=dict(status=status,body=health),finished_unix=time.time());ip.write_text(json.dumps(rec,indent=2)+'\n')
print(json.dumps(dict(phase=rec['phase'],base_url=rec['base_url'],context_tokens=131072,serving_gpu=r['gpu_uuid'],windows_direct_health_status=status,cached35700_ttft_seconds=warm['time_to_first_output_seconds'],tool_defect_still_open=True,old_card_pending_drain=True)))
