"""Verify the exact owned native service from the jump-host client; never print its key."""
import argparse,base64,json,shlex,subprocess,time
from pathlib import Path
BASE=Path('D:/code/aster/target/h200-native');WORK=Path('D:/code/aster/.wt-h200-native-deploy')
parser=argparse.ArgumentParser();parser.add_argument('--phase',choices=['discovery','chat','stream','lifecycle'],required=True);arguments=parser.parse_args()
record=json.loads((BASE/'native-xq-service-deployment.json').read_text())
code='''from pathlib import Path
import hashlib,json,os,shlex,socket,subprocess,time,urllib.request,urllib.error
record=RECORD;phase=PHASE
root=Path(record['remote'])
if root.resolve()!=root or root.stat().st_uid!=10250 or os.getuid()!=10250:raise RuntimeError('owned service stage identity changed')
os.umask(0o077)
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
def cli(args):return subprocess.run(['bash','-lc','. /etc/profile.d/ssh-init.sh >/dev/null 2>&1; exec '+shlex.join(args)],capture_output=True,text=True,check=True,timeout=25)
replica=json.loads(cli(['brainctl','get','replica',record['replica'],'-n','ailab-hrprdduanyan','-o','json']).stdout)
if replica['metadata']['uid']!=record['replica_uid'] or replica['status']['phase']!='Running' or replica['status']['nodeName']!='gpu-l-lg-cmc-h-h200-0249.host.h.pjlab.org.cn':raise RuntimeError('owned native allocation identity changed')
state=json.loads((root/'service-result.json').read_text())
if state['phase']!='service_listener_verified' or state['server_binary_sha256']!='13cd3ce92f7048fd6720119660e006ab08ccf75dea269586b3a11c21cff21870':raise RuntimeError('exact native service has not passed its listener gate')
secret=root/'auth/api-key.txt';metadata=secret.lstat()
if secret.resolve()!=secret or secret.is_symlink() or metadata.st_uid!=10250 or metadata.st_mode&0o077 or metadata.st_size>128:raise RuntimeError('service credential identity changed')
key=secret.read_text().strip()
base='http://'+socket.gethostbyname(replica['status']['nodeName'])+':30003/v1'
result=dict(schema='aster-native-power-api-client-v1',unix=time.time(),phase=phase,base_url=base,credential_expires_unix=state['credential_expires_unix'],quality_or_performance_qualification_claimed=False)
def query(path,body=None,token=key):
 headers={'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None
 request=urllib.request.Request(base+path,data=data,headers=headers)
 started=time.monotonic()
 try:
  with urllib.request.urlopen(request,timeout=300 if body else 10) as response:
   payload=response.read(1048577)
   if len(payload)>1048576:raise RuntimeError('native API response exceeded its read bound')
   return dict(status=response.status,elapsed_seconds=time.monotonic()-started,body=json.loads(payload))
 except urllib.error.HTTPError as error:
  return dict(status=error.code,elapsed_seconds=time.monotonic()-started)
if phase=='discovery':
 result['valid']=query('/models');result['anonymous']=query('/models',token=None);result['wrong']=query('/models',token='invalid-native-client-key')
 if [result[k]['status'] for k in ['valid','anonymous','wrong']]!=[200,401,401]:raise RuntimeError('external model discovery/authentication failed')
 if [item['id'] for item in result['valid']['body']['data']]!=['deepseek-v4.1-flash-1017-xq']:raise RuntimeError('external native model registry differs')
elif phase=='chat':
 result['cases']=[]
 for prompt,expected in [('只回复一个数字：2+2等于多少？','4'),('Python表达式1+1的结果是什么？只回复数字。','2')]:
  body=dict(model='deepseek-v4.1-flash-1017-xq',messages=[dict(role='user',content=prompt)],temperature=0,max_tokens=8,stream=False)
  response=query('/chat/completions',body)
  if response['status']!=200:raise RuntimeError('native non-stream chat failed: '+str(response))
  usage=response['body']['usage'];content=response['body']['choices'][0]['message']['content']
  if not 1<=usage['completion_tokens']<=8 or usage['prompt_tokens']<=0 or usage['total_tokens']!=usage['prompt_tokens']+usage['completion_tokens']:raise RuntimeError('native usage is invalid')
  result['cases'].append(dict(prompt_sha256=hashlib.sha256(prompt.encode()).hexdigest(),expected=expected,smoke_answer_matches=content.strip()==expected,**response))
elif phase=='stream':
 body=dict(model='deepseek-v4.1-flash-1017-xq',messages=[dict(role='user',content='只回复英文大写OK。')],temperature=0,max_tokens=8,stream=True,stream_options=dict(include_usage=True))
 request=urllib.request.Request(base+'/chat/completions',data=json.dumps(body,ensure_ascii=False).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+key})
 started=time.monotonic();events=[];size=0;done=False;first=None
 with urllib.request.urlopen(request,timeout=300) as response:
  if response.status!=200:raise RuntimeError('native SSE request failed')
  while True:
   line=response.readline(65537);size+=len(line)
   if len(line)>65536 or size>262144:raise RuntimeError('native SSE exceeds its read bound')
   if not line:break
   if not line.startswith(b'data:'):continue
   value=line[5:].strip()
   if value==b'[DONE]':done=True;break
   event=json.loads(value);events.append(dict(elapsed_seconds=time.monotonic()-started,event=event))
   if first is None and any(choice.get('delta',{}).get('content') or choice.get('delta',{}).get('reasoning_content') for choice in event.get('choices',[])):first=time.monotonic()-started
 if not done or first is None or not any(item['event'].get('usage') for item in events):raise RuntimeError('native SSE lacked incremental text, final usage or DONE')
 result.update(events=events,first_text_seconds=first,total_seconds=time.monotonic()-started,done=done)
elif phase=='lifecycle':
 credential=root/'auth/credential.acl';original=credential.read_bytes();marker=root/'auth/revoked'
 if marker.exists():raise RuntimeError('credential is already revoked')
 with marker.open('xb') as output:output.write(b'owned-auth-check')
 try:result['revoked']=query('/models')
 finally:
  if marker.read_bytes()!=b'owned-auth-check':raise RuntimeError('revocation marker changed concurrently')
  marker.unlink()
 if credential.read_bytes()!=original:raise RuntimeError('credential changed concurrently')
 now=int(time.time());expired=('schema = "a3s.deepseek.credential-lease.v1"'+chr(10)+'api_key_sha256 = "'+hashlib.sha256(key.encode()).hexdigest()+'"'+chr(10)+'starts_unix = '+str(now-60)+chr(10)+'expires_unix = '+str(now-30)+chr(10)).encode()
 temporary=root/'auth/expired-check.acl'
 with temporary.open('xb') as output:output.write(expired)
 temporary.replace(credential)
 try:result['expired']=query('/models')
 finally:
  if credential.read_bytes()!=expired:raise RuntimeError('expired credential changed concurrently; original retained in process memory')
  temporary=root/'auth/credential-restore.acl'
  with temporary.open('xb') as output:output.write(original)
  temporary.replace(credential)
 result['restored']=query('/models')
 result['credential_mode_after_restore']=oct(credential.stat().st_mode&0o777)
 if credential.stat().st_mode&0o077:raise RuntimeError('restored credential permissions are insecure')
 if [result[k]['status'] for k in ['revoked','expired','restored']]!=[401,401,200]:raise RuntimeError('actual HTTP credential lifecycle failed')
result['passed']=True
print(json.dumps(result))
'''.replace('RECORD',repr(record)).replace('PHASE',repr(arguments.phase))
compile(code,'native-api-client','exec')
command='python3 -c '+shlex.quote('import base64;exec(base64.b64decode('+repr(base64.b64encode(code.encode()).decode())+'))')
response=subprocess.run(['ssh','-C','-o','BatchMode=yes','-o','ConnectTimeout=15','-o','HostName=10.102.254.2','-o','HostKeyAlias=h.pjlab.org.cn','yangchao-dev.yangchao.ailab-hrprdduanyan.ws@h.pjlab.org.cn',command],capture_output=True,text=True,timeout=650 if arguments.phase=='chat' else 340)
if response.returncode:raise RuntimeError('native API client failed: '+response.stderr[-4000:])
result=json.loads(response.stdout);name='native-api-client-'+arguments.phase+'-'+str(int(result['unix']))+'.json'
(BASE/name).write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
(WORK/'docs/evidence/power/2026-10-22-native-deepseek-h200/native-power-api-deployment'/name).write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
print(json.dumps(result,indent=2,ensure_ascii=False))
