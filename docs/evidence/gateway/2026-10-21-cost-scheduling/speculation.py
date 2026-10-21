"""Cold-history, long-cache and concurrent ngram qualification at full context.

All candidates are restored, even if faster; a general-purpose promotion also
requires authenticated isolation and wider load/cancellation qualification.
"""
from concurrent.futures import ThreadPoolExecutor
import copy
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
from runtime import BASE,digest,environment,pid,ready,request,save,snapshot,wait_idle

assert os.geteuid()==0
assert json.loads((BASE/'native-profile-decision.json').read_text())['restored_before_promotion']
SOURCE=Path('/etc/a3s/gateway-prism.acl')
original=SOURCE.read_bytes();before=snapshot()
assert b'excluded_supplier_ids' not in original
unit='prism-27b@7'
args=[os.fsdecode(part) for part in Path(f'/proc/{pid(unit)}/cmdline').read_bytes().split(b'\0') if part]
override=Path('/etc/systemd/system/prism-27b@7.service.d/96-speculation-probe-20261021.conf')
assert not override.exists()
mutated=False;stopped=False
results=[];baseline_payloads={}

def apply(data):
    path=SOURCE.with_name('gateway-prism.speculation-switch.acl')
    path.write_bytes(data);os.chmod(path,SOURCE.stat().st_mode&0o777)
    subprocess.run([f'/proc/{pid("a3s-gateway")}/exe','config','--config',str(path),'json'],env=environment(),capture_output=True,check=True)
    wait_idle();os.replace(path,SOURCE)
    subprocess.run(['systemctl','restart','a3s-gateway'],check=True);ready(8080)

def isolate():
    validated=subprocess.run([f'/proc/{pid("a3s-gateway")}/exe','config','--config',str(SOURCE),'json'],env=environment(),capture_output=True,check=True)
    config=json.loads(validated.stdout)
    name=next(route['console_catalog']['api_service'] for route in config['inference']['routes'].values() if route.get('console_catalog'))
    origin=urlsplit(config['services'][name]['load_balancer']['servers'][0]['url'])
    client=(http.client.HTTPSConnection if origin.scheme=='https' else http.client.HTTPConnection)(origin.hostname,origin.port,timeout=10)
    client.request('GET',origin.path.rstrip('/')+'/v1/api/admin/internal/model-service/catalog',headers={'Authorization':'Bearer '+environment()['A3S_GATEWAY_ADMIN_TOKEN']})
    response=client.getresponse();assert response.status==200
    catalog=json.loads(response.read(1048576));client.close()
    ids={target['supplierId'] for route in catalog['data']['routes'] for target in route['targets'] if urlsplit(target['baseUrl']).hostname=='127.0.0.1' and urlsplit(target['baseUrl']).port==18207}
    assert len(ids)==1
    apply(original.replace(b'prefix_parallelism = 2',b'prefix_parallelism = 2\n      excluded_supplier_ids = '+json.dumps(sorted(ids)).encode()))
    for _ in range(300):
        status,raw=request(18107,'/slots')
        if status==200 and all(not slot['is_processing'] for slot in json.loads(raw)): return
        time.sleep(.1)
    raise RuntimeError('drain deadline')

def native_ready():
    for _ in range(200):
        try:
            status,raw=request(18107,'/slots',timeout=1);slots=json.loads(raw)
            if status==200 and len(slots)==2 and all(slot['n_ctx']==131072 for slot in slots): return
        except (OSError,TimeoutError,json.JSONDecodeError):pass
        time.sleep(.1)
    raise RuntimeError('native readiness/context deadline')

def metrics():
    status,raw=request(18107,'/metrics');assert status==200
    return {line.split()[0]:float(line.split()[1]) for line in raw.decode().splitlines() if line.startswith('llamacpp:spec_decode_')}

def install(mode):
    global mutated
    mutated=True
    command=args+['--spec-type',mode,'--fit','off']
    override.write_text('[Service]\nExecStart=\nExecStart='+shlex.join(command)+'\n')
    subprocess.run(['systemctl','daemon-reload'],check=True)
    subprocess.run(['systemctl','restart',unit],check=True);native_ready()

def body(text,limit=128):
    return {'model':'prism-27b','stream':False,'temperature':0,'seed':42,'top_k':1,'top_p':1,'min_p':0,'max_tokens':limit,
            'cache_prompt':True,'messages':[{'role':'user','content':text}]}

def measured(mode,key,value):
    start=time.monotonic();status,raw=request(18107,'/v1/chat/completions',value,timeout=120)
    elapsed=time.monotonic()-start;payload=json.loads(raw);assert status==200
    choice=payload['choices'][0];message=copy.deepcopy(choice['message'])
    for call in message.get('tool_calls',[]):call.pop('id',None)
    canonical=json.dumps({'message':message,'finish':choice['finish_reason']},sort_keys=True).encode()
    result={'key':key,'seconds':round(elapsed,4),'payload_sha256':hashlib.sha256(canonical).hexdigest(),'usage':payload['usage'],'timings':payload['timings']}
    if mode=='none':baseline_payloads[key]=result['payload_sha256']
    else:assert baseline_payloads[key]==result['payload_sha256'],'target-output parity failure: '+key
    return result

def persist():
    (BASE/'speculation-progress.json').write_text(json.dumps({'profiles':results},indent=2)+'\n')

cases={'code':body('Write only Python code for binary search in a sorted integer list. Include type annotations and a docstring.'),
       'ordinal':body('Write the integers from 1 to 100 separated by spaces. Do not explain.'),
       'repetitive':body('Continue this sequence without explanation: '+'alpha beta gamma delta '*40)}
tool=body('Use bench_sum to add 19 and 23.')
tool['tools']=[{'type':'function','function':{'name':'bench_sum','description':'Add two integers.','parameters':{'type':'object','properties':{'a':{'type':'integer'},'b':{'type':'integer'}},'required':['a','b']}}}]
cases['tool']=tool

try:
    isolate();subprocess.run(['systemctl','stop','a3s-power@7'],check=True);stopped=True
    for mode in ['none','ngram-simple','ngram-mod']:
        record={'mode':mode,'passed':False,'records':[]};results.append(record);persist()
        try:
            install(mode);start_metrics=metrics()
            for repeat in range(3):
                for name,value in cases.items():
                    result=measured(mode,f'{name}-{repeat}',value);record['records'].append(result);persist()
                long=body('Synthetic speculative cache probe '+str(repeat)+'.\n'+' synthetic record 17: stable reference data.\n'*5005+'\nReply with exactly 42.',32)
                cold=measured(mode,f'long-cold-{repeat}',long);assert cold['usage']['prompt_tokens']>=55000
                long['messages'].extend([{'role':'assistant','content':'42'},{'role':'user','content':'Reply again with exactly 42.'}])
                warm=measured(mode,f'long-warm-{repeat}',long)
                record['records'].extend([cold,warm]);persist()
                assert warm['timings']['cache_n']>=50000,'speculation loses long-prefix reuse'
                print(json.dumps({'speculation':mode,'repeat':repeat,'long_cold_seconds':cold['seconds'],'long_warm_seconds':warm['seconds'],'cached_tokens':warm['timings']['cache_n']}),flush=True)
            with ThreadPoolExecutor(max_workers=2) as pool:
                record['parallel']=list(pool.map(lambda n:measured(mode,f'parallel-{n}',cases['ordinal']),range(2)))
            end_metrics=metrics();record['speculative_counter_delta']={name:end_metrics[name]-start_metrics[name] for name in end_metrics}
            if mode!='none': assert record['speculative_counter_delta']['llamacpp:spec_decode_num_draft_tokens_total']>0,'no actual draft execution'
            record['passed']=True
        except BaseException as error:
            record['error_type']=type(error).__name__;record['error']=str(error)[:400]
            print(json.dumps({'speculation':mode,'failed':record['error']}),flush=True)
        persist()
        if mode=='none':assert record['passed'],'refuse unsupported baseline comparison'
finally:
    if mutated:
        if override.exists():override.unlink()
        subprocess.run(['systemctl','daemon-reload'],check=True)
        subprocess.run(['systemctl','restart',unit],check=True);native_ready()
    if stopped:subprocess.run(['systemctl','start','a3s-power@7'],check=True)
    if SOURCE.read_bytes()!=original:apply(original)
    save('speculation-restoration.json',{'native_args_restored':[os.fsdecode(part) for part in Path(f'/proc/{pid(unit)}/cmdline').read_bytes().split(b'\0') if part]==args,
        'gateway_config_restored':SOURCE.read_bytes()==original,'before':before,'after':snapshot()})
save('speculation-decision.json',{'profiles':results,'production_speculation':'none','restored':True,
    'promotion_boundary':'No promotion without general-load improvement, authenticated isolation and full mixed-load cancellation qualification. Failed parity/cache/capability gates reject a candidate immediately.'})
print(json.dumps({'speculation_qualification_complete':True,'production_restored':True}),flush=True)
