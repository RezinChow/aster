"""CPU-only build of the actual root-workspace CUDA test executable."""
import gzip,hashlib,json,os,shutil,subprocess,tarfile,time
from pathlib import Path,PurePosixPath

ROOT=Path(__file__).resolve().parent
START=time.time()
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def extract(archive,destination,bound):
    destination.mkdir(mode=0o700)
    with tarfile.open(archive,'r:gz') as source:
        members=source.getmembers()
        if len(members)>32768 or sum(x.size for x in members)>bound:raise RuntimeError('archive bound exceeded')
        for item in members:
            name=PurePosixPath(item.name)
            if name.is_absolute() or '..' in name.parts:raise RuntimeError('unsafe archive path')
            target=destination.joinpath(*name.parts)
            if item.isdir():target.mkdir(parents=True,exist_ok=True,mode=0o700)
            elif item.isfile():
                target.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
                with target.open('xb') as out:shutil.copyfileobj(source.extractfile(item),out)
                target.chmod(0o700 if item.mode&0o111 else 0o600)
            elif not (item.issym() or item.islnk()):raise RuntimeError('unsupported archive entry')
        for item in members:
            if not (item.issym() or item.islnk()):continue
            target=destination.joinpath(*PurePosixPath(item.name).parts)
            link=(target.parent/item.linkname) if item.issym() else (destination/item.linkname)
            if not link.resolve().is_relative_to(destination.resolve()):raise RuntimeError('archive link escapes destination')
            target.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
            if item.issym():target.symlink_to(item.linkname)
            else:os.link(link,target)

manifest=json.loads((ROOT/'build-inputs.json').read_text())
for name,expected in manifest['archives'].items():
    if digest(ROOT/name)!=expected:raise RuntimeError('archive transfer mismatch: '+name)
work=Path('/tmp')/ROOT.name;work.mkdir(mode=0o700)
extract(ROOT/'linux-rust1971.tar.gz',work/'rust',2*1024**3)
extract(ROOT/'native-public-cargo-cache.tar.gz',work/'cargo-home',512*1024**2)
extract(ROOT/'native-root-source.tar.gz',work/'source',128*1024**2)
for name in ['rustc','cargo']:(work/'rust/bin'/name).chmod(0o700)
env=dict(os.environ)
env.update(PATH=str(work/'rust/bin')+':/usr/local/cuda/bin:'+env.get('PATH',''),
           CARGO_HOME=str(work/'cargo-home'),RUSTC=str(work/'rust/bin/rustc'),
           CARGO_TARGET_DIR=str(work/'target'),CARGO_BUILD_JOBS='8',CUDA_COMPUTE_CAP='90',
           CUDA_HOME='/usr/local/cuda',CUDA_ROOT='/usr/local/cuda',
           LIBRARY_PATH='/usr/local/cuda/lib64/stubs:/usr/local/cuda/lib64:'+env.get('LIBRARY_PATH',''))
versions={}
for name,command in [('rust',['rustc','--version']),('cargo',['cargo','--version']),('nvcc',['nvcc','--version']),('glibc',['getconf','GNU_LIBC_VERSION'])]:
    p=subprocess.run(command,env=env,capture_output=True,text=True,timeout=15)
    versions[name]={'exit':p.returncode,'out':p.stdout[-1500:]}
    if p.returncode:raise RuntimeError('missing build tool '+name)
if versions['rust']['out'].split()[1]!='1.97.1':raise RuntimeError('Rust toolchain mismatch')
source=work/'source'
for name,expected in manifest['root_identity'].items():
    if digest(source/name)!=expected:raise RuntimeError('root build identity mismatch')
command=['cargo','test','-p','a3s-deepseek','--locked','--offline','--features','cuda','--lib','--no-run','--message-format=json']
with (ROOT/'build.stdout.jsonl').open('w') as stdout,(ROOT/'build.stderr.log').open('w') as stderr:
    p=subprocess.run(command,cwd=source,env=env,stdout=stdout,stderr=stderr,timeout=1500)
result={'schema':'aster-native-linux-cuda-build-v1','unix':time.time(),'uid':os.getuid(),'source_scope':manifest['source_scope'],'archives':manifest['archives'],'root_identity':manifest['root_identity'],'command':command,'versions':versions,'exit_code':p.returncode,'elapsed_seconds':time.time()-START,'GPU_execution_claimed':False}
if p.returncode==0:
    artifacts=[]
    for line in (ROOT/'build.stdout.jsonl').read_text().splitlines():
        record=json.loads(line)
        if record.get('reason')=='compiler-artifact' and record.get('target',{}).get('name')=='a3s_deepseek' and record.get('profile',{}).get('test') and record.get('executable'):artifacts.append(Path(record['executable']))
    if len(artifacts)!=1:raise RuntimeError('build did not produce one owned test executable')
    binary=artifacts[0]
    if not binary.resolve().is_relative_to((work/'target').resolve()):raise RuntimeError('test artifact escapes build target')
    destination=ROOT/'a3s-deepseek-cuda-tests.gz'
    with binary.open('rb') as src,gzip.open(destination,'wb') as out:shutil.copyfileobj(src,out)
    destination.chmod(0o600)
    result.update(binary_sha256=digest(binary),binary_bytes=binary.stat().st_size,archive_sha256=digest(destination),archive_bytes=destination.stat().st_size)
    for name,args in [('dynamic_dependencies',['ldd',str(binary)]),('symbol_versions',['readelf','--version-info',str(binary)])]:
        checked=subprocess.run(args,capture_output=True,text=True,timeout=15)
        (ROOT/(name+'.txt')).write_text(checked.stdout+checked.stderr)
        result[name+'_exit']=checked.returncode
(ROOT/'build-result.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result),flush=True)
raise SystemExit(p.returncode)
