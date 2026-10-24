"""Freeze strict explicit DSML-parameter and complete-JSON-object grammars; do not guess or repair arguments."""
import ast,hashlib,json
from pathlib import Path
BASE=Path(__file__).resolve().parent;out=BASE/'serve_ds41_dsml_json_v6b.frozen.py'
if out.exists():raise RuntimeError('strict V6b source is already frozen')
source=BASE/'xolotl-trial-source-e9d0826d71c5/source/tools/v41/serve/serve_ds41.py';s=source.read_text()
if hashlib.sha256(source.read_bytes()).hexdigest()!='5180c184d1a421dd5b56e799360fe6306b96d41da2d443d0bb68dae6714f2e5d':raise RuntimeError('pinned original DS41 adapter source changed')
fn='''def ds41_parse_tool_call(body: str, schema=None):
    m = re.match(r'\\s*name="(.*?)">', body, re.DOTALL)
    if not m:
        raise ValueError("malformed tool call: " + body[:80])
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("duplicate JSON tool argument: " + key)
            result[key] = value
        return result
    def reject_constant(value):
        raise ValueError("non-finite JSON tool argument: " + value)
    def finite_float(text):
        value = float(text)
        if value in (float("inf"), -float("inf")):
            raise ValueError("non-finite JSON tool argument")
        return value
    def load(text):
        return json.loads(text, object_pairs_hook=pairs, parse_constant=reject_constant, parse_float=finite_float)
    raw = body[m.end():].strip()
    if raw.startswith(("{", "[")):
        args = load(raw)
        if not isinstance(args, dict):
            raise ValueError("JSON tool arguments must be one complete object")
    else:
        args = {}
        pos = 0
        while pos < len(raw):
            while pos < len(raw) and raw[pos].isspace():
                pos += 1
            if pos == len(raw):
                break
            if not raw.startswith(P_OPEN, pos):
                raise ValueError("unsupported native tool argument grammar")
            parameter = _P_RE.match(raw, pos + len(P_OPEN))
            if parameter is None:
                raise ValueError("malformed native tool parameter")
            key, is_str, value = parameter.groups()
            if key in args:
                raise ValueError("duplicate native tool argument: " + key)
            value = unescape(value)
            args[key] = value if is_str == "true" else load(value)
            pos = parameter.end()
    return F.ToolCall(name=m.group(1), arguments=args)
'''
tree=ast.parse(s);nodes=[x for x in tree.body if isinstance(x,ast.FunctionDef) and x.name=='ds41_parse_tool_call']
if len(nodes)!=1:raise RuntimeError('exact DSML adapter function structure differs')
node=nodes[0];lines=s.splitlines(keepends=True);s=''.join(lines[:node.lineno-1])+fn+''.join(lines[node.end_lineno:]);ast.parse(s);out.write_text(s)
test='''import json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(sys.argv[1])/'tools/v41/serve'))
import serve_ds41 as D
class StrictNativeArguments(unittest.TestCase):
 def parse(self,s):return D.ds41_parse_tool_call(' name="add_numbers">'+s).arguments
 def test_integers(self):self.assertEqual(self.parse('{"a":17,"b":25}'),{'a':17,'b':25})
 def test_nested_unicode(self):self.assertEqual(self.parse('{"a":[1,true,null,{"x":"中文"}]}'),{'a':[1,True,None,{'x':'中文'}]})
 def test_empty(self):self.assertEqual(self.parse('{}'),{});self.assertEqual(self.parse(''),{})
 def test_reject_unsupported_or_corrupt(self):
  for raw in ['[]','[1]','{"a":1} trailing','{"a":1,"a":2}','{"a":{"b":1,"b":2}}','{"a":NaN}','{"a":Infinity}','{"a":1e9999}','{"a":','null','undefined','<bad>17</bad>']:
   with self.subTest(raw=raw),self.assertRaises(ValueError):self.parse(raw)
 def test_canonical_dsml(self):
  body=D.P_OPEN+' name="a" string="false">17'+D.P_CLOSE+D.P_OPEN+' name="b" string="false">25'+D.P_CLOSE
  self.assertEqual(self.parse(body),{'a':17,'b':25})
 def test_canonical_string_and_invalid_tail(self):
  body=D.P_OPEN+' name="x" string="true">hello'+D.P_CLOSE
  self.assertEqual(self.parse(body),{'x':'hello'})
  with self.assertRaises(ValueError):self.parse(body+'garbage')
  with self.assertRaises(ValueError):self.parse(body+body)
sys.argv=[sys.argv[0]];unittest.main()
'''
compile(test,'strict-native-argument-grammar-tests','exec');(BASE/'test_xolotl_dsml_json_v6b.frozen.py').write_text(test)
meta=dict(schema='aster-strict-native-arguments-v6b',upstream_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),patched_sha256=hashlib.sha256(out.read_bytes()).hexdigest(),tests_sha256=hashlib.sha256(test.encode()).hexdigest(),real_failure_fixture='xolotl-truncated-tool-v5-diagnostic.json',preserved_public_api='ds41_parse_tool_call(body, schema=None) -> ToolCall',unknown_argument_grammars_rejected=True)
(BASE/'xolotl-dsml-json-fix-v6b-plan.json').write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(meta,indent=2))
