"""Read public CUDA build tools from the known image; never execute GPU work."""
import hashlib,json,shlex,subprocess,tarfile
from pathlib import Path
out=Path('target/h200-native');destination=out/'linux-cuda126-build-tools.tar.gz'
if destination.exists():raise RuntimeError('build-tool archive exists; verify instead of copying again')
code=r'''
from pathlib import Path
import gzip,hashlib,io,json,sys,tarfile
root=Path('/usr/local/cuda-12.6').resolve()
files={}
for name in ['nvcc','nvcc.profile','ptxas','cudafe++','fatbinary','nvlink','bin2c']:
 p=root/'bin'/name
 if not p.is_file():raise RuntimeError('missing known CUDA build tool '+name)
 files['bin/'+name]=p
for name,relative in [('nvvm','nvvm'),('targets/x86_64-linux/include','targets/x86_64-linux/include'),('targets/x86_64-linux/lib/stubs','targets/x86_64-linux/lib/stubs')]:
 for p in (root/relative).rglob('*'):
  if p.is_file():
   if not p.resolve().is_relative_to(root):raise RuntimeError('CUDA build file escapes known toolkit')
   files[name+'/'+p.relative_to(root/relative).as_posix()]=p
for name in ['libcudart.so.12.6.37','libcudart_static.a','libcudadevrt.a','libculibos.a']:
 p=root/'targets/x86_64-linux/lib'/name
 if not p.is_file():raise RuntimeError('missing CUDA build runtime '+name)
 files['targets/x86_64-linux/lib/'+name]=p
for package in ['cuda-nvcc-12-6','cuda-cudart-12-6','cuda-cudart-dev-12-6','cuda-nvrtc-dev-12-6','cuda-driver-dev-12-6','cuda-cccl-12-6']:
 p=Path('/usr/share/doc')/package/'copyright'
 if p.is_file():files['notices/'+package+'-copyright']=p
if len(files)>8192 or sum(p.stat().st_size for p in files.values())>512*1024**2:raise RuntimeError('CUDA build-tool budget exceeded')
manifest={'source_image':'registry.h.pjlab.org.cn/ailab-safeag/zoubo:v2.2','source_root':str(root),'purpose':'CPU compilation and link only; stubs must never be used for runtime qualification','files':[]}
with gzip.GzipFile(fileobj=sys.stdout.buffer,mode='wb',compresslevel=1) as compressed,tarfile.open(fileobj=compressed,mode='w|') as archive:
 for name,p in sorted(files.items()):
  data=p.read_bytes();info=tarfile.TarInfo(name);info.size=len(data);info.mode=0o755 if p.stat().st_mode&0o111 else 0o644
  archive.addfile(info,io.BytesIO(data));manifest['files'].append({'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
 for name,target in [('include','targets/x86_64-linux/include'),('lib64','targets/x86_64-linux/lib'),('targets/x86_64-linux/lib/libcudart.so','libcudart.so.12.6.37'),('targets/x86_64-linux/lib/libcudart.so.12','libcudart.so.12.6.37')]:
  info=tarfile.TarInfo(name);info.type=tarfile.SYMTYPE;info.linkname=target;archive.addfile(info)
 data=(json.dumps(manifest,indent=2)+'\n').encode();info=tarfile.TarInfo('build-tool-manifest.json');info.size=len(data);info.mode=0o644;archive.addfile(info,io.BytesIO(data))
'''
remote='. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(['brainctl','exec','-n','ailab-hrprdduanyan','replica/deepseek-v4-1-flash-1017-private-24500123-6697f-cfcd2','--','python3','-c',code])
command=['ssh','-C','-o','BatchMode=yes','-o','ConnectTimeout=15','-o','HostName=10.102.254.2','-o','HostKeyAlias=h.pjlab.org.cn','yangchao-dev.yangchao.ailab-hrprdduanyan.ws@h.pjlab.org.cn',remote]
partial=destination.with_suffix('.part')
with partial.open('xb') as archive,(out/'linux-cuda126-build-tools-copy.log').open('wb') as log:
 p=subprocess.run(command,stdout=archive,stderr=log,timeout=180)
if p.returncode:raise RuntimeError('read-only build-tool transfer failed; preserve partial')
if partial.stat().st_size>192*1024**2:raise RuntimeError('compressed build-tool archive exceeds budget')
with tarfile.open(partial,'r:gz') as archive:
 manifest=json.load(archive.extractfile('build-tool-manifest.json'))
 for item in manifest['files']:
  if hashlib.sha256(archive.extractfile(item['file']).read()).hexdigest()!=item['sha256']:raise RuntimeError('copied tool checksum mismatch')
partial.rename(destination)
record={'archive_sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),'archive_bytes':destination.stat().st_size,'files':len(manifest['files']),'uncompressed_bytes':sum(x['bytes'] for x in manifest['files']),'source_image':manifest['source_image'],'reference_files_changed':False,'GPU_execution_claimed':False}
(out/'linux-cuda126-build-tools.json').write_text(json.dumps(record,indent=2)+'\n')
(out/'linux-cuda126-build-tool-files.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(record))
