"""Drain one native replica, measure bounded same-context batch profiles, restore.

Run as root only after Gateway promotion. No prompt, auth or quality changes.
The experiment itself always restores the starting native arguments. A later
explicit promotion uses its retained decision, not whichever profile ran last.
"""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import http.client
import json
import os
from pathlib import Path
import shlex
import statistics
import subprocess
import time
from urllib.parse import urlsplit
from runtime import BASE, digest, environment, pid, ready, request, retire, save, snapshot, wait_idle

SOURCE=Path('/etc/a3s/gateway-prism.acl')
original=SOURCE.read_bytes()
original_sha=digest(SOURCE)
assert os.geteuid()==0 and b'prefix_parallelism = 2' in original and b'excluded_supplier_ids' not in original
assert json.loads((BASE/'deployment.json').read_text())['passed']
before=snapshot()
retired=retire()

def catalog():
    validated=subprocess.run([f'/proc/{pid("a3s-gateway")}/exe','config','--config',str(SOURCE),'json'],env=environment(),capture_output=True,check=True)
    config=json.loads(validated.stdout)
    sources=[route['console_catalog']['api_service'] for route in config['inference']['routes'].values() if route.get('console_catalog')]
    assert len(sources)==1
    origin=urlsplit(config['services'][sources[0]]['load_balancer']['servers'][0]['url'])
    assert origin.scheme in ['http','https'] and origin.hostname
    transport=http.client.HTTPSConnection if origin.scheme=='https' else http.client.HTTPConnection
    client=transport(origin.hostname,origin.port,timeout=10)
    try:
        client.request('GET',origin.path.rstrip('/')+'/v1/api/admin/internal/model-service/catalog',headers={'Authorization':'Bearer '+environment()['A3S_GATEWAY_ADMIN_TOKEN']})
        response=client.getresponse();data=response.read(1048577)
        assert response.status==200 and len(data)<=1048576
        envelope=json.loads(data);assert envelope['success']
        return envelope['data']['routes']
    finally: client.close()

def supplier_for(index):
    matching={target['supplierId'] for route in catalog() for target in route['targets']
              if urlsplit(target['baseUrl']).hostname=='127.0.0.1' and urlsplit(target['baseUrl']).port==18200+index}
    assert len(matching)==1, 'exact backend mapping required'
    return next(iter(matching))

def apply_gateway(data):
    assert pid('a3s-gateway')>0
    path=SOURCE.with_name('gateway-prism.native-profile-switch.acl')
    path.write_bytes(data);os.chmod(path,SOURCE.stat().st_mode&0o777)
    binary=Path(f'/proc/{pid("a3s-gateway")}/exe')
    subprocess.run([str(binary),'config','--config',str(path),'json'],env=environment(),capture_output=True,check=True)
    wait_idle()
    os.replace(path,SOURCE)
    subprocess.run(['systemctl','restart','a3s-gateway'],check=True)
    ready(8080)

def drain(index):
    supplier=supplier_for(index)
    assert len(supplier)<=256
    data=original.replace(b'prefix_parallelism = 2',b'prefix_parallelism = 2\n      excluded_supplier_ids = '+json.dumps([supplier]).encode())
    apply_gateway(data)
    for _ in range(300):
        status,raw=request(18100+index,'/slots',timeout=2)
        slots=json.loads(raw)
        if status==200 and len(slots)==2 and all(not slot['is_processing'] for slot in slots):
            time.sleep(.2)
            return supplier
        time.sleep(.2)
    raise RuntimeError('native drain deadline')

def native_ready(index):
    for _ in range(150):
        try:
            status,raw=request(18100+index,'/slots',timeout=1)
            slots=json.loads(raw)
            if status==200 and len(slots)==2 and all(slot['n_ctx']==131072 for slot in slots): return
        except (OSError,TimeoutError,json.JSONDecodeError): pass
        time.sleep(.2)
    raise RuntimeError('native readiness/context gate')

index=7
unit=f'prism-27b@{index}'
override=Path(f'/etc/systemd/system/{unit}.service.d/95-prefill-profile-20261021.conf')
assert not override.exists()
native_args=[os.fsdecode(part) for part in Path(f'/proc/{pid(unit)}/cmdline').read_bytes().split(b'\0') if part]
assert '-b' not in native_args and '-ub' not in native_args
results=[]
native_mutated=False
power_stopped=False

def install_profile(batch,ubatch):
    global native_mutated
    native_mutated=True
    args=native_args+['-b',str(batch),'-ub',str(ubatch),'--fit','off']
    override.write_text('[Service]\nExecStart=\nExecStart='+shlex.join(args)+'\n')
    subprocess.run(['systemctl','daemon-reload'],check=True)
    subprocess.run(['systemctl','restart',unit],check=True)
    native_ready(index)
    memory=int(subprocess.check_output(['nvidia-smi','-i',str(index),'--query-gpu=memory.used','--format=csv,noheader,nounits'],text=True).strip())
    total=int(subprocess.check_output(['nvidia-smi','-i',str(index),'--query-gpu=memory.total','--format=csv,noheader,nounits'],text=True).strip())
    assert total-memory>=768,'candidate leaves less than 768MiB GPU headroom'
    return {'batch':batch,'ubatch':ubatch,'pid':pid(unit),'vram_mib':memory,'free_mib':total-memory,'slots':2,'context_per_slot':131072,'fit':'off'}

def body(size,serial):
    return {'model':'prism-27b','stream':False,'temperature':0,'seed':42,'max_tokens':32,'cache_prompt':False,'messages':[
        {'role':'system','content':f'Synthetic native batching qualification {size}/{serial}. Follow the final instruction.'},
        {'role':'user','content':' synthetic record 17: stable reference data.\n'*size+'\nReply with exactly 42.'}]}

def measure(size,serial):
    value=body(size,serial);start=time.monotonic()
    status,raw=request(18107,'/v1/chat/completions',value,timeout=90)
    payload=json.loads(raw)
    assert status==200 and payload['choices'][0]['message']['content'].strip()=='42'
    assert payload['choices'][0]['finish_reason']=='stop'
    timings=payload['timings'];usage=payload['usage']
    assert timings['cache_n']==0 and timings['prompt_n']==usage['prompt_tokens']
    assert timings['predicted_n']==usage['completion_tokens']
    if size==5005: assert usage['prompt_tokens']>=55000
    return {'size':size,'serial':serial,'request_sha256':hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest(),
            'seconds':round(time.monotonic()-start,4),'timings':timings,'usage':usage,'correct':True}

def tool_check():
    value=body(1,0)
    value['messages'][-1]['content']='Use bench_sum to add 19 and 23.'
    value['max_tokens']=128
    value['tools']=[{'type':'function','function':{'name':'bench_sum','description':'Add two integers.','parameters':{'type':'object','properties':{'a':{'type':'integer'},'b':{'type':'integer'}},'required':['a','b']}}}]
    status,raw=request(18107,'/v1/chat/completions',value)
    result=json.loads(raw);call=result['choices'][0]['message']['tool_calls'][0]
    assert status==200 and call['function']['name']=='bench_sum' and json.loads(call['function']['arguments'])=={'a':19,'b':23}
    return {'correct':True,'finish_reason':result['choices'][0]['finish_reason']}

def persist():
    # Preserve partial results after each cell; final immutable decision is
    # separate, so a failed launch or benchmark remains visible.
    (BASE/'native-profile-progress.json').write_text(json.dumps({'profiles':results},indent=2)+'\n')

restored=False
try:
    excluded=drain(7)
    subprocess.run(['systemctl','stop','a3s-power@7'],check=True)
    power_stopped=True
    for name,batch,ubatch in [('baseline',2048,512),('ub1024',2048,1024),('ub256',2048,256),('batch4096-ub1024',4096,1024)]:
        record={'name':name,'passed':False,'measurements':[]};results.append(record);persist()
        try:
            record['runtime']=install_profile(batch,ubatch)
            for serial in range(3):
                for size in [360,5005]:
                    observation=measure(size,serial);record['measurements'].append(observation);persist()
                    print(json.dumps({'profile':name,'repeat':serial,'size':size,'seconds':observation['seconds'],'prompt_tokens':observation['usage']['prompt_tokens']}),flush=True)
            with ThreadPoolExecutor(max_workers=2) as pool:
                record['parallel']=list(pool.map(lambda n:measure(360,10+n),range(2)))
            record['tool']=tool_check()
            record['post_prefill_vram_mib']=int(subprocess.check_output(['nvidia-smi','-i','7','--query-gpu=memory.used','--format=csv,noheader,nounits'],text=True).strip())
            assert 24564-record['post_prefill_vram_mib']>=768,'post-prefill GPU headroom gate'
            record['passed']=True
        except BaseException as error:
            record['error_type']=type(error).__name__
            record['error']=str(error)[:400]
            print(json.dumps({'profile':name,'failed':record['error']}),flush=True)
        persist()
        if name=='baseline': assert record['passed'],'baseline failed; refuse comparisons'
finally:
    if native_mutated:
        if override.exists(): override.unlink()
        subprocess.run(['systemctl','daemon-reload'],check=True)
        subprocess.run(['systemctl','restart',unit],check=True)
        native_ready(7)
    actual=[os.fsdecode(part) for part in Path(f'/proc/{pid(unit)}/cmdline').read_bytes().split(b'\0') if part]
    assert actual==native_args,'restore original native execution arguments'
    if power_stopped: subprocess.run(['systemctl','start','a3s-power@7'],check=True)
    if SOURCE.read_bytes()!=original: apply_gateway(original)
    assert digest(SOURCE)==original_sha
    restored=True
    save('native-profile-restoration-v2.json',{'restored':restored,'retired_canaries':retired,'before':before,'after':snapshot(),'native_args_identical':True})

baseline=results[0]
median=lambda record,size:statistics.median(item['seconds'] for item in record['measurements'] if item['size']==size)
qualified=[record for record in results[1:] if record['passed'] and median(record,5005)<=median(baseline,5005)*.90 and median(record,360)<=median(baseline,360)*1.10]
selected=min(qualified,key=lambda record:median(record,5005)) if qualified else baseline
save('native-profile-decision.json',{'passed':True,'baseline_name':'baseline','selected':selected['name'],'restored_before_promotion':restored,
    'profiles':results,'cold_prefill_55000_token_gain_required':.10,'short_regression_limit':.10,'kv_precision':'f16','context_per_slot':131072,
    'selected_batch':selected['runtime']['batch'],'selected_ubatch':selected['runtime']['ubatch'],
    'ratios':{record['name']:{'long':median(record,5005)/median(baseline,5005),'short':median(record,360)/median(baseline,360)} for record in results if record['passed']}})
print(json.dumps({'native_selected':selected['name'],'restored':True}),flush=True)
