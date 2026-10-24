from xolotl_trial_common import BASE
s=(BASE/'xolotl_device_verify_build_launcher.frozen.py').read_text()
a='xolotl-h200-device-verify-build-intent.json'
if s.count(a)!=1:raise RuntimeError('split rows launcher intent differs')
s=s.replace(a,'xolotl-h200-split-rows-build-intent.json');compile(s,'split-rows-build-launcher.py','exec');(BASE/'xolotl_split_rows_build_launcher.frozen.py').write_text(s)
exec(compile(s,'split-rows-build-launcher.py','exec'))
