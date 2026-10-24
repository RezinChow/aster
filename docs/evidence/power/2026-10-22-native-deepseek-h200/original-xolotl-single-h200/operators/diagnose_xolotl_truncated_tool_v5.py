"""Bound a synthetic forced-call response before its closing tag to inspect the model's actual parameter syntax."""
import ast,json
from xolotl_trial_common import BASE,jump
r=json.loads((BASE/'xolotl-prefill-shadow-v5-intent.json').read_text())
tree=ast.parse((BASE/'diagnose_xolotl_raw_tool_body_v5.py').read_text());rows=[n.value for n in ast.walk(tree) if isinstance(n,ast.Constant) and isinstance(n.value,str) and 'body=dict(model=' in n.value]
if len(rows)!=1:raise RuntimeError('public raw-tool diagnostic source structure differs')
out=[]
for n in [12,20]:
 code=rows[0].replace('max_tokens=128','max_tokens='+str(n)).replace(",stop=['</｜DSML｜ invoke>']",'').replace('@R@',repr(r));compile(code,'bounded-native-tool-truncation','exec');out.append(dict(max_tokens=n,result=jump(code,65)))
(BASE/'xolotl-truncated-tool-v5-diagnostic.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps(out,ensure_ascii=False,indent=2))
