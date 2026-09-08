#!/usr/bin/env bash
# Can server.mjs talk to the resident gateway directly and skip the 12s CLI boot?
# Look for the WS RPC surface in the installed package.
CONTAINER="$(docker ps --format '{{.Names}}' | grep -- '--igor-' | head -1)"

docker exec "$CONTAINER" bash -lc '
  ROOT=$(dirname $(readlink -f $(command -v openclaw)))/..
  echo "package root: $ROOT"
  echo
  echo "=== candidate HTTP routes registered by the gateway ==="
  grep -rhoE "\"/(api|v1|rpc|agent|invoke|message)[a-z0-9/_-]*\"" "$ROOT" 2>/dev/null \
    | sort -u | head -30
  echo
  echo "=== websocket rpc method names ==="
  grep -rhoE "(method|type)\s*[:=]\s*\"[a-z]+\.[a-zA-Z.]+\"" "$ROOT" 2>/dev/null \
    | grep -oE "\"[a-z]+\.[a-zA-Z.]+\"" | sort -u | head -30
'
