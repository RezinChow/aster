"""Compile the verified current snapshot after the retained identity refusal."""
import gzip,hashlib,json,os,shutil,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent;START=time.time()
RESULT={'schema':'aster-native-linux-cuda-build-v3','tests_ran':False,'GPU_execution_claimed':False}
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def publish():
 p=ROOT/'build-result.tmp';p.write_text(json.dumps(RESULT,indent=2)+'\n');p.replace(ROOT/'build-result.json')
def main():
 inputs=json.loads((ROOT/'resume-source-v3.json').read_text());previous=json.loads((ROOT/'build-result.json').read_text())
 if previous.get('schema')!='aster-native-linux-cuda-build-v2' or previous.get('error')!='new root build identity differs':raise RuntimeError('expected source identity refusal was not retained')
 shutil.copy2(ROOT/'build-result.json',ROOT/'v2-build-result.json')
 with (ROOT/'resume-source-v3-started.json').open('x') as stream:json.dump({'unix':time.time(),'inputs':inputs},stream)
 source=Path('/tmp/output/source');work=source.parent
 if source.is_symlink() or work.stat().st_uid!=os.getuid():raise RuntimeError('build source owner mismatch')
 if digest(ROOT/'native-root-source.v2.tar.gz')!=inputs['source_archive_sha256']:raise RuntimeError('source archive identity mismatch')
 manifest=json.loads((ROOT/'native-root-source.v2-manifest.json').read_text())
 for item in manifest['files']:
  p=source/item['file']
  if not p.resolve().is_relative_to(source) or digest(p)!=item['sha256']:raise RuntimeError('extracted source differs from the frozen snapshot: '+item['file'])
 for name,sha in inputs['root_identity'].items():
  if digest(source/name)!=sha:raise RuntimeError('current root build identity mismatch')
 env=dict(os.environ)
 env.update(PATH=str(work/'rust/bin')+':/usr/local/cuda/bin:'+env.get('PATH',''),CARGO_HOME=str(work/'cargo-home'),RUSTC=str(work/'rust/bin/rustc'),CARGO_TARGET_DIR=str(work/'target'),CARGO_BUILD_JOBS='8',CUDA_COMPUTE_CAP='90',CUDA_HOME='/usr/local/cuda',CUDA_ROOT='/usr/local/cuda',LIBRARY_PATH='/usr/local/cuda/lib64/stubs:/usr/local/cuda/lib64:'+env.get('LIBRARY_PATH',''))
 RESULT.update(unix=time.time(),phase='metadata',inputs=inputs,versions=json.loads((ROOT/'v1-build-result.json').read_text())['versions']);publish()
 with (ROOT/'metadata-v3.json').open('w') as stdout,(ROOT/'metadata-v3.stderr.log').open('w') as stderr:
  p=subprocess.run(['cargo','metadata','--locked','--offline','--no-deps','--format-version=1'],cwd=source,env=env,stdout=stdout,stderr=stderr,timeout=60)
 RESULT['metadata_exit_code']=p.returncode;publish()
 if p.returncode:raise RuntimeError('complete root workspace snapshot metadata refused')
 command=['cargo','test','-p','a3s-deepseek','--locked','--offline','--features','cuda','--lib','--no-run','--message-format=json']
 RESULT.update(phase='compiling',command=command);publish()
 with (ROOT/'build.stdout.jsonl').open('w') as stdout,(ROOT/'build.stderr.log').open('w') as stderr:p=subprocess.run(command,cwd=source,env=env,stdout=stdout,stderr=stderr,timeout=1500)
 RESULT.update(exit_code=p.returncode,elapsed_seconds=time.time()-START)
 if p.returncode:raise RuntimeError('Linux CUDA compilation failed; inspect exact compiler output')
 artifacts=[]
 for line in (ROOT/'build.stdout.jsonl').read_text().splitlines():
  r=json.loads(line)
  if r.get('reason')=='compiler-artifact' and r.get('target',{}).get('name')=='a3s_deepseek' and r.get('profile',{}).get('test') and r.get('executable'):artifacts.append(Path(r['executable']))
 if len(artifacts)!=1 or not artifacts[0].resolve().is_relative_to(work/'target'):raise RuntimeError('expected one owned Rust CUDA test binary')
 binary=artifacts[0];destination=ROOT/'a3s-deepseek-cuda-tests.gz'
 with binary.open('rb') as src,gzip.open(destination,'wb',compresslevel=1) as dst:shutil.copyfileobj(src,dst)
 destination.chmod(0o600)
 RESULT.update(binary_sha256=digest(binary),binary_bytes=binary.stat().st_size,archive_sha256=digest(destination),archive_bytes=destination.stat().st_size,phase='built',finished_unix=time.time())
 for name,args in [('dynamic_dependencies',['ldd',str(binary)]),('symbol_versions',['readelf','--version-info',str(binary)])]:
  p=subprocess.run(args,capture_output=True,text=True,timeout=15);(ROOT/(name+'.txt')).write_text(p.stdout+p.stderr);RESULT[name+'_exit']=p.returncode
 publish()
try:main()
except Exception as error:
 RESULT.update(phase='failed',error_type=type(error).__name__,error=str(error),finished_unix=time.time());publish();raise
finally:print(json.dumps(RESULT),flush=True)
