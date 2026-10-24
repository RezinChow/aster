"""Compare the actual sidecar switch on the same binary and retain quality/output evidence."""
import ast
from xolotl_trial_common import BASE
s=(BASE/'compare_xolotl_mma_v2_model.frozen.py').read_text()
s=s.replace("names=['single-current-mma-v2-control','single-current-mma-v2-candidate']","names=['single-current-mma-v2-control','single-current-mma-v2-original-mtp']")
a="if [p.pop('ptq_mma') for p in plans]!=[False,True] or plans[0]!=plans[1]:raise RuntimeError('same-binary plans differ beyond the explicit MMA flag')"
b="""if [p.pop('original_mtp') for p in plans]!=[False,True]:raise RuntimeError('original MTP profile identity differs')
old_sidecar=plans[0].pop('sidecar');new_sidecar=plans[1].pop('sidecar')
if old_sidecar!='/mnt/shared-storage-user/yangchao/Workspace/aster-h200-xq/assets/V41-MTP-Vision-1017.Q2_K.gguf' or new_sidecar!='/mnt/shared-storage-user/yangchao/Workspace/aster-h200-xq/assets/original-mtp-6f3d5b8611dd/V41-MTP-Vision-1017.gguf' or plans[1].pop('sidecar_sha256')!='6f3d5b8611ddb3954bb89c09e8890806225715fea90868a6d7ec0ffee5c72082' or plans[0]!=plans[1]:raise RuntimeError('plans differ beyond the verified sidecar switch')"""
if s.count(a)!=1:raise RuntimeError('sidecar comparison plan gate differs')
s=s.replace(a,b).replace('xolotl-mma-v2-model-comparison.json','xolotl-original-mtp-model-comparison.json').replace('same binary with flag0/1, one paired round','same binary and main model; Q2_K versus full original sidecar, including its cache footprint and acceptance; one paired round')
ast.parse(s);(BASE/'compare_xolotl_original_mtp.frozen.py').write_text(s)
print('Prepared same-binary original-sidecar comparison; main model, GPU, routing, depth/confidence and requests must match.')
