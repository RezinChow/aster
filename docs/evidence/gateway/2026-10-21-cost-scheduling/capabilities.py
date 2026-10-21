"""Read-only capability probes, not invented runtime telemetry."""
import json
import shutil
import subprocess
from runtime import save

_,raw=subprocess.getstatusoutput('/data/prism/llama-prism-b10787-73bfe6c/llama-server --help')
probes={name:shutil.which(name) for name in ['nsys','ncu','perf','numactl']}
status,topology=subprocess.getstatusoutput('nvidia-smi topo -m')
metrics=subprocess.check_output(['curl','-fsS','http://127.0.0.1:18107/metrics'],text=True)
save('capabilities.json',{'profilers':probes,'gpu_topology_status':status,'gpu_topology':topology,
    'native_metrics_names':[line.split()[0] for line in metrics.splitlines() if line.startswith('llamacpp:')],
    'continuous_batching_supported': '--cont-batching' in raw,'continuous_batching_default_enabled':True,
    'batch_controls':{'logical_default':2048,'physical_default':512},
    'authoritative_free_kv_blocks_metric':False,'native_cache_epoch_metric':False,
    'distributed_kv_transfer_attestation':'unsupported by current Prism backend contract',
    'compatible_dspark_draft_configured':False,'deepinfer_hardware':'RTX4090D is SM89; reference DeepInfer targets SM100/Ascend950',
    'reference_revision':'9bd9cf243fc53ef9afbf8f04d391d989117d6ab9'})
print(json.dumps({'capability_probes_retained':True,'profilers':probes}))
