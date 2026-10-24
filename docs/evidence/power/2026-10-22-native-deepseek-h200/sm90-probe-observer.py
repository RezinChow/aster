"""Observe the exact current owned job; never submit, restart, or stop it."""
import importlib.util,json,time
from pathlib import Path
s=importlib.util.spec_from_file_location('remote','target/h200-native/remote_readonly.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
record=json.loads(Path('target/h200-native/t008-probe-current-submission.json').read_text())
code='''import subprocess,json,time,hashlib
from pathlib import Path
root=Path(REMOTE)
p=subprocess.run(['brainctl','get','rjob',JOB,'-n','ailab-hrprdduanyan','-o','json'],capture_output=True,text=True,check=True,timeout=15);j=json.loads(p.stdout)
if j['metadata']['uid']!=UID or j['metadata'].get('annotations',{}).get('kubebrain.brainpp.cn/showname')!=SHOWNAME:raise RuntimeError('owner identity mismatch')
for file,expected in HASHES.items():
 if hashlib.sha256((root/file).read_bytes()).hexdigest()!=expected:raise RuntimeError('submitted artifact identity mismatch')
e=subprocess.run(['brainctl','get','events','-n','ailab-hrprdduanyan','--field-selector','involvedObject.uid='+UID,'-o','json'],capture_output=True,text=True,check=True,timeout=15)
print(json.dumps({'unix':time.time(),'rjob':JOB,'uid':UID,'artifact_hashes_match':True,'status':j.get('status',{}),'events':[{'time':x.get('lastTimestamp'),'reason':x.get('reason'),'message':x.get('message')} for x in json.loads(e.stdout)['items']],'result':json.loads((root/'result.json').read_text()) if (root/'result.json').exists() else None,'log':(root/'worker.log').read_text()[-12000:] if (root/'worker.log').exists() else None}))
'''.replace('REMOTE',repr(record['remote'])).replace('JOB',repr(record['rjob'])).replace('UID',repr(record['uid'])).replace('SHOWNAME',repr(record['showname'])).replace('HASHES',repr(record['files']))
result=m.inspect_jump(code,timeout=40)
path=Path('docs/evidence/power/2026-10-22-native-deepseek-h200')/('sm90-current-job-'+str(int(result['unix']))+'.json')
path.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
