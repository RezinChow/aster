import json
from xolotl_trial_common import BASE,jump
r=json.loads((BASE/'xolotl-single-current-profile-prose-v2-intent.json').read_text())
code='''from pathlib import Path
import json,sqlite3,csv
root=Path(@ROOT@);p=root/'warm-prose.sqlite'
if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size>512*1024**2:raise RuntimeError('SQLite bounds differ')
c=sqlite3.connect(p.as_uri()+'?mode=ro',uri=True)
tables=c.execute("select name,sql from sqlite_master where type='table'").fetchall()
o=dict(sqlite_bytes=p.stat().st_size,tables=tables,kernel_top=list(csv.DictReader((root/'statistics_cuda_gpu_kern_sum.csv').open()))[:20])
print(json.dumps(o))
'''.replace('@ROOT@',repr(r['root']))
v=jump(code)
(BASE/'xolotl-profile-schema.json').write_text(json.dumps(v,indent=2)+'\n')
print(json.dumps(v,indent=2))
