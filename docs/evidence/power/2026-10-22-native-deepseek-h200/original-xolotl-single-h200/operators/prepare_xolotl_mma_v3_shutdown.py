"""Publish GPU diagnostics before the engine's deliberate _Exit, preserving all math."""
import ast
from xolotl_trial_common import BASE
p=BASE/'aster_ptq_mma_integrated_v3.cuh'
if p.exists():raise RuntimeError('V3 source already frozen')
header=(BASE/'aster_ptq_mma_integrated_v2.cuh').read_text()+r'''
extern "C" void aster_xq_dump_ptq_groups() {
    const cudaError_t e=cudaDeviceSynchronize();
    if(e!=cudaSuccess){std::fprintf(stderr,"ASTER_MMA_GROUPS_ERROR %d\n",int(e));return;}
    aster_ptq_mma::report_group_histogram();
}
'''
p.write_text(header)
worker=(BASE/'xolotl_ptq_mma_integrated_v2_worker.py').read_text()
anchor=' binaries={}\n for name in [\'ds41_generate\',\'aster_xq_split_parity\']:'
extra=r''' main_source=parent/'source/tools/v41/engine/ds41_generate.cpp'
 if main_source.is_symlink() or main_source.stat().st_uid!=10250 or main_source.stat().st_size>2*1024**2:raise RuntimeError('main source owner differs')
 main_before=main_source.read_text();main=main_before
 a='int main(int argc, char ** argv) {'
 if main.count(a)!=1:raise RuntimeError('main forward declaration anchor differs')
 main=main.replace(a,'extern "C" void aster_xq_dump_ptq_groups();\n\n'+a)
 a='        tier.close();'
 b='        const char* mma_diag=std::getenv("ASTER_XQ_PTQ_MMA_DIAGNOSTICS");\n        if(mma_diag && std::strcmp(mma_diag,"1")==0){aster_xq_dump_ptq_groups();std::fflush(stderr);}\n'+a
 if main.count(a)!=1:raise RuntimeError('serve pre-close diagnostic anchor differs')
 main=main.replace(a,b)
 (root/'ds41_generate.original.cpp').write_text(main_before);(root/'ds41_generate.cpp').write_text(main)
 (root/'main-shutdown.patch').write_text(''.join(difflib.unified_diff(main_before.splitlines(True),main.splitlines(True),fromfile='a/tools/v41/engine/ds41_generate.cpp',tofile='b/tools/v41/engine/ds41_generate.cpp')))
 out['original_main_sha256']=sha(main_source);out['patched_main_sha256']=sha(root/'ds41_generate.cpp')
 args=shlex.split(plan['parent_main_command'])
 if args.count('-MD')!=1 or args.count('-MT')!=1 or args.count('-MF')!=1 or args.count('-o')!=1 or args.count('-c')!=1:raise RuntimeError('main compile command shape differs')
 args.remove('-MD')
 for flag in ['-MT','-MF']:
  index=args.index(flag);del args[index:index+2]
 if args[args.index('-c')+1]!=str(main_source):raise RuntimeError('main compile input differs')
 args[args.index('-c')+1]=str(root/'ds41_generate.cpp');args[args.index('-o')+1]=str(root/'ds41_generate.cpp.o')
 out['main_compile_args']=args;run(args,'main-compile',90,root,env)
'''
if worker.count(anchor)!=1:raise RuntimeError('main compile placement anchor differs')
worker=worker.replace(anchor,extra+anchor)
anchor="  if name=='aster_xq_split_parity':"
extra="""  if name=='ds41_generate':
   old='CMakeFiles/ds41_generate.dir/tools/v41/engine/ds41_generate.cpp.o'
   if args.count(old)!=1:raise RuntimeError('main object link substitution differs')
   args[args.index(old)]=str(root/'ds41_generate.cpp.o')
"""
if worker.count(anchor)!=1:raise RuntimeError('main link placement anchor differs')
worker=worker.replace(anchor,extra+anchor);ast.parse(worker);(BASE/'xolotl_ptq_mma_integrated_v3_worker.py').write_text(worker)
stage=(BASE/'stage_xolotl_ptq_mma_integrated_v2.frozen.py').read_text()
for a,b in [('xolotl-ptq-mma-integrated-v2-intent.json','xolotl-ptq-mma-integrated-v3-intent.json'),('aster_ptq_mma_integrated_v2.cuh','aster_ptq_mma_integrated_v3.cuh'),("'/xolotl-ptq-mma-integrated-v2'","'/xolotl-ptq-mma-integrated-v3'"),('xolotl_ptq_mma_integrated_v2_worker.py','xolotl_ptq_mma_integrated_v3_worker.py')]:
 if stage.count(a)!=1:raise RuntimeError('V3 stage anchor differs: '+a)
 stage=stage.replace(a,b)
anchor="payload={'aster_ptq_mma.cuh'"
if stage.count(anchor)!=1:raise RuntimeError('parent main command plan placement differs')
stage=stage.replace(anchor,"plan['parent_main_command']=json.loads((BASE/'xolotl-parent-main-compile-command.json').read_text())['command']\n"+anchor)
ast.parse(stage);(BASE/'stage_xolotl_ptq_mma_integrated_v3.frozen.py').write_text(stage)
observer=(BASE/'observe_xolotl_ptq_mma_integrated_v2.frozen.py').read_text().replace('xolotl-ptq-mma-integrated-v2-intent.json','xolotl-ptq-mma-integrated-v3-intent.json').replace('xolotl-ptq-mma-integrated-v2-latest.json','xolotl-ptq-mma-integrated-v3-latest.json')
ast.parse(observer);(BASE/'observe_xolotl_ptq_mma_integrated_v3.frozen.py').write_text(observer)
print('V3 prepared: explicit pre-close diagnostic hook, unchanged GPU math/flags and18 exact controls; original private main source and compile command retained.')
