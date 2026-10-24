"""Honor the user's server-only ingress choice; terminate only exact task-owned Windows processes."""
import ctypes,json,subprocess,time
from ctypes import wintypes
from xolotl_serving_common import BASE
outpath=BASE/'xolotl-windows-forwarding-removed-v1.json'
if outpath.exists():raise RuntimeError('Windows cleanup receipt exists; inspect it')
intent=json.loads((BASE/'xolotl-stable-access-tunnel-intent.json').read_text())
state=json.loads((BASE/'xolotl-stable-access-tunnel-status.json').read_text())
rec=dict(unix=time.time(),phase='prepared',user_instruction='windows转发不需要存在',processes=[])
outpath.write_text(json.dumps(rec,ensure_ascii=False,indent=2)+'\n')
k=ctypes.WinDLL('kernel32',use_last_error=True)
k.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD];k.OpenProcess.restype=wintypes.HANDLE
k.GetProcessTimes.argtypes=[wintypes.HANDLE]+[ctypes.POINTER(wintypes.FILETIME)]*4
k.TerminateProcess.argtypes=[wintypes.HANDLE,wintypes.UINT];k.WaitForSingleObject.argtypes=[wintypes.HANDLE,wintypes.DWORD];k.CloseHandle.argtypes=[wintypes.HANDLE]
def stop(pid,created):
 h=k.OpenProcess(0x00100000|0x1000|0x0001,False,pid)
 if not h:
  if ctypes.get_last_error()==87:return dict(pid=pid,already_gone=True)
  raise ctypes.WinError(ctypes.get_last_error())
 try:
  ft=[wintypes.FILETIME() for _ in range(4)]
  if not k.GetProcessTimes(h,*[ctypes.byref(v) for v in ft]):raise ctypes.WinError(ctypes.get_last_error())
  if ((ft[0].dwHighDateTime<<32)|ft[0].dwLowDateTime)!=created:raise RuntimeError('Windows process creation identity changed; refusing termination')
  if not k.TerminateProcess(h,0):raise ctypes.WinError(ctypes.get_last_error())
  if k.WaitForSingleObject(h,5000)!=0:raise RuntimeError('owned Windows process did not stop')
  return dict(pid=pid,created_filetime=created,stopped=True)
 finally:k.CloseHandle(h)
for pid,created in [(intent['supervisor_pid'],intent['supervisor_created_filetime']),(state['ssh_pid'],state['ssh_created_filetime'])]:
 rec['processes'].append(stop(pid,created));outpath.write_text(json.dumps(rec,ensure_ascii=False,indent=2)+'\n')
script=BASE/'remove_xolotl_windows_network_v1.ps1'
p=subprocess.run(['powershell','-NoProfile','-NonInteractive','-File',str(script)],capture_output=True,text=True,timeout=35)
if p.returncode:raise RuntimeError('Exact Windows network cleanup failed: '+p.stderr[-3000:])
rec.update(phase='removed',network=json.loads(p.stdout),finished_unix=time.time());outpath.write_text(json.dumps(rec,ensure_ascii=False,indent=2)+'\n');print(json.dumps(rec,ensure_ascii=False,indent=2))
