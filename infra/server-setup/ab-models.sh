#!/usr/bin/env bash
# A/B the current 120B against smaller NVIDIA models through the managed route.
# Smaller models are usually both faster and less contended.
run() {
  local model="$1"
  local start end dur
  start=$(date +%s)
  nemoclaw igor exec -- openclaw capability model run \
    --model "$model" --prompt 'Say Hi' --thinking off >/tmp/ab.txt 2>&1
  end=$(date +%s)
  dur=$(( end - start ))
  if grep -qiE 'error|overloaded|not found|unknown' /tmp/ab.txt; then
    printf '%-52s FAIL %3ss  %s\n' "$model" "$dur" \
      "$(grep -oiE 'overloaded|not found|unknown model|[0-9]{3} status code|Error: .{0,60}' /tmp/ab.txt | head -1)"
  else
    printf '%-52s ok   %3ss  %s\n' "$model" "$dur" "$(tail -1 /tmp/ab.txt | head -c 40)"
  fi
}

for m in \
  inference/nvidia/nemotron-3-super-120b-a12b \
  inference/nvidia/nemotron-3.5-lightning-30b-a3b \
  inference/nvidia/nemotron-3-ultra-550b-a55b
do
  run "$m"
done
