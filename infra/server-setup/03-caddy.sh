#!/usr/bin/env bash
# Puts Caddy in front of the agent service so Vercel can reach it over HTTPS.
# Usage: bash 03-caddy.sh <domain>
set -euo pipefail

DOMAIN="${1:?usage: 03-caddy.sh <domain>}"

if ! command -v caddy >/dev/null; then
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi
caddy version

cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
	encode gzip

	@blocked not path /health /v1/*
	respond @blocked 404

	reverse_proxy 127.0.0.1:8787 {
		transport http {
			read_timeout 240s
			write_timeout 240s
		}
	}
}
EOF

systemctl enable caddy >/dev/null 2>&1 || true
systemctl restart caddy
echo "waiting for certificate…"
for i in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 10 "https://$DOMAIN/health" || echo 000)"
  if [ "$code" = "200" ]; then echo "https ready after ${i}0s"; break; fi
  sleep 10
done

echo "=== caddy ==="
systemctl is-active caddy
echo "=== https health ==="
curl -s -m 15 "https://$DOMAIN/health"; echo
echo "=== blocked path returns 404 ==="
curl -s -o /dev/null -w '%{http_code}\n' -m 15 "https://$DOMAIN/"
