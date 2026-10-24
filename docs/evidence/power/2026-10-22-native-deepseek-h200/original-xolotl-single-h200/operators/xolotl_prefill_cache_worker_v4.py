"""Public cold-prefill / interleaved KV reuse / native tool-call checks, not private Workbuddy replay."""
import hashlib,json,socket,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parent
PLAN=json.loads((ROOT/'request-plan.json').read_text())
STATE=dict(schema='aster-xolotl-prefill-cache-qualification-v4',phase='starting',unix=time.time(),source_hostname=socket.gethostname(),base_url=PLAN['base_url'],tests=[])
def save():
 p=ROOT/'request-result.tmp';p.write_text(json.dumps(STATE,ensure_ascii=False,indent=2)+'\n');p.replace(ROOT/'request-result.json')
def ask(name,payload):
 STATE.update(phase='requesting',current_test=name,request_started_unix=time.time());save()
 payload.update(model='deepseek-v4.1-flash-1017-xq',temperature=0,seed=1,reasoning_effort='none',stream=True,stream_options=dict(include_usage=True))
 key=(Path(PLAN['service_root'])/'credentials/api-key.txt').read_text().strip()
 req=urllib.request.Request(PLAN['base_url']+'/chat/completions',data=json.dumps(payload).encode(),headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
 t=time.time();text='';calls={};usage=None;finish=None;done=False;first=None
 with urllib.request.urlopen(req,timeout=600) as response:
  status=response.status
  for line in response:
   if len(line)>1048576:raise RuntimeError('SSE response line exceeds bound')
   if not line.startswith(b'data:'):continue
   raw=line[5:].strip()
   if raw==b'[DONE]':done=True;break
   data=json.loads(raw)
   for c in data.get('choices',[]):
    d=c.get('delta',{});part=d.get('content') or '';text+=part
    if (part or d.get('tool_calls')) and first is None:first=time.time()
    for call in d.get('tool_calls',[]):
     x=calls.setdefault(call.get('index',0),dict(name='',arguments=''))
     f=call.get('function',{});x['name']+=f.get('name') or '';x['arguments']+=f.get('arguments') or ''
    finish=c.get('finish_reason') or finish
   if data.get('usage'):usage=data['usage']
   if len(text)>65536 or time.time()-t>600:raise RuntimeError('bounded public qualification response exceeded')
 q=dict(name=name,status=status,done=done,finish_reason=finish,content=text,tool_calls=list(calls.values()),usage=usage,seconds=time.time()-t,time_to_first_output_seconds=first-t if first else None)
 STATE['tests'].append(q);save()
 if status!=200 or not done or not finish:raise RuntimeError(name+' did not finish')
 return q
try:
 save();raw=Path(PLAN['public_fixture']).read_bytes()
 if hashlib.sha256(raw).hexdigest()!=PLAN['fixture_sha256']:raise RuntimeError('public35700-token fixture changed')
 payload=dict(messages=[dict(role='user',content=raw.decode())],max_tokens=64)
 cold=ask('cold35700',dict(payload))
 if cold.get('usage',{}).get('prompt_tokens')!=35700 or '42' not in cold['content']:raise RuntimeError('cold long-context token accounting/output failed')
 side=ask('interleaved-short',dict(messages=[dict(role='user',content='Calculate 17 + 25. Reply with only the integer answer.')],max_tokens=16))
 if '42' not in side['content']:raise RuntimeError('side request output failed')
 warm=ask('restored35700',dict(payload))
 if warm.get('usage',{}).get('prompt_tokens')!=35700 or '42' not in warm['content']:raise RuntimeError('restored long-context token accounting/output failed')
 if warm.get('usage',{}).get('prompt_tokens_details',{}).get('cached_tokens',0)<35000:raise RuntimeError('actual API did not account for long-context prefix reuse')
 tool=ask('forced-native-tool-call',dict(messages=[dict(role='user',content='Call add_numbers with a=17 and b=25. Do not calculate it yourself.')],max_tokens=128,tools=[dict(type='function',function=dict(name='add_numbers',description='Add two integers.',parameters=dict(type='object',properties=dict(a=dict(type='integer'),b=dict(type='integer')),required=['a','b'])))],tool_choice=dict(type='function',function=dict(name='add_numbers'))))
 if tool['finish_reason']!='tool_calls' or len(tool['tool_calls'])!=1 or tool['tool_calls'][0]['name']!='add_numbers' or json.loads(tool['tool_calls'][0]['arguments'])!={'a':17,'b':25}:raise RuntimeError('native tool-call parse/arguments failed')
 STATE.update(phase='passed',current_test=None,cold35700_ttft_seconds=cold['time_to_first_output_seconds'],restored35700_ttft_seconds=warm['time_to_first_output_seconds'],finished_unix=time.time());save()
except BaseException as e:
 STATE.update(phase='failed',error=type(e).__name__+': '+str(e),finished_unix=time.time());save();raise
