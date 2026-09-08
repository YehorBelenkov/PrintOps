#!/usr/bin/env bash
# The gateway was launched as root and may have created root-owned state that the
# normal (uid 998) sandbox user can no longer write. Inspect, then repair.
CONTAINER="$(docker ps --format '{{.Names}}' | grep -- '--igor-' | head -1)"

echo "=== who normally runs openclaw ==="
docker exec "$CONTAINER" bash -lc 'ls -ld /sandbox/.openclaw /sandbox/.openclaw/agents 2>&1'
echo
echo "=== root-owned files under /sandbox/.openclaw ==="
docker exec "$CONTAINER" bash -lc 'find /sandbox/.openclaw -user 0 2>/dev/null | head -20; echo "count: $(find /sandbox/.openclaw -user 0 2>/dev/null | wc -l)"'
echo
echo "=== expected owner (from an untouched path) ==="
docker exec "$CONTAINER" bash -lc 'stat -c "%u:%g %n" /sandbox 2>/dev/null'
