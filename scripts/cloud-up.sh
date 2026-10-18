#!/usr/bin/env bash
# Monorepo Cloud bring-up: bind control plane on :18080 so :8080 stays
# a3s-gateway (Console proxies /api → gateway → a3s-api :3000).
# Cloud only — also invoked by `just up`. Stop with `just cloud-down`.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

state="apps/cloud/.a3s/cloud/dev"
mkdir -p "$state"
conf="$state/cloud.os.acl"

# Guests dial host.orb.internal. Keep this port and certificate name aligned
# with agent_control_plane_target(os_node_control_listen()) in the node-agent crate.
# 8443 stays with whatever already bound it (including a guest forward).
node_control_port=18083
node_control_name=host.orb.internal

# Point Cloud at the OS shared Postgres (:5432) and Iggy (:5102).
# Do not start a3s-cloud-postgres or a NATS broker.
# This database may already be bound to the local object directory. Naming a
# different store makes the control plane exit before it listens.
object_provider=s3
object_root="$(cd "$repo_root/apps/cloud" && python3 -c 'import os; print(os.path.realpath(".a3s/cloud/objects"))')"
local_digest="$(
  python3 -c 'import hashlib, json, sys
root = sys.argv[1]
payload = {"provider":"local","schema":"a3s.cloud.object-storage-authority.v1","root":root,"prefix":"cloud"}
print(hashlib.sha256(json.dumps(payload, separators=(",", ":")).encode()).hexdigest())
' "$object_root"
)"
bound_digest="$(
  docker exec -e PGPASSWORD=a3s_cloud a3s-postgres \
    psql -U a3s_cloud -d a3s_cloud -tAc \
    "select binding_digest from infrastructure_bindings where binding_name='object-storage'" \
    2>/dev/null || true
)"
bound_digest="${bound_digest#sha256:}"
bound_digest="${bound_digest//$'\n'/}"
if [[ -n $bound_digest && $bound_digest == "$local_digest" ]]; then
  object_provider=local
  printf 'object storage stays on the bound local directory\n' >&2
fi

awk -v node_port="$node_control_port" -v object_provider="$object_provider" '
  /^server \{/ { in_server = 1 }
  /^node_control \{/ { in_node = 1 }
  in_server && /^\}/ { in_server = 0 }
  in_node && /^\}/ { in_node = 0 }
  in_server && $0 == "  port = 8080" { sub(/8080/, "18080") }
  in_node && $0 == "  port = 8443" { sub(/8443/, node_port) }
  in_node && $0 == "  server_name = \"localhost\"" {
    print "  server_name = \"host.orb.internal\""
    next
  }
  # The control plane runs on the Mac. host.orb.internal is the address guests
  # use to reach the Mac; from the Mac that address accepts TCP and then
  # resets. RustFS is the compose publish on loopback.
  $0 == "  endpoint = \"http://host.orb.internal:9000\"" {
    print "  endpoint = \"http://127.0.0.1:9000\""
    next
  }
  object_provider == "local" && $0 == "  provider = \"s3\"" { sub(/s3/, "local") }
  $0 == "  provider = \"memory\"" { sub(/memory/, "iggy") }
  { print }
' apps/cloud/config/cloud.acl >"$conf"

# The running identity is reused when both files exist. Drop a certificate
# whose name is not the dial host so the next start issues a matching one.
node_cert="apps/cloud/.a3s/cloud/security/node-control/server.pem"
node_key="apps/cloud/.a3s/cloud/security/node-control/server-key.pem"
if [[ -f $node_cert ]] && ! openssl x509 -in "$node_cert" -noout -subject 2>/dev/null | grep -q "CN=${node_control_name}"; then
  rm -f "$node_cert" "$node_key"
fi

export A3S_CLOUD_API_PORT=18080
export A3S_CLOUD_CONFIG="$repo_root/$conf"

# Compose publishes Postgres on *:5432. OrbStack also forwards a Linux
# machine's 127.0.0.1:5432 onto the Mac loopback, and that socket wins.
# Cloud would then authenticate against the wrong server.
postgres_host=127.0.0.1
if [[ -z ${A3S_CLOUD_POSTGRES_URL:-} && -z ${A3S_CLOUD_POSTGRES_MIGRATION_URL:-} ]]; then
  if [[ ! -f "$repo_root/scripts/compose-postgres-host.sh" ]]; then
    echo "missing scripts/compose-postgres-host.sh — refusing to retarget Cloud" >&2
    exit 127
  fi
  postgres_host="$(bash "$repo_root/scripts/compose-postgres-host.sh")"
  if [[ "$postgres_host" != "127.0.0.1" ]]; then
    printf 'compose postgres is at %s:5432\n' "$postgres_host" >&2
  fi
fi

export A3S_CLOUD_POSTGRES_URL="${A3S_CLOUD_POSTGRES_URL:-postgres://a3s_cloud_serving:a3s_cloud_serving@${postgres_host}:5432/a3s_cloud}"
export A3S_CLOUD_POSTGRES_MIGRATION_URL="${A3S_CLOUD_POSTGRES_MIGRATION_URL:-postgres://a3s_cloud:a3s_cloud@${postgres_host}:5432/a3s_cloud}"
export A3S_CLOUD_IGGY_ADDRESS="${A3S_CLOUD_IGGY_ADDRESS:-127.0.0.1:5102}"
export A3S_CLOUD_IGGY_USERNAME="${A3S_CLOUD_IGGY_USERNAME:-${IGGY_ROOT_USERNAME:-iggy}}"
export A3S_CLOUD_IGGY_PASSWORD="${A3S_CLOUD_IGGY_PASSWORD:-${IGGY_ROOT_PASSWORD:-iggy}}"
unset A3S_CLOUD_NATS_URL || true
# cloud.acl objects.provider=s3 reads these names. They match the local
# a3s-rustfs credentials in docker-compose.yml.
export A3S_CLOUD_S3_ACCESS_KEY_ID="${A3S_CLOUD_S3_ACCESS_KEY_ID:-kense}"
export A3S_CLOUD_S3_SECRET_ACCESS_KEY="${A3S_CLOUD_S3_SECRET_ACCESS_KEY:-a3s-rustfs-dev-secret}"

# Publication registry is a service in the OS compose, not a second compose file.
docker compose -f "$repo_root/docker-compose.yml" up -d a3s-iggy a3s-cloud-registry

exec just --justfile apps/cloud/justfile up
