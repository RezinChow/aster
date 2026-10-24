from xolotl_trial_common import BASE
s=(BASE/'launch_xolotl_current_build.py').read_text()
for a,b in [('xolotl-h200-current-build-intent.json','xolotl-h200-device-verify-build-intent.json'),('2400','1200')]:
 if a not in s:raise RuntimeError('device build launcher anchor differs: '+a)
 s=s.replace(a,b)
compile(s,'device-build-launcher.py','exec');(BASE/'xolotl_device_verify_build_launcher.frozen.py').write_text(s)
exec(compile(s,'device-build-launcher.py','exec'))
