from xolotl_trial_common import BASE
s=(BASE/'observe_xolotl_split_build.py').read_text()
for a,b in [('xolotl-h200-split-build-intent.json','xolotl-h200-device-verify-build-intent.json'),('xolotl-split-build-latest.json','xolotl-device-verify-build-latest.json'),("'split-mmvq-patch.log'","'split-mmvq-patch.log','device-verify-patch.log'")]:
 if s.count(a)!=1:raise RuntimeError('device observer anchor differs: '+a)
 s=s.replace(a,b)
compile(s,'device-build-observer.py','exec');(BASE/'xolotl_device_verify_build_observer.frozen.py').write_text(s)
exec(compile(s,'device-build-observer.py','exec'))
