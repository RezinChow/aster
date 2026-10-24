from pathlib import Path
import hashlib,json,os,subprocess,time
root=Path(__file__).resolve().parent
out=dict(phase='running',started=time.time(),cuda_visible_devices='0',passed=False)
try:
 build=json.loads((root/'build-result.json').read_text());meta=build['binaries']['aster_xq_split_parity'];p=Path(meta['path'])
 if p.stat().st_size!=meta['bytes'] or hashlib.sha256(p.read_bytes()).hexdigest()!=meta['sha256']:raise RuntimeError('split control binary identity differs')
 env={k:v for k,v in os.environ.items() if not k.startswith(('STRATA_','ASTER_XQ_'))};env.update(CUDA_VISIBLE_DEVICES='0',ASTER_XQ_SPLIT_MMVQ='both')
 p=subprocess.run([str(p),'--aster-xq'],env=env,capture_output=True,text=True,timeout=180)
 if len(p.stdout)>262144 or len(p.stderr)>262144:raise RuntimeError('control output bounds exceeded')
 (root/'controls.stdout.log').write_text(p.stdout);(root/'controls.stderr.log').write_text(p.stderr)
 passed=p.returncode==0 and 'Aster split GPU: NVIDIA H200, SM90' in p.stdout.splitlines() and 'aster_xq_split_parity: 0 failures' in p.stdout.splitlines() and p.stdout.count('bitwise equal to the old kernels')==12
 out['additional_controls']=[]
 if passed:
  for name in ['test_ds41_fq','test_ds41_hcmix']:
   meta=build['binaries'][name];binary=Path(meta['path'])
   if binary.stat().st_size!=meta['bytes'] or hashlib.sha256(binary.read_bytes()).hexdigest()!=meta['sha256']:raise RuntimeError('numerical control executable differs')
   q=subprocess.run([str(binary),'--cuda'],env=env,capture_output=True,text=True,timeout=20)
   if len(q.stdout)>32768 or len(q.stderr)>32768:raise RuntimeError('control output exceeds bound')
   ok=q.returncode==0 and 'fused == composite, bit for bit' in q.stdout and any(x.startswith('cuda ') for x in q.stdout.splitlines()) and not any(x.startswith('cpu ') for x in q.stdout.splitlines())
   out['additional_controls'].append(dict(name=name,passed=ok,exit=q.returncode,stdout=q.stdout,stderr=q.stderr))
   passed=passed and ok
 out.update(phase='complete' if passed else 'failed',passed=passed,exit=p.returncode)
except Exception as e:out.update(phase='failed',error=str(e))
out['unix']=time.time();(root/'controls-result.json').write_text(json.dumps(out,indent=2)+'\n')
