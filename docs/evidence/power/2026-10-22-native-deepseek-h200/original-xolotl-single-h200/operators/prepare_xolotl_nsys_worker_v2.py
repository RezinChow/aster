"""Correct the unsupported Nsight start switch; retain the first failed worker."""
import ast
from xolotl_trial_common import BASE
source=(BASE/'xolotl_nsys_protocol_worker.frozen.py').read_text()
for a,b in [("'--duration=20',",''),('deadline=start+600',"deadline=start+(20 if case['role']=='profiled' else 600)"),('target=sample,daemon=True','target=lambda:None,daemon=True')]:
 if source.count(a)!=1:raise RuntimeError('reviewed profile correction anchor changed')
 source=source.replace(a,b)
anchor="        child.stdin.write('QUIT\\n');child.stdin.flush();child.wait(timeout=30)"
addition='''        trace=ROOT/'warm-prose.nsys-rep'
        if not trace.is_file() or trace.stat().st_uid!=os.getuid() or not 0<trace.stat().st_size<=512*1024**2:raise RuntimeError('diagnostic trace missing, foreign or exceeds bound')
        import hashlib
        RESULT['trace']=dict(file=str(trace),bytes=trace.stat().st_size,sha256=hashlib.sha256(trace.read_bytes()).hexdigest(),diagnostic_only=True)
'''
if source.count(anchor)!=1:raise RuntimeError('profile shutdown anchor changed')
source=source.replace(anchor,addition+anchor)
tree=ast.parse(source)
calls=[n for n in ast.walk(tree) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and isinstance(n.func.value,ast.Name) and n.func.value.id=='target_script']
if len(calls)!=1:raise RuntimeError('profile target derivation differs')
compile(ast.literal_eval(calls[0].args[0]),'verified-profile-exec-target','exec')
path=BASE/'xolotl_nsys_protocol_worker_v2.frozen.py'
with path.open('x',encoding='utf-8',newline='\n') as f:f.write(source)
print(str(path))
