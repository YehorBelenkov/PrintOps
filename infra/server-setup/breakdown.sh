#!/usr/bin/env bash
# Split the fixed cost (process startup) from the variable cost (inference).
echo "=== nemoclaw exec + /bin/true (nemoclaw boot + docker exec) ==="
time nemoclaw igor exec -- /bin/true >/dev/null 2>&1

echo
echo "=== + openclaw boot (version only, no network) ==="
time nemoclaw igor exec -- openclaw --version >/dev/null 2>&1

echo
echo "=== + full inference ==="
time nemoclaw igor exec -- openclaw capability model run --prompt Hi --thinking off >/dev/null 2>&1

echo
echo "=== cpu single-core reference ==="
time bash -c 'a=0; for i in $(seq 1 300000); do a=$((a+i)); done'
