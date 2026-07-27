# Sentry recipes

Org `expensify`, project `app`. Correlate by `user.email` + time window around the pinned timestamp `T` (default ±2 min, widen to ±15 min if empty).

## Tools

| Tool | Use |
|------|-----|
| `mcp__sentry__search_issues` | Grouped errors/crashes by query + date range |
| `mcp__sentry__search_events` | Raw events / spans (durations, perf) |
| `mcp__sentry__get_sentry_resource` | Fetch a specific issue/event by ID or URL |

## By symptom

### Crash / error / red screen
```
search_issues
query: user.email:<email>
range: T-2m .. T+2m
```
Then open the top issue, read the latest event's breadcrumbs for the failing action and any surfaced backend message.

### Slow / perf / jank
```
search_events
query: user.email:<email> span.duration:>1000
range: T-2m .. T+2m
```
Sort by duration. Long spans point at the slow operation (network call, render, JS work).

### Wrong / missing data (client side)
```
search_events
query: user.email:<email>
range: T-2m .. T+2m
```
Look for handled errors / warnings around the data load. Often no Sentry signal → pivot to VictoriaLogs.

### Stuck / blank UI
```
search_issues
query: user.email:<email>
range: T-2m .. T+2m
```
Check breadcrumbs for an exception that halted a flow. Combine with Fullstory to see what the user saw when it stalled.

## Notes

- Widen the range progressively (±2m → ±15m → session length) before concluding "no Sentry signal".
- Breadcrumbs often contain a backend error string — quote it; it's the bridge to VictoriaLogs even without a shared ID.
- Do NOT use `analyze_issue_with_seer`.
