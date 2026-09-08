#!/usr/bin/env bash
# How reliable is the NVIDIA endpoint right now?
# Runs N attempts, reports per-attempt duration and pass/fail.
N=${1:-6}
pass=0
for i in $(seq 1 "$N"); do
  start=$(date +%s)
  nemoclaw igor exec -- openclaw capability model run --prompt Hi --thinking off >/tmp/rel.txt 2>&1
  end=$(date +%s)
  dur=$(( end - start ))
  if grep -qi 'error\|overloaded' /tmp/rel.txt; then
    echo "attempt $i: FAIL  ${dur}s  -> $(grep -oi 'overloaded\|rate limit\|failover[a-z]*\|[0-9]\{3\} status code' /tmp/rel.txt | head -1)"
  else
    pass=$(( pass + 1 ))
    echo "attempt $i: ok    ${dur}s  -> $(tail -1 /tmp/rel.txt | cut -c1-40)"
  fi
done
echo "----"
echo "$pass / $N succeeded"
