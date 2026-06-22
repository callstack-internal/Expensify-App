#!/usr/bin/env bash
# Reports prompt-cache health for a reviewer run.
#
# Source is the action's execution file (always written, independent of
# `show_full_output`). We read ONLY token counts — never message content — so it
# is safe to emit in public CI logs.
#
# Output:
#   - a per-run table in the GitHub step summary,
#   - a single parseable line (for external monitoring / scraping),
#   - a NON-BLOCKING warning annotation when the rule prefix was written instead
#     of read, i.e. the cache went cold.
#
# A cold run is expected occasionally (first review after an idle gap > TTL).
# A *sustained* cold signal means caching regressed — typically a rules edit, an
# action/CLI bump (changes the system-prompt bytes), a model change, or the TTL
# reverting to 5m (ENABLE_PROMPT_CACHING_1H lost).
set -euo pipefail

f="${EXEC_FILE:-}"
if [ -z "$f" ] || [ ! -s "$f" ]; then
  echo "report-cache-health: no execution file, skipping"
  exit 0
fi

# Aggregate cache tokens across assistant turns; cost from the result message.
read -r CREATION READ COST < <(jq -r '
  [.[] | select(.type=="assistant") | .message.usage // empty] as $u
  | (($u | map(.cache_creation_input_tokens // 0) | add) // 0) as $c
  | (($u | map(.cache_read_input_tokens // 0) | add) // 0) as $r
  | (([.[] | select(.type=="result")] | last | .total_cost_usd) // 0) as $cost
  | "\($c) \($r) \($cost)"' "$f")

TOTAL=$(( CREATION + READ ))
RATIO=0
[ "$TOTAL" -gt 0 ] && RATIO=$(( READ * 100 / TOTAL ))
WARN_TOKENS="${CACHE_CREATION_WARN_TOKENS:-15000}"

{
  echo "### Reviewer prompt-cache health"
  echo ""
  echo "| metric | value |"
  echo "| --- | --- |"
  echo "| cache_read tokens | ${READ} |"
  echo "| cache_creation tokens | ${CREATION} |"
  echo "| warm ratio (read / read+create) | ${RATIO}% |"
  echo "| total_cost_usd | ${COST} |"
} >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"

# Parseable single line (counts only — safe to log).
echo "cache_health read=${READ} creation=${CREATION} warm_ratio=${RATIO}% cost=${COST}"

if [ "$CREATION" -gt "$WARN_TOKENS" ]; then
  echo "::warning title=Reviewer cache cold::cache_creation=${CREATION} tokens (> ${WARN_TOKENS}) — the rule prefix was written, not read. Expected occasionally (first run after an idle gap); if sustained across runs, caching has regressed (rules edit, action/CLI bump, model change, or 1h TTL lost)."
fi
