#!/usr/bin/env bash
# What does the gateway expose over HTTP? Looking for a way to skip the CLI entirely.
CONTAINER="$(docker ps --format '{{.Names}}' | grep -- '--igor-' | head -1)"

probe() {
  code=$(docker exec "$CONTAINER" bash -lc \
    "curl -s -m 5 -o /tmp/probe.out -w '%{http_code}' 'http://127.0.0.1:18789$1'" 2>/dev/null)
  body=$(docker exec "$CONTAINER" bash -lc 'head -c 200 /tmp/probe.out' 2>/dev/null)
  printf '%-34s %s   %s\n' "$1" "$code" "$(echo "$body" | tr -d '\n' | head -c 120)"
}

echo "path                               code  body"
for p in / /health /api /api/health /v1/models /v1/chat/completions /rpc /openapi.json /.well-known/openclaw; do
  probe "$p"
done
