// Aster exact activation-sum experiment. Reuses MIT Xolotl's synthetic fixture.
#define main xolotl_fixture_original_main
#include "/mnt/shared-storage-user/yangchao/Workspace/aster-h200-xq/aster-xolotl-300-0b1716ac50e0/xolotl-split-rows-h200/source/src/kernels/iq_multi_parity.cpp"
#undef main

namespace {
struct Snapshot { std::vector<float> gu,out;std::vector<uint8_t> q; };
Snapshot snapshot(Grouped& g,bool old,cudaStream_t s,bool split=false) {
    const size_t f=(size_t)g.cap_ent*g.L.n_ff,fa=(f*4+255)&~size_t(255);
    ck(cudaMemset(g.dscr,0xff,k::native_expert_scratch_bytes(g.cap_ent,g.L.n_ff)),"scratch sentinels");
    ck(cudaMemset(g.dout,0xff,g.out_floats*4),"output sentinels");
    k::native_expert_set_mode(4,split?1:0);g.run(old,s);
    if(split){k::native_expert_set_mode(4,2);g.run(old,s);}
    k::native_expert_set_mode(4,0);ck(cudaStreamSynchronize(s),"snapshot sync");
    Snapshot p;p.gu.resize(2*f);p.out.resize(g.out_floats);p.q.resize((size_t)g.n_ent*(g.L.n_ff/32)*36);
    ck(cudaMemcpy(p.gu.data(),g.dscr,f*4,cudaMemcpyDeviceToHost),"gate snapshot");
    ck(cudaMemcpy(p.gu.data()+f,g.dscr+fa,f*4,cudaMemcpyDeviceToHost),"up snapshot");
    ck(cudaMemcpy(p.out.data(),g.dout,g.out_floats*4,cudaMemcpyDeviceToHost),"down snapshot");
    if(!p.q.empty())ck(cudaMemcpy(p.q.data(),g.dscr+3*fa,p.q.size(),cudaMemcpyDeviceToHost),"q8 snapshot");
    return p;
}
void qsum_case(int gu,int dt,int H,int FF,const std::vector<int>& counts,int nt,bool v1,bool split,cudaStream_t s,std::mt19937& rng) {
    Grouped g(gu,dt,H,FF,counts,nt,rng);k::native_grouped_set_v1(v1);
    // Include zero q8 blocks, all-negative and cancellation codes in real token rows.
    std::vector<float> input((size_t)nt*H);ck(cudaMemcpy(input.data(),g.dx,input.size()*4,cudaMemcpyDeviceToHost),"activation input");
    for(int t=0;t<nt;++t)for(int i=0;i<96;++i)input[(size_t)t*H+i]=i<32?0.0f:i<64?-0.75f:((i&1)?0.5f:-0.5f);
    ck(cudaMemcpy(g.dx,input.data(),input.size()*4,cudaMemcpyHostToDevice),"activation controls");
    const auto a=snapshot(g,true,s,split),b=snapshot(g,false,s,split);
    size_t gd=0,od=0;bool finite=true,sentinel=true;
    const size_t f=(size_t)g.cap_ent*FF,live=(size_t)g.n_ent*FF;
    for(size_t i=0;i<b.gu.size();++i){gd+=std::memcmp(&a.gu[i],&b.gu[i],4)!=0;if(i%f<live)finite=finite&&std::isfinite(b.gu[i]);else {uint32_t v;std::memcpy(&v,&b.gu[i],4);sentinel=sentinel&&v==0xffffffffu;}}
    for(size_t i=0;i<b.out.size();++i){od+=std::memcmp(&a.out[i],&b.out[i],4)!=0;if(i<(size_t)g.n_ent*H)finite=finite&&std::isfinite(b.out[i]);else {uint32_t v;std::memcpy(&v,&b.out[i],4);sentinel=sentinel&&v==0xffffffffu;}}
    const bool pass=gd==0&&od==0&&a.q==b.q&&finite&&sentinel;
    float old_us=0,new_us=0;
    if(!split){old_us=1e3f*time_ms(s,20,[&]{g.run(true,s);});new_us=1e3f*time_ms(s,20,[&]{g.run(false,s);});}
    std::printf("{\"gu_type\":%d,\"down_type\":%d,\"H\":%d,\"FF\":%d,\"groups\":%d,\"entries\":%d,\"tokens\":%d,\"v1\":%s,\"split_phases\":%s,\"gu_differences\":%zu,\"down_differences\":%zu,\"q8_equal\":%s,\"finite\":%s,\"sentinels\":%s,\"strict_passed\":%s,\"old_full_grouped_us\":%.9g,\"new_full_grouped_us\":%.9g}\n",gu,dt,H,FF,g.n_groups,g.n_ent,nt,v1?"true":"false",split?"true":"false",gd,od,a.q==b.q?"true":"false",finite?"true":"false",sentinel?"true":"false",pass?"true":"false",old_us,new_us);
    if(!pass)++g_fail;k::native_grouped_set_v1(false);
}
}
int main() {
    int n=0;ck(cudaGetDeviceCount(&n),"device count");cudaDeviceProp p;ck(cudaGetDeviceProperties(&p,0),"device properties");
    if(n!=1||p.major!=9||p.minor!=0||std::string(p.name)!="NVIDIA H200"){std::fprintf(stderr,"single H200 SM90 required\n");return 2;}
    cudaStream_t s;ck(cudaStreamCreate(&s),"stream");std::mt19937 rng(1803);
    std::printf("{\"devices\":1,\"strict_gate\":\"bitwise GU and Down, identical q8, finite and sentinel bounds\"}\n");
    k::native_expert_set_mode(4,0);
    qsum_case(143,143,5120,2304,{1,3,4,5,0,8,2,11,1},8,false,false,s,rng);
    for(int m:{1,2,3,5,8})qsum_case(143,143,5120,2304,std::vector<int>(7,m),8,false,false,s,rng);
    qsum_case(143,143,5120,2304,std::vector<int>(9,0),8,false,false,s,rng);
    qsum_case(143,143,1024,512,{1,3,4,5,0,8,2,11,1},8,false,false,s,rng);
    qsum_case(143,143,5120,2304,{1},16,false,false,s,rng);
    qsum_case(143,11,5120,2304,{1,3,4,5,0,8,2,11,1},8,false,false,s,rng);
    qsum_case(11,143,5120,2304,{1,3,4,5,0,8,2,11,1},8,false,false,s,rng);
    qsum_case(143,143,5120,2304,std::vector<int>(7,3),8,true,false,s,rng);
    qsum_case(143,143,5120,2304,std::vector<int>(7,3),8,false,true,s,rng);
    ck(cudaStreamDestroy(s),"destroy stream");std::printf("{\"complete\":true,\"failures\":%d}\n",g_fail);return g_fail?1:0;
}
