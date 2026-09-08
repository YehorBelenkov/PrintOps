#!/usr/bin/env bash
# Same managed inference route the CLI uses, but reached with curl inside the sandbox.
# Skips OpenClaw's ~13s Node boot while keeping NemoClaw's key custody and egress policy.
CONTAINER="$(docker ps --format '{{.Names}}' | grep -- '--igor-' | head -1)"

echo "=== proxy env inside the sandbox ==="
docker exec "$CONTAINER" bash -lc 'env | grep -iE "proxy" | head -5'

echo
echo "=== timed completion via curl inside the sandbox ==="
for i in 1 2 3; do
  start=$(date +%s.%N)
  out=$(docker exec "$CONTAINER" bash -lc '
    curl -sk -m 90 https://inference.local/v1/chat/completions \
      -H "Content-Type: application/json" \
      -d "{\"model\":\"nvidia/nemotron-3-super-120b-a12b\",\"messages\":[{\"role\":\"user\",\"content\":\"Say Hi\"}],\"max_tokens\":24,\"stream\":false}"
  ' 2>&1)
  end=$(date +%s.%N)
  dur=$(echo "$end - $start" | bc)
  printf 'run %s: %.2fs  %s\n' "$i" "$dur" "$(echo "$out" | tr -d '\n' | head -c 160)"
done
