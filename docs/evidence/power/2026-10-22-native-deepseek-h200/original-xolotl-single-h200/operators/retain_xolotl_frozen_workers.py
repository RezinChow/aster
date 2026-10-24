"""Preserve exact historical operators and complete bounded stderr for finished trials."""
import argparse,base64,hashlib,json
from concurrent.futures import ThreadPoolExecutor
from xolotl_trial_common import BASE,WORK,jump
dest=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200/frozen-trials'
dest.mkdir(exist_ok=True)
names=['single-base','single-dspark','pair-base','single-resident-base','single-resident-dspark','single-resident-warm-d4','single-resident-warm-d5','single-resident-warm-d5-pf0','single-resident-warm-d5-pf0-conf06','single-resident-warm-d5-pf0-conf045','single-current-warm-control','single-current-warm-cache1024','single-current-warm-cache1024-async']
records=[]
names+=['single-current-profile-prose','single-current-profile-prose-v2','single-current-warm-cache1024-r2','single-current-warm-cache1024-r4']
names+=['single-current-split-control','single-current-split-both','single-current-split-control-b2','single-current-split-hybrid','single-current-split-control-b3','single-current-split-hybrid-b2','single-current-split-control-b4','single-current-split-hybrid-b3']
names+=['single-current-q8-control','single-current-q8-mmq','single-current-split-conf020','single-current-split-conf045-final']
names+=['single-current-device-control','single-current-device-direct','single-current-device-cpu-control','single-current-device-cpu-direct','single-current-rows-control','single-current-rows-r2','single-current-rows-r4']
names+=['single-current-mma-control','single-current-mma-candidate']
names+=['single-current-mma-v2-control','single-current-mma-v2-candidate','single-current-mma-v2-diagnostic','single-current-mma-v2-original-mtp','single-current-mma-v3-diagnostic','single-current-hostthreads-1','single-current-hostthreads-4']
names+=['single-current-qsum-control','single-current-qsum-gu','single-current-qsum-both','single-current-qsum-v2-control','single-current-qsum-v2-gu','single-current-qsum-v2-both','single-current-qsum-v2-gu-b2','single-current-qsum-v2-control-b2','single-current-qsum-v2-control-b3','single-current-qsum-v2-gu-b3']
names+=['single-current-qsum-v2-profile']
names+=['single-current-dense-chain-control','single-current-dense-chain-candidate','single-current-dense-chain-stress-control','single-current-dense-chain-stress-candidate']
names+=['single-current-dense-chain-v3-control','single-current-dense-chain-v3-candidate','single-current-dense-chain-v3-stress-control','single-current-dense-chain-v3-stress-candidate','single-current-dense-chain-v3-candidate-b2','single-current-dense-chain-v3-control-b2','single-current-dense-chain-v3-control-b3','single-current-dense-chain-v3-candidate-b3']
parser=argparse.ArgumentParser();parser.add_argument('--dense-only',action='store_true');args=parser.parse_args()
if args.dense_only:names=[n for n in names if n.startswith('single-current-dense-chain-')]
for name in names:
 p=BASE/('xolotl-'+name+'-latest.json')
 if p.exists() and json.loads(p.read_text(encoding='utf-8'))['result.json']['phase'] in ['complete','failed']:
  r=json.loads((BASE/('xolotl-'+name+'-intent.json')).read_text());records.append(dict(mode=name,root=r['root'],worker_sha256=r['worker_sha256']))
code='''from pathlib import Path
import json,hashlib,base64
records=@RECORDS@;out={}
for r in records:
 root=Path(r['root'])
 if root.resolve()!=root or root.stat().st_uid!=10250:raise RuntimeError('frozen trial source owner differs')
 data={}
 for name in ['worker.py','engine.stderr.log']:
  p=root/name
  if not p.exists():continue
  if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>(65536 if name=='worker.py' else 262144):raise RuntimeError('frozen trial text bound exceeded')
  raw=p.read_bytes()
  if name=='worker.py' and hashlib.sha256(raw).hexdigest()!=r['worker_sha256']:raise RuntimeError('frozen worker hash differs')
  data[name]=base64.b64encode(raw).decode()
 out[r['mode']]=data
print(json.dumps(out))
'''
chunks=[records[i:i+4] for i in range(0,len(records),4)]
compile(code.replace('@RECORDS@','[]'),'bounded-frozen-evidence-read','exec')
data={}
with ThreadPoolExecutor(max_workers=3) as pool:
 futures=[pool.submit(jump,code.replace('@RECORDS@',repr(chunk))) for chunk in chunks]
 for future in futures:data.update(future.result())
for mode,files in data.items():
 root=dest/mode;root.mkdir(exist_ok=True)
 for name,raw in files.items():(root/name).write_bytes(base64.b64decode(raw))
print(json.dumps(dict(frozen_modes=len(data),root=str(dest)),indent=2))
