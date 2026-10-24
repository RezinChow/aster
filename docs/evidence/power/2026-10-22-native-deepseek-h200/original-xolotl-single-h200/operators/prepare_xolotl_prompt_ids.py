"""Encode public trial prompts with the exact official tokenizer, on CPU."""
import hashlib,json,urllib.request
from pathlib import Path
from tokenizers import Tokenizer
BASE=Path('D:/code/aster/target/h200-native')
path=BASE/'xolotl-official-tokenizer.json'
if not path.exists():
 request=urllib.request.Request('https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017/resolve/1bae0e1088993b9b82de08f59de5be5a34e42170/tokenizer.json',headers={'User-Agent':'Aster-Xolotl-trial'})
 with urllib.request.urlopen(request,timeout=50) as r:
  data=r.read(8*1024**2)
 if len(data)!=6367257 or hashlib.sha256(data).hexdigest()!='c90dfa01249db1be4245780a052ede752e1361c612ac6d08e2bdada7d599476b':raise RuntimeError('official tokenizer identity differs')
 path.write_bytes(data)
if hashlib.sha256(path.read_bytes()).hexdigest()!='c90dfa01249db1be4245780a052ede752e1361c612ac6d08e2bdada7d599476b':raise RuntimeError('cached tokenizer identity differs')
t=Tokenizer.from_file(str(path))
cases=[]
for name,prompt,maximum in [('matched-count-32','按顺序列出从1到20的整数，用逗号分隔，不要解释。',32),('arithmetic','Calculate 17 + 25. Reply with only the integer answer.',16),('code-128','Write a Python function that returns the first n Fibonacci numbers. Include a short explanation.',128),('prose-128','Explain how an LRU cache works, including a concrete example and its time complexity.',128),('chinese-128','用中文解释大语言模型推理中的 KV Cache，说明它保存什么、如何加速生成，以及长上下文的内存代价。',128)]:
 text='<｜begin▁of▁sentence｜><｜User｜>'+prompt+'<｜Assistant｜></think>'
 ids=t.encode(text,add_special_tokens=False).ids
 cases.append(dict(name=name,prompt=prompt,rendered=text,ids=ids,max_new_tokens=maximum))
if len(cases[0]['ids'])!=22:raise RuntimeError('matched prompt differs from native 22-token control')
out=dict(tokenizer_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),tokenizers_version=__import__('tokenizers').__version__,cases=cases)
(BASE/'xolotl-trial-prompt-ids.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(out,ensure_ascii=False,indent=2))
