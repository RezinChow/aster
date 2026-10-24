"""Run the frozen Rust CUDA test executable only on an owned, idle H200."""
import gzip,hashlib,json,os,subprocess,time
from pathlib import Path

ROOT=Path(__file__).resolve().parent
RESULT={'schema':'aster-h200-xq-f32-component-qualification-v1','unix':time.time(),'phase':'preflight','complete_model_execution_claimed':False,'GPU_execution_claimed':False}
EXPECTED_TESTS={
 'cuda::tests::gpu::h200_explicit_scalar_profile_preserves_checkpoint_subnormal_product',
 'cuda::tests::gpu::h200_raw_group32_mma_matches_independent_scalar_inputs',
 'cuda::xq::tests::gpu::h200_xq_all_packed_formats_match_independent_golden_row_dots',
 'cuda::xq::tests::gpu::h200_xq_gather_preserves_distinct_repeated_nonordered_rows_and_every_golden_bit',
 'layers::xq::text::tests::gpu::h200_xq_embedding_shifted_f32_mhc_and_output_head_match_independent_math',
}

def publish():
 p=ROOT/'result.tmp';p.write_text(json.dumps(RESULT,indent=2)+'\n');p.replace(ROOT/'result.json')

def run(name,args,timeout):
 started=time.time()
 with (ROOT/(name+'.stdout.log')).open('w') as stdout,(ROOT/(name+'.stderr.log')).open('w') as stderr:
  p=subprocess.run(args,stdout=stdout,stderr=stderr,timeout=timeout)
 result={'command':args,'exit_code':p.returncode,'elapsed_seconds':time.time()-started}
 RESULT[name]=result;publish()
 if p.returncode:raise RuntimeError(name+' refused or failed; retain original logs')
 return (ROOT/(name+'.stdout.log')).read_text()

def main():
 manifest=json.loads((ROOT/'qualification-inputs.json').read_text())
 if manifest['scope']!='Rust SM90 and XQ component tests only; not full model' or manifest['hermetic_test_count']!=350:raise RuntimeError('unknown qualification contract')
 runtime_paths=[p for p in os.environ.get('LD_LIBRARY_PATH','').split(':') if p]
 if any('stubs' in Path(p).parts for p in runtime_paths):raise RuntimeError('link-stub paths are refused for runtime qualification')
 os.environ['LD_LIBRARY_PATH']=':'.join(['/usr/local/cuda/lib64']+runtime_paths)
 RESULT['inputs']=manifest
 gpu=subprocess.run(['nvidia-smi','--query-gpu=index,name,uuid,memory.total,driver_version','--format=csv,noheader,nounits'],capture_output=True,text=True,check=True,timeout=15).stdout
 rows=[line.strip().split(', ') for line in gpu.splitlines() if line.strip()]
 if len(rows)!=1 or len(rows[0])!=5 or rows[0][1]!='NVIDIA H200':raise RuntimeError('qualification requires exactly one visible NVIDIA H200')
 RESULT['gpu']={'index':rows[0][0],'name':rows[0][1],'uuid':rows[0][2],'memory_total_mib':int(rows[0][3]),'driver_version':rows[0][4]}
 active=subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,check=True,timeout=15).stdout
 if any(line.strip() for line in active.splitlines()):raise RuntimeError('allocated GPU is already in use; do not run or terminate another process')
 artifact=manifest['test_binary'];archive=ROOT/'a3s-deepseek-cuda-tests.gz'
 if hashlib.sha256(archive.read_bytes()).hexdigest()!=artifact['archive_sha256']:raise RuntimeError('test archive identity mismatch')
 if not 0<artifact['binary_bytes']<=1024**3:raise RuntimeError('test executable exceeds qualification byte bound')
 work=Path('/tmp')/ROOT.name;work.mkdir(mode=0o700)
 binary=work/'a3s-deepseek-cuda-tests';count=0;digest=hashlib.sha256()
 with gzip.open(archive,'rb') as source,binary.open('xb') as target:
  while True:
   chunk=source.read(1024**2)
   if not chunk:break
   count+=len(chunk)
   if count>artifact['binary_bytes']:raise RuntimeError('test archive expands beyond pinned binary size')
   digest.update(chunk);target.write(chunk)
 if count!=artifact['binary_bytes'] or digest.hexdigest()!=artifact['binary_sha256']:raise RuntimeError('test executable identity mismatch')
 binary.chmod(0o700)
 dependencies=run('dynamic_dependencies',['ldd',str(binary)],15)
 if 'not found' in dependencies or '/stubs/' in dependencies:raise RuntimeError('real CUDA runtime dependencies are required; link stubs cannot qualify execution')
 listed=run('ignored_test_inventory',[str(binary),'--ignored','--list'],30)
 names={line.removesuffix(': test') for line in listed.splitlines() if line.endswith(': test')}
 if names!=EXPECTED_TESTS:raise RuntimeError('frozen Rust GPU test inventory mismatch')
 RESULT['phase']='running';publish()
 control=run('hermetic_cuda_feature_tests',[str(binary),'--test-threads=1'],120)
 if 'test result: ok. 350 passed; 0 failed; 5 ignored;' not in control:raise RuntimeError('Linux CUDA-feature hermetic test counts mismatch')
 RESULT['GPU_hardware_tests_attempted']=True;publish()
 hardware=run('h200_cuda_kernel_tests',[str(binary),'h200_','--ignored','--nocapture','--test-threads=1'],180)
 if 'test result: ok. 5 passed; 0 failed; 0 ignored;' not in hardware:raise RuntimeError('H200 hardware test counts mismatch')
 RESULT.update(phase='passed',GPU_execution_claimed=True,hermetic_tests_passed=350,H200_hardware_tests_passed=5,finished_unix=time.time())
 publish()

try:
 main()
except Exception as error:
 RESULT.update(phase='failed',error_type=type(error).__name__,error=str(error),finished_unix=time.time());publish();raise
finally:
 print(json.dumps(RESULT),flush=True)
