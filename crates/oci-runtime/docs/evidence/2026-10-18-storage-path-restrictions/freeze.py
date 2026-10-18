from pathlib import Path
import subprocess,shutil,tempfile,json,hashlib
q=Path(__file__).parent.resolve();root=Path(tempfile.mkdtemp(prefix='candidate-',dir=q))
for name in ['a3s-oci','a3s-oci-krun-shim']:shutil.copy2(Path('target/debug')/name,root/name)
shutil.copy2('target/debug/examples/qualify_hvf_workspace',root/'qualify_hvf_workspace')
shutil.copytree('target/debug/a3s-oci-krun-runtime',root/'a3s-oci-krun-runtime')
with (q/'codesign.log').open('w') as out:
 subprocess.run(['codesign','--force','--sign','-','--timestamp=none','--entitlements','packaging/macos/a3s-oci-hvf.entitlements',str(root/'a3s-oci-krun-shim')],stdout=out,stderr=subprocess.STDOUT,check=True)
 subprocess.run(['codesign','--verify','--strict',str(root/'a3s-oci-krun-shim')],stdout=out,stderr=subprocess.STDOUT,check=True)
meta={'root':str(root),'source_revision':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'source_dirty':bool(subprocess.check_output(['git','status','--porcelain'],text=True).strip()),'sha256':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file()}}
(q/'candidate.json').write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps({'root':str(root),'source_dirty':meta['source_dirty']}),flush=True)
