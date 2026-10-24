"""Run the installed WorkBuddy client engine against its actual custom model configuration. No GUI claim."""
import hashlib,json,os,subprocess,time,uuid
from pathlib import Path
BASE=Path(__file__).resolve().parent
P=json.loads((BASE/'workbuddy-builtin-e2e-v1-plan.json').read_text())
OUT=BASE/'workbuddy-builtin-e2e-v1-result.json'
STATE=dict(schema='aster-workbuddy-builtin-client-e2e-v1',phase='preflight',unix=time.time(),client_kind='Installed WorkBuddy bundled lite-wb client; headless print mode; actual ~/.workbuddy/models.json; GUI automation unavailable',gui_test_passed=False,base_url=P['base_url'],model=P['model'],tests=[])
def save():
 p=OUT.with_suffix('.tmp');p.write_text(json.dumps(STATE,ensure_ascii=False,indent=2)+'\n');p.replace(OUT)
try:
 save();settings=json.loads(Path(P['model_configuration']).read_text());matches=[r for r in settings if r.get('id')==P['model'] and r.get('url')==P['base_url']]
 if len(matches)!=1:raise RuntimeError('actual Workbuddy custom model configuration changed')
 key=Path(P['credential_file']).read_text().strip()
 if matches[0].get('apiKey')!=key or matches[0].get('maxInputTokens')!=131072:raise RuntimeError('actual Workbuddy credential or context configuration differs')
 env=dict(os.environ);env['CODEBUDDY_FORCE_LITE_WB_BUNDLE']='1'
 for ordinal in range(2):
  name='first-hi' if ordinal==0 else 'second-hi';session='aster-h200-e2e-'+uuid.uuid4().hex
  args=[P['node'],P['entry'],'--model','custom-local:'+P['model'],'--print','hi。请只回复 hi，不调用工具、不读取或修改文件。','--output-format','stream-json','--include-partial-messages','--verbose','--max-turns','1','--no-session-persistence','--permission-mode','plan','--session-id',session]
  t=time.time();first=None;text='';last_result=None;events=0
  STATE.update(phase='running',current_test=name,started_unix=t);save()
  with (Path(P['private_output'])/(name+'.stdout.jsonl')).open('xb') as raw,(Path(P['private_output'])/(name+'.stderr.log')).open('xb') as err:
   child=subprocess.Popen(args,cwd=P['cwd'],env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
   STATE['client_pid']=child.pid;save()
   for line in iter(child.stdout.readline,b''):
    raw.write(line);raw.flush()
    if len(line)>4*1024**2 or time.time()-t>480:child.terminate();raise RuntimeError('WorkBuddy client event/deadline bound exceeded')
    try:event=json.loads(line)
    except (ValueError,UnicodeError):continue
    events+=1;kind=event.get('type')
    if kind=='stream_event':
     ev=event.get('event',{});d=ev.get('delta',{});part=d.get('text') or ''
     if part:
      text+=part
      if first is None:first=time.time()
    elif kind=='assistant' and not text:
     for block in event.get('message',{}).get('content',[]):
      if isinstance(block,dict) and block.get('type')=='text':text+=block.get('text','')
     if text and first is None:first=time.time()
    elif kind=='result':last_result={k:event.get(k) for k in ['subtype','is_error','result','duration_ms','duration_api_ms','num_turns','usage']}
    STATE.update(events=events,elapsed_seconds=time.time()-t,first_output_seconds=first-t if first else None);save()
   rc=child.wait(timeout=10)
  passed=rc==0 and bool(text.strip()) and last_result is not None and not last_result.get('is_error')
  STATE['tests'].append(dict(name=name,passed=passed,exit_code=rc,seconds=time.time()-t,time_to_first_output_seconds=first-t if first else None,reply=text[:4096],result=last_result,events=events));save()
  if not passed:raise RuntimeError('actual WorkBuddy client did not return a successful visible text result')
 STATE.update(phase='passed',current_test=None,finished_unix=time.time());save()
except BaseException as e:
 STATE.update(phase='failed',error=type(e).__name__+': '+str(e),finished_unix=time.time());save();raise
