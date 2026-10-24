"""GPU-free proof of the exact submitted launcher's UID/log/error contracts."""
import ast
import base64
import json
import os
from pathlib import Path
import shlex
import signal
import subprocess
import sys
import tempfile
import unittest


RECORD=Path('/mnt/d/code/aster/target/h200-native/h200-resource-validation-8-attempt2-pending.json')


def submitted_source():
    record=json.loads(RECORD.read_text())
    argv=shlex.split(record['command'][-1])
    script=argv[argv.index('-c')+1]
    tree=ast.parse(script)
    expression=tree.body[1].value
    if not isinstance(expression,ast.Call) or not isinstance(expression.func,ast.Name) or expression.func.id!='exec':
        raise RuntimeError('unknown submitted launcher syntax')
    decode=expression.args[0]
    if not isinstance(decode,ast.Call) or not isinstance(decode.func,ast.Attribute) or decode.func.attr!='b64decode':
        raise RuntimeError('unknown submitted launcher encoding')
    return base64.b64decode(ast.literal_eval(decode.args[0])).decode()


class FixtureData(ast.NodeTransformer):
    def __init__(self,root,child):
        self.root=root;self.child=child;self.roots=0;self.runs=0
    def visit_Assign(self,node):
        if len(node.targets)==1 and isinstance(node.targets[0],ast.Name) and node.targets[0].id=='root':
            self.roots+=1
            node.value=ast.Call(func=ast.Name(id='Path',ctx=ast.Load()),args=[ast.Constant(self.root)],keywords=[])
        return self.generic_visit(node)
    def visit_Call(self,node):
        if isinstance(node.func,ast.Attribute) and isinstance(node.func.value,ast.Name) and node.func.value.id=='subprocess' and node.func.attr=='run':
            self.runs+=1
            node.args[0]=ast.parse(repr(self.child),mode='eval').body
        return self.generic_visit(node)


@unittest.skipUnless(os.getuid()==0,'requires an explicitly owned GPU-free WSL root test process')
class SubmittedBootstrapUidTests(unittest.TestCase):
    def exercise(self,owner,exit_code):
        with tempfile.TemporaryDirectory(prefix='aster-h200-bootstrap-contract-') as directory:
            root=Path(directory);os.chown(root,owner,owner);root.chmod(0o700)
            child="import os,json,pathlib,sys;pathlib.Path('child.json').write_text(json.dumps({'uid':os.getuid(),'gid':os.getgid(),'groups':os.getgroups()}));sys.exit("+str(exit_code)+")"
            transform=FixtureData(str(root),[sys.executable,'-c',child])
            tree=transform.visit(ast.parse(submitted_source()));ast.fix_missing_locations(tree)
            self.assertEqual((transform.roots,transform.runs),(1,1))
            # Only the fixture path/child are changed. Keep the submitted UID
            # transition, exclusive log open and failure branch exactly intact.
            # subprocess.run(timeout=...) itself calls time.sleep for short
            # polling. Preserve those waits; intercept only our exact 600s
            # diagnostic lease so a successful child cannot appear to hold it.
            prelude="import time,pathlib,json;_real_sleep=time.sleep;time.sleep=lambda seconds:pathlib.Path("+repr(str(root/'diagnostic-sleep.json'))+").write_text(json.dumps(seconds)) if seconds==600 else _real_sleep(seconds)\n"
            process=subprocess.Popen([sys.executable,'-c',prelude+ast.unparse(tree)],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
            try:
                stdout,stderr=process.communicate(timeout=15)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid,signal.SIGKILL);process.communicate();raise
            return dict(code=process.returncode,stdout=stdout,stderr=stderr,
                        child=json.loads((root/'child.json').read_text()) if (root/'child.json').exists() else None,
                        log=(root/'worker.log').read_text() if (root/'worker.log').exists() else None,
                        log_uid=(root/'worker.log').stat().st_uid if (root/'worker.log').exists() else None,
                        log_mode=((root/'worker.log').stat().st_mode & 0o777) if (root/'worker.log').exists() else None,
                        diagnostic_sleep=json.loads((root/'diagnostic-sleep.json').read_text()) if (root/'diagnostic-sleep.json').exists() else None)
    def test_root_image_drops_groups_and_writes_as_exact_artifact_owner(self):
        result=self.exercise(10250,0)
        self.assertEqual(result['code'],0,result)
        self.assertEqual(result['child'],{'uid':10250,'gid':10250,'groups':[]})
        self.assertEqual((result['log_uid'],result['log_mode']),(10250,0o600))
        self.assertIsNone(result['diagnostic_sleep'])
    def test_failed_probe_retains_bounded_diagnostic_lease_and_failure_exit(self):
        result=self.exercise(10250,7)
        self.assertEqual(result['code'],7,result)
        self.assertEqual(result['diagnostic_sleep'],600)
        self.assertIn('RESOURCE_PROBE_FAILED',result['log'])
        self.assertEqual(result['log_uid'],10250)
    def test_foreign_artifact_owner_still_refuses_execution(self):
        result=self.exercise(1001,0)
        self.assertEqual(result['code'],1,result)
        self.assertIsNone(result['child'])
        self.assertIn('owned resource stage UID changed',result['stderr'])
        self.assertEqual(result['diagnostic_sleep'],600)


if __name__=='__main__':
    unittest.main(verbosity=2)
