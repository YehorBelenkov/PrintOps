#!/usr/bin/env bash
# Can we pick a model per call? If so, A/B the 120B against the 30B lightning
# without touching the live config.
echo "=== capability model run flags ==="
nemoclaw igor exec -- openclaw capability model run --help 2>&1 \
  | grep -viE 'undici|trace-warnings|Active gateway|safety-net|guard' \
  | grep -iE 'model|provider|prompt|max|temp' | head -20

echo
echo "=== what the provider actually offers ==="
nemoclaw igor exec -- openclaw models list --all 2>&1 \
  | grep -viE 'undici|trace-warnings|Active gateway|safety-net|guard' | head -25
