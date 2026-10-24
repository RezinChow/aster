from xolotl_trial_common import BASE
s=(BASE/'observe_xolotl_split_build.py').read_text()
s=s.replace("'xolotl-h200-split-build-intent.json'","'xolotl-h200-q8-v3-build-intent.json'").replace("'xolotl-split-build-latest.json'","'xolotl-q8-v3-build-latest.json'").replace("'split-mmvq-patch.log'","'split-mmvq-patch.log','q8-mmq-patch.log','q8-control-patch.log'")
exec(compile(s,'q8-build-observer.frozen.py','exec'))
