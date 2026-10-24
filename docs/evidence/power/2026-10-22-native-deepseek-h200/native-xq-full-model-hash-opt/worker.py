"""Bounded complete native token-loop probe on one already owned H200 pair."""
import gzip
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import time


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as source:
        while chunk := source.read(1024**2):
            result.update(chunk)
    return result.hexdigest()


def main():
    root = Path(__file__).absolute().parent
    if root.resolve() != root or root.stat().st_uid != os.getuid() or os.getuid() != 10250:
        raise RuntimeError('full-model probe requires its exact owned stage and UID')
    os.umask(0o077)
    result = dict(schema='aster-native-xq-full-model-probe-v1', unix=time.time(),
                  phase='preflight', service_deployment_claimed=False,
                  quality_or_performance_qualification_claimed=False)
    def publish():
        temporary = root/'probe-result.tmp'
        temporary.write_text(json.dumps(result, indent=2)+'\n')
        temporary.replace(root/'probe-result.json')
    try:
        path = root/'probe-inputs.json'
        if path.stat().st_size > 65536:
            raise RuntimeError('full-model probe manifest exceeds its read bound')
        inputs = json.loads(path.read_text())
        if inputs['schema'] != 'aster-native-xq-full-model-inputs-v1' or inputs['worker_sha256'] != digest(Path(__file__)):
            raise RuntimeError('full-model probe source or manifest contract changed')
        proof = json.loads(Path(inputs['resource_proof']).read_text())
        if proof['phase'] != 'passed' or proof['hostname'] != socket.gethostname() or proof['expectedGpus'] != 8:
            raise RuntimeError('full-model probe requires the verified owned eight-H200 lease')
        deadline = min(1200, int(proof['leaseEndsUnix']-time.time()-60))
        if deadline < 600:
            raise RuntimeError('full-model probe requires at least ten minutes before lease expiry')
        visible = [gpu['uuid'] for gpu in proof['gpus'][:2]]
        active = subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,check=True,timeout=15).stdout
        if active.strip():
            raise RuntimeError('owned allocation already has a CUDA workload')
        artifact = inputs['native_runner']
        archive = root/'run-xq-native.gz'
        if not 0 < artifact['archive_bytes'] <= 128*1024**2 or archive.stat().st_size != artifact['archive_bytes'] or digest(archive) != artifact['archive_sha256']:
            raise RuntimeError('full-model runner archive identity/size differs from its frozen build')
        if not 0 < artifact['binary_bytes'] <= 256*1024**2:
            raise RuntimeError('native executable exceeds its byte bound')
        work = Path('/tmp')/root.name
        work.mkdir(mode=0o700,exist_ok=False)
        binary = work/'run-xq-native'
        count = 0
        with gzip.open(archive,'rb') as source,binary.open('xb') as target:
            while chunk := source.read(1024**2):
                count += len(chunk)
                if count > artifact['binary_bytes']:
                    raise RuntimeError('native executable archive expands beyond its pinned size')
                target.write(chunk)
        if count != artifact['binary_bytes'] or digest(binary) != artifact['binary_sha256']:
            raise RuntimeError('full-model native executable identity changed')
        binary.chmod(0o700)
        environment = dict(os.environ)
        paths = [value for value in environment.get('LD_LIBRARY_PATH','').split(':') if value]
        if any('stubs' in Path(value).parts for value in paths):
            raise RuntimeError('CUDA linker stubs cannot execute a native model')
        environment['LD_LIBRARY_PATH'] = ':'.join(['/usr/local/cuda/lib64']+paths)
        environment['CUDA_VISIBLE_DEVICES'] = ','.join(visible)
        command = [str(binary),inputs['payload_root'],inputs['official_blob_root'],'2','0,7,8,9','2']
        result.update(phase='native_running',inputs=inputs,visible_gpu_uuids=visible,command=command,deadline_seconds=deadline)
        publish()
        with (root/'native.stdout.log').open('x') as stdout,(root/'native.stderr.log').open('x') as stderr:
            child = subprocess.Popen(command,stdout=stdout,stderr=stderr,env=environment)
            ticks = int(Path('/proc/'+str(child.pid)+'/stat').read_text().split(') ',1)[1].split()[19])
            result['native_process'] = dict(pid=child.pid,start_ticks=ticks,uid=os.getuid())
            publish()
            try:
                status = child.wait(timeout=deadline)
            except subprocess.TimeoutExpired:
                child.kill();child.wait();raise
        result['native_exit'] = status
        publish()
        if status:
            raise RuntimeError('complete native model probe failed; preserve exact phase/stderr')
        output = root/'native.stdout.log'
        if output.stat().st_size > 4*1024**2:
            raise RuntimeError('native output exceeds its bounded receipt size')
        events = [json.loads(line) for line in output.read_text().splitlines() if line.strip()]
        generated = events[-1]
        if generated.get('phase') != 'generated' or generated.get('native_execution') is not True or generated.get('group_width') != '2':
            raise RuntimeError('native runner did not return a complete generated-token receipt')
        generation = generated['generation']
        stats = generation['stats']
        if not 1 <= len(generation['tokens']) <= 2 or stats['executedLayersByOrdinal'] != [20*stats['modelSteps']]*2+[0]*6:
            raise RuntimeError('native token receipt did not execute the declared complete 40-layer group')
        result.update(phase='passed',generation_receipt=generated,completed_unix=time.time())
        publish()
    except Exception as error:
        result.update(phase='failed',error_type=type(error).__name__,error=str(error),completed_unix=time.time())
        publish()
        raise
    finally:
        print(json.dumps(result),flush=True)


if __name__ == '__main__':
    main()
