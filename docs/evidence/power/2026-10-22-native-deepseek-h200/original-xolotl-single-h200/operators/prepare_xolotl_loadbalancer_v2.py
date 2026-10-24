"""Freeze a fresh VIP request in the observed Windows-reachable BGP address pool."""
import ast
from xolotl_serving_common import BASE
out=BASE/'publish_xolotl_loadbalancer_v2.frozen.py'
if out.exists():raise RuntimeError('V2 VIP publisher is already frozen')
s=(BASE/'publish_xolotl_loadbalancer_v1.py').read_text()
for a,b in [('xolotl-server-loadbalancer-v1-intent.json','xolotl-server-loadbalancer-v2-intent.json'),('aster-xolotl-api-20261024','aster-xolotl-api-v3pool-20261024')]:
 if s.count(a)!=1:raise RuntimeError('V2 VIP publication anchor differs: '+a)
 s=s.replace(a,b)
anchor='rec=dict(unix=time.time(),phase='
if s.count(anchor)!=1:raise RuntimeError('V2 pool selection anchor differs')
s=s.replace(anchor,"spec['metadata']['annotations']['metallb.universe.tf/address-pool']='bgp-pool-v3'\n"+anchor)
ast.parse(s);out.write_text(s);print('Prepared a new server-side VIP request explicitly selecting observed bgp-pool-v3.')
