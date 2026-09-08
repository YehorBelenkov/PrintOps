#!/usr/bin/env bash
# Find how OpenClaw expresses model fallback so we can survive NVIDIA overloads.
nemoclaw igor exec -- openclaw config schema > /tmp/schema.json 2>&1
echo "=== keys containing fallback ==="
grep -n 'fallback' /tmp/schema.json | head -20
echo
echo "=== agents.defaults.model block ==="
python3 - <<'PY'
import json
schema = json.load(open('/tmp/schema.json'))

def walk(node, path=''):
    if isinstance(node, dict):
        for key, value in node.items():
            here = f'{path}.{key}' if path else key
            if key in ('model', 'fallback', 'fallbacks', 'primary'):
                title = value.get('title') if isinstance(value, dict) else None
                print(f'{here}  ->  {title}')
            walk(value, here)
    elif isinstance(node, list):
        for item in node:
            walk(item, path)

walk(schema)
PY
