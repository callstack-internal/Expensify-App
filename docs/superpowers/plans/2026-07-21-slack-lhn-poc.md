# Slack-like LHN POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the LHN with a Slack-like sectioned sidebar (Pinned / Errors / Drafts / Channels / DMs / Archived) backed by a lean parallel data pipeline, on branch `poc-slack-lhn`.

**Architecture:** A new `useSidebarSections` provider reuses the existing filter machinery (`SidebarUtils.getReportsToDisplayInLHN` / `updateReportsToDisplayInLHN` with the `sourceValue` delta cache) but replaces categorize+flatten+global-sort with section membership + per-expanded-section sort. One FlashList renders interleaved header/row items; a lean `SlackOptionRow` reads from the `REPORT_ATTRIBUTES` derived value instead of running `getOptionData` with ~10 Onyx subscriptions per row. Old pipeline files stay untouched.

**Tech Stack:** React Native, TypeScript, Onyx (`useOnyx`), `@shopify/flash-list`, Jest.

Spec: `docs/superpowers/specs/2026-07-21-slack-lhn-poc-design.md`

## Global Constraints

- **React Compiler is enabled.** Never add `useCallback`, `useMemo`, or `React.memo` in new code. Plain functions and expressions are correct.
- **No comments** on self-descriptive code. Zero comments is the default.
- **Never extract JSX into variables** — inline it, duplicate across branches if needed.
- Do NOT edit: `src/hooks/useSidebarOrderedReports.tsx`, `src/libs/SidebarUtils.ts`, `src/components/LHNOptionsList/**`, `src/pages/inbox/sidebar/SidebarLinks.tsx`.
- After every code change: `npx prettier --write <changed files>`. Before finishing a task that adds components/hooks: `npm run react-compiler-compliance-check check-changed`. Typecheck with `npm run typecheck-tsgo`.
- End every commit message with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- This worktree has NO `node_modules`. Task 1 Step 0 sets it up; all later tasks assume it exists.
- Lint note: `./scripts/lint.sh` inside this worktree falsely flags `@lwc/lwc/no-async-await` on every `async () =>` in tests (symlink config artifact, not a real CI failure). Ignore that specific rule; treat everything else as real.

---

### Task 1: `SidebarSectionsUtils` — classification, per-section sort, unread count (TDD)

**Files:**
- Create: `src/libs/SidebarSectionsUtils.ts`
- Test: `tests/unit/SidebarSectionsUtilsTest.ts`

**Interfaces:**
- Consumes: `ReportsToDisplayInLHN` type from `@hooks/useSidebarOrderedReports` (a `Record<string, Report & {hasErrorsOtherThanFailedReceipt?: boolean; requiresAttention?: boolean}>` keyed by FULL Onyx keys like `report_123`, values carry plain `reportID`), `isArchivedNonExpenseReport` from `@libs/ReportUtils`.
- Produces (used by Task 2 and 3):
  - `const SIDEBAR_SECTIONS = ['pinned', 'errors', 'drafts', 'channels', 'dms', 'archived'] as const`
  - `type SidebarSectionKey = (typeof SIDEBAR_SECTIONS)[number]`
  - `type SidebarSection = {key: SidebarSectionKey; reportIDs: string[]; count: number; unreadCount: number; isCollapsed: boolean}`
  - `getSectionMembership(reportsToDisplay, hasDraftByReportID, reportNameValuePairs): Record<SidebarSectionKey, string[]>` (plain reportIDs, unsorted)
  - `sortSectionMembers(sectionKey, memberIDs, reportsToDisplay, reportAttributes, localeCompare): string[]`
  - `countUnreadReports(memberIDs, reportsToDisplay): number`

- [ ] **Step 0: Set up worktree node_modules (skip if `node_modules/.bin/jest` exists)**

```bash
cd /Users/adhorodyski/Developer/Expensify-App/.worktrees/poc-slack-lhn
mkdir -p node_modules
for entry in /Users/adhorodyski/Developer/Expensify-App/node_modules/*; do ln -sfn "$entry" "node_modules/$(basename "$entry")"; done
rm node_modules/@expensify
mkdir node_modules/@expensify
for entry in /Users/adhorodyski/Developer/Expensify-App/node_modules/@expensify/*; do ln -sfn "$entry" "node_modules/@expensify/$(basename "$entry")"; done
rm node_modules/@expensify/react-native-hybrid-app
ln -s ../../modules/hybrid-app node_modules/@expensify/react-native-hybrid-app
npx jest --version
```

Expected: a jest version number prints.

Known recovery (only if a later jest run fails with `COUNTRY_ZIP_REGEX_DATA` undefined or a missing `babel-preset-expo` build file): the main checkout's copy of that package is stale vs this branch's `package.json`. Fix per package:

```bash
VERSION=$(node -p "require('./package.json').dependencies['expensify-common'] ?? require('./package.json').devDependencies['expensify-common']")
npm pack expensify-common@"${VERSION#^}" --pack-destination /tmp
rm node_modules/expensify-common
mkdir node_modules/expensify-common
tar -xzf /tmp/expensify-common-*.tgz --strip-components=1 -C node_modules/expensify-common
```

(Same recipe for `babel-preset-expo` if jest fails loading `babel.config.js`.)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/SidebarSectionsUtilsTest.ts`:

```ts
import type {OnyxCollection} from 'react-native-onyx';
import type {ReportsToDisplayInLHN} from '@hooks/useSidebarOrderedReports';
import {countUnreadReports, getSectionMembership, sortSectionMembers} from '@libs/SidebarSectionsUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportNameValuePairs} from '@src/types/onyx';

type DisplayReport = ReportsToDisplayInLHN[string];

function buildReport(reportID: string, extra: Partial<DisplayReport> = {}): DisplayReport {
    return {
        reportID,
        type: CONST.REPORT.TYPE.CHAT,
        lastVisibleActionCreated: '2026-07-01 00:00:00.000',
        ...extra,
    } as DisplayReport;
}

function buildDisplayMap(reports: DisplayReport[]): ReportsToDisplayInLHN {
    const map: ReportsToDisplayInLHN = {};
    for (const report of reports) {
        map[`${ONYXKEYS.COLLECTION.REPORT}${report.reportID}`] = report;
    }
    return map;
}

const localeCompare = (a: string, b: string) => a.localeCompare(b);

describe('getSectionMembership', () => {
    it('classifies each report into exactly one section, first match wins', () => {
        const reports = buildDisplayMap([
            buildReport('1', {isPinned: true}),
            buildReport('2', {requiresAttention: true}),
            buildReport('3', {hasErrorsOtherThanFailedReceipt: true}),
            buildReport('4'),
            buildReport('5', {chatType: CONST.REPORT.CHAT_TYPE.GROUP}),
            buildReport('6', {chatType: CONST.REPORT.CHAT_TYPE.POLICY_ROOM}),
            buildReport('7', {type: CONST.REPORT.TYPE.EXPENSE}),
        ]);
        const membership = getSectionMembership(reports, {4: false}, undefined);

        expect(membership.pinned.sort()).toEqual(['1', '2']);
        expect(membership.errors).toEqual(['3']);
        expect(membership.dms.sort()).toEqual(['4', '5']);
        expect(membership.channels.sort()).toEqual(['6', '7']);
        expect(membership.drafts).toEqual([]);
        expect(membership.archived).toEqual([]);
    });

    it('pinned beats draft, draft beats section type', () => {
        const reports = buildDisplayMap([buildReport('1', {isPinned: true}), buildReport('2')]);
        const membership = getSectionMembership(reports, {1: true, 2: true}, undefined);

        expect(membership.pinned).toEqual(['1']);
        expect(membership.drafts).toEqual(['2']);
    });

    it('archived chat goes to archived and suppresses its errors', () => {
        const rNVPs: OnyxCollection<ReportNameValuePairs> = {
            [`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}1`]: {private_isArchived: '2026-07-01 00:00:00.000'} as ReportNameValuePairs,
        };
        const reports = buildDisplayMap([buildReport('1', {hasErrorsOtherThanFailedReceipt: true})]);
        const membership = getSectionMembership(reports, undefined, rNVPs);

        expect(membership.archived).toEqual(['1']);
        expect(membership.errors).toEqual([]);
    });
});

describe('sortSectionMembers', () => {
    it('sorts pinned/errors/drafts by report name from attributes', () => {
        const reports = buildDisplayMap([buildReport('1'), buildReport('2')]);
        const attributes = {
            1: {reportName: 'Zulu'},
            2: {reportName: 'Alpha'},
        };

        expect(sortSectionMembers('pinned', ['1', '2'], reports, attributes as never, localeCompare)).toEqual(['2', '1']);
    });

    it('sorts channels/dms by lastVisibleActionCreated descending', () => {
        const reports = buildDisplayMap([
            buildReport('1', {lastVisibleActionCreated: '2026-07-01 00:00:00.000'}),
            buildReport('2', {lastVisibleActionCreated: '2026-07-02 00:00:00.000'}),
        ]);

        expect(sortSectionMembers('dms', ['1', '2'], reports, undefined, localeCompare)).toEqual(['2', '1']);
    });
});

describe('countUnreadReports', () => {
    it('counts reports whose lastReadTime is behind lastVisibleActionCreated', () => {
        const reports = buildDisplayMap([
            buildReport('1', {lastReadTime: '2026-06-30 00:00:00.000', lastVisibleActionCreated: '2026-07-01 00:00:00.000'}),
            buildReport('2', {lastReadTime: '2026-07-01 00:00:00.000', lastVisibleActionCreated: '2026-07-01 00:00:00.000'}),
        ]);

        expect(countUnreadReports(['1', '2'], reports)).toBe(1);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/SidebarSectionsUtilsTest.ts`
Expected: FAIL — cannot resolve `@libs/SidebarSectionsUtils`.

- [ ] **Step 3: Write the implementation**

Create `src/libs/SidebarSectionsUtils.ts`:

```ts
import type {OnyxCollection} from 'react-native-onyx';
import type {LocaleContextProps} from '@components/LocaleContextProvider';
import type {ReportsToDisplayInLHN} from '@hooks/useSidebarOrderedReports';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportNameValuePairs} from '@src/types/onyx';
import type {ReportAttributesDerivedValue} from '@src/types/onyx/DerivedValues';
import {isArchivedNonExpenseReport} from './ReportUtils';

const SIDEBAR_SECTIONS = ['pinned', 'errors', 'drafts', 'channels', 'dms', 'archived'] as const;

type SidebarSectionKey = (typeof SIDEBAR_SECTIONS)[number];

type SidebarSection = {
    key: SidebarSectionKey;
    reportIDs: string[];
    count: number;
    unreadCount: number;
    isCollapsed: boolean;
};

type SectionMembership = Record<SidebarSectionKey, string[]>;

type DisplayReport = ReportsToDisplayInLHN[string];

function isDirectMessage(report: DisplayReport): boolean {
    if (report.type !== CONST.REPORT.TYPE.CHAT) {
        return false;
    }
    return !report.chatType || report.chatType === CONST.REPORT.CHAT_TYPE.GROUP || report.chatType === CONST.REPORT.CHAT_TYPE.SELF_DM;
}

function classifyReport(report: DisplayReport, hasDraft: boolean, isArchived: boolean): SidebarSectionKey {
    if (report.isPinned || report.requiresAttention) {
        return 'pinned';
    }
    if (report.hasErrorsOtherThanFailedReceipt && !isArchived) {
        return 'errors';
    }
    if (hasDraft) {
        return 'drafts';
    }
    if (isArchived) {
        return 'archived';
    }
    if (isDirectMessage(report)) {
        return 'dms';
    }
    return 'channels';
}

function getSectionMembership(
    reportsToDisplay: ReportsToDisplayInLHN,
    hasDraftByReportID: Record<string, boolean> | undefined,
    reportNameValuePairs: OnyxCollection<ReportNameValuePairs> | undefined,
): SectionMembership {
    const membership: SectionMembership = {pinned: [], errors: [], drafts: [], channels: [], dms: [], archived: []};
    for (const report of Object.values(reportsToDisplay)) {
        if (!report?.reportID) {
            continue;
        }
        const rNVPs = reportNameValuePairs?.[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${report.reportID}`];
        const isArchived = isArchivedNonExpenseReport(report, !!rNVPs?.private_isArchived);
        membership[classifyReport(report, !!hasDraftByReportID?.[report.reportID], isArchived)].push(report.reportID);
    }
    return membership;
}

const NAME_SORTED_SECTIONS: SidebarSectionKey[] = ['pinned', 'errors', 'drafts'];

function sortSectionMembers(
    sectionKey: SidebarSectionKey,
    memberIDs: string[],
    reportsToDisplay: ReportsToDisplayInLHN,
    reportAttributes: ReportAttributesDerivedValue['reports'] | undefined,
    localeCompare: LocaleContextProps['localeCompare'],
): string[] {
    if (NAME_SORTED_SECTIONS.includes(sectionKey)) {
        return [...memberIDs].sort((a, b) => localeCompare(reportAttributes?.[a]?.reportName ?? '', reportAttributes?.[b]?.reportName ?? ''));
    }
    return [...memberIDs].sort((a, b) => {
        const dateA = reportsToDisplay[`${ONYXKEYS.COLLECTION.REPORT}${a}`]?.lastVisibleActionCreated ?? '';
        const dateB = reportsToDisplay[`${ONYXKEYS.COLLECTION.REPORT}${b}`]?.lastVisibleActionCreated ?? '';
        return dateB < dateA ? -1 : Number(dateB > dateA);
    });
}

function countUnreadReports(memberIDs: string[], reportsToDisplay: ReportsToDisplayInLHN): number {
    let count = 0;
    for (const reportID of memberIDs) {
        const report = reportsToDisplay[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
        if (report?.lastReadTime && report.lastVisibleActionCreated && report.lastReadTime < report.lastVisibleActionCreated) {
            count++;
        }
    }
    return count;
}

export {SIDEBAR_SECTIONS, getSectionMembership, sortSectionMembers, countUnreadReports};
export type {SidebarSectionKey, SidebarSection};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/SidebarSectionsUtilsTest.ts`
Expected: PASS, all tests green. If `CONST.REPORT.CHAT_TYPE.POLICY_ROOM` or `SELF_DM` names don't typecheck, check exact members with `grep -n "CHAT_TYPE = {" -A 12 src/CONST.ts` and use the real member names.

- [ ] **Step 5: Format, typecheck, commit**

```bash
npx prettier --write src/libs/SidebarSectionsUtils.ts tests/unit/SidebarSectionsUtilsTest.ts
npm run typecheck-tsgo
git add src/libs/SidebarSectionsUtils.ts tests/unit/SidebarSectionsUtilsTest.ts
git commit -m "Add sidebar section classification and sort utils

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `useSidebarSections` provider

**Files:**
- Create: `src/hooks/useSidebarSections.tsx`
- Reference (do not edit): `src/hooks/useSidebarOrderedReports.tsx` — this is the pattern being leaned out.

**Interfaces:**
- Consumes: Task 1's `getSectionMembership`, `sortSectionMembers`, `countUnreadReports`, `SIDEBAR_SECTIONS`, `SidebarSectionKey`, `SidebarSection`; `SidebarUtils.getReportsToDisplayInLHN` / `updateReportsToDisplayInLHN` (default export of `@libs/SidebarUtils`); `getChatTabBrickRoad` from `@libs/WorkspacesSettingsUtils`.
- Produces (used by Tasks 3–4):
  - `SidebarSectionsContextProvider({children}: {children: React.ReactNode})`
  - `useSidebarSectionsState(): {sections: SidebarSection[]; currentReportID: string | undefined; chatTabBrickRoad: BrickRoad}`
  - `useSidebarSectionsActions(): {toggleSection: (key: SidebarSectionKey) => void}`

- [ ] **Step 1: Write the provider**

Create `src/hooks/useSidebarSections.tsx`. This mirrors `useSidebarOrderedReports` minus priority mode, minus global sort, with NO manual memoization (React Compiler handles it). The display-map cache uses the same state+effect convergence trick: `updateReportsToDisplayInLHN` returns the same reference when nothing changed, so the effect's `setState` bails and there is no loop.

```tsx
import React, {createContext, useContext, useEffect, useState} from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import {countUnreadReports, getSectionMembership, SIDEBAR_SECTIONS, sortSectionMembers} from '@libs/SidebarSectionsUtils';
import type {SidebarSection, SidebarSectionKey} from '@libs/SidebarSectionsUtils';
import SidebarUtils from '@libs/SidebarUtils';
import type {BrickRoad} from '@libs/WorkspacesSettingsUtils';
import {getChatTabBrickRoad} from '@libs/WorkspacesSettingsUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import {useCurrentReportIDState} from './useCurrentReportID';
import useCurrentUserPersonalDetails from './useCurrentUserPersonalDetails';
import useLocalize from './useLocalize';
import useMappedPolicies from './useMappedPolicies';
import useNetwork from './useNetwork';
import useOnyx from './useOnyx';
import usePrevious from './usePrevious';
import useReportAttributes from './useReportAttributes';
import type {ReportsToDisplayInLHN} from './useSidebarOrderedReports';

type PartialPolicyForSidebar = Pick<OnyxTypes.Policy, 'type' | 'name' | 'avatarURL' | 'employeeList'>;

type SidebarSectionsStateValue = {
    sections: SidebarSection[];
    currentReportID: string | undefined;
    chatTabBrickRoad: BrickRoad;
};

type SidebarSectionsActionsValue = {
    toggleSection: (key: SidebarSectionKey) => void;
};

const SidebarSectionsStateContext = createContext<SidebarSectionsStateValue>({
    sections: [],
    currentReportID: undefined,
    chatTabBrickRoad: undefined,
});

const SidebarSectionsActionsContext = createContext<SidebarSectionsActionsValue>({
    toggleSection: () => {},
});

const policyMapper = (policy: OnyxEntry<OnyxTypes.Policy>): PartialPolicyForSidebar =>
    (policy && {
        type: policy.type,
        name: policy.name,
        avatarURL: policy.avatarURL,
        employeeList: policy.employeeList,
    }) as PartialPolicyForSidebar;

function SidebarSectionsContextProvider({children}: {children: React.ReactNode}) {
    const {localeCompare} = useLocalize();
    const [chatReports, {sourceValue: reportUpdates}] = useOnyx(ONYXKEYS.COLLECTION.REPORT);
    const [, {sourceValue: policiesUpdates}] = useMappedPolicies(policyMapper);
    const [transactions, {sourceValue: transactionsUpdates}] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION);
    const [transactionViolations, {sourceValue: transactionViolationsUpdates}] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS);
    const [reportNameValuePairs, {sourceValue: reportNameValuePairsUpdates}] = useOnyx(ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS);
    const [reportsDrafts, {sourceValue: reportsDraftsUpdates}] = useOnyx(ONYXKEYS.COLLECTION.REPORT_DRAFT_COMMENT);
    const [betas] = useOnyx(ONYXKEYS.BETAS);
    const reportAttributes = useReportAttributes();
    const {isOffline} = useNetwork();
    const {accountID, login: currentUserLogin} = useCurrentUserPersonalDetails();
    const {currentReportID} = useCurrentReportIDState();
    const prevCurrentReportID = usePrevious(currentReportID);
    const prevBetas = usePrevious(betas);
    const prevIsOffline = usePrevious(isOffline);
    const [displayCache, setDisplayCache] = useState<ReportsToDisplayInLHN>({});
    const [collapsedSections, setCollapsedSections] = useState<Partial<Record<SidebarSectionKey, boolean>>>({archived: true});

    const updatedReportKeys = new Set<string>();
    if (betas !== prevBetas || isOffline !== prevIsOffline) {
        for (const key of Object.keys(chatReports ?? {})) {
            updatedReportKeys.add(key);
        }
    }
    for (const key of Object.keys(reportUpdates ?? {})) {
        updatedReportKeys.add(key);
    }
    for (const key of Object.keys(reportNameValuePairsUpdates ?? {})) {
        updatedReportKeys.add(key.replace(ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS, ONYXKEYS.COLLECTION.REPORT));
    }
    for (const transaction of Object.values(transactionsUpdates ?? {})) {
        updatedReportKeys.add(`${ONYXKEYS.COLLECTION.REPORT}${transaction?.reportID}`);
    }
    for (const violationKey of Object.keys(transactionViolationsUpdates ?? {})) {
        const transactionKey = violationKey.replace(ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS, ONYXKEYS.COLLECTION.TRANSACTION);
        updatedReportKeys.add(`${ONYXKEYS.COLLECTION.REPORT}${transactions?.[transactionKey]?.reportID}`);
    }
    for (const key of Object.keys(reportsDraftsUpdates ?? {})) {
        updatedReportKeys.add(key.replace(ONYXKEYS.COLLECTION.REPORT_DRAFT_COMMENT, ONYXKEYS.COLLECTION.REPORT));
    }
    if (policiesUpdates) {
        const updatedPolicies = new Set(Object.keys(policiesUpdates).map((policyKey) => policyKey.replace(ONYXKEYS.COLLECTION.POLICY, '')));
        for (const [reportKey, report] of Object.entries(chatReports ?? {})) {
            if (!report?.policyID || !updatedPolicies.has(report.policyID)) {
                continue;
            }
            updatedReportKeys.add(reportKey);
        }
    }
    if (prevCurrentReportID !== currentReportID) {
        updatedReportKeys.add(`${ONYXKEYS.COLLECTION.REPORT}${prevCurrentReportID}`);
        updatedReportKeys.add(`${ONYXKEYS.COLLECTION.REPORT}${currentReportID}`);
    }

    const hasCache = Object.keys(displayCache).length > 0;
    const effectiveUpdatedKeys = updatedReportKeys.size === 0 && hasCache ? Object.keys(displayCache) : Array.from(updatedReportKeys);
    const reportsToDisplay =
        effectiveUpdatedKeys.length > 0 && hasCache
            ? SidebarUtils.updateReportsToDisplayInLHN({
                  displayedReports: displayCache,
                  reports: chatReports,
                  updatedReportsKeys: effectiveUpdatedKeys,
                  currentReportId: currentReportID,
                  isInFocusMode: false,
                  betas,
                  transactionViolations,
                  reportNameValuePairs,
                  reportAttributes,
                  draftComments: reportsDrafts,
                  transactions,
                  isOffline,
                  currentUserLogin: currentUserLogin ?? '',
                  currentUserAccountID: accountID,
              })
            : SidebarUtils.getReportsToDisplayInLHN({
                  currentReportId: currentReportID,
                  reports: chatReports,
                  betas,
                  priorityMode: CONST.PRIORITY_MODE.DEFAULT,
                  draftComments: reportsDrafts,
                  transactionViolations,
                  transactions,
                  isOffline,
                  currentUserLogin: currentUserLogin ?? '',
                  currentUserAccountID: accountID,
                  reportNameValuePairs,
                  reportAttributes,
              });

    useEffect(() => {
        setDisplayCache(reportsToDisplay);
    }, [reportsToDisplay]);

    const hasDraftByReportID: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(reportsDrafts ?? {})) {
        if (value) {
            hasDraftByReportID[key.replace(ONYXKEYS.COLLECTION.REPORT_DRAFT_COMMENT, '')] = true;
        }
    }

    const membership = getSectionMembership(reportsToDisplay, hasDraftByReportID, reportNameValuePairs);

    const sections = SIDEBAR_SECTIONS.map((key): SidebarSection => {
        const memberIDs = membership[key];
        const isCollapsed = !!collapsedSections[key];
        return {
            key,
            isCollapsed,
            count: memberIDs.length,
            unreadCount: isCollapsed ? countUnreadReports(memberIDs, reportsToDisplay) : 0,
            reportIDs: isCollapsed ? [] : sortSectionMembers(key, memberIDs, reportsToDisplay, reportAttributes, localeCompare),
        };
    });

    const allVisibleReportIDs = Object.keys(reportsToDisplay).map((key) => key.replace(ONYXKEYS.COLLECTION.REPORT, ''));

    const stateValue: SidebarSectionsStateValue = {
        sections,
        currentReportID,
        chatTabBrickRoad: getChatTabBrickRoad(allVisibleReportIDs, reportAttributes),
    };

    const toggleSection = (key: SidebarSectionKey) => {
        setCollapsedSections((current) => ({...current, [key]: !current[key]}));
    };

    const actionsValue: SidebarSectionsActionsValue = {toggleSection};

    return (
        <SidebarSectionsStateContext.Provider value={stateValue}>
            <SidebarSectionsActionsContext.Provider value={actionsValue}>{children}</SidebarSectionsActionsContext.Provider>
        </SidebarSectionsStateContext.Provider>
    );
}

function useSidebarSectionsState() {
    return useContext(SidebarSectionsStateContext);
}

function useSidebarSectionsActions() {
    return useContext(SidebarSectionsActionsContext);
}

export {SidebarSectionsContextProvider, useSidebarSectionsState, useSidebarSectionsActions};
```

- [ ] **Step 2: Typecheck and compiler check**

```bash
npx prettier --write src/hooks/useSidebarSections.tsx
npm run typecheck-tsgo
npm run react-compiler-compliance-check check-changed
```

Expected: both pass. If the compiler check flags the render-scope `Set` mutation loop, extract the key-collection into a plain module-level function `collectUpdatedReportKeys(...)` in the same file taking all inputs as arguments and returning `string[]`, then call it once in render — same logic, compiler-friendly shape.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSidebarSections.tsx
git commit -m "Add useSidebarSections provider with per-section sort and collapse state

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: UI — `SlackOptionRow`, `SectionHeader`, `SidebarSectionsList`

**Files:**
- Create: `src/components/SidebarSections/SlackOptionRow.tsx`
- Create: `src/components/SidebarSections/SectionHeader.tsx`
- Create: `src/components/SidebarSections/SidebarSectionsList.tsx`

**Interfaces:**
- Consumes: `useSidebarSectionsState` / `useSidebarSectionsActions` from Task 2; `SidebarSection`, `SidebarSectionKey` from Task 1; `getIcons`, `isUnread` from `@libs/ReportUtils`; `useReportAttributesByID` from `@hooks/useReportAttributes`; `LHNEmptyState` from `@components/LHNOptionsList/LHNEmptyState`.
- Produces: `SidebarSectionsList` (no props) — the whole sidebar body, rendered by Task 4.

- [ ] **Step 1: Write `SlackOptionRow`**

Create `src/components/SidebarSections/SlackOptionRow.tsx`:

```tsx
import React from 'react';
import {View} from 'react-native';
import Avatar from '@components/Avatar';
import Icon from '@components/Icon';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import {useReportAttributesByID} from '@hooks/useReportAttributes';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import {getIcons, isUnread} from '@libs/ReportUtils';
import type {ReportAttributesDerivedValue} from '@src/types/onyx/DerivedValues';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';

type SlackOptionRowProps = {
    reportID: string;
    isFocused: boolean;
};

function SlackOptionRow({reportID, isFocused}: SlackOptionRowProps) {
    const styles = useThemeStyles();
    const theme = useTheme();
    const {formatPhoneNumber} = useLocalize();
    const {Pin} = useMemoizedLazyExpensifyIcons(['Pin']);
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const attributes = useReportAttributesByID(reportID) as ReportAttributesDerivedValue['reports'][string] | undefined;

    if (!report) {
        return null;
    }

    const icon = getIcons(report, formatPhoneNumber).at(0);
    const reportName = attributes?.reportName ?? report.reportName ?? '';
    const brickRoad = attributes?.brickRoadStatus;

    return (
        <PressableWithFeedback
            onPress={() => {
                if (reportID === Navigation.getTopmostReportId()) {
                    return;
                }
                Navigation.navigate(ROUTES.REPORT_WITH_ID.getRoute(reportID, attributes?.actionTargetReportActionID));
            }}
            accessibilityLabel={reportName}
            role={CONST.ROLE.BUTTON}
            style={[styles.flexRow, styles.alignItemsCenter, styles.ph5, styles.pv2, isFocused && styles.sidebarLinkActive]}
        >
            {!!icon && (
                <Avatar
                    source={icon.source}
                    type={icon.type}
                    name={icon.name}
                    avatarID={icon.id}
                    size={CONST.AVATAR_SIZE.SMALL}
                    fallbackIcon={icon.fallbackIcon}
                />
            )}
            <Text
                numberOfLines={1}
                style={[styles.ml3, styles.flex1, isUnread(report, undefined, false) ? styles.sidebarLinkTextBold : styles.sidebarLinkText]}
            >
                {reportName}
            </Text>
            {!!report.isPinned && !brickRoad && (
                <Icon
                    src={Pin}
                    width={16}
                    height={16}
                    fill={theme.icon}
                />
            )}
            {brickRoad === CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR && <View style={[styles.ml2, {width: 8, height: 8, borderRadius: 4, backgroundColor: theme.danger}]} />}
            {brickRoad === CONST.BRICK_ROAD_INDICATOR_STATUS.INFO && <View style={[styles.ml2, {width: 8, height: 8, borderRadius: 4, backgroundColor: theme.success}]} />}
        </PressableWithFeedback>
    );
}

export default SlackOptionRow;
```

Note: `getIcons(report, formatPhoneNumber)` deliberately relies on its `allPersonalDetails` default parameter — no per-row personal-details subscription. If `useReportAttributesByID` already returns a properly typed value (check its signature), drop the `as` cast.

- [ ] **Step 2: Write `SectionHeader`**

Create `src/components/SidebarSections/SectionHeader.tsx`:

```tsx
import React from 'react';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Icon from '@components/Icon';
import Text from '@components/Text';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import {useSidebarSectionsActions} from '@hooks/useSidebarSections';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import type {SidebarSection, SidebarSectionKey} from '@libs/SidebarSectionsUtils';
import CONST from '@src/CONST';

const SECTION_LABELS: Record<SidebarSectionKey, string> = {
    pinned: 'Pinned & Attention',
    errors: 'Needs attention',
    drafts: 'Drafts',
    channels: 'Channels',
    dms: 'Direct messages',
    archived: 'Archived',
};

type SectionHeaderProps = {
    section: SidebarSection;
};

function SectionHeader({section}: SectionHeaderProps) {
    const styles = useThemeStyles();
    const theme = useTheme();
    const {toggleSection} = useSidebarSectionsActions();
    const {DownArrow, ArrowRight} = useMemoizedLazyExpensifyIcons(['DownArrow', 'ArrowRight']);

    return (
        <PressableWithFeedback
            onPress={() => toggleSection(section.key)}
            accessibilityLabel={SECTION_LABELS[section.key]}
            role={CONST.ROLE.BUTTON}
            style={[styles.flexRow, styles.alignItemsCenter, styles.ph5, styles.pv2, styles.mt2]}
        >
            <Icon
                src={section.isCollapsed ? ArrowRight : DownArrow}
                width={12}
                height={12}
                fill={theme.icon}
            />
            <Text style={[styles.ml2, styles.textLabelSupporting, styles.textStrong]}>{SECTION_LABELS[section.key]}</Text>
            {section.isCollapsed && section.unreadCount > 0 && <Text style={[styles.ml2, styles.textLabelSupporting]}>{section.unreadCount}</Text>}
        </PressableWithFeedback>
    );
}

export default SectionHeader;
```

- [ ] **Step 3: Write `SidebarSectionsList`**

Create `src/components/SidebarSections/SidebarSectionsList.tsx`:

```tsx
import {FlashList} from '@shopify/flash-list';
import React from 'react';
import {View} from 'react-native';
import LHNEmptyState from '@components/LHNOptionsList/LHNEmptyState';
import {useSidebarSectionsState} from '@hooks/useSidebarSections';
import useThemeStyles from '@hooks/useThemeStyles';
import type {SidebarSection} from '@libs/SidebarSectionsUtils';
import SectionHeader from './SectionHeader';
import SlackOptionRow from './SlackOptionRow';

type SidebarListItem = {type: 'header'; section: SidebarSection} | {type: 'row'; reportID: string};

function SidebarSectionsList() {
    const styles = useThemeStyles();
    const {sections, currentReportID} = useSidebarSectionsState();

    const items: SidebarListItem[] = [];
    for (const section of sections) {
        if (section.count === 0) {
            continue;
        }
        items.push({type: 'header', section});
        if (!section.isCollapsed) {
            for (const reportID of section.reportIDs) {
                items.push({type: 'row', reportID});
            }
        }
    }

    if (items.length === 0) {
        return (
            <View style={[styles.flex1, styles.emptyLHNWrapper]}>
                <LHNEmptyState />
            </View>
        );
    }

    return (
        <FlashList
            data={items}
            testID="sidebar-sections-list"
            keyExtractor={(item) => (item.type === 'header' ? `header_${item.section.key}` : `report_${item.reportID}`)}
            getItemType={(item) => item.type}
            renderItem={({item}) =>
                item.type === 'header' ? (
                    <SectionHeader section={item.section} />
                ) : (
                    <SlackOptionRow
                        reportID={item.reportID}
                        isFocused={item.reportID === currentReportID}
                    />
                )
            }
            showsVerticalScrollIndicator={false}
        />
    );
}

export default SidebarSectionsList;
```

Check `LHNEmptyState`'s import path and props first with `grep -n "LHNEmptyState" src/components/LHNOptionsList/LHNEmptyState.tsx | head -5` — if it requires props, render it exactly as `src/pages/inbox/sidebar/SidebarLinks.tsx:95` does.

- [ ] **Step 4: Typecheck, compiler check, commit**

```bash
npx prettier --write src/components/SidebarSections/
npm run typecheck-tsgo
npm run react-compiler-compliance-check check-changed
git add src/components/SidebarSections/
git commit -m "Add sectioned sidebar list, header, and lean Slack-style row

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Wire-up — swap provider, render new list, migrate tab-bar brick road

**Files:**
- Modify: `src/libs/Navigation/AppNavigator/AuthScreens.tsx` (provider at ~line 179, `PriorityModeController` import at ~line 15 and JSX at ~line 388)
- Modify: `src/pages/inbox/sidebar/SidebarLinksData.tsx`
- Modify: `src/components/Navigation/NavigationTabBar/index.tsx` (~lines 15, 52)

**Interfaces:**
- Consumes: `SidebarSectionsContextProvider`, `useSidebarSectionsState` from Task 2; `SidebarSectionsList` from Task 3.
- Produces: the running app renders the new sidebar. `TestToolMenu` and `DebugTabView` still reference the old (now unmounted) context — they get its default values (`clearLHNCache` no-op, empty arrays), which is fine for debug-only surfaces; leave them alone.

- [ ] **Step 1: Swap the provider and drop `PriorityModeController` in `AuthScreens.tsx`**

Replace the import:

```tsx
import {SidebarSectionsContextProvider} from '@hooks/useSidebarSections';
```

(delete the `useSidebarOrderedReports` and `PriorityModeController` imports). In the `ComposeProviders` list replace `SidebarOrderedReportsContextProvider,` with `SidebarSectionsContextProvider,`. Delete the `<PriorityModeController />` line near the end of the JSX.

- [ ] **Step 2: Render `SidebarSectionsList` from `SidebarLinksData.tsx`**

Keep the telemetry span logic and the outer `View` exactly as-is; replace the data consumption and `SidebarLinks` render:

```tsx
import {useFocusEffect, useIsFocused} from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import React, {useCallback, useEffect, useRef} from 'react';
import {View} from 'react-native';
import type {EdgeInsets} from 'react-native-safe-area-context';
import SidebarSectionsList from '@components/SidebarSections/SidebarSectionsList';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {cancelSpan, endSpan, getSpan} from '@libs/telemetry/activeSpans';
import CONST from '@src/CONST';

type SidebarLinksDataProps = {
    insets: EdgeInsets;
};

function SidebarLinksData({insets}: SidebarLinksDataProps) {
    const isFocused = useIsFocused();
    const styles = useThemeStyles();
    const {translate} = useLocalize();

    const hasHadFirstLayout = useRef(false);
    const spanOnMount = useRef(getSpan(CONST.TELEMETRY.SPAN_NAVIGATE_TO_INBOX_TAB));

    const onLayout = useCallback(() => {
        hasHadFirstLayout.current = true;
        endSpan(CONST.TELEMETRY.SPAN_NAVIGATE_TO_INBOX_TAB);
        spanOnMount.current = undefined;
    }, []);

    useFocusEffect(
        useCallback(() => {
            if (hasHadFirstLayout.current) {
                endSpan(CONST.TELEMETRY.SPAN_NAVIGATE_TO_INBOX_TAB);
            }
            return () => cancelSpan(CONST.TELEMETRY.SPAN_NAVIGATE_TO_INBOX_TAB);
        }, []),
    );

    useEffect(
        () => () => {
            if (hasHadFirstLayout.current) {
                return;
            }
            const activeSpan = getSpan(CONST.TELEMETRY.SPAN_NAVIGATE_TO_INBOX_TAB);
            if (activeSpan !== spanOnMount.current) {
                return;
            }
            cancelSpan(CONST.TELEMETRY.SPAN_NAVIGATE_TO_INBOX_TAB);
        },
        [],
    );

    return (
        <View
            accessibilityElementsHidden={!isFocused}
            collapsable={false}
            accessibilityLabel={translate('sidebarScreen.listOfChats')}
            style={[styles.flex1, styles.h100]}
            onLayout={onLayout}
        >
            <SidebarSectionsList />
        </View>
    );
}

const WrappedSidebarLinksData = Sentry.withProfiler(SidebarLinksData);

export default WrappedSidebarLinksData;
```

(The existing `useCallback`/`useRef` telemetry code is kept verbatim — the no-manual-memoization rule applies to new code; this file's span logic is preserved, not rewritten. `insets` stays in props so `BaseSidebarScreen` needs no change; if the unused-prop lint complains, remove the prop here AND the `insets={insets}` argument in `BaseSidebarScreen.tsx:67`.)

- [ ] **Step 3: Migrate `NavigationTabBar` to the new context**

In `src/components/Navigation/NavigationTabBar/index.tsx` replace:

```tsx
import {useSidebarOrderedReportsState} from '@hooks/useSidebarOrderedReports';
```

with:

```tsx
import {useSidebarSectionsState} from '@hooks/useSidebarSections';
```

and `const {chatTabBrickRoad} = useSidebarOrderedReportsState();` with `const {chatTabBrickRoad} = useSidebarSectionsState();`.

- [ ] **Step 4: Full checks and commit**

```bash
npx prettier --write src/libs/Navigation/AppNavigator/AuthScreens.tsx src/pages/inbox/sidebar/SidebarLinksData.tsx src/components/Navigation/NavigationTabBar/index.tsx
npm run typecheck-tsgo
npm run lint-changed
npm run react-compiler-compliance-check check-changed
git add -A src/
git commit -m "Swap LHN to sectioned Slack-like sidebar

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Expected: typecheck and compiler check pass. Lint: ignore the known false `@lwc/lwc/no-async-await` worktree artifact; fix anything else.

---

### Task 5: Browser smoke test

**Files:** none (verification only)

**Interfaces:**
- Consumes: the wired-up app from Task 4.
- Produces: confirmed-working POC; screenshots for the demo.

- [ ] **Step 1: Start the dev server and load the app**

Use the `/playwright-app-testing` skill (dev server: `npm run web`, app at `https://dev.new.expensify.com:8082/`).

- [ ] **Step 2: Verify against this checklist**

1. Sidebar shows section headers in order: Pinned & Attention, Needs attention, Drafts, Channels, Direct messages, Archived (empty sections hidden; Archived collapsed by default).
2. DMs (1:1 chats, group chats, Concierge) appear under Direct messages; rooms/workspace chats/expense reports under Channels.
3. Clicking a section header collapses it (rows disappear, header stays); clicking again expands. Collapsed section with unreads shows a count.
4. Clicking a row opens that report; the focused row is highlighted.
5. A pinned report appears under Pinned & Attention.
6. Rows with unread messages render bold.
7. The Inbox tab-bar dot (brick road) still appears when a report has errors.

- [ ] **Step 3: Fix anything broken, re-verify, commit fixes**

```bash
git add -A src/
git commit -m "Fix sectioned sidebar issues found in browser smoke test

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(Skip the commit if nothing needed fixing.)

---

## Deferred (next session, not in this plan)

Perf measurement — React Profiler exports on `main` vs this branch (cold load, incoming-message tick, report switch) compared via the react-profiler-eval flow on a large account. Run it once the POC is visually confirmed.
