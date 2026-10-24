import json,subprocess,time,hashlib
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
(root/'statistics-result.json').write_text(json.dumps(out,indent=2)+'\n')
