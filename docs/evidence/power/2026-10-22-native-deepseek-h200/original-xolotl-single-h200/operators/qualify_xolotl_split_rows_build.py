"""Real SM90 row2/row4 bitwise grouped controls, plus existing dense controls."""
from xolotl_trial_common import BASE
s=(BASE/'qualify_xolotl_device_verify_build.frozen.py').read_text()
for a,b in [('xolotl-h200-device-verify-build-intent.json','xolotl-h200-split-rows-build-intent.json'),('xolotl-device-verify-hardware-controls.json','xolotl-split-rows-hardware-controls.json'),('xolotl-device-verify-build-latest.json','xolotl-split-rows-build-latest.json'),('xolotl_device_verify_control_worker.frozen.py','xolotl_split_rows_control_worker.frozen.py'),('xolotl-device-verify-controls-launch.json','xolotl-split-rows-controls-launch.json')]:
 if s.count(a)!=1:raise RuntimeError('row control derivation anchor differs: '+a)
 s=s.replace(a,b)
start=s.index(" p=subprocess.run([str(p),'--aster-xq']")
end=s.index(" out['additional_controls']=[]",start)
block=''' binary=p;out['row_controls']=[];passed=True
 stdout=[];stderr=[]
 for selected_rows in ['2','4']:
  env['ASTER_XQ_SPLIT_ROWS']=selected_rows
  p=subprocess.run([str(binary),'--aster-xq'],env=env,capture_output=True,text=True,timeout=180)
  if len(p.stdout)>262144 or len(p.stderr)>262144:raise RuntimeError('row control output bounds exceeded')
  ok=p.returncode==0 and 'Aster split GPU: NVIDIA H200, SM90' in p.stdout.splitlines() and 'aster_xq_split_parity: 0 failures' in p.stdout.splitlines() and p.stdout.count('bitwise equal to the old kernels')==12
  out['row_controls'].append(dict(rows=int(selected_rows),passed=ok,exit=p.returncode,stdout=p.stdout,stderr=p.stderr))
  stdout.append('ROWS='+selected_rows+'\\\\n'+p.stdout);stderr.append(p.stderr);passed=passed and ok
 (root/'controls.stdout.log').write_text('\\\\n'.join(stdout));(root/'controls.stderr.log').write_text('\\\\n'.join(stderr))
'''
s=s[:start]+block+s[end:]
compile(s,'split-rows-controls.py','exec');(BASE/'qualify_xolotl_split_rows_build.frozen.py').write_text(s)
exec(compile(s,'split-rows-controls.py','exec'))
