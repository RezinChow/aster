"""Frozen background real-SM90 controls for the new single-GPU executable."""
from xolotl_trial_common import BASE
s=(BASE/'qualify_xolotl_split_build.py').read_text()
for a,b in [('xolotl-h200-split-build-intent.json','xolotl-h200-device-verify-build-intent.json'),('xolotl-split-build-hardware-controls.json','xolotl-device-verify-hardware-controls.json'),('xolotl-split-build-latest.json','xolotl-device-verify-build-latest.json'),('xolotl_split_control_worker.frozen.py','xolotl_device_verify_control_worker.frozen.py'),('xolotl-split-controls-launch.json','xolotl-device-verify-controls-launch.json'),("time.time()+240>","time.time()+330>"),("'210','python3'","'300','python3'")]:
 if s.count(a)!=1:raise RuntimeError('control operator anchor differs: '+a)
 s=s.replace(a,b)
anchor=" out.update(phase='complete' if passed else 'failed',passed=passed,exit=p.returncode)"
extra=''' out['additional_controls']=[]
 if passed:
  for name in ['test_ds41_fq','test_ds41_hcmix']:
   meta=build['binaries'][name];binary=Path(meta['path'])
   if binary.stat().st_size!=meta['bytes'] or hashlib.sha256(binary.read_bytes()).hexdigest()!=meta['sha256']:raise RuntimeError('numerical control executable differs')
   q=subprocess.run([str(binary),'--cuda'],env=env,capture_output=True,text=True,timeout=20)
   if len(q.stdout)>32768 or len(q.stderr)>32768:raise RuntimeError('control output exceeds bound')
   ok=q.returncode==0 and 'fused == composite, bit for bit' in q.stdout and any(x.startswith('cuda ') for x in q.stdout.splitlines()) and not any(x.startswith('cpu ') for x in q.stdout.splitlines())
   out['additional_controls'].append(dict(name=name,passed=ok,exit=q.returncode,stdout=q.stdout,stderr=q.stderr))
   passed=passed and ok
'''
if s.count(anchor)!=1:raise RuntimeError('control result anchor differs')
s=s.replace(anchor,extra+anchor)
compile(s,'device-controls.py','exec');(BASE/'qualify_xolotl_device_verify_build.frozen.py').write_text(s)
exec(compile(s,'device-controls.py','exec'))
