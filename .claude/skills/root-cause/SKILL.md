---
name: root-cause
description: Determine the root cause of a reported user problem by running three observability sources in a fixed sequence — Sentry, then VictoriaLogs, then Fullstory — each pass building on the previous one, correlated by user email + timestamp. Ends with a synthesized root cause and concrete candidate fixes. Use when a user reports a crash, wrong/missing data, slow performance, or a stuck/broken flow and you need why + how to fix.
---

# Root Cause Investigation

Finds WHY a reported user problem happened and proposes HOW to fix it. Runs three sources **one at a time in a fixed order**, each pass fed the previous pass's findings, then synthesizes.

## When to use

User reports a problem and you need root cause + fix direction. Covers crashes/errors, wrong/missing data, slow/janky performance, stuck/broken flows.

## Required input

Confirm before starting:
1. **User email** (sole correlation key)
2. **Time window** (when it happened — timestamp or range; note timezone if known)
3. **Symptom description**

Optional: platform, report/transaction ID, app release/version.

If email or time window is missing, ask. Correlation is impossible without both.

## Prerequisites

- **Sentry** (`mcp__sentry__*`) — org `expensify`, project `app`.
- **VictoriaLogs** (`mcp__victorialogs__*`).
- **Fullstory** (`mcp__fullstory__*`).

If a server is unavailable, skip that pass and note it in the report.

## How it runs — SEQUENTIAL, one source per agent

Run the `rca-investigator` subagent **three times in strict order**, NOT in parallel. Each call investigates exactly one source and receives the accumulated findings from earlier calls so it can aim its queries.

**Pass 1 — Sentry** (client errors/crashes/spans/heap). Dispatch with `SOURCE: Sentry` and the input. Sentry is first because it usually pins the decisive event: the route, release, timestamp, error string, or heap signature.

**Pass 2 — VictoriaLogs** (backend logs). Dispatch with `SOURCE: VictoriaLogs`, the input, **and Pass 1's findings**. Use the timestamps / error strings / routes Sentry surfaced to confirm or exonerate the backend around that exact moment.

**Pass 3 — Fullstory** (session replay). Dispatch with `SOURCE: Fullstory`, the input, **and Passes 1 + 2's findings**. Use the pinned timestamp/route to find and inspect the exact session moment.

Dispatch prompt template (fill per pass):

```
SOURCE: <Sentry | VictoriaLogs | Fullstory>

Reported problem:
User email: <email>
Time window: <start> – <end> (timezone: <tz or "unstated — widen">)
Symptom: <description>
Platform: <ios/android/web/unknown>
Extra context: <IDs, release, prior known issues>

PRIOR FINDINGS:
<paste the previous passes' returned findings verbatim, or "none (first pass)">

Run only the <SOURCE> pass per your instructions and return single-source findings.
```

### Early stop — do not burn tokens

- Each pass is bounded: targeted queries, then report. No speculative deep dives.
- After Pass 1, judge: if Sentry gives a clear decisive signal, Passes 2 and 3 mainly **confirm/exonerate and add the user-visible angle** — keep them tight.
- If a pass returns "Concrete signal: none", still run the remaining passes (a negative is useful — it exonerates a layer), but keep them short.
- If ALL passes return no concrete signal, do NOT launch extra investigations. Report "inconclusive", list exactly what was checked, and suggest what more info would help. Only go deeper if the user explicitly asks.

## Synthesis (you, the main thread — do this after Pass 3)

Combine the three passes into the final report. This is where root cause + fixes come from:

1. **Merge** all findings onto one timeline.
2. **Connect the anomalies BEFORE splitting them** — the most common failure of this skill is filing two related signals as "separate incidents". Do this explicitly:
   - List every anomaly found (errors, status codes, retries/loops, slow spans, auth failures, stalls).
   - For each **pair**, ask: could one cause the other? Correlate by **route + command + error code + mechanism**, NOT just by timestamp. Two signals hours apart can be the *same failure pattern recurring* — a clock gap is not evidence they're unrelated.
   - Whenever a pass found a **retry / re-fetch / render loop**, you MUST answer *"why doesn't it terminate?"* — trace what each retry returns. A loop sitting next to an error/non-200 code on the same route is a prime candidate for ONE mechanism (e.g. failed-auth-retry that never logs out and keeps refetching).
   - **Adversarial rule:** before you label anything a "separate incident", try to DISPROVE that. Prior passes' conclusions are INPUT, not verdicts — if a pass declared two things unrelated, you may overturn it. Only split into separate causes if you cannot construct a plausible single mechanism.
3. **Root cause hypothesis** — state the most likely cause and the layer (client / backend / data). Tie it to the evidence. Prefer the hypothesis that unifies the most anomalies.
4. **Locate it in code** — use `Read`/`Grep`/`Glob` on this repo to find the responsible file(s)/function(s) for the pinned route/component/command. Cite `file:line`.
5. **Candidate fixes** — propose concrete, specific fixes against that code (not "profile it"). Rank by likelihood/effort. If a fix needs a repro/profile first, say what specifically to capture and why.
6. **Confidence + caveats** — including any timestamp-proximity ambiguity and any anomaly you could NOT unify (state why it's genuinely separate).

Produce the report in the format in `references/output-format.md`. Relay it to the user; do not silently re-run the source queries in the main thread.

## References

- `references/sentry-recipes.md` — Sentry templates by symptom
- `references/vl-recipes.md` — LogsQL templates by symptom
- `references/fullstory-recipes.md` — session workflow
- `references/output-format.md` — RCA report schema (with root cause + fixes)
