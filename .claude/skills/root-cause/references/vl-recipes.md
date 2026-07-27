# VictoriaLogs (LogsQL) recipes

VictoriaLogs filters by **email** directly. Correlate by email + `_time` window around pinned timestamp `T`.

Use `mcp__victorialogs__documentation` first if unsure of LogsQL syntax — treat docs as most authoritative. Keep queries narrow; some are query-heavy.

## Tools

| Tool | Use |
|------|-----|
| `mcp__victorialogs__query` | Run a LogsQL query, return matching log lines |
| `mcp__victorialogs__hits` | Count matches over time (spot spikes) |
| `mcp__victorialogs__stats_query` / `stats_query_range` | Aggregate stats |
| `mcp__victorialogs__field_names` / `field_values` / `facets` | Discover fields/values before filtering |

## Time window

LogsQL uses `_time` filter. Start ±2 min around `T`, widen to ±15 min if empty:
```
_time:[<T-2m>, <T+2m>] email:<email>
```

## By symptom

### Wrong / missing data (lead)
```
_time:[<T-2m>, <T+2m>] email:<email>
```
Then narrow to errors / failed commands:
```
_time:[<T-2m>, <T+2m>] email:<email> (error OR fail OR exception OR "500")
```
Look for a failed backend command that should have produced the missing data.

### Backend errors behind a client crash
```
_time:[<T-2m>, <T+2m>] email:<email> level:error
```
Match timestamp to the Sentry error (proximity linking).

### Command / API failures
```
_time:[<T-2m>, <T+2m>] email:<email> status:>=500
```
(Adjust field names to the schema — verify with `field_names` / `facets` first.)

## Notes

- Field names vary by log stream. Run `field_names` / `facets` scoped to the email+time window before assuming a field like `level`, `status`, `command` exists.
- Quote the shortest decisive line; do not dump the whole result set.
- Timestamp-proximity link to Sentry is approximate — flag ambiguity when multiple lines share the same second.
