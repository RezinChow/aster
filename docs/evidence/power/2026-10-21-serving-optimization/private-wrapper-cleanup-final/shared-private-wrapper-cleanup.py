from pathlib import Path
import importlib.util,json,hashlib,os,stat,subprocess,sys,time,datetime
ROOT=Path("/code/Power/.git/optimization-20261021")
RUN=ROOT/"eight-replica"
FINAL=RUN/"live-v4-v2-full1/live-complete.json"
OUT=RUN/"shared-private-wrapper-cleanup-final.json"
CONTROLLER=RUN/"supervisor-shared.py"
CONTROLLER_SHA="df32bae3cd464db984a2506e173d55a5ddc2596e51d0ee759812a7399a40208c"
FINAL_SHA="94172884407670d5ddd95e9d5a7348c54c16d38bebbe80772c32c66d906f3b8c"
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def load(name,path):
 spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def persist(value):
 tmp=OUT.with_suffix(".own-tmp")
 with tmp.open("x") as stream:json.dump(value,stream,indent=2);stream.write("\n")
 os.replace(tmp,OUT)
result={"status":"preflight","started_utc":now(),"authorization_scope":"root GO exact private Power19500..19507 and Gateway19890..19897 only","native_process_control":False,"production_service_control":False,"retained":"all prior artifacts, home, config and process receipts; supervisor removes only its live pid state files","stopped":[]}
if OUT.exists():raise RuntimeError("existing cleanup receipt; no retry")
with OUT.open("x") as stream:json.dump(result,stream)
try:
 if digest(CONTROLLER)!=CONTROLLER_SHA or digest(FINAL)!=FINAL_SHA:raise RuntimeError("fixed controller or full qualification final receipt differs")
 w=load("owned_cleanup_controller",CONTROLLER)
 l=load("cleanup_live_library",Path("/code/aster/docs/evidence/power/2026-10-21-serving-optimization/eight-card-live-qualification-v2.py"))
 complete=json.loads(FINAL.read_bytes())
 if complete.get("qualification_status")!="passed" or complete.get("cell_count")!=12 or complete.get("smoke") is not False:raise RuntimeError("full qualification did not pass")
 production=complete["final_production_identity"]
 expected_keys={"native-"+str(i) for i in range(8)}|{"power-"+str(i) for i in range(8)}|{"gateway"}
 if set(production)!=expected_keys:raise RuntimeError("production final identity set differs")
 def production_verify():
  observed={}
  for key,entry in production.items():
   stamp=entry["process"]
   if l.systemd_pid(entry["unit"])!=stamp["pid"]:raise RuntimeError("production systemd generation changed")
   actual=l.m.process_identity(stamp["pid"],stamp["port"])
   if any(actual[k]!=stamp.get(k) for k in actual):raise RuntimeError("production process identity changed")
   observed[key]={"unit":entry["unit"],"pid":actual["pid"],"start_ticks":actual["start_ticks"],"exe_sha256":actual["exe_sha256"],"cmdline_sha256":actual["cmdline_sha256"],"listener_inodes":actual["listener_inodes"]}
  return observed
 result["production_before"]=production_verify()
 private=[]
 for i in range(8):
  expected=json.loads((RUN/("worker-"+str(i)+"-identity.json")).read_bytes())
  for kind,port in [("power",19500+i),("gateway",19890+i)]:
   recordpath=w.recordfile(kind,i);pf=w.pidfile(kind,i)
   for path in [recordpath,pf]:
    info=path.lstat()
    if not stat.S_ISREG(info.st_mode) or path.is_symlink() or info.st_uid!=os.getuid():raise RuntimeError("private receipt owner or regular file differs")
   receipt=json.loads(w.read_limited(recordpath))
   if int(w.read_limited(pf,32))!=receipt["pid"]:raise RuntimeError("private pid state differs")
   actual=w.verify_owned(kind,i,receipt)
   if actual is None or (Path("/proc")/str(receipt["pid"])).stat().st_uid!=os.getuid():raise RuntimeError("private process is absent or has wrong owner")
   identity=l.m.process_identity(receipt["pid"],port)
   if identity!=expected[kind]:raise RuntimeError("private identity differs from qualified generation")
   private.append({"gpu":i,"kind":kind,"port":port,"pid":receipt["pid"],"start_ticks":receipt["start_ticks"],"uid":os.getuid(),"argv_sha256":identity["cmdline_sha256"],"exe_sha256":identity["exe_sha256"]})
 result.update(status="validated-before-stop",private_before=private,controller_sha256=CONTROLLER_SHA,full_receipt_sha256=FINAL_SHA)
 persist(result)
 command=[sys.executable,str(CONTROLLER),"stop","--gpu"]+[str(i) for i in range(8)]+["--slots","2"]
 completed=subprocess.run(command,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=230)
 result["controller_stop"]={"returncode":completed.returncode,"stdout_sha256":hashlib.sha256(completed.stdout).hexdigest(),"stderr_sha256":hashlib.sha256(completed.stderr).hexdigest()}
 if completed.returncode!=0:raise RuntimeError("private controller stop failed; no automatic retry")
 for item in private:
  state=w.proc(item["pid"])
  if state is not None:raise RuntimeError("qualified private process still alive or pid reused")
  result["stopped"].append(dict(item,owned_generation_exited=True,pid_state_file_absent=not w.pidfile(item["kind"],item["gpu"]).exists()))
 selected_ports={19500+i for i in range(8)}|{19890+i for i in range(8)}
 listening=[]
 for name in ["tcp","tcp6"]:
  for line in (Path("/proc/net")/name).read_text().splitlines()[1:]:
   fields=line.split()
   if len(fields)>3 and fields[3]=="0A":
    port=int(fields[1].split(":")[1],16)
    if port in selected_ports:listening.append(port)
 if listening:raise RuntimeError("selected private port still has listener")
 result["private_ports_released"]=sorted(selected_ports)
 result["production_after"]=production_verify()
 if result["production_after"]!=result["production_before"]:raise RuntimeError("production identity changed after private cleanup")
 result["known_setup_and_load_pids"]={str(pid):{"qualified_generation_exited":w.proc(pid) is None} for pid in [3643669,3652075,3709825]}
 if not all(v["qualified_generation_exited"] for v in result["known_setup_and_load_pids"].values()):raise RuntimeError("known setup or load process still alive")
 result.update(status="passed",finished_utc=now(),all_private_owned_generations_exited=True,all_private_ports_released=True,production_17_unchanged=True,no_new_model_requests=True)
except Exception as error:
 result.update(status="failed-no-retry",failure_exception=type(error).__name__,failure_reason=str(error),finished_utc=now())
finally:persist(result)
print(json.dumps({"status":result["status"],"stopped":len(result["stopped"]),"production_17_unchanged":result.get("production_17_unchanged",False)}),flush=True)
sys.exit(0 if result["status"]=="passed" else 1)
