#!/usr/bin/env bash
# Scheduled collector: scans recent reviewer runs' LOGS for the CACHE_USAGE line
# emitted by emit-cache-usage.sh, computes the warm-hit trend, and fails (a red
# scheduled run = built-in alert) if caching looks regressed across a meaningful
# sample.
#
# Reads only run logs (token counts) - no message content, no artifacts. Runs
# entirely out of the review hot path.
#
# Tunables (env):
#   LOOKBACK                  how many recent reviewer runs to scan (default 30)
#   CACHE_CREATION_WARN_TOKENS a run is "cold" if creation exceeds this (default 15000)
#   COLD_ALERT_PCT            alert if more than this % of the sample is cold (default 40)
#   MIN_SAMPLE               need at least this many data-carrying runs to judge (default 10)
set -euo pipefail

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY not set}"
LOOKBACK="${LOOKBACK:-30}"
WARN_TOKENS="${CACHE_CREATION_WARN_TOKENS:-15000}"
COLD_ALERT_PCT="${COLD_ALERT_PCT:-40}"
MIN_SAMPLE="${MIN_SAMPLE:-10}"

mapfile -t RUNS < <(gh run list --repo "$REPO" --workflow claude-review.yml \
  --status completed --limit "$LOOKBACK" --json databaseId --jq '.[].databaseId')

scanned=0
cold=0
rows=""
for id in "${RUNS[@]}"; do
  line=$(gh run view "$id" --repo "$REPO" --log 2>/dev/null | grep -m1 'CACHE_USAGE' || true)
  [ -n "$line" ] || continue
  c=$(sed -n 's/.*creation=\([0-9][0-9]*\).*/\1/p' <<<"$line")
  r=$(sed -n 's/.*read=\([0-9][0-9]*\).*/\1/p' <<<"$line")
  [ -n "$c" ] && [ -n "$r" ] || continue
  t=$(( c + r )); ratio=0; [ "$t" -gt 0 ] && ratio=$(( r * 100 / t ))
  scanned=$(( scanned + 1 ))
  [ "$c" -gt "$WARN_TOKENS" ] && cold=$(( cold + 1 ))
  rows="${rows}| ${id} | ${c} | ${r} | ${ratio}% |"$'\n'
done

{
  echo "### Reviewer cache monitor"
  echo ""
  echo "Scanned **${scanned}** data-carrying runs of the last ${LOOKBACK}."
  echo ""
  echo "| run | creation | read | warm% |"
  echo "| --- | --- | --- | --- |"
  printf '%s' "$rows"
} >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"

if [ "$scanned" -lt "$MIN_SAMPLE" ]; then
  echo "Only ${scanned} runs carried cache data (< ${MIN_SAMPLE}); not enough to judge — skipping."
  exit 0
fi

coldpct=$(( cold * 100 / scanned ))
echo "cold=${cold}/${scanned} (${coldpct}%)  alert threshold=${COLD_ALERT_PCT}%"

if [ "$coldpct" -gt "$COLD_ALERT_PCT" ]; then
  echo "::error title=Reviewer cache regressed::${coldpct}% of the last ${scanned} reviewer runs were cold (> ${COLD_ALERT_PCT}%). Likely cause: a rules edit, an action/CLI bump, a model change, or the 1h TTL being lost."
  exit 1
fi
echo "Reviewer cache healthy: ${coldpct}% cold over ${scanned} runs."
