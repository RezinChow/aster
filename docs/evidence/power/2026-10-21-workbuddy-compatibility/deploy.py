"""Root-only, one-instance-at-a-time Power wrapper rollout with rollback."""
import hashlib
import http.client
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

EXPECTED = '7fd9ef1c0752c748790669bec2d7a51b4187887dd9d45128096b87293523cf6e'
SOURCE = Path('/code/Power/target/release/a3s-power')
RELEASE = Path('/opt/a3s/releases') / EXPECTED / 'a3s-power'
RECORD = Path('/data/power/workbuddy-compat-20261021/deployment-attempt2.json')
DROPIN = '91-workbuddy-compat-20261021.conf'


def run(*args):
    return subprocess.check_output(args, text=True, timeout=95).strip()


def pid(unit):
    return int(run('systemctl', 'show', unit, '--property=MainPID', '--value'))


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def probe(index, compatible=False):
    conn = http.client.HTTPConnection('127.0.0.1', 8080 if compatible else 18200+index, timeout=15)
    try:
        if not compatible:
            conn.request('GET', '/health')
        else:
            body = {'model':'prism-27b','max_tokens':8,'stream':False,
                    'messages':[{'role':'user','content':'Reply with exactly OK.',
                    'agent':'synthetic-workbuddy','conversationRequestId':'synthetic-turn',
                    'startsNewUserRequest':True}]}
            gateway_pid = pid('a3s-gateway')
            parts = Path(f'/proc/{gateway_pid}/environ').read_bytes().split(b'\0')
            values = [part.split(b'=',1)[1] for part in parts
                      if part.startswith(b'A3S_GATEWAY_SHARED_TOKEN=')]
            assert len(values) == 1
            conn.request('POST', '/v1/chat/completions', json.dumps(body),
                         {'Content-Type':'application/json',
                          'Authorization':'Bearer '+values[0].decode('ascii')})
        response = conn.getresponse()
        value = json.loads(response.read(1024*1024))
        assert response.status == 200, response.status
        if compatible:
            assert value['choices'][0]['message']['content'].strip() == 'OK'
    finally:
        conn.close()


def main():
    assert os.geteuid() == 0
    assert not RECORD.exists(), 'do not overwrite prior deployment evidence'
    assert digest(SOURCE) == EXPECTED
    assert '1953 passed; 0 failed' in Path('/data/power/workbuddy-compat-20261021/library-tests.log').read_text()
    native_before = {str(i):pid(f'prism-27b@{i}') for i in range(8)}
    for i in range(8):
        probe(i)
        assert not (Path(f'/etc/systemd/system/a3s-power@{i}.service.d') / DROPIN).exists()
    RELEASE.parent.mkdir(parents=True, exist_ok=True)
    if RELEASE.exists():
        assert digest(RELEASE) == EXPECTED
    else:
        shutil.copyfile(SOURCE, RELEASE)
        RELEASE.chmod(0o755)
    result = {'started_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
              'source_commit':run('git','-C','/code/Power','rev-parse','HEAD'),
              'binary_sha256':EXPECTED, 'instances':[], 'passed':False,
              'native_pids_before':native_before}
    changed = []
    try:
        for i in [7,0,1,2,3,4,5,6]:
            unit = f'a3s-power@{i}'
            before = pid(unit)
            dropin = Path(f'/etc/systemd/system/{unit}.service.d') / DROPIN
            dropin.parent.mkdir(parents=True, exist_ok=True)
            with dropin.open('x') as stream:
                stream.write(f'[Service]\nExecStart=\nExecStart={RELEASE} serve --config /etc/a3s/power/{i}.acl\n')
            changed.append((unit, dropin))
            run('systemctl','daemon-reload')
            run('systemctl','restart',unit)
            for attempt in range(30):
                try:
                    probe(i)
                    break
                except (OSError, AssertionError):
                    if attempt == 29:
                        raise
                    time.sleep(0.3)
            # Exercise the production credential and upstream-auth path. During
            # the canary, old pool members still return the known schema 400.
            # Only an upgraded member can pass the WorkBuddy request.
            for attempt in range(48):
                try:
                    probe(i, compatible=True)
                    break
                except AssertionError as exc:
                    if str(exc) != '400' or attempt == 47:
                        raise
            after = pid(unit)
            assert after != before and digest(f'/proc/{after}/exe') == EXPECTED
            result['instances'].append({'index':i,'before_pid':before,'after_pid':after,
                                        'health_http':200,'gateway_workbuddy_http':200,
                                        'probe_scope':'production load-balanced gateway, exact member not asserted',
                                        'binary_sha256':EXPECTED})
            RECORD.write_text(json.dumps(result,indent=2))
            print(json.dumps(result['instances'][-1]),flush=True)
        result['native_pids_after'] = {str(i):pid(f'prism-27b@{i}') for i in range(8)}
        assert result['native_pids_after'] == native_before
        result['passed'] = True
    except Exception as exc:
        result['failure'] = type(exc).__name__ + ': ' + str(exc)
        result['rollback'] = []
        for unit, dropin in reversed(changed):
            dropin.unlink()
            run('systemctl','daemon-reload')
            run('systemctl','restart',unit)
            result['rollback'].append(unit)
        raise
    finally:
        RECORD.write_text(json.dumps(result,indent=2))


if __name__ == '__main__':
    main()
