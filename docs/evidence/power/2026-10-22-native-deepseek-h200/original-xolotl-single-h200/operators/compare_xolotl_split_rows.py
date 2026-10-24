"""Compare the row-interleaved kernel pair on identical generation inputs."""
from xolotl_trial_common import BASE
s=(BASE/'compare_xolotl_transport.py').read_text()
for a,b in [
 ("names=[stem+'control',stem+'direct'];expected=4 if a.cpu else 17","names=['single-current-rows-control','single-current-rows-r2'];expected=17"),
 ("if k!='device_verify'","if k not in ('ptq_rows_per_warp','split_mmvq','split_rows','expert_rows_per_warp')"),
 ('plans differ beyond input transport','plans differ beyond the combined expert layout'),
 ("one serial paired campaign; CPU fallback runs are correctness controls, not speed qualification","one serial paired expert-layout campaign; no stable speedup qualification"),
 ("name='xolotl-device-cpu-comparison.json' if a.cpu else 'xolotl-device-round-comparison.json'","name='xolotl-split-rows-round-comparison.json'")
]:
 if s.count(a)!=1:raise RuntimeError('row comparison derivation differs: '+a)
 s=s.replace(a,b)
anchor='plans=[{k:v for k,v in r[\'plan\'].items()'
guard='''for r in rs:
 if 'expert_rows_per_warp' in r['plan'] and 'ptq_rows_per_warp' not in r['plan']:raise RuntimeError('generic expert rows are not overridden by the final PTQ selector')
'''
if s.count(anchor)!=1:raise RuntimeError('effective selector guard anchor differs')
s=s.replace(anchor,guard+anchor)
s=s.replace("phase='complete',cpu_fallback_control=a.cpu,","phase='complete',cpu_fallback_control=a.cpu,selector_note='Generic expert row metadata is superseded by the later PTQ selector, which sets both T143 and T11 in the frozen worker; original intents retained',")
compile(s,'row-comparison.py','exec');(BASE/'compare_xolotl_split_rows.frozen.py').write_text(s)
exec(compile(s,'row-comparison.py','exec'))
