"""Launch a bounded CPU-only summary of the exact completed owned profile."""
import json
from xolotl_trial_common import BASE,owned,observe

intent=json.loads((BASE/'xolotl-single-current-profile-prose-v2-intent.json').read_text())
code='''from pathlib import Path
import os,json,subprocess,time
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('profile root ownership differs')
result=json.loads((root/'result.json').read_text())
if result['phase']!='complete' or not result['engine_reaped']:raise RuntimeError('profile workload not complete/reaped')
trace=root/'warm-prose.nsys-rep'
if trace.is_symlink() or trace.stat().st_uid!=10250 or not 0<trace.stat().st_size<512*1024**2:raise RuntimeError('profile artifact differs')
if (root/'statistics-launch.json').exists():raise RuntimeError('statistics already launched; observe existing work')
worker=root/'statistics-worker.py'
worker.write_text(@WORKER@)
env=os.environ.copy();env['CUDA_VISIBLE_DEVICES']=''
log=(root/'statistics-worker.log').open('xb')
p=subprocess.Popen(['python3','-u',str(worker)],stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,env=env,start_new_session=True)
record=dict(pid=p.pid,start_ticks=Path('/proc/'+str(p.pid)+'/stat').read_text().split()[21],root=str(root),unix=time.time(),cuda_visible_devices='')
(root/'statistics-launch.json').write_text(json.dumps(record,indent=2)+'\\n')
print(json.dumps(record))
'''
worker='''import json,subprocess,time,hashlib
from pathlib import Path
root=Path(__file__).parent
out=dict(phase='running',started=time.time(),commands=[])
try:
 for args,name in [(['nsys','stats','--report=cuda_api_sum,cuda_gpu_kern_sum,cuda_gpu_mem_time_sum,cuda_gpu_mem_size_sum','--format=csv','--output='+str(root/'statistics'),str(root/'warm-prose.nsys-rep')],'stats'),(['nsys','export','--type=sqlite','--output='+str(root/'warm-prose.sqlite'),str(root/'warm-prose.nsys-rep')],'export')]:
  p=subprocess.run(args,capture_output=True,text=True,timeout=180)
  (root/(name+'.stdout.log')).write_text(p.stdout);(root/(name+'.stderr.log')).write_text(p.stderr)
  out['commands'].append(dict(name=name,exit=p.returncode))
  if p.returncode:raise RuntimeError(name+' failed: '+p.stderr[-1000:])
 out['phase']='complete'
except Exception as e:out.update(phase='failed',error=str(e))
out['unix']=time.time()
(root/'statistics-result.json').write_text(json.dumps(out,indent=2)+'\\n')
'''
compile(worker,'statistics-worker.py','exec')
code=code.replace('@ROOT@',repr(intent['root'])).replace('@WORKER@',repr(worker))
compile(code,'statistics-launch.py','exec')
observe()
r=owned(code)
(BASE/'xolotl-profile-statistics-launch.json').write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps(r,indent=2))
