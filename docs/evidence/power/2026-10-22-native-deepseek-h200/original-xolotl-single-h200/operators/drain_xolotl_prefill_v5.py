"""Retire only the completed public V5 qualification engine before the V6b JSON adapter check."""
import json,time
from xolotl_trial_common import BASE,observe,owned
ip=BASE/'xolotl-prefill-v5-drain.json'
if ip.exists():raise RuntimeError('V5 drain exists; inspect its state')
r=json.loads((BASE/'xolotl-prefill-shadow-v5-intent.json').read_text());stage=json.loads((BASE/'xolotl-json-runtime-v6b-r2-stage.json').read_text());o=observe()
if o['job_uid']!=r['allocation_uid'] or o['phase']!='Running':raise RuntimeError('exact V5 allocation changed')
code='''import json,os,signal,time
from pathlib import Path
r=@R@;stage=@STAGE@
gate=json.loads((Path(stage['root'])/'cpu-preflight-result.json').read_text());q=json.loads((Path(r['root'])/'qualification-v5/request-result.json').read_text())
if gate['phase']!='passed' or len(gate['tests'])!=3 or any(x['exit_code'] for x in gate['tests']) or q['phase']!='failed' or q['error']!='RuntimeError: native tool-call parse/arguments failed':raise RuntimeError('strict V6b CPU gate / completed public V5 qualification differs')
p=r['process'];stat=Path('/proc/'+str(p['pid'])+'/stat')
if stat.stat().st_uid!=10250 or int(stat.read_text().split(') ',1)[1].split()[19])!=p['start_ticks']:raise RuntimeError('exact V5 supervisor lifetime differs')
os.kill(p['pid'],signal.SIGTERM);print(json.dumps(dict(unix=time.time(),signal='SIGTERM',exact_process=p,cpu_gate_passed=True,formal_service_untouched=True)))
'''.replace('@R@',repr(r)).replace('@STAGE@',repr(stage));compile(code,'exact-public-V5-engine-drain','exec');q=owned(code);record=dict(unix=time.time(),phase='drain_requested',signal=q);ip.write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record,indent=2))
