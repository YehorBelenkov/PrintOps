#!/usr/bin/env bash
# Installs the PrintOps agent service. Expects server.mjs and
# printops-agent.service to already sit in /root/deploy/.
set -euo pipefail

NODE_BIN="$(command -v node)"
echo "node: $NODE_BIN ($(node --version))"

install -d -m 755 /opt/printops
install -d -m 700 /opt/printops/data
install -m 755 /root/deploy/server.mjs /opt/printops/server.mjs

# Reuse the existing token across re-runs so Vercel's env var stays valid.
if [ -f /etc/printops-agent.token ]; then
  TOKEN="$(cat /etc/printops-agent.token)"
  echo "reusing existing token"
else
  TOKEN="$(openssl rand -hex 32)"
  printf '%s' "$TOKEN" > /etc/printops-agent.token
  chmod 600 /etc/printops-agent.token
  echo "generated new token"
fi

sed -e "s|Environment=AGENT_TOKEN=replace-me|Environment=AGENT_TOKEN=$TOKEN|" \
    -e "s|ExecStart=/usr/bin/node|ExecStart=$NODE_BIN|" \
    /root/deploy/printops-agent.service > /etc/systemd/system/printops-agent.service
chmod 600 /etc/systemd/system/printops-agent.service

systemctl daemon-reload
systemctl enable --now printops-agent
sleep 2
systemctl restart printops-agent
sleep 3

echo "=== status ==="
systemctl is-active printops-agent
echo "=== health ==="
curl -s -m 10 http://127.0.0.1:8787/health; echo
echo "=== auth required? ==="
curl -s -o /dev/null -w 'no token -> %{http_code}\n' -m 10 \
  -X POST http://127.0.0.1:8787/v1/agent
echo
echo "AGENT_TOKEN=$TOKEN"
