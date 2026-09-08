#!/usr/bin/env bash
# End-to-end sticker generation through the agent service.
TOKEN="$(cat /etc/printops-agent.token)"
start=$(date +%s)
curl -s -m 260 -X POST http://127.0.0.1:8787/v1/image \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"prompt":"Professional die-cut vinyl sticker of a fierce lion mascot, orange black and white, fine line art, flat screen-print look, transparent background","name":"lion test"}' \
  -o /tmp/img.json
end=$(date +%s)
echo "took $((end-start))s"
python3 -c "
import json
d = json.load(open('/tmp/img.json'))
print('generated:', d.get('generated'))
print('id:', d.get('id'))
if d.get('reason'): print('reason:', str(d['reason'])[:400])
"
