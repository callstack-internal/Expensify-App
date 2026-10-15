import {render, screen} from '@testing-library/react-native';

import ComposeProviders from '@components/ComposeProviders';
import {LocaleContextProvider} from '@components/LocaleContextProvider';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import Text from '@components/Text';

import useIsApproverOfOutstandingPolicyReports from '@hooks/useIsApproverOfOutstandingPolicyReports';
import useOutstandingReports from '@hooks/useOutstandingReports';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report} from '@src/types/onyx';

import React from 'react';
import {View} from 'react-native';
import Onyx from 'react-native-onyx';
import {measureAsyncFunction, measureRenders} from 'reassure';

import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';

const CONSUMER_COUNT = 10;
const WRITES_PER_SCENARIO = 10;
const REPORT_COUNT = 5000;
const POLICY_COUNT = 50;
const CURRENT_USER_ACCOUNT_ID = 1;
const APPROVER_ACCOUNT_ID = 2;
const POLICY_ID = 'policy0';

// Report IDs by role in the generated collection: even IDs are chats, odd IDs are expense reports spread over the policies in turn
const CHAT_REPORT_ID = 2;
const OTHER_POLICY_OUTSTANDING_REPORT_ID = 5;
const OUTSTANDING_REPORT_ID = 101;

function createReport(reportID: number): Report {
    if (reportID % 2 === 0) {
        return {
            reportID: String(reportID),
            type: CONST.REPORT.TYPE.CHAT,
            chatType: CONST.REPORT.CHAT_TYPE.POLICY_ROOM,
            policyID: `policy${Math.floor(reportID / 2) % POLICY_COUNT}`,
            reportName: `Chat ${reportID}`,
        };
    }
    const isApproved = reportID % 3 === 0;
    return {
        reportID: String(reportID),
        type: CONST.REPORT.TYPE.EXPENSE,
        policyID: `policy${Math.floor(reportID / 2) % POLICY_COUNT}`,
        ownerAccountID: CURRENT_USER_ACCOUNT_ID,
        managerID: APPROVER_ACCOUNT_ID,
        stateNum: isApproved ? CONST.REPORT.STATE_NUM.APPROVED : CONST.REPORT.STATE_NUM.SUBMITTED,
        statusNum: isApproved ? CONST.REPORT.STATUS_NUM.APPROVED : CONST.REPORT.STATUS_NUM.SUBMITTED,
        reportName: `Expense ${reportID}`,
    };
}

const reports = Object.fromEntries(Array.from({length: REPORT_COUNT}, (value, index) => [`${ONYXKEYS.COLLECTION.REPORT}${index + 1}`, createReport(index + 1)]));

/** Passed as the reassure wrapper so the providers sit outside the profiler and render counts are the consumers' own */
function Providers({children}: {children: React.ReactNode}) {
    return <ComposeProviders components={[OnyxListItemProvider, LocaleContextProvider]}>{children}</ComposeProviders>;
}

/** Reads every policy's outstanding reports, like the move-expense report picker and the expense header actions */
function MoveExpenseConsumer() {
    const outstandingReports = useOutstandingReports(undefined, POLICY_ID, CURRENT_USER_ACCOUNT_ID, false);
    return <Text testID="MoveExpenseConsumer">{outstandingReports.length}</Text>;
}

/** Reads one policy's outstanding reports, like the workspace overview and leave-workspace checks */
function ApproverConsumer() {
    const isApprover = useIsApproverOfOutstandingPolicyReports(POLICY_ID);
    return <Text testID="ApproverConsumer">{isApprover ? 'approver' : 'member'}</Text>;
}

/** Neither consumer reads the report attributes, so their re-renders isolate outstanding reports churn */
function AllConsumers() {
    return (
        <View>
            {Array.from({length: CONSUMER_COUNT}, (value, index) => (
                <React.Fragment key={index}>
                    <MoveExpenseConsumer />
                    <ApproverConsumer />
                </React.Fragment>
            ))}
        </View>
    );
}

function SinglePolicyConsumers() {
    return (
        <View>
            {Array.from({length: CONSUMER_COUNT}, (value, index) => (
                <ApproverConsumer key={index} />
            ))}
        </View>
    );
}

async function seed() {
    await Onyx.multiSet({
        ...reports,
        [ONYXKEYS.SESSION]: {accountID: APPROVER_ACCOUNT_ID, email: 'approver@test.com'},
    });
    await waitForBatchedUpdates();
}

async function renameChat(label: string) {
    for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${CHAT_REPORT_ID}`, {reportName: `Chat ${label}-${index}`});
        await waitForBatchedUpdates();
    }
}

describe('Outstanding reports consumers on report writes', () => {
    beforeAll(async () => {
        Onyx.init({keys: ONYXKEYS});
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        require('@userActions/OnyxDerived').default();
        await waitForBatchedUpdates();
    });

    afterEach(async () => {
        await Onyx.clear();
        await waitForBatchedUpdates();
    });

    test('[OutstandingReportsByPolicyID] should re-render consumers when a chat is renamed among 5000 reports', async () => {
        // Given 10 consumers of every policy and 10 of one policy over 5000 reports
        await seed();

        // Reassure runs the scenario several times against one seeded Onyx, so every run writes a name that doesn't exist yet
        let run = 0;
        const scenario = async () => {
            await screen.findAllByTestId('ApproverConsumer');

            // When a chat is renamed, which leaves every policy's outstanding reports unchanged
            await renameChat(`renders ${run}`);
            run++;
        };

        // Then reassure measures how many re-renders the unrelated writes cause
        await measureRenders(<AllConsumers />, {scenario, wrapper: Providers});
    });

    test('[OutstandingReportsByPolicyID] should re-render single policy consumers when another policy outstanding report changes', async () => {
        // Given 10 consumers of one policy over 5000 reports
        await seed();

        let run = 0;
        const scenario = async () => {
            await screen.findAllByTestId('ApproverConsumer');

            // When an outstanding report of another policy changes, which leaves this policy's outstanding reports unchanged
            for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
                await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${OTHER_POLICY_OUTSTANDING_REPORT_ID}`, {total: run * WRITES_PER_SCENARIO + index + 1});
                await waitForBatchedUpdates();
            }
            run++;
        };

        // Then reassure measures how many re-renders the other policy's writes cause
        await measureRenders(<SinglePolicyConsumers />, {scenario, wrapper: Providers});
    });

    test('[OutstandingReportsByPolicyID] should re-render consumers when a report of their policy is approved and reopened', async () => {
        // Given 10 consumers of every policy and 10 of one policy over 5000 reports
        await seed();

        let isApproved = false;
        const scenario = async () => {
            await screen.findAllByTestId('ApproverConsumer');

            // When an outstanding report of the consumers' policy is approved and reopened in turn, so it leaves the outstanding reports and comes back
            for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
                isApproved = !isApproved;
                await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${OUTSTANDING_REPORT_ID}`, {
                    stateNum: isApproved ? CONST.REPORT.STATE_NUM.APPROVED : CONST.REPORT.STATE_NUM.SUBMITTED,
                    statusNum: isApproved ? CONST.REPORT.STATUS_NUM.APPROVED : CONST.REPORT.STATUS_NUM.SUBMITTED,
                });
                await waitForBatchedUpdates();
            }
        };

        // Then reassure measures the cost of a real change, which both versions have to pay
        await measureRenders(<AllConsumers />, {scenario, wrapper: Providers});
    });

    test('[OutstandingReportsByPolicyID] should process chat renames among 5000 reports', async () => {
        // Given every consumer mounted over 5000 reports
        await seed();
        render(
            <Providers>
                <AllConsumers />
            </Providers>,
        );
        await screen.findAllByTestId('ApproverConsumer');

        // When a chat is renamed repeatedly
        let run = 0;
        const writeRenames = async () => {
            await renameChat(`timed ${run}`);
            run++;
        };

        // Then reassure times the whole write loop, including work done outside React renders such as derived computes and their writes
        await measureAsyncFunction(writeRenames);
    });
});
