"""Activate the verified public preparation bundle and replace only its owned waiter."""
from pathlib import Path
import json
import time
from remote_readonly import inspect_jump

ROOT=Path(__file__).resolve().parents[2]
EVIDENCE=ROOT/'docs/evidence/power/2026-10-22-native-deepseek-h200'

REMOTE=r'''
from pathlib import Path
import fcntl,hashlib,json,os,secrets,shutil,signal,subprocess,sys,time,shlex
root=Path('/mnt/shared-storage-user/yangchao/Workspace/aster-h200-xq')
release=Path(RELEASE)
expected_archive=ARCHIVE
expected_old_manifest=BASELINE
old_pid=244040;old_ticks=256235785;download_pid=217634;download_ticks=255375652
transaction=root/'logs'/('preparation-upgrade-'+release.name+'.json')
if transaction.exists():raise RuntimeError('an upgrade record exists; inspect it instead of repeating activation')
record={'unix':time.time(),'release':str(release),'phase':'validating','old_launcher_pid':old_pid,'old_launcher_start_ticks':old_ticks,'downloaders_changed':False}
def publish():
 temporary=transaction.with_suffix('.tmp');temporary.write_text(json.dumps(record,indent=2));temporary.replace(transaction)
def process(pid):
 try:
  p=Path(f'/proc/{pid}');v=(p/'stat').read_text().rsplit(')',1)[1].split()
  return {'state':v[0],'ticks':int(v[19]),'uid':p.stat().st_uid,'argv':(p/'cmdline').read_bytes().split(bytes([0]))}
 except FileNotFoundError:return None
def owned_waiter():
 p=process(old_pid)
 return p and p['ticks']==old_ticks and p['uid']==os.getuid() and os.fsencode(str(root/'deferred_launch.py')) in p['argv'] and p['state']not in('Z','X')
def before_submission():
 if (root/'deployment-state.json').exists() or len(list((root/'assets/v3').glob('*.gguf.part-??-of-16')))==16:
  raise RuntimeError('waiter may be submitting; do not replace it')
def verify_downloader():
 p=process(download_pid)
 if not p or p['ticks']!=download_ticks or p['uid']!=os.getuid() or p['state']in('Z','X'):raise RuntimeError('original downloader identity is no longer live')
def start_waiter(label):
 before_submission()
 marker=secrets.token_hex(16)
 log_path=root/'logs'/('deferred-'+label+'-'+release.name+'.log')
 with log_path.open('ab',buffering=0) as output:
  command='. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join([sys.executable,'-u',str(root/'deferred_launch.py')])
  child=subprocess.Popen(['bash','-lc',command],cwd=root,stdin=subprocess.DEVNULL,stdout=output,stderr=subprocess.STDOUT,env={**os.environ,'A3S_POWER_OPERATOR_INSTANCE':marker},start_new_session=True)
 identity=process(child.pid)
 if not identity:raise RuntimeError('replacement waiter exited before identity capture')
 result={'pid':child.pid,'start_ticks':identity['ticks'],'uid':identity['uid'],'log':str(log_path)}
 record[label+'_launcher']=result;publish()
 deadline=time.monotonic()+40
 while time.monotonic()<deadline:
  identity=process(child.pid)
  if not identity or identity['ticks']!=result['start_ticks']or identity['state']in('Z','X'):raise RuntimeError('replacement waiter exited during preflight')
  if b'WAITING_WITHOUT_GPU_RESERVATION' in log_path.read_bytes()[-65536:]:
   result['waiting_without_gpu_reservation']=True
   return result
  time.sleep(.2)
 raise RuntimeError('replacement waiter is live but its preflight observation expired')
publish();verify_downloader();before_submission()
if not owned_waiter():raise RuntimeError('waiting launcher ownership did not match; nothing was changed')
saved=json.loads((release/'prepared-release.json').read_text())
if not saved.get('successful')or saved.get('archive_sha256')!=expected_archive or not saved.get('prepared_preflight',{}).get('nonweight_ready'):raise RuntimeError('prepared release qualification did not match')
if hashlib.sha256((root/'operator-files.json').read_bytes()).hexdigest()!=expected_old_manifest:raise RuntimeError('active operator manifest changed since inspection')
old_manifest=json.loads((root/'operator-files.json').read_text());new_manifest=json.loads((release/'operator-files.json').read_text())
old_map={x['file']:x['sha256']for x in old_manifest};new_map={x['file']:x['sha256']for x in new_manifest}
if set(old_map)!=set(new_map):raise RuntimeError('this activation cannot add or remove operators')
for name,sha in old_map.items():
 p=root/name
 if Path(name).name!=name or p.is_symlink()or not p.is_file()or p.stat().st_size>1024**2 or hashlib.sha256(p.read_bytes()).hexdigest()!=sha:raise RuntimeError('active operator bytes no longer match their recorded manifest')
sys.path.insert(0,str(release));import remote_install
record['prepared_preflight']=remote_install.verify_staging(root,release);publish()
changed=[name for name in old_map if old_map[name]!=new_map[name]]+['operator-files.json','a3s-power-glibc235.gz']
backup=release/'active-before';backup.mkdir(mode=0o700,exist_ok=False)
for name in changed:
 p=root/name
 if p.is_symlink()or p.stat().st_size>16*1024**2:raise RuntimeError('unsafe preparation backup source')
 shutil.copy2(p,backup/name)
record['changed_files']=changed;record['backup']=str(backup);publish()
suspended=False;terminated=False;modified=False;guard=None;new_started=False
try:
 os.kill(old_pid,signal.SIGSTOP);suspended=True
 deadline=time.monotonic()+3
 while process(old_pid)['state']not in('T','t'):
  if time.monotonic()>deadline:raise RuntimeError('could not quiesce the owned waiter')
  time.sleep(.05)
 if not owned_waiter():raise RuntimeError('waiter identity changed before replacement')
 before_submission();verify_downloader()
 record['phase']='old_waiter_quiesced';publish()
 os.kill(old_pid,signal.SIGTERM);os.kill(old_pid,signal.SIGCONT);suspended=False;terminated=True
 deadline=time.monotonic()+5
 while owned_waiter():
  if time.monotonic()>deadline:raise RuntimeError('old waiter did not terminate; no duplicate will be started')
  time.sleep(.05)
 guard=(root/'deferred-launch.lock').open('a');fcntl.flock(guard,fcntl.LOCK_EX|fcntl.LOCK_NB)
 before_submission()
 for name in changed:
  temporary=root/(name+'.native-t004.tmp');shutil.copy2(release/name,temporary);temporary.replace(root/name);modified=True
 record['phase']='software_published';publish()
 record['active_preflight']=remote_install.run_preflight();verify_downloader();before_submission();publish()
 guard.close();guard=None
 new_started=True
 record['new_launcher']=start_waiter('new')
 record['phase']='complete';record['download_identity_unchanged']=True;record['completed_unix']=time.time();publish()
except BaseException as error:
 record['failure_type']=type(error).__name__
 if suspended and owned_waiter():os.kill(old_pid,signal.SIGCONT);suspended=False
 # If a new waiter has started, an observation failure must never start
 # another one or revert code underneath it. Retain its live identity.
 if terminated and not new_started and guard is not None:
  for name in changed:
   temporary=root/(name+'.native-t004-rollback.tmp');shutil.copy2(backup/name,temporary);temporary.replace(root/name)
  record['software_rolled_back']=True;guard.close();guard=None
  record['rollback_launcher']=start_waiter('rollback')
 record['phase']='needs_inspection';publish();raise
finally:
 if guard is not None:guard.close()
 if suspended and owned_waiter():os.kill(old_pid,signal.SIGCONT)
print(json.dumps(record))
'''


def main():
    prepared=json.loads((EVIDENCE/'xq-prepared-release.json').read_text(encoding='utf-8'))
    baseline=json.loads((EVIDENCE/'xq-prepared-operator-baseline.json').read_text(encoding='utf-8'))
    code=REMOTE.replace('RELEASE',repr(prepared['release'])).replace('ARCHIVE',repr(prepared['archive_sha256'])).replace('BASELINE',repr(baseline['manifest_sha256']))
    (ROOT/'target/h200-native/t004-release/activation-intent.json').write_text(json.dumps({'release':prepared['release'],'started_unix':time.time(),'old_launcher_pid':244040,'old_launcher_start_ticks':256235785},indent=2)+'\n',encoding='utf-8')
    data=inspect_jump(code,timeout=120)
    (EVIDENCE/'xq-preparation-activation.json').write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(data))


if __name__=='__main__':
    main()
