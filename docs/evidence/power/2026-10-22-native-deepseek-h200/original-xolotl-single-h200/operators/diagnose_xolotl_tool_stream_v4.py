"""Read public arithmetic tool-call events to distinguish parser defects from client assembly errors."""
import json
from xolotl_longctx_common import BASE,jump
r=json.loads((BASE/'xolotl-prefill-shadow-v4-intent.json').read_text())
code='''import json,urllib.request,time
from pathlib import Path
r=@R@;key=(Path(r['root'])/'credentials/api-key.txt').read_text().strip();url='http://'+r['pod_ip']+':30003/v1/chat/completions'
body=dict(model=r['plan']['model_name'],messages=[dict(role='user',content='Call add_numbers with a=17 and b=25. Do not calculate it yourself.')],max_tokens=128,temperature=0,seed=1,reasoning_effort='none',tools=[dict(type='function',function=dict(name='add_numbers',description='Add two integers.',parameters=dict(type='object',properties=dict(a=dict(type='integer'),b=dict(type='integer')),required=['a','b'])))],tool_choice=dict(type='function',function=dict(name='add_numbers')))
out=[]
for stream in [True,False]:
 body['stream']=stream;req=urllib.request.Request(url,data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'});events=[];t=time.time()
 with urllib.request.urlopen(req,timeout=25) as response:
  if stream:
   for line in response:
    if line.startswith(b'data:'):
     raw=line[5:].strip();events.append('[DONE]' if raw==b'[DONE]' else json.loads(raw))
     if len(events)>64:raise RuntimeError('public tool diagnostic event bound exceeded')
  else:events=json.load(response)
 out.append(dict(stream=stream,seconds=time.time()-t,events=events))
print(json.dumps(out))
'''.replace('@R@',repr(r))
compile(code,'public-native-tool-stream-diagnostic','exec');o=jump(code,80);(BASE/'xolotl-native-tool-stream-v4-diagnostic.json').write_text(json.dumps(o,indent=2)+'\n');print(json.dumps(o,indent=2))
