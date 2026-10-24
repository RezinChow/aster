"""Read exact owned native process counters; never restart based on a timeout."""
import argparse
import importlib.util
import json
from pathlib import Path

parser=argparse.ArgumentParser();parser.add_argument('--attempt',choices=['first','hash-opt','deployment'],required=True);args=parser.parse_args()
BASE=Path('D:/code/aster/target/h200-native')
record=json.loads((BASE/{'first':'native-xq-full-model-first.json','hash-opt':'native-xq-full-model-hash-opt.json','deployment':'native-xq-full-model-deployment.json'}[args.attempt]).read_text())
spec=importlib.util.spec_from_file_location('r',BASE/'remote_readonly.py');remote=importlib.util.module_from_spec(spec);spec.loader.exec_module(remote)
inside='''from pathlib import Path
import os,json,time
root=Path(ROOT)
if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('native diagnostic root changed')
if os.getuid()==0:os.setgroups([]);os.setgid(root.stat().st_gid);os.setuid(10250)
if os.getuid()!=10250:raise RuntimeError('native counters require the exact process owner')
state=json.loads((root/'probe-result.json').read_text());expected=state['native_process'];p=Path('/proc/'+str(expected['pid']))
result=dict(unix=time.time(),pid=expected['pid'],exists=p.exists(),probe_phase=state['phase'])
if p.exists():
 fields=(p/'stat').read_text().split(') ',1)[1].split()
 if int(fields[19])!=expected['start_ticks'] or p.stat().st_uid!=10250:raise RuntimeError('native process identity changed')
 result.update(state=fields[0],user_ticks=int(fields[11]),system_ticks=int(fields[12]),rss_pages=int(fields[21]))
 result['io']={line.split(':',1)[0]:int(line.split(':',1)[1]) for line in (p/'io').read_text().splitlines()}
 # This container virtualizes /proc/uptime independently of PID start ticks.
 # Use the recorded UTC launch instead; this includes unpacking/bootstrap and
 # is explicitly a cumulative diagnostic rate, not a kernel/inference rate.
 elapsed=time.time()-LAUNCH_UNIX
 result['launch_elapsed_seconds']=elapsed
 result['cumulative_read_mib_per_launch_second']=result['io']['rchar']/1024**2/elapsed if elapsed>0 else None
out=root/'native.stdout.log'
if out.exists():
 if out.stat().st_size>4*1024**2:raise RuntimeError('native event log exceeds read bound')
 lines=out.read_text().splitlines()
 result['latest_native_event']=json.loads(lines[-1]) if lines else None
err=root/'native.stderr.log'
if err.exists():
 if err.stat().st_size>65536:raise RuntimeError('native error log exceeds read bound')
 result['native_stderr']=err.read_text()
print(json.dumps(result))
'''.replace('ROOT',repr(record['remote'])).replace('LAUNCH_UNIX',repr(record['process']['unix']))
code='''import subprocess,shlex
args=['brainctl','exec','-n','ailab-hrprdduanyan','replica/'+REPLICA,'--','python3','-c',INSIDE]
p=subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(args)],capture_output=True,text=True,timeout=30,check=True)
print(p.stdout)
'''.replace('INSIDE',repr(inside)).replace('REPLICA',repr(record['replica']))
result=remote.inspect_jump(code,timeout=50)
path=BASE/('native-xq-full-'+args.attempt+'-io-'+str(int(result['unix']))+'.json');path.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
