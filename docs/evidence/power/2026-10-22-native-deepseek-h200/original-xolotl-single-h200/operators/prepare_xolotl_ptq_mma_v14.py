"""Read original PTQ bytes through an exact packed-four-code decoder."""
import ast
from xolotl_trial_common import BASE
p=BASE/'aster_ptq_mma_prototype_v14.cu'
if p.exists():raise RuntimeError('V14 source already frozen')
s=(BASE/'aster_ptq_mma_prototype_v13.cu').read_text()
start=s.index('__device__ __forceinline__ unsigned proto_pair(');end=s.index('__device__ __forceinline__ void proto_mma(',start)
s=s[:start]+r'''__device__ __forceinline__ unsigned proto_packed4(const ProtoPtq* block,int col) {
    unsigned lo,hi;int depth;
    if(col<120) {
        unsigned raw;
        if(col<80){raw=*(const unsigned*)(block->qs+(col&15));depth=col>>4;}
        else {const int e=col-80;raw=*(const unsigned*)(block->qs+16+(e&7));depth=e>>3;}
        lo=raw&0x00ff00ffu;hi=(raw>>8)&0x00ff00ffu;
    }else{
        const unsigned q0=block->qh[0],q1=block->qh[1];
        lo=q0|(((q0*3u)&255u)<<16);hi=q1|(((q1*3u)&255u)<<16);
        depth=(col-120)>>1;
    }
#pragma unroll 1
    for(int j=0;j<depth;++j){lo=(lo*3u)&0x00ff00ffu;hi=(hi*3u)&0x00ff00ffu;}
    const unsigned q=(((lo*3u)>>8)&0x00030003u)|((((hi*3u)>>8)&0x00030003u)<<8);
    return (q+0x7f7f7f7fu)^0x80808080u;
}
'''+s[end:]
a='''            const size_t index=((size_t)(first/16)*(l.n_embd/128)+ib)*512+(sub*4+j)*32+lane;
            const unsigned packed=blob[index];
            a[j]=proto_pair(packed);'''
b='''            const int row=first+(j%2)*8+lane/4,col=sub*32+(j/2)*16+4*(lane%4);
            const bool is_up=row>=l.n_ff;const int rr=is_up?row-int(l.n_ff):row;
            const ProtoPtq* block=(const ProtoPtq*)(blob+(is_up?l.up_off:0)+(size_t)rr*l.gu_row)+ib;
            a[j]=proto_packed4(block,col);'''
if s.count(a)!=1:raise RuntimeError('MMA weight load anchor differs')
s=s.replace(a,b)
a='''        const __half* scale=(const __half*)(blob+(size_t)(2*l.n_ff)*l.n_embd/4)+(size_t)row*(l.n_embd/128)+ib;
        value[c]+=__half2float(*scale)*scaled[c];'''
b='''        const bool is_up=row>=l.n_ff;const int rr=is_up?row-int(l.n_ff):row;
        const ProtoPtq* block=(const ProtoPtq*)(blob+(is_up?l.up_off:0)+(size_t)rr*l.gu_row)+ib;
        value[c]+=__half2float(block->d)*scaled[c];'''
if s.count(a)!=1:raise RuntimeError('original scale anchor differs')
s=s.replace(a,b)
if s.count('    ProtoHotGU hot(g,s);')!=1:raise RuntimeError('hot fixture anchor differs')
s=s.replace('    ProtoHotGU hot(g,s);','    // No auxiliary code cache: use original immutable PTQ blobs directly.')
if s.count('proto_run(g,s,hot.pointers)')!=3:raise RuntimeError('original pointer call sites differ')
s=s.replace('proto_run(g,s,hot.pointers)','proto_run(g,s,g.dptr)')
a='''    std::fprintf(stderr,"auxiliary bytes=%zu preparation_ms=%.6f H=%d FF=%d groups=%d\\n",hot.bytes,hot.preparation_ms,H,FF,g.n_groups);'''
b='''    std::fprintf(stderr,"original_PTQ=true auxiliary_bytes=0 preparation_ms=0 H=%d FF=%d groups=%d\\n",H,FF,g.n_groups);'''
if s.count(a)!=1:raise RuntimeError('auxiliary report anchor differs')
s=s.replace(a,b).replace('// V12 expands four signed two-bit codes using shifts and masks, retaining K4 tree.','// V14 reads original PTQ blocks directly; no auxiliary code cache or preparation.')
p.write_text(s)
for src,dest in [('stage_xolotl_ptq_mma_v13.frozen.py','stage_xolotl_ptq_mma_v14.frozen.py'),('observe_xolotl_ptq_mma_v13.frozen.py','observe_xolotl_ptq_mma_v14.frozen.py')]:
 s=(BASE/src).read_text()
 for a,b in [('xolotl-ptq-mma-v13-intent.json','xolotl-ptq-mma-v14-intent.json'),('xolotl-ptq-mma-v13-latest.json','xolotl-ptq-mma-v14-latest.json'),("'/xolotl-ptq-mma-v13'","'/xolotl-ptq-mma-v14'"),('aster_ptq_mma_prototype_v13.cu','aster_ptq_mma_prototype_v14.cu'),('xolotl_ptq_mma_v13_worker.frozen.py','xolotl_ptq_mma_v14_worker.frozen.py')]:
  if a in s:s=s.replace(a,b)
 s=s.replace('over lossless signed two-bit synthetic GU codes capped at1GiB, 34/28 original PTQ GU bytes; one-time preparation and extra bytes reported separately in gpu stderr','over original immutable PTQ GU blobs; no auxiliary code cache or preparation')
 ast.parse(s);(BASE/dest).write_text(s)
print('V14 original PTQ path prepared; unchanged strict math and paired cold-cache controls.')
