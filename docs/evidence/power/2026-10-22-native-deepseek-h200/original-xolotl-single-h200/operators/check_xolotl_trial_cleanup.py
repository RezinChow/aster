"""Exercise the actual worker's signal handler/finally on owned CPU-only children."""
import ast,hashlib,json
from xolotl_trial_common import BASE,owned
source=(BASE/'xolotl_protocol_trial_worker.py').read_text();tree=ast.parse(source)
handler=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='interrupt_trial']
main=[n for n in tree.body if isinstance(n,ast.Try)]
if len(handler)!=1 or len(main)!=1:raise RuntimeError('worker cleanup AST differs')
cleanup=ast.unparse(ast.Module(body=main[0].finalbody,type_ignores=[]));handler=ast.unparse(handler[0])
code='''import os,json,subprocess,signal,threading,time,errno,hashlib
from pathlib import Path
handler=@HANDLER@;cleanup=@CLEANUP@
if os.getuid()!=10250:raise RuntimeError('cleanup controls must be owner-only')
results=[]
for name in ['alarm','termination']:
 child=subprocess.Popen(['python3','-c','import time; time.sleep(30)'],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
 pidfd=os.pidfd_open(child.pid);stop=threading.Event();telemetry=[];RESULT={}
 def save():pass
 exec(handler,globals());signal.signal(signal.SIGTERM,interrupt_trial);signal.signal(signal.SIGALRM,interrupt_trial)
 caught=False
 try:
  if name=='alarm':signal.setitimer(signal.ITIMER_REAL,.05)
  else:
   def terminate_self():time.sleep(.05);os.kill(os.getpid(),signal.SIGTERM)
   threading.Thread(target=terminate_self,daemon=True).start()
  time.sleep(3)
 except TimeoutError:caught=True
 finally:exec(cleanup,globals())
 closed=False
 try:os.fstat(pidfd)
 except OSError as e:closed=e.errno==errno.EBADF
 passed=caught and RESULT.get('engine_reaped') is True and RESULT.get('engine_exit')==-signal.SIGTERM and closed
 results.append(dict(case=name,passed=passed,child_exit=child.returncode,pidfd_closed=closed))
 if not passed:raise RuntimeError('actual worker cleanup control failed')
print(json.dumps(dict(passed=all(r['passed'] for r in results),gpu_work_performed=False,worker_candidate_sha256=@SHA@,cases=results)))
'''.replace('@HANDLER@',repr(handler)).replace('@CLEANUP@',repr(cleanup)).replace('@SHA@',repr(hashlib.sha256(source.encode()).hexdigest()))
compile(code,'cleanup-control.py','exec')
v=owned(code);(BASE/'xolotl-trial-cleanup-controls.json').write_text(json.dumps(v,indent=2)+'\n');print(json.dumps(v,indent=2))
