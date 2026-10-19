#!/usr/bin/env bash
# End-to-end: boot the aster-built OS backend (config :7654, auth :7642,
# billing :7655, api :3000) on the live middleware, then verify serving,
# admin login through the auth directory, and a notes round-trip.
set -uo pipefail

BIN=/Users/roylin/code/aster/target/debug
LOGD=/tmp/aster-stack
mkdir -p "$LOGD"

boot() { # name binary port env...
  local name="$1" bin="$2" port="$3"; shift 3
  if nc -z -G 1 127.0.0.1 "$port" >/dev/null 2>&1; then
    echo "$name already up"; return 0
  fi
  env "$@" nohup "$bin" >"$LOGD/$name.log" 2>&1 &
  echo "$name pid=$!"
}

boot config "$BIN/a3s-config" 7654 \
  A3S_CONFIG_LISTEN=127.0.0.1:7654 \
  A3S_CONFIG_DATABASE_URL='postgres://a3s_api:a3s_api@127.0.0.1:5432/a3s_config_aster?sslmode=disable'

boot auth "$BIN/a3s-auth" 7642 \
  A3S_AUTH_LISTEN=127.0.0.1:7642 \
  A3S_AUTH_ISSUER=http://127.0.0.1:7642 \
  A3S_AUTH_INTERNAL_TOKEN=aster-local-internal \
  A3S_AUTH_DIRECTORY_URL=http://127.0.0.1:3000/v1/api/admin \
  A3S_AUTH_DATABASE_URL='postgres://a3s_api:a3s_api@127.0.0.1:5432/a3s_auth_aster?sslmode=disable'

boot billing "$BIN/a3s-billing" 7655 \
  A3S_BILLING_LISTEN=127.0.0.1:7655 \
  A3S_BILLING_INTERNAL_TOKEN=aster-local-billing \
  A3S_BILLING_DATABASE_URL='postgres://a3s_api:a3s_api@127.0.0.1:5432/a3s_billing_aster?sslmode=disable'

ok=0
for i in $(seq 1 25); do
  ok=1
  for p in 7654 7642 7655; do
    nc -z -G 1 127.0.0.1 "$p" >/dev/null 2>&1 || ok=0
  done
  [ "$ok" = 1 ] && break
  sleep 1
done
[ "$ok" = 1 ] && echo "peers up (7642/7655/7654)" || { echo "PEERS FAILED"; tail -5 "$LOGD"/*.log; exit 1; }

cd /Users/roylin/code/aster/apps/api || exit 1
set -a; source .env; set +a
export A3S_AUTH_BASE_URL=http://127.0.0.1:7642
export A3S_AUTH_INTERNAL_TOKEN=aster-local-internal
export A3S_BILLING_BASE_URL=http://127.0.0.1:7655
export A3S_BILLING_INTERNAL_TOKEN=aster-local-billing
export A3S_CONFIG_URL=http://127.0.0.1:7654

nohup "$BIN/a3s-api" >"$LOGD/api.log" 2>&1 &
echo "api pid=$!"

i=0
until curl -sf --max-time 2 http://127.0.0.1:3000/live >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 45 ]; then echo "API BOOT FAILED"; tail -15 "$LOGD/api.log"; exit 1; fi
  sleep 1
done
echo "api LISTENING after ~${i}s"

echo "--- E2E 1: /live + /health ---"
curl -sf --max-time 2 http://127.0.0.1:3000/live > /dev/null && echo "live: OK"
curl -s --max-time 15 http://127.0.0.1:3000/health | python3 -c "
import json,sys
d = json.load(sys.stdin)
checks = d['checks']
bad = [k for k, v in checks.items() if v['status'] != 'up']
print('health:', 'ALL UP' if not bad and d['status']=='up' else f'DEGRADED {bad}', '| checks:', len(checks))
sys.exit(1 if bad else 0)
" || exit 1

ORG=51675e79-a499-4f7c-9359-7c0181de71ab
echo "--- E2E 2: admin login (api→auth directory admission) ---"
TOKEN=$(curl -s --max-time 8 -X POST http://127.0.0.1:3000/v1/api/admin/identity/sessions \
  -H 'content-type: application/json' \
  -d "{\"org_id\":\"$ORG\",\"email\":\"admin@local\",\"password\":\"Admin123!\"}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['data']['token'] if d.get('success') else 'LOGIN_FAILED:'+d.get('message',''))")
case "$TOKEN" in a3s_us_*) echo "login: OK (${TOKEN:0:12}…)";; *) echo "login FAILED: $TOKEN"; exit 1;; esac

echo "--- E2E 3: notes write→read round-trip ---"
RESP=$(curl -s --max-time 10 -X POST http://127.0.0.1:3000/v1/api/admin/notes \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"title":"e2e-goal-verification","body":"per development standards"}')
NID=$(printf '%s' "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
[ -n "$NID" ] && echo "create: OK ($NID)" || { echo "create FAILED: $RESP"; exit 1; }
curl -s --max-time 10 "http://127.0.0.1:3000/v1/api/admin/notes/$NID" \
  -H "authorization: Bearer $TOKEN" | python3 -c "
import json,sys
d = json.load(sys.stdin)
assert d['success'] and d['data']['title'] == 'e2e-goal-verification'
print('read-back: OK')
"

echo "--- E2E 4: guard fail-closed (no token ⇒ 401) ---"
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/v1/api/admin/notes)
[ "$CODE" = 401 ] && echo "fail-closed: OK (401)" || { echo "fail-closed FAILED: $CODE"; exit 1; }

echo "--- E2E 5: control-plane bootstrap (first organization) ---"
CP_TOKEN=$(grep -ho 'Bootstrap token: [a-f0-9]*' /tmp/cloud-up-aster*.log 2>/dev/null | tail -1 | awk '{print $3}')
BOOT_CODE=$(curl -s -o /tmp/e2e-boot.json -w '%{http_code}' --max-time 10 -X POST http://127.0.0.1:18080/api/v1/bootstrap \
  -H 'content-type: application/json' -H 'idempotency-key: aster-e2e-bootstrap-001' \
  -H "x-a3s-bootstrap-token: $CP_TOKEN" \
  -d "{\"organizationName\":\"Aster E2E\",\"tokenName\":\"aster-e2e\",\"token\":\"a3s_$CP_TOKEN\"}")
case "$BOOT_CODE" in
  201) echo "bootstrap: OK (created)";;
  409) echo "bootstrap: OK (already bootstrapped)";;
  *) echo "bootstrap FAILED: HTTP $BOOT_CODE"; cat /tmp/e2e-boot.json; exit 1;;
esac

echo "--- E2E 6: automations definitions read-through (api→proxy→control-plane) ---"
AUTOS=$(curl -s --max-time 10 http://127.0.0.1:3000/v1/api/admin/cloud/automation-definitions \
  -H "authorization: Bearer $TOKEN")
echo "$AUTOS" | python3 -c "
import json,sys
d = json.load(sys.stdin)
data = d.get('data')
ok = d.get('success') is True and isinstance(data, list)
print('automations read:', 'OK (' + str(len(data)) + ' definitions)' if ok else 'FAILED')
sys.exit(0 if ok else 1)
" || { echo "automations read FAILED: $AUTOS"; exit 1; }

echo
echo "E2E: ALL GREEN"
