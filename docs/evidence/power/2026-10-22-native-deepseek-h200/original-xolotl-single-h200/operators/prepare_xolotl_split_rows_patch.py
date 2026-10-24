"""Layer a closed, default-off row-interleaved decode-once kernel onto the previous patch."""
import difflib,hashlib,json
from xolotl_trial_common import BASE
p=BASE/'xolotl-trial-source-e9d0826d71c5/source/src/kernels/cuda/iq_kernels.cu'
original=p.read_text(encoding='utf-8');s=original
a='constexpr int GRP_NC = 4;';b=a+'\n#include "fork/aster_xq_split_rows.cuh"'
if s.count(a)!=1:raise RuntimeError('GRP_NC anchor differs')
s=s.replace(a,b)
# Add the already-qualified scalar split dispatch as context for this incremental patch.
for ty,stem,extra in [('TG','gu','float* gate, float* up'),('TD','down','float* out')]:
 signature='void launch_'+stem+'('
 start=s.index(signature);point=s.index('    if constexpr (!kSplit<'+ty+'>)',start)
 args='grp_ptr, grp_start, n_groups, ent_tok, X, L, gate, up' if stem=='gu' else 'grp_ptr, grp_start, n_groups, ent_dst, hq, L, out'
 old=f'''    if constexpr ({ty} == 143 || {ty} == 11) {{
        if (!g_old_kernels && aster_xq_split_enabled({ty})) {{
            native_{stem}_multi_kernel<{ty}, false{', false' if stem=='gu' else ''}><<<grid, 256, 0, s>>>({args});
            return;
        }}
    }}
'''
 s=s[:point]+old+s[point:]
 # The prior patch has this exact block; use it as the incremental diff baseline below.
base=s
for ty,stem in [('TG','gu'),('TD','down')]:
 args='grp_ptr, grp_start, n_groups, ent_tok, X, L, gate, up' if stem=='gu' else 'grp_ptr, grp_start, n_groups, ent_dst, hq, L, out'
 a=f'        if (!g_old_kernels && aster_xq_split_enabled({ty})) {{\n'
 extent='2 * L.n_ff' if stem=='gu' else 'L.n_embd'
 b=a+f'''            const int rows = aster_xq_split_rows();
            if (rows == 2) {{
                const dim3 shape((unsigned) (({extent} + 15) / 16), grid.y);
                aster_xq_{stem}_rows_kernel<{ty}, 2><<<shape, 256, 0, s>>>({args}); return;
            }}
            if (rows == 4) {{
                const dim3 shape((unsigned) (({extent} + 31) / 32), grid.y);
                aster_xq_{stem}_rows_kernel<{ty}, 4><<<shape, 256, 0, s>>>({args}); return;
            }}
'''
 if s.count(a)!=1:raise RuntimeError('incremental split dispatch differs')
 s=s.replace(a,b)
# The include belongs to this patch, not to the previous split-patch baseline.
base=base.replace('#include "fork/aster_xq_split_rows.cuh"\n','')
patch=''.join(difflib.unified_diff(base.splitlines(True),s.splitlines(True),fromfile='a/src/kernels/cuda/iq_kernels.cu',tofile='b/src/kernels/cuda/iq_kernels.cu',n=2))
header=(BASE/'aster_xq_split_rows.cuh').read_text()
patch+=''.join(difflib.unified_diff([],header.splitlines(True),fromfile='/dev/null',tofile='b/src/kernels/cuda/fork/aster_xq_split_rows.cuh',n=2))
out=BASE/'xolotl-h200-split-rows.patch'
if out.exists():raise RuntimeError('split rows patch already prepared; retain immutable source')
out.write_text(patch,encoding='utf-8',newline='\n')
r=dict(prepared_only=True,default='off',flag='ASTER_XQ_SPLIT_ROWS=0|2|4',type_selector='ASTER_XQ_SPLIT_MMVQ',patch_sha256=hashlib.sha256(out.read_bytes()).hexdigest(),scope='PTQ1_0 and Q3_K grouped gate/up/down; 2 or 4 rows per warp and decode-once reuse across up to4 entries',math_order='same lane k order, block scaling, and warp_sum as the scalar reference',qualified=False,target_tok_s=300,target_met=False)
(BASE/'xolotl-h200-split-rows-plan.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
