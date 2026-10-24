"""Start the already frozen four-replica operator only after its exact prerequisite passes."""
import base64, json, shlex, subprocess, time
from pathlib import Path
BASE = Path('D:/code/aster/target/h200-native')
path = BASE / 'native-xq-service-deployment.json'
record = json.loads(path.read_text())
if record['phase'] != 'verified' or 'process' in record:
    raise RuntimeError('inspect existing replica launch before proceeding')
bootstrap = "from pathlib import Path\nimport os,json,subprocess,time,hashlib\nrecord=RECORD\nroot=Path(record['remote'])\nif root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('native service stage owner changed')\nif os.getuid()==0:os.setgroups([]);os.setgid(root.stat().st_gid);os.setuid(10250)\nif os.getuid()!=10250:raise RuntimeError('native service operator requires its exact owner')\nos.umask(0o077)\nif any((root/name).exists() for name in ['process.json','worker.log','service-result.json']):raise RuntimeError('service intent already has a process or result; inspect it')\nfor value in record['files']:\n p=root/value['file']\n if p.is_symlink() or not p.is_file() or p.stat().st_uid!=10250 or p.stat().st_size!=value['bytes'] or hashlib.sha256(p.read_bytes()).hexdigest()!=value['sha256']:raise RuntimeError('frozen service input changed')\ninputs=json.loads((root/'deploy-inputs.json').read_text());proof=json.loads(Path(inputs['resource_proof']).read_text())\ndeadline=int(proof['leaseEndsUnix']-time.time()-30)\nif proof['phase']!='passed' or deadline<1800:raise RuntimeError('owned lease is too short for native service startup')\nwith (root/'worker.log').open('xb',buffering=0) as log:\n child=subprocess.Popen(['timeout','--signal=TERM','--kill-after=30',str(deadline),'python3','-u',str(root/'worker.py')],cwd=root,stdout=log,stderr=log,start_new_session=True)\n ticks=int(Path('/proc/'+str(child.pid)+'/stat').read_text().split(') ',1)[1].split()[19])\n process=dict(pid=child.pid,start_ticks=ticks,uid=os.getuid(),unix=time.time(),deadline_seconds=deadline)\n(root/'process.json').write_text(json.dumps(process,indent=2)+chr(10))\nprint(json.dumps(process))\n".replace('RECORD', repr(record))
compile(bootstrap, 'replica-bootstrap', 'exec')
code = "import subprocess,shlex,json\nrecord=RECORD;bootstrap=BOOTSTRAP\ndef cli(args):return subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(args)],capture_output=True,text=True,timeout=35,check=True)\nfor kind,name,uid in [('rjob',record['allocation_job'],record['allocation_uid']),('replica',record['replica'],record['replica_uid'])]:\n value=json.loads(cli(['brainctl','get',kind,name,'-n','ailab-hrprdduanyan','-o','json']).stdout)\n if value['metadata']['uid']!=uid or value['status']['phase']!='Running':raise RuntimeError('owned allocation no longer running with expected UID')\nprint(cli(['brainctl','exec','-n','ailab-hrprdduanyan','replica/'+record['replica'],'--','python3','-c',bootstrap]).stdout)\n".replace('RECORD', repr(record)).replace('BOOTSTRAP', repr(bootstrap))
wrapper = 'python3 -c ' + shlex.quote('import base64;exec(base64.b64decode(' + repr(base64.b64encode(code.encode()).decode()) + '))')
command = ['ssh', '-C', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'HostName=10.102.254.2', '-o', 'HostKeyAlias=h.pjlab.org.cn', 'yangchao-dev.yangchao.ailab-hrprdduanyan.ws@h.pjlab.org.cn', wrapper]
record['phase'] = 'launch_requested'
path.write_text(json.dumps(record, indent=2) + '\n')
response = subprocess.run(command, capture_output=True, text=True, timeout=75)
if response.returncode:
    raise RuntimeError('replica launch needs inspection: ' + response.stderr[-5000:])
record['process'] = json.loads(response.stdout)
record['phase'] = 'launched'
record['launched_unix'] = time.time()
path.write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(record, indent=2))
