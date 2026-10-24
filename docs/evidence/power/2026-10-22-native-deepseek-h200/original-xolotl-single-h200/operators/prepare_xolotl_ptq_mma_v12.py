"""Use a lossless signed two-bit cache with shift/mask expansion to INT8."""
import ast
from xolotl_trial_common import BASE
p=BASE/'aster_ptq_mma_prototype_v12.cu'
if p.exists():raise RuntimeError('V12 source already frozen')
s=(BASE/'aster_ptq_mma_prototype_v11.cu').read_text()
a='''    return ((v%3-1)&255u)|(((v/3-1)&255u)<<8);'''
b='''    v=(v|(v<<12))&0x000f000fu;
    v=(v|(v<<6))&0x03030303u;
    return (v&0x01010101u)|(((v>>1)&0x01010101u)*254u);'''
if s.count(a)!=1:raise RuntimeError('pair decode anchor differs')
s=s.replace(a,b)
a='a[j]=proto_pair(packed&15)|(proto_pair(packed>>4)<<16);'
if s.count(a)!=1:raise RuntimeError('register unpack anchor differs')
s=s.replace(a,'a[j]=proto_pair(packed);')
a='''    for(int pair=0;pair<2;++pair) {
        const unsigned first=proto_code(block,(col+pair*2)%128)+1,second=proto_code(block,(col+pair*2+1)%128)+1;
        encoded|=(first+3*second)<<(4*pair);
    }'''
b='''    for(int code=0;code<4;++code) {
        encoded|=(unsigned(proto_code(block,(col+code)%128))&3u)<<(2*code);
    }'''
if s.count(a)!=1:raise RuntimeError('cache encoding anchor differs')
s=s.replace(a,b).replace('// V11 distributes the identical reduction tree across four cooperating warps.','// V12 expands four signed two-bit codes using shifts and masks, retaining K4 tree.')
p.write_text(s)
for src,dest in [('stage_xolotl_ptq_mma_v11.frozen.py','stage_xolotl_ptq_mma_v12.frozen.py'),('observe_xolotl_ptq_mma_v11.frozen.py','observe_xolotl_ptq_mma_v12.frozen.py')]:
 s=(BASE/src).read_text()
 for a,b in [('xolotl-ptq-mma-v11-intent.json','xolotl-ptq-mma-v12-intent.json'),('xolotl-ptq-mma-v11-latest.json','xolotl-ptq-mma-v12-latest.json'),("'/xolotl-ptq-mma-v11'","'/xolotl-ptq-mma-v12'"),('aster_ptq_mma_prototype_v11.cu','aster_ptq_mma_prototype_v12.cu'),('xolotl_ptq_mma_v11_worker.frozen.py','xolotl_ptq_mma_v12_worker.frozen.py')]:
  if a in s:s=s.replace(a,b)
 s=s.replace('lossless nibble-encoded synthetic GU codes','lossless signed two-bit synthetic GU codes')
 ast.parse(s);(BASE/dest).write_text(s)
# Exhaust all 3^4 valid four-code combinations before the CUDA build.
import itertools
for codes in itertools.product([-1,0,1],repeat=4):
 v=sum((c&3)<<(2*i) for i,c in enumerate(codes));v=(v|(v<<12))&0x000f000f;v=(v|(v<<6))&0x03030303
 word=(v&0x01010101)|(((v>>1)&0x01010101)*254)
 expected=sum((c&255)<<(8*i) for i,c in enumerate(codes))
 if word!=expected:raise RuntimeError('signed code expansion differs')
print('V12 prepared; all81 signed two-bit code-word expansions exact; six GPU gates unchanged.')
