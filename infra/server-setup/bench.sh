#!/usr/bin/env bash
# Break agent latency into its parts so we know what to optimise.
echo "=== bare sandbox exec (no inference) ==="
time nemoclaw igor exec -- echo hi >/tmp/bench-a.txt 2>&1

echo
echo "=== model run: tiny prompt ==="
time nemoclaw igor exec -- openclaw capability model run --prompt Hi --thinking off >/tmp/bench-b.txt 2>&1
tail -1 /tmp/bench-b.txt

echo
echo "=== model run: tiny prompt (second, warm) ==="
time nemoclaw igor exec -- openclaw capability model run --prompt Hi --thinking off >/tmp/bench-c.txt 2>&1
tail -1 /tmp/bench-c.txt
