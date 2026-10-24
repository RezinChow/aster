"""Verify the existing switch after endpoint propagation; never repeat the VIP mutation."""
import json
import time
import urllib.request
from pathlib import Path

from xolotl_serving_common import BASE, jump, observe

p = BASE / 'xolotl-context-1m-v8-promotion.json'
r = json.loads((BASE / 'xolotl-stable-service-v8-intent.json').read_text())
record = json.loads(p.read_text())
if record['phase'] != 'switched' or record['new_allocation_uid'] != r['allocation_uid']:
    raise RuntimeError('only the already-switched exact 1M intent can be finalized')
with (BASE / 'xolotl-context-1m-v8-promotion.first-attempt.frozen.json').open('xb') as output:
    output.write(p.read_bytes())
observation = observe()
if observation['job_uid'] != r['allocation_uid'] or observation['phase'] != 'Running':
    raise RuntimeError('current serving role differs from the already-switched target')
code = '''import json,shlex,subprocess
r=@R@
args=['brainctl','get','service','aster-xolotl-api-v3pool-20261024','-n','ailab-hrprdduanyan','-o','json']
p=subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(args)],capture_output=True,text=True,timeout=20)
if p.returncode:raise RuntimeError('fresh VIP observation failed')
s=json.loads(p.stdout)
if s['metadata']['uid']!='1f968a8d-4ddc-4cee-b32a-390cd44210c7' or s['spec']['selector']!={'rjob.brainpp.cn/rjob-name':r['allocation_job']} or s['metadata']['annotations']['aster.serving/allocation-uid']!=r['allocation_uid']:raise RuntimeError('already-switched VIP identity/target differs')
print(json.dumps(dict(uid=s['metadata']['uid'],resource_version=s['metadata']['resourceVersion'],selector=s['spec']['selector'],load_balancer=s['status']['loadBalancer'])))
'''.replace('@R@', repr(r))
record['post_switch_service_observation'] = jump(code)
key = Path(r['credential_file']).read_text().strip()
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
request = urllib.request.Request('http://10.102.93.68/health', headers={'Authorization': 'Bearer ' + key, 'Connection': 'close'})
with opener.open(request, timeout=10) as response:
    health = json.load(response)
    status = response.status
if status != 200 or not health.get('loaded') or health.get('max_context') != 1048576:
    raise RuntimeError('1M health is still not externally ready; preserve switch for inspection')
payload = dict(model=r['plan']['model_name'], messages=[dict(role='user', content='Calculate 17 + 25. Reply with only the integer answer.')],
               max_tokens=16, temperature=0, reasoning_effort='none', stream=False)
request = urllib.request.Request('http://10.102.93.68/v1/chat/completions', data=json.dumps(payload).encode(),
                                 headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Connection': 'close'})
started = time.monotonic()
with opener.open(request, timeout=30) as response:
    generated = json.load(response)
if generated['choices'][0]['message']['content'].strip() != '42':
    raise RuntimeError('direct Windows1M actual generation failed')
record.update(phase='promoted', finished_unix=time.time(),
              initial_post_switch_health_gate_failed=True,
              no_repeated_service_mutation=True,
              windows_direct_health=dict(status=status, max_context=health['max_context'], loaded=True),
              windows_direct_generation=dict(content='42', usage=generated['usage'], seconds=time.monotonic()-started),
              old_card_pending_idle_drain=True)
p.write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(dict(phase='promoted', context_tokens=1048576, base_url='http://10.102.93.68/v1',
                      windows_direct_generation=record['windows_direct_generation'],
                      same_existing_key=True, full_1m_length_qualified=False)))
