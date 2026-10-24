"""Resume after the documented source-packaging failure, preserving v1 evidence."""
import gzip,hashlib,json,os,shutil,subprocess,tarfile,time
from pathlib import Path,PurePosixPath
ROOT=Path(__file__).resolve().parent
START=time.time();RESULT={'schema':'aster-native-linux-cuda-build-v2','GPU_execution_claimed':False,'tests_ran':False}
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def publish():
 p=ROOT/'build-result.tmp';p.write_text(json.dumps(RESULT,indent=2)+'\n');p.replace(ROOT/'build-result.json')
def extract(archive,destination):
 destination.mkdir(mode=0o700)
 with tarfile.open(archive,'r:gz') as source:
  members=source.getmembers()
  if len(members)>32768 or sum(x.size for x in members)>128*1024**2:raise RuntimeError('source snapshot exceeds build bounds')
  for item in members:
   name=PurePosixPath(item.name)
   if name.is_absolute() or '..' in name.parts or not item.isfile():raise RuntimeError('source snapshot requires bounded regular paths')
   target=destination.joinpath(*name.parts);target.parent.mkdir(parents=True,exist_ok=True)
   with target.open('xb') as output:shutil.copyfileobj(source.extractfile(item),output)
   target.chmod(0o600)
def main():
 manifest=json.loads((ROOT/'resume-source-v2.json').read_text());previous=json.loads((ROOT/'build-result.json').read_text())
 if previous.get('schema')!='aster-native-linux-cuda-build-v1' or previous.get('exit_code')!=101:raise RuntimeError('resume is only for the retained first build failure')
 expected="can't find `sandbox_smoke_test` example at `examples/sandbox_smoke_test.rs`"
 if expected not in (ROOT/'build.stderr.log').read_text():raise RuntimeError('first source-packaging failure no longer matches')
 for name in ['build-result.json','build.stderr.log','build.stdout.jsonl']:
  target=ROOT/('v1-'+name)
  if target.exists():raise RuntimeError('prior failure backup already exists; inspect before resuming')
  shutil.copy2(ROOT/name,target)
 intent=ROOT/'resume-source-v2-started.json'
 with intent.open('x') as stream:json.dump({'unix':time.time(),'uid':os.getuid(),'inputs':manifest},stream)
 archive=ROOT/'native-root-source.v2.tar.gz'
 if digest(archive)!=manifest['source_archive_sha256']:raise RuntimeError('source v2 transfer mismatch')
 work=Path('/tmp/output');source=work/'source'
 if work.is_symlink() or work.stat().st_uid!=os.getuid() or source.is_symlink():raise RuntimeError('build directory ownership mismatch')
 for name,sha in manifest['root_identity'].items():
  if digest(source/name)!=sha:raise RuntimeError('original root build identity changed')
 source.rename(work/'source.v1');extract(archive,source)
 for name,sha in manifest['root_identity'].items():
  if digest(source/name)!=sha:raise RuntimeError('new root build identity differs')
 env=dict(os.environ)
 env.update(PATH=str(work/'rust/bin')+':/usr/local/cuda/bin:'+env.get('PATH',''),CARGO_HOME=str(work/'cargo-home'),RUSTC=str(work/'rust/bin/rustc'),CARGO_TARGET_DIR=str(work/'target'),CARGO_BUILD_JOBS='8',CUDA_COMPUTE_CAP='90',CUDA_HOME='/usr/local/cuda',CUDA_ROOT='/usr/local/cuda',LIBRARY_PATH='/usr/local/cuda/lib64/stubs:/usr/local/cuda/lib64:'+env.get('LIBRARY_PATH',''))
 RESULT.update(unix=time.time(),uid=os.getuid(),inputs=manifest,versions=previous['versions'],phase='metadata',root_identity=manifest['root_identity']);publish()
 metadata=['cargo','metadata','--locked','--offline','--no-deps','--format-version=1']
 with (ROOT/'metadata-v2.json').open('w') as stdout,(ROOT/'metadata-v2.stderr.log').open('w') as stderr:
  p=subprocess.run(metadata,cwd=source,env=env,stdout=stdout,stderr=stderr,timeout=60)
 RESULT['metadata_exit_code']=p.returncode;publish()
 if p.returncode:raise RuntimeError('root workspace source v2 metadata refused; retain exact log')
 command=['cargo','test','-p','a3s-deepseek','--locked','--offline','--features','cuda','--lib','--no-run','--message-format=json']
 RESULT.update(phase='compiling',command=command);publish()
 with (ROOT/'build.stdout.jsonl').open('w') as stdout,(ROOT/'build.stderr.log').open('w') as stderr:
  p=subprocess.run(command,cwd=source,env=env,stdout=stdout,stderr=stderr,timeout=1500)
 RESULT.update(exit_code=p.returncode,elapsed_seconds=time.time()-START)
 if p.returncode:raise RuntimeError('Linux CUDA compilation failed; retain exact compiler output')
 artifacts=[]
 for line in (ROOT/'build.stdout.jsonl').read_text().splitlines():
  r=json.loads(line)
  if r.get('reason')=='compiler-artifact' and r.get('target',{}).get('name')=='a3s_deepseek' and r.get('profile',{}).get('test') and r.get('executable'):artifacts.append(Path(r['executable']))
 if len(artifacts)!=1 or not artifacts[0].resolve().is_relative_to((work/'target').resolve()):raise RuntimeError('build must produce one owned Rust test executable')
 binary=artifacts[0];destination=ROOT/'a3s-deepseek-cuda-tests.gz'
 with binary.open('rb') as source,gzip.open(destination,'wb',compresslevel=1) as output:shutil.copyfileobj(source,output)
 destination.chmod(0o600)
 RESULT.update(binary_sha256=digest(binary),binary_bytes=binary.stat().st_size,archive_sha256=digest(destination),archive_bytes=destination.stat().st_size,phase='built',finished_unix=time.time())
 for name,args in [('dynamic_dependencies',['ldd',str(binary)]),('symbol_versions',['readelf','--version-info',str(binary)])]:
  checked=subprocess.run(args,capture_output=True,text=True,timeout=15);(ROOT/(name+'.txt')).write_text(checked.stdout+checked.stderr);RESULT[name+'_exit']=checked.returncode
 publish()
try:main()
except Exception as error:
 RESULT.update(phase='failed',error_type=type(error).__name__,error=str(error),finished_unix=time.time());publish();raise
finally:print(json.dumps(RESULT),flush=True)
