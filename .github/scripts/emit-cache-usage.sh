#!/usr/bin/env bash
# In-run, minimal: emit the reviewer's prompt-cache token counts to the run log.
#
# Token COUNTS ONLY (no message content) -> safe in public logs. Source is the
# action's execution file (always written, independent of `show_full_output`).
#
# Analysis, thresholds and alerting live OUT of the review hot path: the
# scheduled collector (.github/workflows/reviewer-cache-monitor.yml) scans these
# lines across recent runs to detect caching regressions over time.
set -euo pipefail

f="${EXEC_FILE:-}"
if [ -z "$f" ] || [ ! -s "$f" ]; then
  echo "emit-cache-usage: no execution file, skipping"
  exit 0
fi

jq -r '
  [.[] | select(.type=="assistant") | .message.usage // empty] as $u
  | (($u | map(.cache_creation_input_tokens // 0) | add) // 0) as $c
  | (($u | map(.cache_read_input_tokens // 0) | add) // 0) as $r
  | (([.[] | select(.type=="result")] | last | .total_cost_usd) // 0) as $cost
  | "CACHE_USAGE creation=\($c) read=\($r) cost=\($cost)"' "$f"
