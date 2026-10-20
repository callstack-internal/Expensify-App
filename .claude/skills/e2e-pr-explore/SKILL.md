---
name: e2e-pr-explore
description: Explore a PR's ad-hoc web build with `e2e explore`. Writes goals blind from the PR's diff and the code it reaches, runs them in parallel on seeded staging accounts and reports the findings. Use when asked to validate, explore or bug-hunt a PR build.
alwaysApply: false
---

# E2E PR Explore

Turn a PR into explore goals, run them against `https://<PR>.pr-testing.expensify.com`, and report what the agent found.

**Write goals (blind) → run in parallel → review findings → (optional) second round → report → (evaluation only) score.**

## Prerequisites

- The PR has an ad-hoc build. Check it loads (not "Update available"): builds older than the backend's minimum version can't be tested.
- `ANTHROPIC_API_KEY` is set. Runs use the `default` agent in `tests/e2e/e2e.config.ts`.
- Run everything from `tests/e2e/`.

## 1. Write goals (blind)

Spawn a separate subagent for this, so nothing you know about the PR's history leaks into the goals.

### What the goal-writer may read

- `gh pr view <PR> -R Expensify/App --json title,body,files,mergedAt`
- `gh pr diff <PR> -R Expensify/App`
- Local source files (grep, read).
- `git log` of the changed files, and deploy blockers of **other** PRs created **before** this PR's `mergedAt` (step 1c).

### What it must not read

This PR's comments, reviews, linked issues, revert PR, or any issue that mentions it. No GitHub searches for the PR number or title. It lists every command it ran at the end, so the blindness can be checked.

### 1a. Map the code's reach

For each changed component, hook or util, follow imports upward until reaching screens (`src/pages/**`), then map them to routes (`src/ROUTES.ts`, `src/SCREENS.ts`). The result is a list of **entry points**: every screen a user can reach the changed code from, and how to get there. Don't stop at the screens the PR description names; regressions mostly land in the ones it doesn't.

When the diff changes a role or permission, also grep for the role's consumers (for example `ROLE.GUEST`, `isPolicyGuest`) and treat each one as an entry point, not only the callers of the changed function.

### 1b. List data variants from the diff's branches

Every new or changed `if`, ternary, early return or selector condition becomes a variant to check with matching data: single vs many items, workspace vs personal vs self DM, draft vs submitted vs paid, negative vs positive vs zero amounts, foreign currency, empty states, admin vs member. Offline is a variant for every write or optimistic update.

### 1c. Apply change-type rules

| The diff changes | Add checks for |
| --- | --- |
| A computed or displayed value | Every other place it shows: system messages in the thread, previews, Search columns, report totals, after editing, after reload |
| Navigation, lists or position ("x of y", arrows, Back) | Round trips (open → link → Back → Back), opening by direct URL, every entry point, state after removing or moving an item. Every link in a changed header (report subtitle, "From", system message links) is its own entry point: go through it, open something there, then Back twice and recheck |
| Actions or buttons | Before and after each status change (draft → submitted → paid), bulk selection, narrow width |
| Writes or optimistic updates | The same action from a second entry point, undo, reopening the item afterwards |
| A role, permission or membership rule | For everything the role controls (room and chat membership, approver or payer eligibility, report and workspace visibility), set the relationship up first, then change the role, then recheck it from the admin side and, when a fixture allows it, from the affected member's side. Include rooms other than #admins and #announce |

Then check history: `git log --format='%H %s' -- <changed files>` for earlier PRs, and look up deploy blockers from those PRs (only issues created before this PR's `mergedAt`). Turn each into a generic flow ("remove from report, then use the arrows") and add the ones relevant to this diff.

### 1d. Match to fixtures

The `seeded` session (`tests/e2e/seed.ts`) gives every run a fresh account with:

- "E2E Submit Workspace" with draft reports in Spend > Reports: "Fixture A" (Fixture A Cafe $12) and "Fixture B" (Fixture B Shop $5, Fixture B Bakery $9)
- In the same workspace: "Fixture C", submitted (Fixture C Lunch $15, Fixture C Taxi $22, and Fixture C Hotel $80, which was moved in from Fixture D after submitting, so the report has a "moved" system message), and "Fixture D", a draft with Fixture D Parking $6 (Fixture C Hotel moved out of it and Fixture Loose was removed from it)
- "Fixture Loose" $4, an unreported expense in the self DM
- "E2E Collect Workspace" with taxes on (Tax exempt 0%, Tax Rate 1 5%) and draft report "Fixture Tax": Fixture Tax Pos ($20, Tax Rate 1), Fixture Tax Neg (-$20, Tax Rate 1), Fixture Tax EUR (-€20, Tax Rate 1) and Fixture Tax Exempt (-$10, Tax exempt)
- A 1:1 chat with a second account holding a paid "Fixture Pay" ($30) and an outstanding "Fixture Request" ($7.25)

Checks should start from this data. If a variant needs data that doesn't exist and the agent can't cheaply create it, output `missing fixture: <what>` instead of a check, so it can be added to `seed.ts`.

### 1e. Write one goal per entry point

Aim for 6–10 goals, each a single entry point or side flow, so no run runs out of budget before reaching it. Each goal is **at most 1900 characters** (explore rejects goals over 2000). Use this template:

```
Hunt for regressions this PR introduced. You are signed in with test data ready; dismiss any popup or cookie banner. Create the specific data a check needs only if the test data below lacks it. Report each defect as an issue with evidence while on screen. If you could not confirm a check, retry it first in the next step; if you still cannot, file a warning saying what is unconfirmed. Leave actions that remove data (Delete, Merge, Move, Remove from report) for last, then reopen what they affected. To go offline or back online, use Settings > Troubleshoot > Force offline.

PR: <title>
Changed: <one line from the diff>

Test data: <only the fixtures this goal uses>

Entry point: <screen and how to reach it>
1. <check: action + expected result>
2. ...

After every navigation (open, arrow, link, Back), check the header counter and title match the screen and Back returns where you came from. Use all your steps: when the checks are done, do round trips from this entry point into other screens and back, and repeat the state checks. In the assessment, list what you tried and what worked.
```

Write the goals to `/tmp/e2e-pr/goal-<PR>-<n>.txt` and a line per goal to `/tmp/e2e-pr/charters-<PR>.txt` as `n|target`.

## 2. Run

Each run uses its own seeded account, so all goals run in parallel, five at a time. Use `--target pr` for desktop width and `--target pr-mobile` for any goal that needs narrow width.

```sh
cd tests/e2e
while IFS='|' read -r n target; do
  printf '%s\0%s\0' "$n" "$target"
done < /tmp/e2e-pr/charters-<PR>.txt | xargs -0 -n 2 -P 5 sh -c 'E2E_PR_URL=https://<PR>.pr-testing.expensify.com npx e2e explore --config e2e.config.ts --target "$2" --session seeded --max-steps 12 --timeout 900000 --reporter list,markdown --output .e2e/pr-<PR>-$1 --video on --trace on "$(cat /tmp/e2e-pr/goal-<PR>-$1.txt)" < /dev/null > /tmp/e2e-pr/run-<PR>-$1.log 2>&1' _
```

Each run ends after 12 steps, after 3 failed steps in a row, or when the agent decides it's done. Exit code 1 means it filed at least one issue. Each log ends with steps used, tokens and duration.

## 3. Review

Read every run's `summary.md` in `.e2e/pr-<PR>-<n>/` and merge findings that describe one defect. Check each against its screenshot and the source **at the build's commit** (`gh pr view <PR> --json headRefOid`, then `git show <sha>:<path>`; the local checkout is newer), and mark it as one of:

- **Bug:** the screenshot backs it and the code doesn't say the behavior is intended.
- **Intended:** the code, its tests or its copy say so (cite `file:line`).
- **Tool limit or environment:** needs offline, a new tab or a long press; the screenshot contradicts it; or it comes from the account's currency, locale or staging data.
- **Missing fixture:** the seed data lacks something real records have; consider adding it to `seed.ts`.

## 4. Second round (optional)

Run it when most findings are the same defect, or the assessments' lists of what wasn't reached are long. Parallel goals can't adapt to each other, so the first round often spends its budget on one bug.

Give a new blind goal-writer (same read rules as step 1) the first round's entry points, the findings already reported and each run's assessment. It writes 3–5 goals that skip the reported areas and target the unreached entry points and the 1c rules no goal covered. Run and review them as in steps 2 and 3, numbering them after the first round's goals.

## 5. Report

Bugs first, most severe first: title, expected vs observed, steps, screenshot and video, and the runs that found it. Then the other findings grouped by mark, warnings, and per run: steps used, failed steps, time, tokens. End with the areas no run reached.

## 6. Score (evaluation only)

Only when measuring the tool on an already-merged PR, and only after the goals are written and run:

- Deploy blockers: the PR's revert, and issues labeled `DeployBlockerCash` that name the PR.
- QA issues: `gh issue list -R Expensify/App --search '"Issue reported by" "Applause" "<PR URL>"'`; their body links the PR in the "caught during regression testing" line.
- Mark each one **exact**, **likely**, **related** or **missed** against the findings, and note which weren't reachable on web.
- Report the false-positive rate: findings not tied to any of them out of all findings.
