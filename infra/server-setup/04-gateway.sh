#!/usr/bin/env bash
# Start a persistent OpenClaw gateway inside the sandbox container.
#
# Without this, every `capability model run` cold-starts a gateway, which measured
# at ~9.5s of the ~16s spent before the provider request is even sent.
set -uo pipefail

CONTAINER="$(docker ps --format '{{.Names}}' | grep -- '--igor-' | head -1)"
[ -z "$CONTAINER" ] && { echo "No igor container running."; exit 1; }
echo "container: $CONTAINER"

# The sandbox runs as a non-root uid; reuse whatever uid owns the openclaw home.
USER_SPEC="$(docker inspect -f '{{.Config.User}}' "$CONTAINER")"
echo "user: ${USER_SPEC:-<default>}"

# Probe the port, not the process list: `pgrep -f "openclaw gateway"` matches its own
# `bash -lc` wrapper and always reports a false positive.
gateway_up() {
  docker exec "$CONTAINER" bash -lc \
    'timeout 2 bash -c "echo > /dev/tcp/127.0.0.1/18789" 2>/dev/null'
}

if gateway_up; then
  echo "gateway already listening on 18789"
else
  docker exec -d "$CONTAINER" bash -lc \
    'nohup openclaw gateway --bind loopback --auth none --allow-unconfigured --force \
       > /tmp/openclaw-gateway.log 2>&1 &'
  echo "gateway launched, waiting for it to listen…"
  for i in $(seq 1 40); do
    if gateway_up; then echo "listening after ${i}s"; break; fi
    sleep 1
  done
fi

echo "=== port check ==="
gateway_up && echo "18789 open" || echo "18789 NOT open"
echo "=== last log lines ==="
docker exec "$CONTAINER" bash -lc 'tail -15 /tmp/openclaw-gateway.log 2>/dev/null' || true
