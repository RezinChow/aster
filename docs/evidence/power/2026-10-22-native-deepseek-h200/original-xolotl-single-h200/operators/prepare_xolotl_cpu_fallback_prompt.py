import json
from pathlib import Path
from tokenizers import Tokenizer
base=Path('D:/code/aster/target/h200-native')
t=Tokenizer.from_file(str(base/'xolotl-official-tokenizer.json'))
prompt='1+1';rendered='<｜begin▁of▁sentence｜><｜User｜>'+prompt+'<｜Assistant｜></think>'
r=dict(name='cpu-fallback-2',prompt=prompt,rendered=rendered,ids=t.encode(rendered,add_special_tokens=False).ids,max_new_tokens=2)
(base/'xolotl-device-cpu-fallback-prompt.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(r,ensure_ascii=False))
