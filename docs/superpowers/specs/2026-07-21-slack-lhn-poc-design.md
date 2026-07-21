# Slack-like LHN POC — Design

Issue: callstack-internal/expensify-issues#2722
Branch: `poc-slack-lhn` (the branch IS the POC — no feature flag)

## Goal

Demo a decluttered, Slack-like sidebar (sections + DMs coexisting) backed by a
parallel lean data pipeline, and show measurable CPU savings against the
current LHN on a large account.

## What it proves

1. **UX**: sections declutter the sidebar; collapsed sections hide noise.
2. **Perf**: per-section computation + a lean row are much cheaper than one
   global sort + `getOptionData` per row. Collapsed sections cost ~nothing.

## Sections

Fixed, type-based, mirroring today's `categorizeReportsForLHN` priority order,
with the big "everything else" bucket split Slack-style:

| Order | Section | Membership | Sort |
|---|---|---|---|
| 1 | Pinned & Attention | `isPinned \|\| requiresAttention` | name |
| 2 | Errors | RBR reports (non-archived) | name |
| 3 | Drafts | has draft comment | name |
| 4 | Channels | rooms, policy/workspace chats, expense reports | `lastVisibleActionCreated` desc |
| 5 | Direct messages | 1:1 DMs, group chats | `lastVisibleActionCreated` desc |
| 6 | Archived | archived reports | `lastVisibleActionCreated` desc, collapsed by default |

A report appears in exactly one section — first match wins, same as the
current bucket precedence.

Sections are collapsible (chevron in header). Collapse state is session-only
component/provider state — no persistence. Collapsed sections show an unread
count in the header.

## Architecture

### 1. Data pipeline — `useSidebarSections` (new provider)

`src/hooks/useSidebarSections.tsx`, mounted in `AuthScreens` **replacing**
`SidebarOrderedReportsContextProvider`.

- Subscribes to the same inputs as `useSidebarOrderedReports` today:
  `COLLECTION.REPORT` (+ `sourceValue` deltas), policies (mapped selector),
  transactions, violations, report NVPs, draft comments, betas,
  `DERIVED.REPORT_ATTRIBUTES`, current report ID. Priority mode is NOT an
  input — focus mode is retired on this branch.
- **Filter + section in one pass**: reuse
  `ReportUtils.shouldReportBeInOptionList` for visibility, then classify each
  visible report directly into its section key. Output:
  `Record<SectionKey, reportID[]>` membership.
- Keep the incremental `sourceValue`-delta pattern from
  `useSidebarOrderedReports.getUpdatedReports` so steady-state updates
  reclassify only changed reports.
- **Sort per expanded section only.** Collapsed sections keep membership (for
  header counts) but skip sorting entirely. No `getOptionData`, no MiniReport
  building, no Collator on the date-sorted sections.
- Collapse state lives in the provider; exposed via a split state/actions
  context pair, same pattern as the current provider.

### 2. Rendering — one FlashList with header rows

`src/components/SidebarSections/` (new, sibling to `LHNOptionsList`):

- **`SidebarSectionsList`**: single `FlashList`. `data` is an interleaved
  array of `{type: 'header', section}` and `{type: 'row', reportID}` items;
  a collapsed section contributes only its header. `getItemType`
  distinguishes the two. No nested lists — virtualization stays intact.
- **`SectionHeader`**: chevron + section name + unread count when collapsed.
  Tap toggles collapse via the actions context.
- **`SlackOptionRow`**: the lean row. Gets `reportID`; reads
  `reportAttributes[reportID]` (name, `brickRoadStatus` dot, `actionBadge`)
  plus the report itself (unread → bold, pin icon) and `getIcons` for the
  avatar. Single compact line, Slack-style. No subtitle / message preview —
  so none of `getOptionData`'s alternate-text work and none of
  `OptionRowLHNData`'s ~10 per-row Onyx subscriptions.

`BaseSidebarScreen` renders the new list instead of
`SidebarLinksData → SidebarLinks → LHNOptionsList`. Old files stay on disk
untouched, which keeps the main-vs-branch profiler comparison clean.

### 3. Displaced consumers of the old context

- `NavigationTabBar` (chat tab brick road): recompute from
  `DERIVED.REPORT_ATTRIBUTES` (`brickRoadStatus` is already there per
  report) — a cheap scan.
- `PriorityModeController` (auto-switch to #focus on large accounts):
  disabled on this branch. Sections replace the problem #focus mode solves;
  that's part of the demo narrative.
- `TestToolMenu` / `DebugTabView`: stubbed/guarded — debug-only surfaces.

## Measurement

Web, dev server, large account (bench user). React Profiler exports on `main`
vs this branch for the same flows, compared with the react-profiler-eval flow:

1. Cold sidebar load.
2. Incoming message tick (steady-state re-render).
3. Switching between reports.

Headline metrics: provider recompute time, per-row render cost, total
committed renders per tick, and the collapsed-section delta.

## Out of scope

Drag-to-reorder, user-defined/custom sections, collapse-state persistence,
mobile polish, translations and a11y beyond basics, any edits to the existing
pipeline files (`useSidebarOrderedReports`, `SidebarUtils`, `LHNOptionsList`,
`OptionRowLHN*`).
