"""Narrowly support the complete JSON object actually emitted inside a DSML invoke, preserving canonical DSML."""
import ast,hashlib,json
from pathlib import Path
BASE=Path(__file__).resolve().parent
out=BASE/'serve_ds41_dsml_json_v6.frozen.py'
if out.exists():raise RuntimeError('V6 DSML parser fix is already frozen')
src=BASE/'xolotl-trial-source-e9d0826d71c5/source/tools/v41/serve/serve_ds41.py';s=src.read_text();anchor='''    args = {}
    for key, is_str, value in _P_RE.findall(body[m.end():]):'''
replacement='''    argument_body = body[m.end():].strip()
    # The1017 model also emits a complete JSON object inside the DSML invoke.
    # Parse that explicit grammar strictly; never infer argument names or repair broken JSON.
    if argument_body.startswith(("{", "[")):
        def object_pairs(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise ValueError("duplicate JSON tool argument: " + key)
                result[key] = value
            return result
        def reject_constant(value):
            raise ValueError("non-finite JSON tool argument: " + value)
        args = json.loads(argument_body, object_pairs_hook=object_pairs, parse_constant=reject_constant)
        if not isinstance(args, dict):
            raise ValueError("JSON tool arguments must be one complete object")
        return F.ToolCall(name=m.group(1), arguments=args)
    args = {}
    for key, is_str, value in _P_RE.findall(body[m.end():]):'''
if s.count(anchor)!=1:raise RuntimeError('pinned DSML parser insertion anchor differs')
s=s.replace(anchor,replacement);ast.parse(s);out.write_text(s)
test='''import importlib.util,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(sys.argv[1])/'tools/v41/serve'))
import serve_ds41 as D
class JsonInvokeTests(unittest.TestCase):
 def parse(self,s):return D.ds41_parse_tool_call(' name="add_numbers">'+s).arguments
 def test_integer_arguments(self):self.assertEqual(self.parse('{"a":17,"b":25}'),{'a':17,'b':25})
 def test_nested_and_unicode(self):self.assertEqual(self.parse('{"a":[1,true,null,{"x":"中文"}]}'),{'a':[1,True,None,{'x':'中文'}]})
 def test_empty_object(self):self.assertEqual(self.parse('{}'),{})
 def test_reject_invalid_grammars(self):
  for raw in ['[]','[1]','{"a":1} trailing','{"a":1,"a":2}','{"a":{"b":1,"b":2}}','{"a":NaN}','{"a":Infinity}','{"a":']:
   with self.subTest(raw=raw),self.assertRaises(ValueError):self.parse(raw)
 def test_canonical_dsml(self):
  body=D.P_OPEN+' name="a" string="false">17'+D.P_CLOSE+D.P_OPEN+' name="b" string="false">25'+D.P_CLOSE
  self.assertEqual(self.parse(body),{'a':17,'b':25})
sys.argv=[sys.argv[0]];unittest.main()
'''
compile(test,'strict-dsml-json-parser-controls','exec');(BASE/'test_xolotl_dsml_json_v6.frozen.py').write_text(test)
meta=dict(schema='aster-native-dsml-json-fix-v6',upstream_source_sha256=hashlib.sha256(src.read_bytes()).hexdigest(),patched_source_sha256=hashlib.sha256(out.read_bytes()).hexdigest(),strict_tests_sha256=hashlib.sha256(test.encode()).hexdigest(),real_failure_fixture='xolotl-truncated-tool-v5-diagnostic.json',scope='Native DSML invoke body containing a complete JSON object only; no renamed arguments, inferred aliases, or recovery from malformed JSON')
(BASE/'xolotl-dsml-json-fix-v6-plan.json').write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(meta,indent=2))
