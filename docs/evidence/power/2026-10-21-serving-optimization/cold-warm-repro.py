#!/usr/bin/env python3
"""Private Power-only restart experiment. Never changes production services or ACL."""
from pathlib import Path
import datetime,hashlib,importlib.util,json,os,signal,statistics,subprocess,sys,time,urllib.request
OUT=Path('/code/Power/.git/optimization-20261021')
SCRIPT=Path('/code/aster/scripts/power_serving_qualification.py')
spec=importlib.util.spec_from_file_location('power_qualification',SCRIPT)
qualification=importlib.util.module_from_spec(spec);sys.modules[spec.name]=qualification;spec.loader.exec_module(qualification)
MODEL='/data/models/Ternary-Bonsai-2-27B-PTQ1_0.gguf'
BODY={'model':'prism27b','messages':[{'role':'user','content':'Reply with exactly OK.'}],'max_tokens':16,'temperature':0,'seed':42,'stream':False}
ENGINE='http://127.0.0.1:19100'
NATIVE_NAMES=['llamacpp:prompt_tokens_total','llamacpp:prompt_tokens_cached_total','llamacpp:prompt_seconds_total','llamacpp:tokens_predicted_total','llamacpp:tokens_predicted_seconds_total','llamacpp:requests_processing','llamacpp:requests_deferred']
START=time.monotonic()
R={'schema':'a3s.power.isolated-cold-warm.v1','started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rows':[],'startup_events':[],'original':{},'qualification_script_sha256':hashlib.sha256(SCRIPT.read_bytes()).hexdigest(),'request_sha256':hashlib.sha256(json.dumps(BODY,sort_keys=True).encode()).hexdigest(),'request_policy':{k:v for k,v in BODY.items() if k!='messages'},'meaning':'Buffered completion wall time; never TTFT. Cold refers to restarted Power autoload/template state, not engine/GPU/OS cache cold. Native is one exclusively-owned persistent warm engine.'}
ARMS={}
def save():
 p=OUT/'cold-warm-final.json';t=OUT/'cold-warm-final.tmp';t.write_text(json.dumps(R,indent=2)+'\n');os.replace(t,p)
def fetch(url,method='GET',body=None,key=None):
 headers={'Content-Type':'application/json'}
 if key:headers['Authorization']='Bearer '+key
 req=urllib.request.Request(url,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
 with urllib.request.urlopen(req,timeout=90 if method=='POST' and url.endswith('/v1/models') else 12) as res:
  raw=res.read(2*1024*1024)
  if len(raw)>=2*1024*1024:raise RuntimeError('response bound')
  return res.status,raw
def get(url):return json.loads(fetch(url)[1])
def metrics(url):
 values={}
 for line in fetch(url+'/metrics')[1].decode().splitlines():
  if line and not line.startswith('#'):
   k,v=line.rsplit(None,1);values[k]=float(v)
 return values
def native():
 v=metrics(ENGINE);d={name:v[name] for name in NATIVE_NAMES}
 if d['llamacpp:requests_processing']!=0 or d['llamacpp:requests_deferred']!=0:raise RuntimeError('native not idle')
 return d
def loads(arm):
 m=metrics(arm['url'])
 return {'count':m.get('power_model_load_duration_seconds_count{model="prism27b"}',0),'seconds':m.get('power_model_load_duration_seconds_sum{model="prism27b"}',0),'active_requests_gauge':m.get('power_active_requests')}
def env_for(pid):
 return {a.decode():b.decode() for item in Path('/proc',str(pid),'environ').read_bytes().split(b'\0') if item for a,b in [item.split(b'=',1)]}
def identity(pid,arm):
 args=[s.decode() for s in Path('/proc',str(pid),'cmdline').read_bytes().split(b'\0') if s]
 if args!=arm['argv']:raise RuntimeError('private exact argv mismatch')
 start=Path('/proc',str(pid),'stat').read_text().rsplit(')',1)[1].split()[19]
 return start
def snapshot(path):
 st=path.stat();return {'path':str(path),'size':st.st_size,'mtime_ns':st.st_mtime_ns,'ctime_ns':st.st_ctime_ns,'inode':st.st_ino,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
GLOBAL=Path('/home/user/.a3s/power/models/manifests/prism27b.json')
R['global_registry_before']=snapshot(GLOBAL)
def startup(arm,reason):
 logpath=OUT/('cold-warm-'+arm['name']+'-'+reason+'.log')
 with logpath.open('ab') as log:
  proc=subprocess.Popen(arm['argv'],cwd=arm['cwd'],env=arm['env'],stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 arm['proc']=proc;arm['pid']=proc.pid
 temp=OUT/(arm['name']+'.pid.cold-warm.tmp');temp.write_text(str(proc.pid)+'\n');os.replace(temp,arm['pidfile'])
 begin=time.monotonic()
 while time.monotonic()-begin<12:
  if proc.poll() is not None:raise RuntimeError('private Power startup exited')
  try:
   h=get(arm['url']+'/health')
   if h.get('status')=='ok':break
  except (OSError,ValueError):pass
  time.sleep(.05)
 else:raise RuntimeError('private startup health deadline')
 identity(proc.pid,arm)
 if env_for(proc.pid).get('A3S_POWER_HOME')!=str(arm['home']):raise RuntimeError('private home env missing')
 event={'arm':arm['name'],'reason':reason,'new_pid':proc.pid,'argv':arm['argv'],'startup_seconds':time.monotonic()-begin,'home':str(arm['home']),'health':h,'model_load_metrics':loads(arm)}
 R['startup_events'].append(event);save()
 if h.get('loaded_models')!=0 or event['model_load_metrics']['count']!=0:raise RuntimeError('Power startup is not cold')
 return event
def stop(arm):
 native()
 pid=int(arm['pidfile'].read_text())
 if pid!=arm['pid']:raise RuntimeError('private pidfile changed')
 stamp=identity(pid,arm)
 os.kill(pid,signal.SIGTERM)
 for _ in range(100):
  try:
   if identity(pid,arm)!=stamp:raise RuntimeError('PID starttime changed')
  except (FileNotFoundError,ProcessLookupError):break
  except RuntimeError:
   try:empty=Path('/proc',str(pid),'cmdline').read_bytes()==b''
   except FileNotFoundError:empty=True
   if empty:break
   raise
  time.sleep(.03)
 else:
  if identity(pid,arm)!=stamp:raise RuntimeError('kill identity changed')
  os.kill(pid,signal.SIGKILL)
 proc=arm.get('proc')
 if proc:proc.wait(timeout=3)
 arm['pid']=None
def register(arm):
 manifest=arm['home']/'models'/'manifests'/'prism27b.json'
 if manifest.exists():
  d=json.loads(manifest.read_text())
  if d.get('name')!='prism27b' or d.get('path')!=MODEL:raise RuntimeError('unexpected private registry')
  return {'mode':'existing-private-registry','manifest':snapshot(manifest)}
 begin=time.monotonic()
 status,_=fetch(arm['url']+'/v1/models','POST',{'name':'prism27b','path':MODEL,'format':'gguf'},arm['key'])
 if status!=201:raise RuntimeError('private registration did not return201')
 if not manifest.exists():raise RuntimeError('private manifest was not created')
 d=json.loads(manifest.read_text())
 if d.get('name')!='prism27b' or d.get('path')!=MODEL:raise RuntimeError('registered identity mismatch')
 return {'mode':'fresh-api-registration','status':status,'seconds':time.monotonic()-begin,'manifest':snapshot(manifest),'model_sha256':d.get('sha256')}
def measured(arm,rep,phase):
 before=native();load_before=loads(arm)
 record=qualification.request_once(arm['url']+'/v1',BODY,arm['key'],10,expected={'text':'OK','normalize_whitespace':True})
 after=native();load_after=loads(arm)
 delta={k:after[k]-before[k] for k in NATIVE_NAMES}
 engine_ms=1000*(delta['llamacpp:prompt_seconds_total']+delta['llamacpp:tokens_predicted_seconds_total'])
 row={'arm':arm['name'],'rep':rep,'phase':phase,'pid':arm['pid'],'record':record,'native_before':before,'native_after':after,'native_delta':delta,'engine_prompt_ms':1000*delta['llamacpp:prompt_seconds_total'],'engine_decode_ms':1000*delta['llamacpp:tokens_predicted_seconds_total'],'engine_total_ms':engine_ms,'client_minus_engine_ms':record['elapsed_ms']-engine_ms,'authoritative_native_completion_tokens':delta['llamacpp:tokens_predicted_total'],'power_load_before':load_before,'power_load_after':load_after,'power_load_seconds_delta':load_after['seconds']-load_before['seconds'],'power_load_count_delta':load_after['count']-load_before['count'],'health_after':get(arm['url']+'/health')}
 R['rows'].append(row);save()
 if record['outcome']!='success' or record['http_status']!=200:raise RuntimeError('expected OK request failed')
 if phase=='cold' and row['power_load_count_delta']!=1:raise RuntimeError('cold did not autoload exactly once')
 if phase=='warm' and row['power_load_count_delta']!=0:raise RuntimeError('warm unexpectedly autoloaded')
 return row
try:
 for name,port in [('baseline',19200),('candidate',19210)]:
  cfg=OUT/(name+'.acl');binary=OUT/(name+'-power');pidfile=OUT/(name+'.pid');pid=int(pidfile.read_text())
  text=cfg.read_text();key_lines=[l.split('=',1)[1].strip() for l in text.splitlines() if l.strip().startswith('api_keys =')]
  if len(key_lines)!=1:raise RuntimeError('ambiguous benchmark api_keys')
  keys=json.loads(key_lines[0])
  if len(keys)!=1 or not isinstance(keys[0],str):raise RuntimeError('private key configuration invalid')
  arm={'name':name,'url':'http://127.0.0.1:'+str(port),'argv':[str(binary),'serve','--config',str(cfg)],'cfg':cfg,'binary':binary,'pidfile':pidfile,'pid':pid,'key':keys[0],'home':OUT/(name+'-home'),'cwd':os.readlink('/proc/'+str(pid)+'/cwd'),'env':env_for(pid)}
  if binary.resolve().parent!=OUT.resolve() or arm['home'].resolve().parent!=OUT.resolve():raise RuntimeError('private path boundary')
  identity(pid,arm)
  ARMS[name]=arm
  R['original'][name]={'pid':pid,'argv':arm['argv'],'binary':snapshot(binary),'config':snapshot(cfg),'health':get(arm['url']+'/health'),'load_metrics':loads(arm),'original_A3S_POWER_HOME':arm['env'].get('A3S_POWER_HOME')}
  allowed={'PATH','LANG','LC_ALL','LC_CTYPE','TZ','HOME','USER','LOGNAME','LD_LIBRARY_PATH','CUDA_VISIBLE_DEVICES'}
  arm['env']={k:v for k,v in arm['env'].items() if k in allowed}
  arm['env']['A3S_POWER_HOME']=str(arm['home'])
 R['native_initial_before_warmup']=native();save()
 for arm in ARMS.values():
  stop(arm);startup(arm,'isolated-home-setup');arm['registration']=register(arm)
 R['registrations']={name:arm['registration'] for name,arm in ARMS.items()};save()
 R['native_warmup']=qualification.request_once(ENGINE+'/v1',BODY,None,10,expected={'text':'OK','normalize_whitespace':True})
 if R['native_warmup']['outcome']!='success':raise RuntimeError('native warmup failed')
 R['native_after_warmup']=native()
 def deadline(signum,frame):raise TimeoutError('cold warm measurement window115s')
 signal.signal(signal.SIGALRM,deadline);signal.alarm(115)
 R['order']=[['baseline','candidate'],['candidate','baseline'],['baseline','candidate']]
 for rep,order in enumerate(R['order'],1):
  for name in order:
   arm=ARMS[name];stop(arm);startup(arm,'rep'+str(rep));measured(arm,rep,'cold');measured(arm,rep,'warm')
 R['status']='complete'
except BaseException as error:
 R['status']='error';R['error_type']=type(error).__name__;R['error']=str(error)
finally:
 signal.alarm(0)
 R['final']={}
 for name,arm in ARMS.items():
  try:
   if arm['pid'] is None:startup(arm,'final-recovery')
   h=get(arm['url']+'/health');identity(arm['pid'],arm)
   R['final'][name]={'pid':arm['pid'],'pidfile_pid':int(arm['pidfile'].read_text()),'A3S_POWER_HOME':env_for(arm['pid']).get('A3S_POWER_HOME'),'health':h,'load_metrics':loads(arm),'registry':snapshot(arm['home']/'models'/'manifests'/'prism27b.json'),'binary_unchanged':snapshot(arm['binary'])['sha256']==R['original'][name]['binary']['sha256'],'config_unchanged':snapshot(arm['cfg'])['sha256']==R['original'][name]['config']['sha256']}
  except BaseException as error:R['final'][name]={'error_type':type(error).__name__,'error':str(error)}
 R['native_final']=native();R['global_registry_after']=snapshot(GLOBAL);R['global_registry_unchanged']=R['global_registry_before']==R['global_registry_after']
 R['elapsed_seconds']=time.monotonic()-START
 R['summary']=[]
 for arm in ['baseline','candidate']:
  for phase in ['cold','warm']:
   rows=[r for r in R['rows'] if r['arm']==arm and r['phase']==phase]
   if rows:R['summary'].append({'arm':arm,'phase':phase,'n':len(rows),'median_wall_ms':statistics.median(r['record']['elapsed_ms'] for r in rows),'median_engine_ms':statistics.median(r['engine_total_ms'] for r in rows),'median_power_minus_engine_ms':statistics.median(r['client_minus_engine_ms'] for r in rows),'median_model_load_ms':1000*statistics.median(r['power_load_seconds_delta'] for r in rows),'actual_native_completion_tokens':[r['authoritative_native_completion_tokens'] for r in rows]})
 save()
 print(json.dumps({'status':R['status'],'elapsed_seconds':R['elapsed_seconds'],'rows':len(R['rows']),'global_registry_unchanged':R['global_registry_unchanged'],'summary':R['summary'],'final_pids':{name:v.get('pid') for name,v in R['final'].items()}},indent=2),flush=True)
