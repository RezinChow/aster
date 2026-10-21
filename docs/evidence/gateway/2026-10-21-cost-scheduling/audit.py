"""Read-only final audit; never export configuration, keys or real prompts."""
import json
import os
from pathlib import Path
import subprocess
from finalize import source_identity
from runtime import BASE,digest,pid,request,save,snapshot

expected='10d1242dadba7621d151140dbdad3d8d7544cba599ced1dafd41db22236a27d6'
state=snapshot();assert state['services']['a3s-gateway']['binary_sha256']==expected
for unit in state['services']:
    assert subprocess.check_output(['systemctl','is-active',unit],text=True).strip()=='active'
    assert state['services'][unit]['pid']>0
native=[]
for index in range(8):
    unit=f'prism-27b@{index}'
    args=[os.fsdecode(part) for part in Path(f'/proc/{pid(unit)}/cmdline').read_bytes().split(b'\0') if part]
    assert args[args.index('-c')+1]=='262144' and args[args.index('--parallel')+1]=='2'
    assert args[args.index('-fa')+1]=='on' and '--spec-type' not in args and '-ub' not in args and '-b' not in args
    status,raw=request(18100+index,'/slots');slots=json.loads(raw)
    assert status==200 and len(slots)==2 and all(slot['n_ctx']==131072 for slot in slots)
    status,raw=request(18100+index,'/v1/chat/completions',{'model':'prism-27b','temperature':0,'max_tokens':16,'messages':[{'role':'user','content':'Reply with exactly 42.'}]})
    assert status==200 and json.loads(raw)['choices'][0]['message']['content'].strip()=='42'
    assert state['services'][f'a3s-power@{index}']['binary_sha256']=='231f7db4041a74dedda22935cff7f94149b7b0102c3199a451ff42619e11020c'
    native.append({'index':index,'slots':2,'context_per_slot':131072,'flash_attention':True,'kv_precision':'f16-default','speculation':'none','text_correct':True})
identity=json.loads((BASE/'final-source.json').read_text());assert identity['files']==source_identity()
patch=Path((BASE/'current-patch.txt').read_text().strip())
subprocess.run(['git','apply','-R','--check',str(patch)],cwd='/code/aster',check=True,capture_output=True)
config=Path('/etc/a3s/gateway-prism.acl').read_bytes()
assert b'excluded_supplier_ids' not in config and b'prefix_parallelism = 2' in config
assert all(not Path(f'/etc/systemd/system/prism-27b@{index}.service.d/{name}').exists() for index in range(8) for name in ['95-prefill-profile-20261021.conf','96-speculation-probe-20261021.conf'])
save('final-audit.json',{'passed':True,'all_17_units_active':True,'state':state,'native':native,'runtime_source_matches_build':True,
    'final_patch_sha256':digest(patch),'build_patch_sha256':identity['source_patch_sha256'],'post_build_change':'documentation only; every compiled-source file and Cargo input hash is identical',
    'production_exclusions_empty':True,'experiment_overrides_absent':True})
print(json.dumps({'all_17_units_active':True,'eight_native_correct':True,'source_matches_build':True,'gateway_sha256':expected}))
