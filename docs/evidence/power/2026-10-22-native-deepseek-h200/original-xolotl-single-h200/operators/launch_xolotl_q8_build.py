from xolotl_trial_common import BASE
s=(BASE/'launch_xolotl_current_build.py').read_text()
anchor="'xolotl-h200-current-build-intent.json'"
if s.count(anchor)!=1:raise RuntimeError('Q8 build launcher anchor differs')
s=s.replace(anchor,"'xolotl-h200-q8-build-intent.json'")
s=s.replace('time.time()+2400','time.time()+1200').replace("'2400','python3'","'1200','python3'").replace('deadline_seconds=2400','deadline_seconds=1200')
compile(s,'q8-build-launcher.frozen.py','exec');(BASE/'xolotl_q8_build_launcher.frozen.py').write_text(s)
exec(compile(s,'q8-build-launcher.frozen.py','exec'))
