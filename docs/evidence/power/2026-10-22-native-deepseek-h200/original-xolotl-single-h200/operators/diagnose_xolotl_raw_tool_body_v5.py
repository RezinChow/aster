"""Use standard stop-before-close semantics to expose only the public incomplete native tool body."""
import json
from xolotl_trial_common import BASE,jump
r=json.loads((BASE/'xolotl-prefill-shadow-v5-intent.json').read_text())
code='''import json,urllib.request,time
from pathlib import Path
r=@R@;state=json.loads((Path(r['root'])/'service-longctx-v1-result.json').read_text())
if state['phase']!='serving':raise RuntimeError('V5 public-only shadow service is not ready yet')
key=(Path(r['root'])/'credentials/api-key.txt').read_text().strip()
body=dict(model=r['plan']['model_name'],messages=[dict(role='user',content='Call add_numbers with a=17 and b=25. Do not calculate it yourself.')],max_tokens=128,temperature=0,seed=1,reasoning_effort='none',tools=[dict(type='function',function=dict(name='add_numbers',description='Add two integers.',parameters=dict(type='object',properties=dict(a=dict(type='integer'),b=dict(type='integer')),required=['a','b'])))],tool_choice=dict(type='function',function=dict(name='add_numbers')),stop=['</｜DSML｜ invoke>'])
request=urllib.request.Request('http://'+r['pod_ip']+':30003/v1/chat/completions',data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'});t=time.time()
with urllib.request.urlopen(request,timeout=30) as response:out=json.load(response)
print(json.dumps(dict(unix=time.time(),seconds=time.time()-t,response=out)))
'''.replace('@R@',repr(r))
compile(code,'public-stop-before-native-tool-close','exec');o=jump(code,65);(BASE/'xolotl-raw-tool-body-v5-diagnostic.json').write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n');print(json.dumps(o,ensure_ascii=False,indent=2))
