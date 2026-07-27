# RCA report format

The main thread produces this after all three source passes, during synthesis. Must include a root cause hypothesis AND concrete candidate fixes — not just "investigate further".

```
## RCA: <one-line symptom>

**User:** <email>  **Window:** <start> – <end>  **Platform:** <ios/android/web/unknown>

### Symptom
<what the user experienced>

### Timeline
<merged, time-ordered events across sources; tag each line [SENTRY] / [VL] / [FS]>

### Anomalies & causal links
<list every anomaly (errors, status codes, retries/loops, slow spans, auth failures, stalls). Then state which ones are ONE mechanism and why. For any retry/loop: answer "why doesn't it terminate?". Only after trying to unify, note any anomaly that is genuinely a separate incident — and justify why it couldn't be linked. Do NOT split by timestamp alone.>

### Root cause
**Layer:** client | backend | data
<the most likely cause in 1–3 sentences, tied to the evidence. If not fully certain, say "hypothesis" and give the confidence below.>

### Where it lives in code
<file:line references to the responsible component/route/command, from repo lookup. Or "not located — <why>".>

### Candidate fixes
Ranked, concrete, specific to the code above:
1. **<fix>** — <what to change and why it addresses the cause>. <effort/risk>.
2. **<fix>** — ...
<If a fix requires a repro/profile first, state exactly what to capture (which route, which snapshot, what to measure) and what result would confirm which fix.>

### Evidence
- Sentry: <event/issue ID + decisive value, or "none found">
- VictoriaLogs: <query used + key line, or "none found / backend exonerated">
- Fullstory: <session ID/link, or "none found">

### Confidence & caveats
<high/medium/low + why> — <timestamp-proximity or coverage caveats> — <recommended next action>
```

## Rules

- Never assert root cause without at least one evidence line. Low confidence is a valid, honest answer.
- **Always** attempt "Where it lives in code" and "Candidate fixes" — the report is judged poor without them. If the cause is genuinely unlocated, say so and give the smallest next diagnostic step, not a vague "profile it".
- Layer must be one of: client, backend, data.
- Before calling anything a "separate incident", try to disprove it. Prefer the root cause that unifies the most anomalies. A retry/loop next to an error/non-200 code on the same route is usually ONE mechanism, not two — a timestamp gap alone does not make them unrelated.
- Quote the shortest decisive line; no full stack traces or log blobs.
- Flag timestamp-proximity links as approximate when events cluster in the same second.
- If a source returned nothing, write "none found" — do not omit the line.
