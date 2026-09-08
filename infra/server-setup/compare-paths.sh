#!/usr/bin/env bash
# Does routing through the resident gateway (`agent`) beat the embedded path
# (`capability model run`)? Also check how to keep sessions from growing.
echo "=== agent --help (session flags) ==="
nemoclaw igor exec -- openclaw agent --help 2>&1 \
  | grep -viE 'undici|trace-warnings|Active gateway|safety-net|guard' \
  | grep -iE 'session|message|prompt|json|timeout|new|agent ' | head -25

echo
echo "=== timing: capability model run (embedded) ==="
time nemoclaw igor exec -- openclaw capability model run --prompt 'Say Hi' --thinking off >/tmp/t1.txt 2>&1
tail -1 /tmp/t1.txt | head -c 120; echo

echo
echo "=== timing: agent via gateway ==="
time nemoclaw igor exec -- openclaw agent --message 'Say Hi' >/tmp/t2.txt 2>&1
tail -3 /tmp/t2.txt | head -c 300; echo
