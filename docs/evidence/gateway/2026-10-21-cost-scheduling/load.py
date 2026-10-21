"""Bounded matched ordinary-load probes; shared production, not capacity claims."""
from concurrent.futures import ThreadPoolExecutor
import json
import statistics
import time
import uuid
from runtime import BASE, request, save

def one(port, case):
    start=time.monotonic()
    body={'model':'prism-27b','temperature':0,'max_tokens':32,'stream':False,'messages':[
        {'role':'system','content':f'Synthetic serving probe {uuid.uuid4()}. Follow the final instruction.'},
        {'role':'user','content':'reference 17. '*120+'\nReply with exactly 42.'}]}
    status,raw=request(port,'/v1/chat/completions',body,timeout=30)
    value=json.loads(raw)
    result={'case':case,'port':port,'status':status,'completion_seconds':round(time.monotonic()-start,4)}
    if status==200:
        assert value['choices'][0]['message']['content'].strip()=='42', 'incorrect synthetic answer'
        assert value['choices'][0]['finish_reason']=='stop'
        usage=value['usage']
        assert usage['prompt_tokens']+usage['completion_tokens']==usage['total_tokens']
        result['usage']=usage
    else:
        assert status==429 and value.get('error'), 'unexpected refusal'
        result['error_code']=value['error'].get('code')
    return result

records=[]
for repeat in range(3):
    for concurrency in [1,8,16,32]:
        for label,port in ([('control',18091),('candidate',18090)] if repeat%2==0 else [('candidate',18090),('control',18091)]):
            with ThreadPoolExecutor(max_workers=concurrency) as pool:
                batch=list(pool.map(lambda n:one(port,f'{label}-{repeat}-{concurrency}-{n}'),range(concurrency)))
            records.extend(batch)
            print(json.dumps({'arm':label,'repeat':repeat,'concurrency':concurrency,'success':sum(r['status']==200 for r in batch),'refused':sum(r['status']==429 for r in batch),'median_completion_seconds':statistics.median(r['completion_seconds'] for r in batch)}),flush=True)
            time.sleep(.5)
save('ordinary-load.json',{'passed':True,'synthetic_only':True,'shared_production':True,'ttft_claimed':False,'concurrency':[1,8,16,32],'repeats':3,'records':records})
