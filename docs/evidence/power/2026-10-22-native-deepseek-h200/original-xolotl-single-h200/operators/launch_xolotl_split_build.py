from xolotl_trial_common import BASE
s=(BASE/'launch_xolotl_current_build.py').read_text()
anchor="'xolotl-h200-current-build-intent.json'"
if s.count(anchor)!=1:raise RuntimeError('build launcher intent anchor differs')
s=s.replace(anchor,"'xolotl-h200-split-build-intent.json'")
compile(s,'split-build-launcher.frozen.py','exec')
(BASE/'xolotl_split_build_launcher.frozen.py').write_text(s)
exec(compile(s,'split-build-launcher.frozen.py','exec'))
