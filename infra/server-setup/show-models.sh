#!/usr/bin/env bash
# Current model wiring and what else we could fail over to.
echo "=== current model config ==="
nemoclaw igor exec -- openclaw config get agents.defaults.model 2>&1 | tail -12
echo
echo "=== available models ==="
nemoclaw igor exec -- openclaw models list 2>&1 | tail -25
