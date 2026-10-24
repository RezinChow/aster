"""Promote a real over-128K-qualified 1M profile; retain honest full-length/tool limits."""
import ast
import json
import time
import urllib.request
from pathlib import Path

from xolotl_trial_common import BASE, jump, observe

receipt_path = BASE / 'xolotl-context-1m-v8-promotion.json'
if receipt_path.exists():
    raise RuntimeError('observe existing 1M promotion instead of repeating it')
target = json.loads((BASE / 'xolotl-context-1m-v8-intent.json').read_text())
old = json.loads((BASE / 'xolotl-stable-service-v4-intent.json').read_text())
qualified = json.loads((BASE / 'xolotl-context-1m-over128k-v8-latest.json').read_text())['result']
observation = observe()
if (observation['job_uid'] != target['allocation_uid']
        or observation['phase'] != 'Running'
        or qualified['phase'] != 'passed'
        or qualified['prompt_tokens_verified'] != 131073
        or qualified['usage']['prompt_tokens'] != 131073
        or qualified['content'].strip() != '42'
        or not qualified['done']
        or not qualified['short_control']['passed']
        or qualified['health']['max_context'] != 1048576
        or target['plan']['engine_env'].get('STRATA_SERVE_BATCH_TAIL') != '0'):
    raise RuntimeError('exact live 1M and beyond-128K generation gates did not pass')

# Pin the old transport before the mutable serving-role alias moves.
source = (BASE / 'xolotl_serving_common.py').read_text()
if source.count('xolotl-current-serving-lease.json') != 1:
    raise RuntimeError('current serving transport alias differs')
frozen = source.replace('xolotl-current-serving-lease.json', 'xolotl-single500-cont5-lease-pending.json')
frozen = frozen.replace('xolotl-serving-resource-latest.json', 'xolotl-v4-serving-frozen-resource-v8.json')
ast.parse(frozen)
with (BASE / 'xolotl_serving_cont5_frozen_v8.py').open('x', encoding='utf-8') as output:
    output.write(frozen)

record = dict(unix=time.time(), phase='prepared', base_url='http://10.102.93.68/v1',
              old_allocation_uid=old['allocation_uid'], new_allocation_uid=target['allocation_uid'],
              context_tokens=1048576, actual_prompt_tokens_qualified=131073,
              full_1m_length_qualified=False, tool_call_end_to_end_passed=False,
              workbuddy_gui_end_to_end_passed=False,
              lease_ends_unix=target['plan']['lease_ends_unix'],
              supported_profile_change=dict(STRATA_SERVE_BATCH_TAIL='0'), qualification=qualified)
receipt_path.write_text(json.dumps(record, indent=2) + '\n')
reservation = BASE / 'xolotl-active-serving-reservation.json'
with (BASE / 'xolotl-pre-1m-serving-reservation.frozen.json').open('xb') as output:
    output.write(reservation.read_bytes())
reservation.write_text(json.dumps(dict(
    schema='aster-serving-reservation-v1', unix=time.time(),
    allocation_uid=target['allocation_uid'], gpu_uuid=target['gpu_uuid'],
    purpose='public1M-context server; optimization prohibited',
    old_serving_allocation_to_drain=old['allocation_uid']), indent=2) + '\n')

code = '''import json,shlex,subprocess,time
from pathlib import Path
r=@TARGET@;old=@OLD@
def cli(args,data=None):
 p=subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(['brainctl']+args)],input=data,capture_output=True,text=True,timeout=20)
 if p.returncode:raise RuntimeError('VIP CLI failed: '+p.stderr[-1500:])
 if len(p.stdout)>1048576:raise RuntimeError('VIP result bound exceeded')
 return json.loads(p.stdout)
for kind,name,uid in [('rjob',r['allocation_job'],r['allocation_uid']),('replica',r['replica'],r['replica_uid'])]:
 j=cli(['get',kind,name,'-n','ailab-hrprdduanyan','-o','json'])
 if j['metadata']['uid']!=uid or j['status']['phase']!='Running':raise RuntimeError('fresh1M target identity differs')
state=json.loads((Path(r['root'])/'service-longctx-v1-result.json').read_text())
if state['phase']!='serving' or state['context_tokens']!=1048576 or state['binary_sha256']!=r['plan']['binary_sha256']:raise RuntimeError('1M target not ready')
before=cli(['get','service','aster-xolotl-api-v3pool-20261024','-n','ailab-hrprdduanyan','-o','json'])
if before['metadata']['uid']!='1f968a8d-4ddc-4cee-b32a-390cd44210c7' or before['spec']['selector']!={'rjob.brainpp.cn/rjob-name':old['allocation_job']} or before['metadata']['annotations']['aster.serving/allocation-uid']!=old['allocation_uid'] or before['status']['loadBalancer']['ingress']!=[dict(ip='10.102.93.68')]:raise RuntimeError('exact existing VIP backend/owner changed')
after=json.loads(json.dumps(before));after.pop('status',None);after['metadata'].pop('managedFields',None)
after['metadata']['annotations']['aster.serving/allocation-uid']=r['allocation_uid']
after['metadata']['annotations']['aster.serving/lease-ends-unix']=str(r['plan']['lease_ends_unix'])
after['metadata']['ownerReferences']=[dict(apiVersion='rjob.brainpp.cn/v1alpha1',kind='RJob',name=r['allocation_job'],uid=r['allocation_uid'],controller=False,blockOwnerDeletion=False)]
after['spec']['selector']={'rjob.brainpp.cn/rjob-name':r['allocation_job']}
result=cli(['apply','-f','-','-o','json'],json.dumps(after))
if result['metadata']['uid']!=before['metadata']['uid'] or result['spec']['clusterIP']!=before['spec']['clusterIP'] or result['spec']['selector']!=after['spec']['selector']:raise RuntimeError('1M switch result differs')
print(json.dumps(dict(unix=time.time(),before=before,after=result,resource_version_precondition=before['metadata']['resourceVersion'])))
'''.replace('@TARGET@', repr(target)).replace('@OLD@', repr(old))
compile(code, 'exact-owned-1M-VIP-promotion', 'exec')
record['phase'] = 'switch_requested'
receipt_path.write_text(json.dumps(record, indent=2) + '\n')
record['switch'] = jump(code, 55)
record['phase'] = 'switched'
receipt_path.write_text(json.dumps(record, indent=2) + '\n')

current_lease = json.loads((BASE / 'xolotl-single-serving-lease-pending.json').read_text())
if current_lease['submitted']['uid'] != target['allocation_uid']:
    raise RuntimeError('new explicit serving lease differs')
(BASE / 'xolotl-current-serving-lease.json').write_text(json.dumps(current_lease, indent=2) + '\n')
target.update(phase='serving', promoted=True, promotion=receipt_path.name,
              actual_prompt_tokens_qualified=131073, full_1m_length_qualified=False,
              workbuddy_end_to_end_passed=False, tool_call_end_to_end_passed=False)
(BASE / 'xolotl-stable-service-v8-intent.json').write_text(json.dumps(target, indent=2) + '\n')

key = Path(target['credential_file']).read_text().strip()
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
request = urllib.request.Request('http://10.102.93.68/health', headers={'Authorization': 'Bearer ' + key})
with opener.open(request, timeout=10) as response:
    health = json.load(response)
    status = response.status
if status != 200 or not health.get('loaded') or health.get('max_context') != 1048576:
    raise RuntimeError('direct Windows1M health gate failed')
payload = dict(model=target['plan']['model_name'], messages=[dict(role='user', content='Calculate 17 + 25. Reply with only the integer answer.')],
               max_tokens=16, temperature=0, reasoning_effort='none', stream=False)
request = urllib.request.Request('http://10.102.93.68/v1/chat/completions', data=json.dumps(payload).encode(),
                                 headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
started = time.monotonic()
with opener.open(request, timeout=30) as response:
    generated = json.load(response)
if generated['choices'][0]['message']['content'].strip() != '42':
    raise RuntimeError('direct Windows1M actual generation failed')
record.update(phase='promoted', finished_unix=time.time(),
              windows_direct_health=dict(status=status, max_context=health['max_context'], loaded=True),
              windows_direct_generation=dict(content='42', usage=generated['usage'], seconds=time.monotonic()-started),
              old_card_pending_idle_drain=True)
receipt_path.write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(dict(phase='promoted', base_url=record['base_url'], context_tokens=1048576,
                      actual_prompt_tokens_qualified=131073, full_1m_length_qualified=False,
                      serving_gpu=target['gpu_uuid'], same_existing_key=True)))
