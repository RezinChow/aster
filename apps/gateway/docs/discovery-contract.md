# Gateway discovery contract (P2.2)

## Dual track (intentional)

| Track | Owner | Purpose |
| --- | --- | --- |
| **Ingress seeds / snapshot** | Cloud → Gateway managed snapshot | North-south routes, policy, weights |
| **Egress etcd** | Boot `EtcdServiceDiscovery` under prefix **`/a3s/services`** | East-west ServiceClient peer resolve |

Key layout: `/a3s/services/{service}/{instance_id}` → JSON `ServiceInstance` (Boot lease + watch).

Gateway **does not** become an Istio-style mesh control plane. Boot clients must not assume Gateway ACL discovery equals etcd peer discovery unless Cloud publishes an explicit mapping (P2.1).

## Field mapping (expectation)

Until Cloud publishes an internal service directory API (Wave D1), the mapping is:

| Boot etcd field | Cloud/Gateway expectation |
| --- | --- |
| `service` | Logical extension-plane name (`a3s-auth`, `a3s-api`, …) |
| `id` | Instance id (often `{service}-{pid}` locally) |
| `address` + `port` | Peer base for Boot `ServiceClient` |
| (ingress route / weight / ACL) | **Not** in etcd — owned by Gateway managed snapshot from Cloud |

## Compatibility

- Existing Gateway listener resilience tests remain the G3 bar.
- New Boot services register under etcd prefix `/a3s/services`; Gateway may ignore them until Cloud projects an ingress route.
- That prefix is the a3s-boot default (`A3S_ETCD_ENDPOINTS` registers this process).
