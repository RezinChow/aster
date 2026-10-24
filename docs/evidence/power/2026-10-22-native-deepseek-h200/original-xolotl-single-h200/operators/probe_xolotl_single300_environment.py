"""Read actual admitted limits and one exact public-cache candidate path."""
import json
from xolotl_trial_common import BASE,owned
code='''import os,json,subprocess,time
from pathlib import Path
out=dict(unix=time.time(),cpu_affinity=sorted(os.sched_getaffinity(0)),limits={})
for rel in ['memory/memory.limit_in_bytes','memory/memory.usage_in_bytes','cpuset/cpuset.cpus','cpu/cpu.cfs_quota_us','cpu/cpu.cfs_period_us','memory.max','memory.current','cpu.max','cpuset.cpus.effective']:
 p=Path('/sys/fs/cgroup')/rel
 if p.is_file():
  with p.open() as f:out['limits'][rel]=f.read(4097)
  if len(out['limits'][rel])>4096:raise RuntimeError('cgroup read bound exceeded')
p=subprocess.run(['nvidia-smi','--query-gpu=index,uuid,name,memory.total,memory.used,power.limit,clocks.max.sm,clocks.max.memory','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8,check=True)
out['gpu']=p.stdout
blob=Path('/mnt/shared-storage-gpfs2/gpfs2-shared-public/huggingface/hub/models--IndrasMirror--DeepSeek-V4.1-Flash-1017-XQ-Uncensored/blobs/6f3d5b8611ddb3954bb89c09e8890806225715fea90868a6d7ec0ffee5c72082')
out['public_original_mtp_blob']=dict(path=str(blob),exists=blob.exists(),symlink=blob.is_symlink(),bytes=blob.stat().st_size if blob.is_file() else None)
print(json.dumps(out))
'''
r=owned(code);(BASE/'xolotl-single300-environment.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
