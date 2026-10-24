import json
from xolotl_trial_common import BASE,jump
v=jump('''from pathlib import Path
import json
p=Path('/mnt/shared-storage-gpfs2/gpfs2-shared-public/huggingface/hub/models--deepseek-ai--DeepSeek-V4.1-Flash-1017/snapshots/1bae0e1088993b9b82de08f59de5be5a34e42170/config.json')
if p.stat().st_size>262144:raise RuntimeError('config bounds')
v=json.loads(p.read_text())
print(json.dumps(v))
''')
(BASE/'xolotl-official-geometry.json').write_text(json.dumps(v,indent=2)+'\n')
print(json.dumps(v))
