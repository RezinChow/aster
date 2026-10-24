from xolotl_trial_common import BASE
s=(BASE/'xolotl_device_verify_build_observer.frozen.py').read_text()
for a,b in [('xolotl-h200-device-verify-build-intent.json','xolotl-h200-split-rows-build-intent.json'),('xolotl-device-verify-build-latest.json','xolotl-split-rows-build-latest.json'),("'device-verify-patch.log'","'device-verify-patch.log','split-rows-patch.log'")]:
 if s.count(a)!=1:raise RuntimeError('split rows observer differs: '+a)
 s=s.replace(a,b)
compile(s,'split-rows-build-observer.py','exec');(BASE/'xolotl_split_rows_build_observer.frozen.py').write_text(s)
exec(compile(s,'split-rows-build-observer.py','exec'))
