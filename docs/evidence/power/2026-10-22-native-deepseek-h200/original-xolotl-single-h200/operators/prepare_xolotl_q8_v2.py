"""Correct only CMake patch context; retain the refused V1 build unchanged."""
import ast,difflib,hashlib,json
from xolotl_trial_common import BASE
old=(BASE/'xolotl-trial-source-e9d0826d71c5/source/CMakeLists.txt').read_text(encoding='utf-8-sig')
anchor='  set(GGML_STATIC ON CACHE BOOL "" FORCE)'
if old.count(anchor)!=1:raise RuntimeError('static CUDA anchor differs')
old=old.replace(anchor,'  option(STRATA_GGML_STATIC "Link ggml CUDA dependencies statically" ON)\n  set(GGML_STATIC ${STRATA_GGML_STATIC} CACHE BOOL "" FORCE)')
def extra(name):
 tree=ast.parse((BASE/name).read_text());nodes=[n for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='extra' for t in n.targets)]
 if len(nodes)!=1:raise RuntimeError('CMake extra source differs')
 return ast.literal_eval(nodes[0].value)
old+=extra('prepare_xolotl_split_patch.py')
new=old+extra('prepare_xolotl_q8_patch.py')
p=BASE/'xolotl-h200-q8-control-v2.patch'
if p.exists():raise RuntimeError('Q8 v2 patch already frozen')
patch=''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='a/CMakeLists.txt',tofile='b/CMakeLists.txt'))
name='tools/v41/engine/aster_h200_q8_mmq.cpp';raw=(BASE/'aster_h200_q8_mmq.cpp').read_text()
patch+=''.join(difflib.unified_diff([],raw.splitlines(True),fromfile='/dev/null',tofile='b/'+name));p.write_text(patch,encoding='utf-8',newline='\n')
stage=(BASE/'stage_xolotl_q8_build.py').read_text().replace("'xolotl-h200-q8-build-intent.json'","'xolotl-h200-q8-v2-build-intent.json'").replace("+'/xolotl-q8-mmq-h200'","+'/xolotl-q8-mmq-v2-h200'").replace("BASE/'xolotl-h200-q8-control.patch'","BASE/'xolotl-h200-q8-control-v2.patch'").replace("BASE/'xolotl_q8_build_worker.frozen.py'","BASE/'xolotl_q8_v2_build_worker.frozen.py'")
compile(stage,'q8-v2-stage.py','exec');(BASE/'stage_xolotl_q8_v2_build.frozen.py').write_text(stage)
launch=(BASE/'launch_xolotl_q8_build.py').read_text().replace('xolotl-h200-q8-build-intent.json','xolotl-h200-q8-v2-build-intent.json').replace('xolotl_q8_build_launcher.frozen.py','xolotl_q8_v2_build_launcher.frozen.py')
compile(launch,'q8-v2-launch.py','exec');(BASE/'launch_xolotl_q8_v2_build.frozen.py').write_text(launch)
observer=(BASE/'observe_xolotl_q8_build.py').read_text().replace('xolotl-h200-q8-build-intent.json','xolotl-h200-q8-v2-build-intent.json').replace('xolotl-q8-build-latest.json','xolotl-q8-v2-build-latest.json')
compile(observer,'q8-v2-observe.py','exec');(BASE/'observe_xolotl_q8_v2_build.frozen.py').write_text(observer)
qualifier=(BASE/'qualify_xolotl_q8_build.py').read_text().replace('xolotl-h200-q8-build-intent.json','xolotl-h200-q8-v2-build-intent.json').replace('xolotl-q8-build-latest.json','xolotl-q8-v2-build-latest.json').replace('xolotl-q8-hardware-controls.json','xolotl-q8-v2-hardware-controls.json').replace('xolotl-q8-controls-launch.json','xolotl-q8-v2-controls-launch.json').replace('xolotl_q8_control_worker.frozen.py','xolotl_q8_v2_control_worker.frozen.py')
compile(qualifier,'q8-v2-qualifier.py','exec');(BASE/'qualify_xolotl_q8_v2_build.frozen.py').write_text(qualifier)
print(json.dumps(dict(only_change='CMake patch context after graph and split patches',patch_sha256=hashlib.sha256(p.read_bytes()).hexdigest(),v1_preserved=True),indent=2))
