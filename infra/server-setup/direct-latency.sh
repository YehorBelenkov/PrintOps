#!/usr/bin/env bash
# Where does the time actually go? Call NVIDIA directly, bypassing nemoclaw+openclaw,
# so we can separate provider latency from our own stack. Never prints the key.
set -uo pipefail

KEY="$(grep -rhoE 'nvapi-[A-Za-z0-9_-]{40,}' /root/.nemoclaw /root/.openshell /root/.config 2>/dev/null | head -1)"
if [ -z "$KEY" ]; then
  echo "No nvapi- key found in the usual places. Searching more broadly…"
  KEY="$(grep -rhoE 'nvapi-[A-Za-z0-9_-]{40,}' /root 2>/dev/null | head -1)"
fi
[ -z "$KEY" ] && { echo "Could not locate the API key; skipping direct test."; exit 0; }
echo "key found (${#KEY} chars), not printing it"

MODEL="nvidia/nemotron-3-super-120b-a12b"

for i in 1 2 3; do
  start=$(date +%s.%N)
  body=$(curl -s -m 120 https://integrate.api.nvidia.com/v1/chat/completions \
    -H "Authorization: Bearer $KEY" \
    -H 'Content-Type: application/json' \
    -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Say Hi\"}],\"max_tokens\":16,\"stream\":false}")
  end=$(date +%s.%N)
  dur=$(echo "$end - $start" | bc)

  if echo "$body" | grep -qi '"content"'; then
    echo "direct call $i: ok    ${dur}s"
  else
    echo "direct call $i: FAIL  ${dur}s  -> $(echo "$body" | head -c 160)"
  fi
done
