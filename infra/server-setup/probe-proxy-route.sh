#!/usr/bin/env bash
# The sandbox reaches inference via forward proxy 10.200.0.1:3128 using the fake
# host `inference.local`, where NemoClaw injects the real key. Try the same from the host.
echo "=== interfaces carrying 10.200.0.x ==="
ip -4 addr | grep -E '10\.200\.|inet ' | grep -B1 '10\.200\.' | head -10
ip -4 addr show | awk '/inet /{print $2, $NF}' | head -12

echo
echo "=== is the proxy reachable from the host? ==="
timeout 3 bash -c 'echo > /dev/tcp/10.200.0.1/3128' 2>/dev/null && echo "3128 open" || echo "3128 unreachable"

echo
echo "=== timed request through the proxy ==="
curl -sk -m 60 -o /tmp/px.out -w 'http=%{http_code} total=%{time_total}s\n' \
  -x http://10.200.0.1:3128 \
  https://inference.local/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"nvidia/nemotron-3-super-120b-a12b","messages":[{"role":"user","content":"Say Hi"}],"max_tokens":24,"stream":false}'
head -c 400 /tmp/px.out; echo
