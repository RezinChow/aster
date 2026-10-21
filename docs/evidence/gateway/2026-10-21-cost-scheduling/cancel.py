"""Real prefill/decode cancellation and native-idle recovery on the canary."""
import http.client
import json
import time
from runtime import environment, request, save

def wait_idle():
    start=time.monotonic()
    for _ in range(100):
        all_idle=True
        for index in range(8):
            status,raw=request(18100+index,'/slots',timeout=2)
            assert status==200
            all_idle=all_idle and all(not slot['is_processing'] for slot in json.loads(raw))
        if all_idle: return round(time.monotonic()-start,4)
        time.sleep(.1)
    raise RuntimeError('native cleanup deadline or concurrent production work')

records=[]
wait_idle()
for mode in ['prefill','decode']:
    value={'model':'prism-27b','stream':True,'temperature':0,'max_tokens':2048,'messages':[
        {'role':'user','content':('synthetic cancellation data. '*12000+'\n' if mode=='prefill' else '')+'Print the integers from 1 to 2000, separated by spaces.'}]}
    client=http.client.HTTPConnection('127.0.0.1',18090,timeout=30)
    client.request('POST','/v1/chat/completions',json.dumps(value),{'Content-Type':'application/json','Authorization':'Bearer '+environment()['A3S_GATEWAY_SHARED_TOKEN']})
    response=client.getresponse();assert response.status==200
    meaningful=False
    if mode=='decode':
        for _ in range(100):
            line=response.readline(65537)
            if not line: break
            if line.startswith(b'data:') and line[5:].strip()!=b'[DONE]':
                chunk=json.loads(line[5:])
                assert 'error' not in chunk
                if any(choice.get('delta',{}).get('content','').strip() for choice in chunk.get('choices',[])):
                    meaningful=True;break
        assert meaningful
    response.close();client.close()
    cleanup=wait_idle()
    status,raw=request(18090,'/v1/chat/completions',{'model':'prism-27b','temperature':0,'max_tokens':16,'messages':[{'role':'user','content':'Reply with exactly 42.'}]})
    assert status==200 and json.loads(raw)['choices'][0]['message']['content'].strip()=='42'
    records.append({'phase':mode,'native_idle_seconds':cleanup,'meaningful_output_before_cancel':meaningful,'recovery_correct':True})
save('cancellation.json',{'passed':True,'shared_production':True,'records':records})
print(json.dumps(records))
