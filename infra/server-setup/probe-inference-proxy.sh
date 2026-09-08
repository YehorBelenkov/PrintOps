#!/usr/bin/env bash
# NemoClaw proxies `inference.local` from the host. If that proxy is reachable from
# the host itself, server.mjs can POST straight to it and skip the ~13s CLI boot.
echo "=== host listeners ==="
ss -lptnH | awk '{print $4, $6}' | sort -u | head -20

echo
echo "=== probe 8080 for an OpenAI-compatible surface ==="
for path in /v1/models /v1/chat/completions /health /; do
  code=$(curl -s -o /tmp/p.out -m 5 -w '%{http_code}' "http://127.0.0.1:8080$path")
  printf '%-24s %s  %s\n' "$path" "$code" "$(head -c 120 /tmp/p.out | tr -d '\n')"
done

echo
echo "=== timed completion straight through the proxy ==="
start=$(date +%s.%N)
curl -s -m 60 -o /tmp/c.out -w 'http=%{http_code} total=%{time_total}s\n' \
  http://127.0.0.1:8080/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"nvidia/nemotron-3-super-120b-a12b","messages":[{"role":"user","content":"Say Hi"}],"max_tokens":24,"stream":false}'
end=$(date +%s.%N)
echo "wall: $(echo "$end - $start" | bc)s"
head -c 400 /tmp/c.out; echo
