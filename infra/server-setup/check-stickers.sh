#!/usr/bin/env bash
# Are generated stickers actually persisted on the droplet?
TOKEN="$(cat /etc/printops-agent.token)"
echo "=== index ==="
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8787/v1/stickers | head -c 800
echo
echo
echo "=== files on disk ==="
ls -la /opt/printops/data 2>/dev/null | head -15
echo
echo "count: $(ls /opt/printops/data/*.png 2>/dev/null | wc -l) png files"
