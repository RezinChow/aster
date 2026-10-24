"""Verify bounded task evidence hashes and absence of the private serving key."""
import hashlib,json
from pathlib import Path
from xolotl_trial_common import BASE,WORK
root=WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/original-xolotl-single-h200';manifest=json.loads((root/'manifest.json').read_text())
if len(manifest['files'])>8192:raise RuntimeError('evidence file-count bound exceeded')
r=json.loads((BASE/'xolotl-stable-service-v2-intent.json').read_text());secret=Path(r['credential_file']).read_bytes().strip();total=0
for row in manifest['files']:
 p=(root/row['file']).resolve();p.relative_to(root.resolve())
 if p.is_symlink() or not p.is_file() or p.stat().st_size!=row['bytes'] or p.stat().st_size>32*1024**2:raise RuntimeError('evidence owner/path/size differs: '+row['file'])
 raw=p.read_bytes();total+=len(raw)
 if total>128*1024**2 or hashlib.sha256(raw).hexdigest()!=row['sha256']:raise RuntimeError('evidence total/hash differs: '+row['file'])
 if secret in raw:raise RuntimeError('private serving key appeared in public evidence')
load=json.loads((root/'stable-serving/xolotl-stable-windows-loadtest.json').read_text());baseline=json.loads((root/'qualified-xolotl-dense-chain-v3-optimization-baseline.json').read_text())
if not load['passed'] or load['measured_requests']!=64 or not baseline['adopted_as_optimization_baseline'] or baseline['serving_promoted'] or baseline['target300_met'] or baseline['target500_met']:raise RuntimeError('measured serving/optimization scope differs')
print(json.dumps(dict(verified=True,files=len(manifest['files']),bytes=total,private_key_occurrences=0,service_load_requests=64,optimization_gain_percent=baseline['paired_gain_percent'],milestone300_met=False,goal500_met=False)))
