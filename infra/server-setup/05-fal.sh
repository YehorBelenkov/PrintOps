#!/usr/bin/env bash
# Install the fal egress policy and point OpenClaw's image generation at fal.
# Usage: bash 05-fal.sh <FAL_KEY>
set -uo pipefail

KEY="${1:?usage: 05-fal.sh <FAL_KEY>}"
PRESETS="$HOME/.nemoclaw/source/nemoclaw-blueprint/policies/presets"

echo "=== installing preset ==="
install -d "$PRESETS"
install -m 644 /root/deploy/fal-policy.yaml "$PRESETS/fal-image.yaml"
# CRLF parses during preview but fails on apply, with a misleading message.
sed -i 's/\r$//' "$PRESETS/fal-image.yaml"
echo "installed: $PRESETS/fal-image.yaml"

echo
echo "=== applying policy ==="
nemoclaw igor policy-add fal-image --yes 2>&1 | tail -8

echo
echo "=== configuring provider (key not echoed) ==="
nemoclaw igor exec -- openclaw config set models.providers.fal.apiKey "$KEY" >/dev/null 2>&1 \
  && echo "apiKey set" || echo "apiKey FAILED"
nemoclaw igor exec -- openclaw config set agents.defaults.imageGenerationModel.primary fal/fal-ai/flux/dev 2>&1 \
  | grep -viE 'undici|trace-warnings|Active gateway|safety-net|guard' | tail -3

echo
echo "=== verify ==="
nemoclaw igor exec -- openclaw config get agents.defaults.imageGenerationModel 2>&1 \
  | grep -viE 'undici|trace-warnings|Active gateway|safety-net|guard' | tail -5
echo "provider key present:"
nemoclaw igor exec -- openclaw config get models.providers.fal 2>&1 \
  | grep -viE 'undici|trace-warnings|Active gateway|safety-net|guard' \
  | sed -E 's/("apiKey"[[:space:]]*:[[:space:]]*").*"/\1<redacted>"/' | tail -6
