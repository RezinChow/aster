"""Reuse the reviewed archive staging protocol; fresh directory, bounded sources."""
import ast,base64,hashlib,json,time
from xolotl_trial_common import BASE,jump
path=BASE/'xolotl-h200-q8-build-intent.json'
if path.exists():raise RuntimeError('Q8 build exists; inspect its frozen intent')
prior=json.loads((BASE/'xolotl-h200-current-build-intent.json').read_text())
worker=(BASE/'xolotl_split_build_worker.frozen.py').read_text()
anchor=" command(['patch','--batch','--fuzz=0','-p1','-d',str(source),'-i',str(ROOT/'split-mmvq.patch')],'split-mmvq-patch',30)"
if worker.count(anchor)!=1:raise RuntimeError('Q8 worker patch anchor differs')
worker=worker.replace(anchor,anchor+"\n command(['patch','--batch','--fuzz=0','-p1','-d',str(ggml),'-i',str(ROOT/'q8-mmq.patch')],'q8-mmq-patch',30)\n command(['patch','--batch','--fuzz=0','-p1','-d',str(source),'-i',str(ROOT/'q8-control.patch')],'q8-control-patch',30)")
worker=worker.replace("'-DASTER_XQ_BUILD_SPLIT_TEST=ON'","'-DASTER_XQ_BUILD_SPLIT_TEST=OFF','-DASTER_H200_BUILD_Q8_TEST=ON'")
worker=worker.replace("'aster_xq_split_parity'","'aster_h200_q8_mmq'").replace("'compile',2100)","'compile',900)")
compile(worker,'q8-build-worker.py','exec');(BASE/'xolotl_q8_build_worker.frozen.py').write_text(worker,encoding='utf-8',newline='\n')
payload={'h200-experiments.patch':(BASE/'xolotl-h200-graph-experiments.patch').read_bytes(),'split-mmvq.patch':(BASE/'xolotl-h200-split-mmvq.patch').read_bytes(),'q8-mmq.patch':(BASE/'xolotl-h200-q8-mmq.patch').read_bytes(),'q8-control.patch':(BASE/'xolotl-h200-q8-control.patch').read_bytes(),'worker.py':worker.encode()}
r=dict(unix=time.time(),phase='prepared',root=prior['root'].rsplit('/',1)[0]+'/xolotl-q8-mmq-h200',source_revision=prior['source_revision'],prior_root=prior['root'],files=prior['files'][:2]+[dict(file=k,bytes=len(v),sha256=hashlib.sha256(v).hexdigest()) for k,v in payload.items()])
path.write_text(json.dumps(r,indent=2)+'\n')
# Select the exact previously reviewed staging program literal from its AST.
tree=ast.parse((BASE/'stage_xolotl_split_build.py').read_text())
programs=[n.value for n in ast.walk(tree) if isinstance(n,ast.Constant) and isinstance(n.value,str) and n.value.startswith('from pathlib import Path,PurePosixPath\n')]
if len(programs)!=1:raise RuntimeError('reviewed archive staging program differs')
code=programs[0].replace('@RECORD@',repr(r)).replace('@PAYLOAD@',repr({k:base64.b64encode(v).decode() for k,v in payload.items()}))
compile(code,'q8-stage.py','exec');r['stage']=jump(code,100);r['phase']='staged';path.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(dict(root=r['root'],phase=r['phase']),indent=2))
