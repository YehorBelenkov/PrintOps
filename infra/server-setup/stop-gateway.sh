#!/usr/bin/env bash
# Kill the gateway by the PID holding port 18789. Matching on the command line
# fails because the pkill wrapper's own `bash -lc` string contains the pattern.
CONTAINER="$(docker ps --format '{{.Names}}' | grep -- '--igor-' | head -1)"

docker exec "$CONTAINER" bash -lc '
  pid=$(ss -lptnH "sport = :18789" 2>/dev/null | grep -oE "pid=[0-9]+" | head -1 | cut -d= -f2)
  if [ -z "$pid" ]; then
    pid=$(for p in /proc/[0-9]*; do
            tr "\0" " " < "$p/cmdline" 2>/dev/null | grep -q "gateway" && basename "$p"
          done | head -1)
  fi
  if [ -n "$pid" ]; then kill -9 "$pid" 2>/dev/null && echo "killed pid $pid"; else echo "no pid found"; fi
'
sleep 2
docker exec "$CONTAINER" bash -lc \
  'timeout 2 bash -c "echo > /dev/tcp/127.0.0.1/18789" 2>/dev/null && echo "18789 still open" || echo "18789 closed"'
docker exec "$CONTAINER" bash -lc 'find /sandbox/.openclaw -user 0 2>/dev/null | wc -l | xargs echo "root-owned files:"'
