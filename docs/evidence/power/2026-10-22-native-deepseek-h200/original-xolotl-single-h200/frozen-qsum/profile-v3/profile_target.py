import os,sys,json
from pathlib import Path
r=Path(__file__).resolve().parent
b=sys.argv[1]
p=dict(pid=os.getpid(),start_ticks=int(Path('/proc/self/stat').read_text().split(') ',1)[1].split()[19]),uid=os.getuid(),binary=b)
(r/'profile-target-process.json').write_text(json.dumps(p))
os.execv(b,sys.argv[1:])
