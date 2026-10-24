"""Derive a diagnostic-only worker; preserve all unprofiled benchmark workers."""
import ast
from xolotl_trial_common import BASE
source=(BASE/'xolotl_protocol_trial_worker.py').read_text()
def replace_once(a,b):
 global source
 if source.count(a)!=1:raise RuntimeError('profile derivation anchor changed: '+a[:80])
 source=source.replace(a,b)
replace_once('child=None;pidfd=None;stop=threading.Event();telemetry=[]','''child=None;pidfd=None;stop=threading.Event();telemetry=[]
capture_active=False
NSYS='/usr/local/cuda/bin/nsys'
SESSION=ROOT.name
def profile_tool(action):
    command=[NSYS,action,'--session='+SESSION]
    if action=='start':command+=['--sample=none','--cpuctxsw=none','--duration=20','--output='+str(ROOT/'warm-prose')]
    with (ROOT/('nsys-'+action+'.log')).open('x') as out:
        p=subprocess.run(command,stdout=out,stderr=out,timeout=90)
    if p.returncode:raise RuntimeError('diagnostic profiler '+action+' failed')
''')
anchor="    RESULT.update(command=command,phase='loading',cuda_visible_devices=env['CUDA_VISIBLE_DEVICES'],dspark=PLAN['dspark']);save()"
replace_once(anchor,'''
    target_script=ROOT/'profile_target.py'
    target_script.write_text("import os,sys,json\\nfrom pathlib import Path\\nr=Path(__file__).resolve().parent\\nb=sys.argv[1]\\np=dict(pid=os.getpid(),start_ticks=int(Path('/proc/self/stat').read_text().split(') ',1)[1].split()[19]),uid=os.getuid(),binary=b)\\n(r/'profile-target-process.json').write_text(json.dumps(p))\\nos.execv(b,sys.argv[1:])\\n")
    command=[NSYS,'launch','--session-new='+SESSION,'--trace=cuda','--cuda-graph-trace=node','--wait=primary','--show-output=true','python3','-u',str(target_script)]+command
'''+anchor)
replace_once("(ROOT/'engine-process.json').write_text(json.dumps(process,indent=2)+'\\n')","(ROOT/'nsys-launch-process.json').write_text(json.dumps(dict(process,role='nsys-launch'),indent=2)+'\\n')")
start=source.index("        if PLAN.get('campaign')=='broad-warm-v1':")
end=source.index("        with (ROOT/'protocol.jsonl')",start)
source=source[:start]+'''        case=next(c for c in cases if c['name']=='prose-128')
        runs=[dict(case,role='warmup',repeat=i) for i in range(3)]+[dict(case,role='profiled')]
'''+source[end:]
replace_once("                start=time.monotonic();tokens=[];lines=[]",'''                if case['role']=='profiled':profile_tool('start');capture_active=True
                start=time.monotonic();tokens=[];lines=[]''')
replace_once('                if not tokens:raise RuntimeError',"                if capture_active:profile_tool('stop');capture_active=False\n                if not tokens:raise RuntimeError")
replace_once("    if child is not None and child.poll() is None:",'''    if capture_active:
        try:profile_tool('stop')
        except Exception as e:RESULT['capture_stop_error']=repr(e)
    if child is not None and child.poll() is None:
        target=ROOT/'profile-target-process.json'
        if target.exists():
            rec=json.loads(target.read_text());proc=Path('/proc/'+str(rec['pid']))
            if proc.exists() and rec['uid']==os.getuid() and rec['binary']==PLAN['binary']:
                descriptor=os.pidfd_open(rec['pid'])
                try:
                    if proc.stat().st_uid!=rec['uid'] or int((proc/'stat').read_text().split(') ',1)[1].split()[19])!=rec['start_ticks']:raise RuntimeError('profile target PID identity changed')
                    signal.pidfd_send_signal(descriptor,signal.SIGKILL)
                except ProcessLookupError:pass
                finally:os.close(descriptor)
    if child is not None and child.poll() is None:''')
ast.parse(source)
path=BASE/'xolotl_nsys_protocol_worker.frozen.py'
with path.open('x',encoding='utf-8',newline='\n') as f:f.write(source)
print(str(path))
