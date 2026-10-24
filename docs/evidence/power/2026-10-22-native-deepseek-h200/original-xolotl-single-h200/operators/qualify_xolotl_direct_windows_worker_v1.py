"""Actual Windows-to-server generation qualification; this program never listens or forwards traffic."""
import hashlib,json,time,urllib.error,urllib.request
from pathlib import Path
BASE=Path(__file__).resolve().parent
PLAN=json.loads((BASE/'xolotl-direct-windows-qualification-v1-plan.json').read_text())
OUT=BASE/'xolotl-direct-windows-qualification-v1-result.json'
STATE=dict(schema='aster-direct-windows-api-qualification-v1',phase='starting',unix=time.time(),base_url=PLAN['base_url'],local_forwarding=False,tests=[])
def save():
 p=OUT.with_suffix('.tmp');p.write_text(json.dumps(STATE,ensure_ascii=False,indent=2)+'\n');p.replace(OUT)
def request(path,payload=None,auth=True,stream=False):
 headers={'Content-Type':'application/json'}
 if auth:headers['Authorization']='Bearer '+Path(PLAN['credential_file']).read_text().strip()
 q=urllib.request.Request(PLAN['base_url']+path,headers=headers,data=None if payload is None else json.dumps(payload).encode())
 t=time.time();opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
 with opener.open(q,timeout=600) as response:
  if not stream:return dict(status=response.status,body=json.load(response),seconds=time.time()-t)
  text='';calls=[];finish=None;usage=None;done=False;events=0;first=None
  for line in response:
   if len(line)>1048576:raise RuntimeError('direct SSE event exceeds bound')
   if not line.startswith(b'data:'):continue
   raw=line[5:].strip()
   if raw==b'[DONE]':done=True;break
   data=json.loads(raw);events+=1
   for choice in data.get('choices',[]):
    delta=choice.get('delta',{});part=delta.get('content') or '';text+=part
    if part and first is None:first=time.time()
    if delta.get('tool_calls'):calls.extend(delta['tool_calls'])
    finish=choice.get('finish_reason') or finish
   if data.get('usage'):usage=data['usage']
   if len(text)>65536:raise RuntimeError('direct SSE response exceeds bound')
   if time.time()-t>600:raise RuntimeError('direct SSE total deadline exceeded')
  return dict(status=response.status,content=text,tool_calls=calls,finish_reason=finish,usage=usage,done=done,events=events,seconds=time.time()-t,time_to_first_content_seconds=(first-t) if first else None)
try:
 save()
 for label,prompt,max_new in [('short-arithmetic','Calculate 17 + 25. Reply with only the integer answer.',16),('normal-code','Write a Python function that returns the first n Fibonacci numbers. Include a short explanation.',128)]:
  STATE.update(phase='requesting',current_test=label);save()
  payload=dict(model=PLAN['model'],messages=[dict(role='user',content=prompt)],max_tokens=max_new,temperature=0,seed=1,reasoning_effort='none',stream=True,stream_options=dict(include_usage=True))
  q=request('/chat/completions',payload,stream=True)
  if q['status']!=200 or not q['done'] or not q['finish_reason'] or (label=='short-arithmetic' and '42' not in q['content']):raise RuntimeError(label+' failed')
  STATE['tests'].append(dict(name=label,passed=True,result=q));save()
 fixture=BASE/PLAN['fixture_file'];raw=fixture.read_bytes()
 if hashlib.sha256(raw).hexdigest()!=PLAN['fixture_sha256']:raise RuntimeError('public long-context fixture SHA changed')
 STATE.update(phase='requesting',current_test='long-context35700');save()
 payload=dict(model=PLAN['model'],messages=[dict(role='user',content=raw.decode())],max_tokens=64,temperature=0,seed=1,reasoning_effort='none',stream=True,stream_options=dict(include_usage=True))
 q=request('/chat/completions',payload,stream=True)
 if q['status']!=200 or not q['done'] or q.get('usage',{}).get('prompt_tokens')!=35700 or '42' not in q['content']:raise RuntimeError('formal server actual35700-token request failed')
 STATE['tests'].append(dict(name='long-context35700',passed=True,result=q));STATE.update(phase='passed',current_test=None,finished_unix=time.time());save()
except BaseException as e:
 STATE.update(phase='failed',error=type(e).__name__+': '+str(e),finished_unix=time.time());save();raise
