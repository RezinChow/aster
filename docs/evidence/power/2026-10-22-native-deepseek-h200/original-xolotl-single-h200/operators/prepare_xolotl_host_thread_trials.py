"""Isolate control-thread count on the same CUDA binary; no GPU algorithm changes."""
import ast
from xolotl_trial_common import BASE
profiles={
 'single-current-hostthreads-1':dict(ptq_mma=False,ptq_mma_diagnostics=False,original_mtp=False,host_threads=1),
 'single-current-hostthreads-4':dict(ptq_mma=False,ptq_mma_diagnostics=False,original_mtp=False,host_threads=4),
}
worker=(BASE/'xolotl_mma_v2_protocol_worker.frozen.py').read_text()
def once(text,a,b):
 if text.count(a)!=1:raise RuntimeError('thread trial anchor differs: '+a[:70])
 return text.replace(a,b)
worker=once(worker,"    budget=PLAN.get('max_trial_seconds',1800)","    host_threads=PLAN.get('host_threads',16)\n    if type(host_threads) is not int or host_threads not in (1,4,16):raise RuntimeError('host threads must be1,4 or16')\n    budget=PLAN.get('max_trial_seconds',1800)")
worker=once(worker,"OMP_NUM_THREADS='16'","OMP_NUM_THREADS=str(host_threads)")
worker=once(worker,"'--threads','16'","'--threads',str(host_threads)")
ast.parse(worker);(BASE/'xolotl_host_thread_protocol_worker.frozen.py').write_text(worker)
launcher=(BASE/'launch_xolotl_mma_v2_model_trial.frozen.py').read_text();start=launcher.index('choices=[');end=launcher.index('],required=True',start)+1;launcher=launcher[:start]+'choices='+repr(list(profiles))+launcher[end:]
launcher=once(launcher,"worker=(BASE/'xolotl_mma_v2_protocol_worker.frozen.py').read_bytes()","worker=(BASE/'xolotl_host_thread_protocol_worker.frozen.py').read_bytes()")
start=launcher.index('\nprofiles=')+1;end=launcher.index('\nprofile=profiles[args.mode]',start);launcher=launcher[:start]+'profiles='+repr(profiles)+launcher[end:]
ast.parse(launcher);(BASE/'launch_xolotl_host_thread_trial.frozen.py').write_text(launcher)
observer=(BASE/'observe_xolotl_mma_v2_model_trial.frozen.py').read_text();start=observer.index('choices=[');end=observer.index(']);p.add_argument',start)+1;observer=observer[:start]+'choices='+repr(list(profiles))+observer[end:]
ast.parse(observer);(BASE/'observe_xolotl_host_thread_trial.frozen.py').write_text(observer)
comparison=(BASE/'compare_xolotl_mma_v2_model.frozen.py').read_text()
comparison=once(comparison,'import json,time','import argparse,json,time\np=argparse.ArgumentParser();p.add_argument("--threads",type=int,choices=[1,4],required=True);args=p.parse_args()')
comparison=once(comparison,"names=['single-current-mma-v2-control','single-current-mma-v2-candidate']","names=['single-current-mma-v2-control','single-current-hostthreads-'+str(args.threads)]")
a="if [p.pop('ptq_mma') for p in plans]!=[False,True] or plans[0]!=plans[1]:raise RuntimeError('same-binary plans differ beyond the explicit MMA flag')"
b="if [p.pop('host_threads',16) for p in plans]!=[16,args.threads] or plans[0]!=plans[1]:raise RuntimeError('same-binary plans differ beyond the explicit host thread count')"
comparison=once(comparison,a,b)
comparison=once(comparison,"BASE/'xolotl-mma-v2-model-comparison.json'","BASE/('xolotl-hostthreads-'+str(args.threads)+'-comparison.json')")
comparison=once(comparison,'same binary with flag0/1, one paired round','same binary with16 versus requested host threads, one paired round')
ast.parse(comparison);(BASE/'compare_xolotl_host_thread_trial.frozen.py').write_text(comparison)
print('Prepared one/four host-thread trials against the completed16-thread control; same binary, weights, routing, context and GPU flags.')
