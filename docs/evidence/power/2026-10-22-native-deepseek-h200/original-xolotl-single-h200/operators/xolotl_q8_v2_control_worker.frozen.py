from pathlib import Path
import hashlib,json,os,subprocess,time,math,array
root=Path(__file__).resolve().parent
out=dict(phase='running',started=time.time(),passed=False,claim='finite paired numerical tolerance, not bitwise equivalence',relative_l2_limit=2e-4,normalized_max_abs_limit=2e-4,tests=[])
try:
 b=json.loads((root/'build-result.json').read_text());meta=b['binaries']['aster_h200_q8_mmq'];p=Path(meta['path'])
 if p.stat().st_size!=meta['bytes'] or hashlib.sha256(p.read_bytes()).hexdigest()!=meta['sha256']:raise RuntimeError('Q8 control binary differs')
 rows=[]
 for mode in ['0','1']:
  d=root/('q8-output-'+mode);d.mkdir(mode=0o700,exist_ok=False)
  env={k:v for k,v in os.environ.items() if not k.startswith(('STRATA_','ASTER_'))};env.update(CUDA_VISIBLE_DEVICES='0',ASTER_H200_Q8_MMQ=mode)
  t=subprocess.run([str(p),mode,str(d)],env=env,capture_output=True,text=True,timeout=180)
  if len(t.stdout)>262144 or len(t.stderr)>262144:raise RuntimeError('Q8 log bounds differ')
  (root/('q8-'+mode+'.stdout.log')).write_text(t.stdout);(root/('q8-'+mode+'.stderr.log')).write_text(t.stderr)
  if t.returncode:raise RuntimeError('Q8 mode '+mode+' failed: '+str(t.returncode))
  rows.append([json.loads(line) for line in t.stdout.splitlines()])
 if len(rows[0])!=22 or len(rows[1])!=22:raise RuntimeError('Q8 case inventory differs')
 for a,b in zip(*rows):
  if any(a[k]!=b[k] for k in ['file','K','N','M']):raise RuntimeError('Q8 shape order differs')
  raw=[]
  for mode in ['0','1']:
   p=root/('q8-output-'+mode)/a['file']
   if p.name!=a['file'] or p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size!=a['N']*a['M']*4 or p.stat().st_size>32*1024**2:raise RuntimeError('Q8 array bounds differ')
   raw.append(p.read_bytes())
  x=array.array('f');x.frombytes(raw[0]);y=array.array('f');y.frombytes(raw[1])
  if not all(math.isfinite(v) for v in x) or not all(math.isfinite(v) for v in y):raise RuntimeError('nonfinite Q8 output')
  rel=math.sqrt(sum((u-v)**2 for u,v in zip(x,y))/max(1e-30,sum(u*u for u in x)))
  maximum=max(abs(u-v) for u,v in zip(x,y))/max(1.,max(abs(u) for u in x))
  exact=raw[0]==raw[1]
  passed=rel<=2e-4 and maximum<=2e-4 and (a['M']!=1 or exact) and a['mmvq'] is True and b['mmvq']==(a['M']==1)
  out['tests'].append(dict(K=a['K'],N=a['N'],M=a['M'],control_mean_us=a['mean_us'],mmq_mean_us=b['mean_us'],relative_l2=rel,normalized_max_abs=maximum,bitwise_equal=exact,passed=passed,output_sha256=[hashlib.sha256(v).hexdigest() for v in raw]))
 out.update(phase='complete',passed=all(t['passed'] for t in out['tests']))
except Exception as e:out.update(phase='failed',error=str(e))
out['unix']=time.time();(root/'q8-controls-result.json').write_text(json.dumps(out,indent=2)+'\n')
