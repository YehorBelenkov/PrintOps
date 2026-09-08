#!/usr/bin/env bash
# Undo the damage from running the gateway as root: give its files back to uid 998
# and stop it, since routing through it did not avoid the CLI boot cost anyway.
set -uo pipefail
CONTAINER="$(docker ps --format '{{.Names}}' | grep -- '--igor-' | head -1)"

echo "=== stopping root-owned gateway ==="
docker exec "$CONTAINER" bash -lc \
  'pkill -f "openclaw gateway" 2>/dev/null; sleep 2; echo stopped' || true

echo "=== restoring ownership to 998:998 ==="
docker exec "$CONTAINER" bash -lc 'chown -R 998:998 /sandbox/.openclaw 2>/dev/null; find /sandbox/.openclaw -user 0 | wc -l'

echo "=== removing root-created log dir ==="
docker exec "$CONTAINER" bash -lc 'rm -rf /tmp/openclaw /tmp/openclaw-gateway.log 2>/dev/null; echo done'

echo "=== port 18789 should now be closed ==="
docker exec "$CONTAINER" bash -lc \
  'timeout 2 bash -c "echo > /dev/tcp/127.0.0.1/18789" 2>/dev/null && echo "still open" || echo "closed"'

echo "=== verify a normal run works again ==="
nemoclaw igor exec -- openclaw capability model run --prompt 'Say Hi' --thinking off 2>&1 \
  | grep -viE 'undici|trace-warnings|Active gateway|safety-net|guard' | tail -3
