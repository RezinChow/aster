import json,subprocess,time,hashlib,sqlite3
from pathlib import Path
root=Path(__file__).resolve().parent;out=dict(phase='running',unix=time.time(),cuda_visible_devices='',commands=[])
try:
 trace=root/'warm-prose.nsys-rep'
 if trace.is_symlink() or trace.stat().st_uid!=10250 or not 0<trace.stat().st_size<512*1024**2:raise RuntimeError('profile trace bound differs')
 out['trace_bytes']=trace.stat().st_size;out['trace_sha256']=hashlib.sha256(trace.read_bytes()).hexdigest()
 args=['/usr/local/cuda/bin/nsys','stats','--report=cuda_api_sum,cuda_gpu_kern_sum,cuda_gpu_mem_time_sum,cuda_gpu_mem_size_sum','--format=csv','--output='+str(root/'statistics'),str(trace)]
 p=subprocess.run(args,capture_output=True,text=True,timeout=180)
 if len(p.stdout)>2*1024**2 or len(p.stderr)>2*1024**2:raise RuntimeError('statistics log bound exceeded')
 (root/'stats.stdout.log').write_text(p.stdout);(root/'stats.stderr.log').write_text(p.stderr);out['commands'].append(dict(args=args,exit=p.returncode))
 if p.returncode:raise RuntimeError('statistics failed')
 sql=root/'warm-prose.sqlite'
 if sql.is_symlink() or sql.stat().st_uid!=10250 or not 0<sql.stat().st_size<512*1024**2:raise RuntimeError('statistics SQLite bound differs')
 c=sqlite3.connect(sql.as_uri()+'?mode=ro',uri=True)
 if c.execute('pragma quick_check').fetchone()[0]!='ok':raise RuntimeError('profile SQLite integrity refused')
 out.update(phase='complete',sqlite_bytes=sql.stat().st_size,sqlite_integrity='ok')
except Exception as e:out.update(phase='failed',error=str(e))
out['finished_unix']=time.time();(root/'statistics-result.json').write_text(json.dumps(out,indent=2)+'\n')
