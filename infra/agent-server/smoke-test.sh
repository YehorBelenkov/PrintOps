#!/usr/bin/env bash
# Starts the agent service and exercises it in one WSL session, because a
# detached process dies as soon as the last shell exits.
set -uo pipefail

NODE="${NODE:-$HOME/.nvm/versions/node/v22.23.2/bin/node}"
DIR="$HOME/printops-agent"
PORT=8787

pkill -f "$DIR/server.mjs" 2>/dev/null || true

AGENT_TOKEN=devtoken PORT=$PORT DATA_DIR="$DIR/data" \
  "$NODE" "$DIR/server.mjs" > "$DIR/agent.log" 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT

sleep 2

echo "--- health ---"
curl -s "http://127.0.0.1:$PORT/health"; echo

echo "--- unauthenticated (expect 401) ---"
curl -s -o /dev/null -w '%{http_code}\n' -X POST "http://127.0.0.1:$PORT/v1/agent" \
  -H 'Content-Type: application/json' -d '{"prompt":"hi"}'

echo "--- wrong token (expect 401) ---"
curl -s -o /dev/null -w '%{http_code}\n' -X POST "http://127.0.0.1:$PORT/v1/agent" \
  -H 'Authorization: Bearer nope' -H 'Content-Type: application/json' -d '{"prompt":"hi"}'

echo "--- authenticated agent call ---"
curl -s -X POST "http://127.0.0.1:$PORT/v1/agent" \
  -H 'Authorization: Bearer devtoken' -H 'Content-Type: application/json' \
  -d '{"prompt":"Reply with only the word pong"}' | tail -c 300
echo

echo "--- sticker list ---"
curl -s "http://127.0.0.1:$PORT/v1/stickers" -H 'Authorization: Bearer devtoken'
echo
