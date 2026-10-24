"""Short actual API load test: fixed prompt mix, serial GPU engine, 1/2/4/8 clients."""
import concurrent.futures,json,math,statistics,threading,time,urllib.request
from pathlib import Path
from xolotl_serving_common import BASE
r=json.loads((BASE/'xolotl-stable-service-v8-intent.json').read_text());key=Path(r['credential_file']).read_text().strip();url='http://10.102.93.68/v1/chat/completions';model=r['plan']['model_name'];cases=[c for c in json.loads((BASE/'xolotl-trial-prompt-ids.json').read_text())['cases'] if c['name']!='arithmetic']
out=dict(schema='aster-xolotl-server-v8-1m-single-load-v1',unix=time.time(),phase='running',scope='Windows direct, proxies disabled -> server LoadBalancer VIP -> current V8 single H200; upstream STRATA_SERVE_BATCH_TAIL0; context1048576; prefill batch8192; RAM conversation cache8192MiB/8 slots; one model request at a time; OpenAI SSE; 4 fixed public synthetic prompts; 16 requests per concurrency level; temperature0; prefix reuse is reported; no completion cache',base_url='http://10.102.93.68/v1',model=model,allocation_uid=r['allocation_uid'],gpu_uuid=r['gpu_uuid'],concurrency_levels=[1],requests_per_level=16,warmups=[],levels=[],passed=False,soak_test_claimed=False,target300_claimed=False)
path=BASE/'xolotl-server-v8-1m-windows-single-loadtest.json';lock=threading.Lock();deadline=time.monotonic()+420
if path.exists():raise RuntimeError('load-test record exists; do not replace observations')
def save():
 p=path.with_suffix('.tmp');p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');p.replace(path)
def percentile(values,fraction):
 a=sorted(values);x=(len(a)-1)*fraction;lo=int(x);hi=min(lo+1,len(a)-1);return a[lo]+(a[hi]-a[lo])*(x-lo)
def request(case,index):
 start=time.monotonic();row=dict(index=index,case=case['name'],max_tokens=case['max_new_tokens'],success=False)
 try:
  if start>deadline:raise TimeoutError('bounded load-test deadline reached')
  payload=dict(model=model,messages=[dict(role='user',content=case['prompt'])],temperature=0,seed=1,reasoning_effort='none',max_tokens=case['max_new_tokens'],stream=True,stream_options=dict(include_usage=True))
  req=urllib.request.Request(url,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+key})
  text='';usage=None;done=False;first=None;last=None;chunks=0;total=0;finish=None
  with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req,timeout=90) as response:
   row['status']=response.status
   for raw in response:
    total+=len(raw)
    if total>2*1024**2:raise RuntimeError('bounded load-test response exceeded')
    if not raw.startswith(b'data:'):continue
    value=raw[5:].strip()
    if value==b'[DONE]':done=True;break
    obj=json.loads(value);chunks+=1
    if obj.get('usage'):usage=obj['usage']
    for choice in obj.get('choices',[]):
     content=choice.get('delta',{}).get('content') or ''
     if content:
      now=time.monotonic();first=now if first is None else first;last=now;text+=content
     if choice.get('finish_reason'):finish=choice['finish_reason']
  end=time.monotonic()
  if row['status']!=200 or not done or not text.strip() or usage is None or not usage.get('completion_tokens') or first is None:raise RuntimeError('invalid or incomplete actual API generation')
  row.update(success=True,request_seconds=end-start,ttft_seconds=first-start,first_to_last_text_seconds=last-first,completion_tokens=usage['completion_tokens'],prompt_tokens=usage['prompt_tokens'],cached_prompt_tokens=(usage.get('prompt_tokens_details') or {}).get('cached_tokens',0),end_to_end_completion_tok_s=usage['completion_tokens']/(end-start),sse_chunks=chunks,finish_reason=finish,output_characters=len(text))
 except Exception as e:row.update(error=type(e).__name__+': '+str(e),request_seconds=time.monotonic()-start)
 return row
try:
 save()
 out['runtime']=dict(context_tokens=r['plan']['context_tokens'],prefill_batch_tokens=r['plan']['prefill_batch_tokens'],conversation_cache_mib=r['plan']['conversation_cache_mib'],conversation_cache_slots=r['plan']['conversation_cache_slots'],binary_sha256=r['plan']['binary_sha256'],source_intent='xolotl-stable-service-v8-intent.json',tool_call_test_claimed=False,workbuddy_test_claimed=False)
 healthreq=urllib.request.Request('http://10.102.93.68/health',headers={'Authorization':'Bearer '+key})
 with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(healthreq,timeout=10) as healthresponse:
  health=json.load(healthresponse)
  out['preflight_health']=dict(status=healthresponse.status,loaded=health.get('loaded'),max_context=health.get('max_context'))
 if not health.get('loaded') or health.get('max_context')!=1048576:raise RuntimeError('current131072 context not ready')
 save()
 for i,case in enumerate(cases):
  row=request(case,i);out['warmups'].append(row);save()
  if not row['success']:raise RuntimeError('actual API load-test warmup failed')
 for concurrency in out['concurrency_levels']:
  level=dict(concurrency=concurrency,phase='running',requests=[]);out['levels'].append(level);save();start=time.monotonic()
  with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
   futures=[pool.submit(request,cases[i%len(cases)],i) for i in range(16)]
   for future in concurrent.futures.as_completed(futures):
    level['requests'].append(future.result());save()
  elapsed=time.monotonic()-start;good=[x for x in level['requests'] if x['success']];n=sum(x['completion_tokens'] for x in good);durations=[x['request_seconds'] for x in good];ttfts=[x['ttft_seconds'] for x in good]
  level.update(phase='complete',successes=len(good),failures=16-len(good),elapsed_seconds=elapsed,completion_tokens=n,aggregate_end_to_end_completion_tok_s=n/elapsed,requests_per_second=len(good)/elapsed,request_p50_seconds=percentile(durations,.50) if good else None,request_p95_seconds=percentile(durations,.95) if good else None,ttft_p50_seconds=percentile(ttfts,.50) if good else None,ttft_p95_seconds=percentile(ttfts,.95) if good else None,cached_prompt_tokens=sum(x['cached_prompt_tokens'] for x in good));level['stream_output_interval_tok_s_estimate']=(n-len(good))/sum(x['first_to_last_text_seconds'] for x in good);level['pure_gpu_decode_claimed']=False;save()
  print(json.dumps({k:v for k,v in level.items() if k!='requests'}),flush=True)
  if level['failures']:raise RuntimeError('load-test failures stop further pressure')
 out.update(phase='complete',passed=True,measured_requests=16,warmup_requests=4,total_requests=20,finished_unix=time.time());save();print(json.dumps(dict(phase='complete',passed=True,measured_requests=16)),flush=True)
except Exception as e:out.update(phase='failed',error=str(e),finished_unix=time.time());save();raise
