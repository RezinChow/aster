"""A hidden, bounded SSH tunnel with reconnects, for this Windows client's API."""
import ctypes,json,os,socket,subprocess,sys,time
from ctypes import wintypes
from pathlib import Path
BASE=Path(__file__).resolve().parent
PLAN=json.loads((BASE/'xolotl-stable-access-tunnel-plan.json').read_text())
STATE=dict(phase='starting',unix=time.time(),base_url='http://127.0.0.1:30003/v1',reconnects=0)
child=None
def save():
 p=BASE/'xolotl-stable-access-tunnel-status.tmp';p.write_text(json.dumps(STATE,indent=2)+'\n');p.replace(BASE/'xolotl-stable-access-tunnel-status.json')
def creation_time(proc):
 a,b,c,d=[wintypes.FILETIME() for _ in range(4)]
 fn=ctypes.windll.kernel32.GetProcessTimes;fn.argtypes=[wintypes.HANDLE,ctypes.POINTER(wintypes.FILETIME),ctypes.POINTER(wintypes.FILETIME),ctypes.POINTER(wintypes.FILETIME),ctypes.POINTER(wintypes.FILETIME)]
 if not fn(wintypes.HANDLE(int(proc._handle)),ctypes.byref(a),ctypes.byref(b),ctypes.byref(c),ctypes.byref(d)):raise ctypes.WinError()
 return (a.dwHighDateTime<<32)|a.dwLowDateTime
try:
 if os.name!='nt':raise RuntimeError('this access tunnel is for the requested Windows client')
 with socket.socket() as s:s.bind(('127.0.0.1',30003))
 while time.time()<PLAN['lease_ends_unix']-20:
  with (BASE/'xolotl-stable-access-tunnel-ssh.stderr.log').open('ab') as log:
   child=subprocess.Popen(PLAN['command'],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW)
  STATE.update(phase='connected',ssh_pid=child.pid,ssh_created_filetime=creation_time(child),last_started_unix=time.time());save()
  while child.poll() is None and time.time()<PLAN['lease_ends_unix']-20:time.sleep(2)
  if child.poll() is None:child.terminate()
  child.wait(timeout=10);STATE.update(phase='reconnecting',last_ssh_exit=child.returncode,reconnects=STATE['reconnects']+1);save()
  if time.time()<PLAN['lease_ends_unix']-20:time.sleep(5)
 STATE.update(phase='expired',finished_unix=time.time());save()
except BaseException as e:
 if child and child.poll() is None:child.terminate();child.wait(timeout=10)
 STATE.update(phase='failed',error=type(e).__name__+': '+str(e),finished_unix=time.time());save();raise
