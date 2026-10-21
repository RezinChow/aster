"""Private serving qualification utilities. Never serialize process secrets."""
import hashlib
import http.client
import json
import os
from pathlib import Path
import subprocess
import time

BASE = Path('/code/aster/target/workbuddy-cost-scheduling')
OLD_SHA = '1fc30e114c47bd23a52053ccc51bc92c64789854b4dce4db4f0ddff4f84241a4'

def digest(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def pid(unit): return int(subprocess.check_output(['systemctl','show',unit,'-p','MainPID','--value']))
def environment():
    current = pid('a3s-gateway')
    return {os.fsdecode(k):os.fsdecode(v) for part in Path(f'/proc/{current}/environ').read_bytes().split(b'\0') if b'=' in part for k,v in [part.split(b'=',1)]}
def request(port, path, body=None, admin=False, timeout=180):
    transport = http.client.HTTPConnection('127.0.0.1',port,timeout=timeout)
    headers = {}
    if port in [8080,9090,18090,18091]:
        env = environment()
        headers['Authorization'] = 'Bearer ' + env['A3S_GATEWAY_ADMIN_TOKEN' if admin else 'A3S_GATEWAY_SHARED_TOKEN']
    if body is not None: headers['Content-Type']='application/json'
    try:
        transport.request('POST' if body is not None else 'GET',path,json.dumps(body) if body is not None else None,headers)
        response=transport.getresponse()
        data=response.read(2*1024*1024+1)
        assert len(data)<=2*1024*1024
        return response.status,data
    finally: transport.close()
def snapshot():
    units=['a3s-gateway']+[f'a3s-power@{i}' for i in range(8)]+[f'prism-27b@{i}' for i in range(8)]
    return {'services':{unit:{'pid':pid(unit),'binary_sha256':digest(f'/proc/{pid(unit)}/exe')} for unit in units},
            'gateway_config_sha256':digest('/etc/a3s/gateway-prism.acl'),
            'gpu':subprocess.check_output(['nvidia-smi','--query-gpu=index,name,memory.total,memory.used,utilization.gpu','--format=csv,noheader,nounits'],text=True).splitlines()}
def save(name, value):
    path=BASE/name
    assert not path.exists(), 'preserve earlier evidence'
    encoded=(json.dumps(value,indent=2)+'\n').encode()
    for key,value in environment().items():
        if any(word in key for word in ['TOKEN','PASSWORD','SECRET','API_KEY']) and len(value)>=16:
            assert value.encode() not in encoded, 'secret must not enter evidence'
    path.write_bytes(encoded)
def idle():
    status,raw=request(9090,'/api/gateway/metrics',admin=True,timeout=5)
    assert status==200
    lines=[line for line in raw.decode().splitlines() if line.startswith('gateway_service_active_requests{')]
    assert lines
    return all(float(line.rsplit(' ',1)[1])==0 for line in lines)
def wait_idle():
    for _ in range(300):
        if idle(): return
        time.sleep(.2)
    raise RuntimeError('gateway did not drain within 60 seconds')
def ready(port):
    for _ in range(150):
        try:
            status,raw=request(port,'/v1/models',timeout=1)
            if status==200 and b'prism-27b' in raw: return
        except (OSError,TimeoutError): pass
        time.sleep(.2)
    raise RuntimeError('catalog readiness deadline')
def retire():
    import signal
    records=[]
    for path in sorted(BASE.glob('canaries*.json')):
        for item in json.loads(path.read_text())['processes']:
            process=Path(f'/proc/{item["pid"]}')
            if not process.exists(): continue
            args=process.joinpath('cmdline').read_bytes().split(b'\0')
            assert os.fsencode(item['config']) in args and digest(process/'exe')==item['binary_sha256']
            os.kill(item['pid'],signal.SIGTERM)
            records.append(item['pid'])
    for current in records:
        for _ in range(100):
            if not Path(f'/proc/{current}').exists(): break
            time.sleep(.05)
        else: raise RuntimeError('canary did not stop')
    return records
def canaries(generation='v4'):
    source=Path('/etc/a3s/gateway-prism.acl').read_text()
    assert source.count('"0.0.0.0:8080"')==1 and source.count('prefix_affinity = true')==1
    candidate=Path('/code/aster/target/release/a3s-gateway')
    sha=digest(candidate)
    import shutil
    release=BASE/'releases'/sha/'a3s-gateway'
    release.parent.mkdir(parents=True,exist_ok=True)
    if not release.exists(): shutil.copy2(candidate,release)
    assert digest(release)==sha
    records=[]
    for name,port,binary in [('control',18091,Path('/opt/a3s/releases')/OLD_SHA/'a3s-gateway'),('candidate',18090,release)]:
        config=source.replace('"0.0.0.0:8080"',f'"127.0.0.1:{port}"').replace('enabled        = true','enabled        = false')
        if name=='candidate': config=config.replace('prefix_affinity = true','prefix_affinity = true\n      prefix_parallelism = 2')
        path=BASE/f'{name}-{generation}.acl'; path.write_text(config); os.chmod(path,0o600)
        validated=subprocess.run([str(binary),'config','--config',str(path),'json'],env=environment(),capture_output=True,check=True)
        parsed=json.loads(validated.stdout)
        assert not parsed['management']['enabled'] and not parsed['managed'].get('state_file') and not parsed['managed'].get('usage_spool')
        with (BASE/f'{name}.log').open('wb') as log:
            child=subprocess.Popen([str(binary),'--config',str(path)],env=environment(),stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        ready(port)
        records.append({'name':name,'pid':child.pid,'port':port,'binary_sha256':digest(binary),'config_sha256':digest(path),'config':str(path)})
    save(f'canaries-{generation}.json',{'candidate_sha256':sha,'same_native_slots':2,'candidate_declared_parallelism':2,'processes':records})
    print(json.dumps({'canaries_ready':True,'candidate_sha256':sha}),flush=True)
if __name__=='__main__':
    import sys
    if sys.argv[1]=='baseline': save('baseline.json',snapshot()); print('baseline retained without secrets')
    elif sys.argv[1]=='canaries': canaries()
    elif sys.argv[1]=='retire': print(json.dumps({'retired':retire()}))
