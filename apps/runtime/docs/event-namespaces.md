# Runtime event namespaces (P2.6)

| Namespace | Purpose |
| --- | --- |
| `a3s.product.*` | Commodity invoke / usage facts for Runtime |
| `a3s.platform.*` | Internal microservice bus (auth/billing/config/cloud outbox) |

Runtime must not subscribe to `a3s.platform.*` for sku routing. Platform services must not publish product invoke payloads onto platform topics.
