#!/usr/bin/env bash
# Refusal rate for a given model. Usage: bash model-reliability.sh <model> <n>
MODEL="${1:?usage: model-reliability.sh <model> [n]}"
N="${2:-8}"
pass=0
for i in $(seq 1 "$N"); do
  start=$(date +%s)
  nemoclaw igor exec -- openclaw capability model run \
    --model "$MODEL" --prompt 'Say Hi' --thinking off >/tmp/mr.txt 2>&1
  end=$(date +%s)
  if grep -qiE 'error|overloaded' /tmp/mr.txt; then
    echo "  $i: FAIL $((end-start))s"
  else
    pass=$((pass+1))
    echo "  $i: ok   $((end-start))s"
  fi
done
echo "$MODEL -> $pass/$N succeeded"
