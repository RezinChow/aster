"""One bounded original-engine trial; real token IDs and monotonic arrivals."""
import json
import math
import os
from pathlib import Path
import queue
import signal
import subprocess
import threading
import time

ROOT=Path(__file__).resolve().parent
PLAN=json.loads((ROOT/'plan.json').read_text())
RESULT=dict(schema='aster-original-xolotl-protocol-trial-v1',phase='preflight',unix=time.time(),plan=PLAN,requests=[])
def save():
    p=ROOT/'result.tmp'
    p.write_text(json.dumps(RESULT,ensure_ascii=False,indent=2)+'\n')
    p.replace(ROOT/'result.json')
def checked_file(path,size):
    p=Path(path)
    if not p.is_file() or p.stat().st_size!=size:raise RuntimeError('trial model input size differs: '+str(p))
    return p
def reader(pipe,events):
    try:
        for line in iter(pipe.readline,''):
            if len(line)>65536:raise RuntimeError('engine protocol line exceeds bound')
            events.put((time.monotonic(),line.rstrip('\n')),timeout=2)
    finally:events.put((time.monotonic(),None),timeout=2)

child=None;pidfd=None;stop=threading.Event();telemetry=[]
def sample():
    while not stop.is_set() and len(telemetry)<1800:
        p=subprocess.run(['nvidia-smi','--query-gpu=index,uuid,utilization.gpu,memory.used,power.draw','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8)
        telemetry.append(dict(unix=time.time(),exit=p.returncode,stdout=p.stdout[:4096]))
        stop.wait(1)

try:
    if ROOT!=Path(__file__).absolute().parent or ROOT.stat().st_uid!=os.getuid() or os.getuid()!=10250:raise RuntimeError('trial worker ownership differs')
    if time.time()+1800>PLAN['lease_ends_unix']:raise RuntimeError('insufficient immutable lease remaining')
    checked_file(PLAN['model'],162954903552)
    checked_file(PLAN['rank'],122880)
    active=subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,check=True,timeout=10)
    if active.stdout.strip():raise RuntimeError('trial GPUs already have a workload')
    env={k:v for k,v in os.environ.items() if not k.startswith('STRATA_')}
    env.update(CUDA_VISIBLE_DEVICES=PLAN['visible_devices'],GGML_NO_BACKTRACE='1',STRATA_NO_LARGEPAGES='1',OMP_NUM_THREADS='16',OPENBLAS_NUM_THREADS='1')
    if PLAN['dspark']:env.update(STRATA_SERVE_DSPARK=PLAN['sidecar'],STRATA_DSPARK_DEPTH='4')
    command=[PLAN['binary'],'--serve','-m',PLAN['model'],'--backend','cuda','--experts','gpu','--engram',PLAN['engram'],'--rank',PLAN['rank'],'--ctx','256','--threads','16','--prompt-batch','256','--prefill-chunk','128','--arena-gib','60','--arena-skip-resident','--pcie','1','--route-bias','0','--route-bias-file','0','--skip-miss','0','--skip-file','0','--temp','0','--seed','1','--conversation-cache-mib','0','--prompt-cache','0','--stop','1']
    if PLAN['visible_devices']=='0,1':command+=['--layer-split','20','--split-device','1']
    RESULT.update(command=command,phase='loading',cuda_visible_devices=env['CUDA_VISIBLE_DEVICES'],dspark=PLAN['dspark']);save()
    events=queue.Queue(maxsize=4096)
    with (ROOT/'engine.stderr.log').open('x',buffering=1) as stderr:
        child=subprocess.Popen(command,cwd=ROOT,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=stderr,text=True,bufsize=1,start_new_session=True)
        pidfd=os.pidfd_open(child.pid)
        process=dict(pid=child.pid,start_ticks=int(Path('/proc/'+str(child.pid)+'/stat').read_text().split(') ',1)[1].split()[19]),uid=os.getuid(),binary=PLAN['binary'])
        (ROOT/'engine-process.json').write_text(json.dumps(process,indent=2)+'\n')
        threading.Thread(target=reader,args=(child.stdout,events),daemon=True).start()
        sampler=threading.Thread(target=sample,daemon=True);sampler.start()
        deadline=time.monotonic()+600
        while True:
            ts,line=events.get(timeout=max(.01,deadline-time.monotonic()))
            if line is None:raise RuntimeError('engine exited before READY')
            if line.startswith('READY '):RESULT['ready_line']=line;break
            if line.startswith('ERR '):raise RuntimeError(line)
        RESULT.update(phase='running',ready_unix=time.time());save()
        cases=PLAN['cases']
        runs=[dict(cases[0],role='warmup')]+[dict(cases[0],role='measured',repeat=i) for i in range(3)]+[dict(c,role='quality') for c in cases[1:]]
        with (ROOT/'protocol.jsonl').open('x',buffering=1) as journal:
            for case in runs:
                start=time.monotonic();tokens=[];lines=[]
                child.stdin.write('GEN '+str(case['max_new_tokens'])+' temperature=0 seed=1 '+','.join(map(str,case['ids']))+'\n');child.stdin.flush()
                deadline=start+600
                while True:
                    ts,line=events.get(timeout=max(.01,deadline-time.monotonic()))
                    if line is None:raise RuntimeError('engine exited during request')
                    journal.write(json.dumps(dict(case=case['name'],role=case['role'],seconds=ts-start,line=line))+'\n')
                    lines.append(line)
                    if line.startswith('T '):
                        fields=line.split()
                        if len(fields)!=2:raise RuntimeError('unexpected token record')
                        tokens.append(dict(id=int(fields[1]),seconds=ts-start))
                    elif line.startswith('ERR '):raise RuntimeError(line)
                    elif line.startswith('DONE '):break
                    if len(lines)>4096 or len(tokens)>case['max_new_tokens']:raise RuntimeError('request output exceeds bound')
                if not tokens:raise RuntimeError('trial request returned no tokens')
                done=lines[-1].split()
                if int(done[1])!=len(tokens):raise RuntimeError('engine completion count disagrees with emitted tokens')
                elapsed=time.monotonic()-start
                span=tokens[-1]['seconds']-tokens[0]['seconds']
                rate=(len(tokens)-1)/span if len(tokens)>1 and span>0 else None
                if rate is not None and not math.isfinite(rate):raise RuntimeError('invalid decode rate')
                RESULT['requests'].append(dict(case=case['name'],role=case['role'],prompt_tokens=len(case['ids']),tokens=tokens,completion_tokens=len(tokens),ttft_seconds=tokens[0]['seconds'],request_seconds=elapsed,selected_id_decode_tok_s=rate,done=line,protocol_metadata=[s for s in lines if not s.startswith('T ')]))
                save()
        child.stdin.write('QUIT\n');child.stdin.flush();child.wait(timeout=30)
        if child.returncode:raise RuntimeError('engine failed during orderly shutdown')
        RESULT.update(phase='complete',finished_unix=time.time(),engine_exit=child.returncode)
except Exception as e:
    RESULT.update(phase='failed',error=repr(e),finished_unix=time.time())
    raise
finally:
    if child is not None and child.poll() is None:
        if pidfd is not None:signal.pidfd_send_signal(pidfd,signal.SIGTERM)
        try:child.wait(timeout=15)
        except subprocess.TimeoutExpired:
            signal.pidfd_send_signal(pidfd,signal.SIGKILL);child.wait(timeout=15)
    if pidfd is not None:os.close(pidfd)
    stop.set()
    if 'sampler' in globals():sampler.join(timeout=10)
    RESULT['telemetry']=telemetry
    RESULT['engine_reaped']=child is None or child.poll() is not None
    save()
