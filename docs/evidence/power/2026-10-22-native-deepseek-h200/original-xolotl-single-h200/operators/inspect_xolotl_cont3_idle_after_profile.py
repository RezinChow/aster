"""Prove the exact profile target is gone and the owned GPU currently idle."""
import json,shutil
from xolotl_trial_common import BASE,WORK,owned,lease
r=lease()
if r['submitted']['uid']!='662c0a01-26eb-4e72-9d39-2e07ef2619c0':raise RuntimeError('idle proof lease differs')
intent=json.loads((BASE/'xolotl-single-current-qsum-v2-profile-intent.json').read_text())
code='''from pathlib import Path
import json,subprocess,time,os
root=Path(@ROOT@);rec=json.loads((root/'profile-target-process.json').read_text());proc=Path('/proc/'+str(rec['pid']))
same=False
if proc.exists():same=proc.stat().st_uid==rec['uid'] and int((proc/'stat').read_text().split(') ',1)[1].split()[19])==rec['start_ticks']
if same:raise RuntimeError('exact profiled target is still alive')
p=subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,check=True,timeout=8)
if p.stdout.strip():raise RuntimeError('owned GPU has an active workload')
print(json.dumps(dict(unix=time.time(),profile_target_pid=rec['pid'],profile_target_start_ticks=rec['start_ticks'],profile_target_gone=True,gpu_idle=True,active_compute_apps=p.stdout,resources_still_reserved=True)))
'''.replace('@ROOT@',repr(intent['root']))
o=owned(code);p=BASE/'xolotl-cont3-after-profile-idle.json';p.write_text(json.dumps(o,indent=2)+'\n');d=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200';shutil.copy2(p,d/p.name);shutil.copy2(BASE/'inspect_xolotl_cont3_idle_after_profile.py',d/'operators/inspect_xolotl_cont3_idle_after_profile.py');print(json.dumps(o))
