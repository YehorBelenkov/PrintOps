#!/usr/bin/env bash
# Timestamp every line of a model run so we can see which phase costs what.
# awk prefixes seconds elapsed since the script started.
nemoclaw igor exec -- openclaw capability model run --prompt 'Say Hi' --thinking off --log-level debug 2>&1 \
  | awk 'BEGIN { "date +%s.%N" | getline t0 }
         { "date +%s.%N" | getline now; close("date +%s.%N");
           printf "%6.2f  %s\n", now - t0, substr($0, 1, 150) }'
