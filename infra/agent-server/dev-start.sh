#!/usr/bin/env bash
# Local smoke test: runs the agent service against the WSL sandbox so remote mode
# can be exercised before there is a real VPS.
set -euo pipefail

NODE="${NODE:-$HOME/.nvm/versions/node/v22.23.2/bin/node}"
DIR="$HOME/printops-agent"

cd "$DIR"
pkill -f "$DIR/server.mjs" 2>/dev/null || true

AGENT_TOKEN="${AGENT_TOKEN:-devtoken}" \
PORT="${PORT:-8787}" \
DATA_DIR="$DIR/data" \
nohup "$NODE" "$DIR/server.mjs" > "$DIR/agent.log" 2>&1 &

sleep 2
curl -s "http://127.0.0.1:${PORT:-8787}/health" || true
echo
tail -3 "$DIR/agent.log"
