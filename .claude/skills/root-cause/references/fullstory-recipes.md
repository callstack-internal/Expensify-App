# Fullstory recipes

Session replay — answers "what did the user do and see". This is the outside-in starting point: pin the exact failure timestamp `T` and the failing action, then Sentry + VictoriaLogs explain it.

**Key model:** Fullstory has NO direct "find sessions by email" query. You reach a user's sessions through a **segment** (natural-language filter → segment_id → sessions). Session inspection tools use timestamps in **milliseconds relative to session start**, not wall-clock.

## Tool workflow (in order)

### 1. Build a segment for the user
`build_segment` — natural-language query. Put the email and window in the query text.
```
build_segment(
  query: "users with email <email>",
  start_date: "<YYYY-MM-DD>", end_date: "<YYYY-MM-DD>"   // or time_range: last_7_days
)
→ returns segment_id
```
Notes:
- Email is a user property — phrase it in `query`, there is no email param.
- Use `start_date`/`end_date` for exact windows; `time_range` enum only for presets (last_24_hours, last_7_days, last_30_days, …).
- If email alone returns too many/old sessions, add symptom behavior to narrow: `"users with email X who rage clicked"` or `"... who had an error on <page>"`.

### 2. List the user's sessions
```
get_sessions(segment_id: <id>, limit: 10)
→ sessions, each with a session_url / session identifier
```
Pick the session covering the reported time window.

### 3. Get the event transcript (find `T`)
```
get_session_events(
  session_id: <session_url or id>,
  start_time: "<ISO around incident>", end_time: "<ISO>"   // optional slice; both or neither
)
```
Returns chronological actions grouped by **page** (clicks, navigations, inputs, errors, network). From this pin:
- **`T`** — the failing moment (feeds Sentry/VL ±2 min windows, as wall-clock ISO)
- **page_id** — the page where it happened
- **relative timestamp (ms)** of `T` from session start — for the visual tools below
- user-visible error string, if any

### 4. See what the user saw
```
session_open(session_id: <id>)              → client_id + page summaries (page_id list)
session_screenshot(client_id, page_id, timestamp)   // timestamp = ms relative to session start
session_get_a11y_tree(client_id, page_id, timestamp) // page structure / DOM at that moment
```

### 5. Find what changed at the break
```
session_diff(client_id, page_id, from_ts, to_ts)   // ms; diff a11y tree just before vs at failure
```
Good for stuck/blank UI and wrong-data symptoms — shows the DOM change (or lack of one) at `T`.

### 6. Clean up
```
session_close(client_id)   // when done inspecting
```

## Discovery helpers (optional)
- `discover_org_context(queries: [...])` — resolve page names, defined events, element IDs to build a sharper segment.
- `discover_groups(...)` — top frustration/error groups; useful if the symptom is vague and you need to find the failing page/element first.

## Notes

- Fullstory shows the symptom, rarely the true cause. Use it to aim Sentry + VictoriaLogs, not to conclude.
- Convert carefully: `get_session_events` takes ISO wall-clock; `session_screenshot`/`a11y_tree`/`diff` take **ms relative to session start**.
- If no session found for the email in the window: widen the date range, confirm the email is correct, then report "no session found" rather than assuming no problem.
- Always `session_close` opened sessions.
