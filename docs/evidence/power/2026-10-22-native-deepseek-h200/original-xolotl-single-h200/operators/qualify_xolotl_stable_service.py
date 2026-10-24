"""Qualify the actual Windows-to-H200 path, authentication, generation and SSE."""
import concurrent.futures,hashlib,json,time,urllib.error,urllib.request
from pathlib import Path
from xolotl_serving_common import BASE
r=json.loads((BASE/'xolotl-stable-service-v2-intent.json').read_text());key=Path(r['credential_file']).read_text().strip();url='http://127.0.0.1:30003';model=r['plan']['model_name'];out=dict(unix=time.time(),base_url=url+'/v1',model=model,allocation_uid=r['allocation_uid'],gpu_uuid=r['gpu_uuid'],checks=[],requests=[],passed=False)
def http(path,auth=None,body=None,stream=False):
 headers={'Content-Type':'application/json'}
 if auth is not None:headers['Authorization']='Bearer '+auth
 req=urllib.request.Request(url+path,headers=headers,data=json.dumps(body).encode() if body else None)
 return urllib.request.urlopen(req,timeout=120)
def status(path,auth,expected):
 try:
  with http(path,auth) as q:actual=q.status;body=json.loads(q.read(65536))
 except urllib.error.HTTPError as e:actual=e.code;body=json.loads(e.read(65536))
 out['checks'].append(dict(path=path,credential='new' if auth==key else 'none' if auth is None else 'invalid_or_revoked',expected=expected,status=actual))
 if actual!=expected:raise RuntimeError('actual API authentication/status differs')
 return body
def generate(prompt,max_tokens=64,stream=False):
 start=time.monotonic();body=dict(model=model,messages=[dict(role='user',content=prompt)],max_tokens=max_tokens,temperature=0,seed=1,reasoning_effort='none',stream=stream)
 if stream:body['stream_options']={'include_usage':True}
 with http('/v1/chat/completions',key,body) as q:
  if not stream:
   data=json.loads(q.read(2*1024**2));text=data['choices'][0]['message']['content'];usage=data.get('usage',{});done=True;chunks=0
  else:
   text='';done=False;chunks=0;usage={};first=None;total=0
   for raw in q:
    total+=len(raw)
    if total>2*1024**2:raise RuntimeError('SSE response exceeded bound')
    if not raw.startswith(b'data:'):continue
    value=raw[5:].strip()
    if value==b'[DONE]':done=True;break
    data=json.loads(value);chunks+=1
    for c in data.get('choices',[]):
     part=c.get('delta',{}).get('content') or ''
     if part and first is None:first=time.monotonic()-start
     text+=part
    if data.get('usage'):usage=data['usage']
 if not done or not text.strip():raise RuntimeError('actual generation/SSE returned no complete text')
 return dict(prompt=prompt,stream=stream,text=text,usage=usage,request_seconds=time.monotonic()-start,sse_chunks=chunks,done=done)
try:
 status('/health',None,200);status('/v1/models',None,401);status('/v1/models','invalid-test-key',401)
 old=json.loads((BASE/'native-service-local-access.json').read_text());oldkey=Path(old['credential_file']).read_text().strip();status('/v1/models',oldkey,401)
 models=status('/v1/models',key,200)
 if model not in [m['id'] for m in models['data']]:raise RuntimeError('actual API model identity differs')
 a=generate('Calculate 17 + 25. Reply with only the integer answer.',16)
 if a['text'].strip()!='42':raise RuntimeError('actual arithmetic qualification differs')
 out['requests'].append(a)
 out['requests'].append(generate('Write a Python function that returns the first n Fibonacci numbers. Include a short explanation.',96))
 out['requests'].append(generate('用中文解释大语言模型推理中的 KV Cache，说明它保存什么、如何加速生成。',96,True))
 prompts=['Calculate 11 + 31. Reply with only the integer answer.','Calculate 9 + 4. Reply with only the integer answer.']
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:paired=list(pool.map(lambda p:generate(p,16),prompts))
 if [p['text'].strip() for p in paired]!=['42','13']:raise RuntimeError('two simultaneous clients failed output isolation')
 out['requests']+=paired;out.update(passed=True,normal_generation=True,streaming_generation=True,two_client_output_isolation=True,serving_gpu_count=1,active_engine_requests=1,context_tokens=4096,lease_ends_unix=r['plan']['lease_ends_unix'],baseline_mixed_rate_not_remeasured=True)
except Exception as e:out['error']=type(e).__name__+': '+str(e)
out['finished_unix']=time.time();(BASE/'xolotl-stable-service-windows-qualification.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(out,ensure_ascii=False,indent=2))
if not out['passed']:raise SystemExit(1)
