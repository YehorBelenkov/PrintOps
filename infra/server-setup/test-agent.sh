#!/usr/bin/env bash
# End-to-end check: authenticated agent call through the local service.
TOKEN="$(cat /etc/printops-agent.token)"
echo "=== POST /v1/agent ==="
time curl -s -m 200 -X POST http://127.0.0.1:8787/v1/agent \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"prompt":"Reply with exactly the word pong and nothing else."}' \
  | head -c 600
echo
