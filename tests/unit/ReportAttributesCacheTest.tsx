/* eslint-disable @typescript-eslint/naming-convention */
/**
 * What the report attributes hold for given Onyx data: names, errors, RBR/GBR and their propagation to parent chats.
 */

import createReportAttributesComputer from '@libs/computeReportAttributes';

import CONST from '@src/CONST';
import IntlStore from '@src/languages/IntlStore';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, ReportActions} from '@src/types/onyx';

import type {OnyxCollection} from 'react-native-onyx';

import Onyx from 'react-native-onyx';

import {createRandomReport} from '../utils/collections/reports';
import createRandomTransaction from '../utils/collections/transaction';
import readReportAttributes from '../utils/readReportAttributes';
import {getFakeReportAction} from '../utils/ReportTestUtils';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';

beforeAll(() => {
    Onyx.init({keys: ONYXKEYS});
});

beforeEach(async () => {
    await Onyx.clear();
});

describe('ReportAttributesCache', () => {
    beforeAll(async () => {
        await IntlStore.load(CONST.LOCALES.EN);
        await waitForBatchedUpdates();
    });

    beforeEach(async () => {
        await Onyx.set(ONYXKEYS.RAM_ONLY_ARE_TRANSLATIONS_LOADING, false);
        await waitForBatchedUpdates();
    });

    const mockReport: Report = {
        reportID: `test_1`,
        reportName: 'Test Report',
        type: 'chat',
        chatType: CONST.REPORT.CHAT_TYPE.POLICY_ROOM,
        lastVisibleActionCreated: '2023-01-01T00:00:00.000Z',
        lastMessageText: 'Test message',
        lastActorAccountID: 1,
        lastMessageHtml: '<p>Test message</p>',
        policyID: '123',
        ownerAccountID: 1,
        stateNum: CONST.REPORT.STATE_NUM.OPEN,
        statusNum: CONST.REPORT.STATUS_NUM.OPEN,
    };

    // A DM has no stored name, so its name is built from the other participant's display name.
    const mockDMReport: Report = {
        reportID: 'dm_1',
        type: CONST.REPORT.TYPE.CHAT,
        lastVisibleActionCreated: '2023-01-01T00:00:00.000Z',
        lastMessageText: 'Test message',
        ownerAccountID: 1,
        participants: {'1': {notificationPreference: 'always'}},
        stateNum: CONST.REPORT.STATE_NUM.OPEN,
        statusNum: CONST.REPORT.STATUS_NUM.OPEN,
    };

    it('returns empty reports when dependencies are not set', async () => {
        await waitForBatchedUpdates();
        const derivedReportAttributes = await readReportAttributes();
        expect(derivedReportAttributes).toMatchObject({
            reports: {},
        });
    });

    it('computes report attributes when reports are set', async () => {
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${mockReport.reportID}`, mockReport);
        await waitForBatchedUpdates();

        const derivedReportAttributes = await readReportAttributes();

        expect(derivedReportAttributes).toMatchObject({
            reports: {
                [mockReport.reportID]: {
                    reportName: mockReport.reportName,
                },
            },
        });
    });

    it('should clear the report attributes when the report is cleared', async () => {
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${mockReport.reportID}`, mockReport);
        await waitForBatchedUpdates();

        let derivedReportAttributes = await readReportAttributes();

        expect(derivedReportAttributes).toMatchObject({
            reports: {
                [mockReport.reportID]: {
                    reportName: mockReport.reportName,
                },
            },
        });

        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${mockReport.reportID}`, null);

        derivedReportAttributes = await readReportAttributes();

        expect(derivedReportAttributes).toMatchObject({
            reports: {},
        });
    });

    it('updates when locale changes', async () => {
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${mockReport.reportID}`, mockReport);
        await IntlStore.load(CONST.LOCALES.ES);
        // Derived recomputes are coalesced onto a microtask; pump it so the locale change is applied.
        await waitForBatchedUpdates();

        const derivedReportAttributes = await readReportAttributes();

        expect(derivedReportAttributes).toMatchObject({
            locale: 'es',
        });
    });

    it('should contain both report attributes update when there are report and transaction updates', async () => {
        // One compute keeps its baselines between calls, like the cache does between writes.
        const computeReportAttributes = createReportAttributesComputer();
        await waitForBatchedUpdates();
        // Given 2 reports and 1 transaction
        const reportID1 = '0';
        const reportID2 = '1';
        const reports: OnyxCollection<Report> = {
            [`${ONYXKEYS.COLLECTION.REPORT}${reportID1}`]: createRandomReport(Number(reportID1), undefined),
            [`${ONYXKEYS.COLLECTION.REPORT}${reportID2}`]: createRandomReport(Number(reportID2), undefined),
        };
        const transaction = createRandomTransaction(1);

        // When the report attributes are recomputed with both report and transaction updates
        computeReportAttributes(
            [
                reports,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
            ],
            {},
        );
        const reportAttributesComputedValue = computeReportAttributes(
            [
                reports,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
            ],
            {
                sourceValues: {
                    [ONYXKEYS.COLLECTION.REPORT]: {
                        [`${ONYXKEYS.COLLECTION.REPORT}${reportID1}`]: reports[`${ONYXKEYS.COLLECTION.REPORT}${reportID1}`],
                    },
                    [ONYXKEYS.COLLECTION.TRANSACTION]: {
                        [`${ONYXKEYS.COLLECTION.TRANSACTION}${transaction.transactionID}`]: transaction,
                    },
                },
            },
        ).reports;

        // Then the computed report attributes should contain both reports
        expect(Object.keys(reportAttributesComputedValue)).toEqual([reportID1, reportID2]);
    });

    it('should not recompute reportAttributes when personalDetailsList changes without displayName change', async () => {
        // Set up initial state with report and personalDetailsList
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${mockReport.reportID}`, mockReport);
        await Onyx.set(ONYXKEYS.PERSONAL_DETAILS_LIST, {
            '1': {
                accountID: 1,
                displayName: 'John Doe',
                login: 'john.doe@example.com',
                firstName: 'John',
                lastName: 'Doe',
            },
        });
        await waitForBatchedUpdates();

        // Get initial computed value
        const initialDerivedReportAttributes = await readReportAttributes();

        // Spy on generateReportAttributes - this function should NOT be called
        // when the optimization kicks in and skips the computation
        const generateReportAttributesSpy = jest.spyOn(require('@libs/ReportUtils'), 'generateReportAttributes');

        // Change only the login (not displayName) - this should trigger the optimization
        await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {
            '1': {
                login: 'john.newemail@example.com',
            },
        });
        await waitForBatchedUpdates();

        // The generateReportAttributes function should not have been called
        // because the optimization should have returned early
        expect(generateReportAttributesSpy).not.toHaveBeenCalled();

        // Get the computed value after login change
        const derivedReportAttributesAfterLoginChange = await readReportAttributes();

        // And the values should be preserved correctly
        expect(derivedReportAttributesAfterLoginChange).toEqual(initialDerivedReportAttributes);

        generateReportAttributesSpy.mockRestore();
    });

    it('should recompute reportAttributes when personalDetailsList displayName changes', async () => {
        // Given a DM whose name comes from the other participant's display name
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${mockDMReport.reportID}`, mockDMReport);
        await Onyx.set(ONYXKEYS.PERSONAL_DETAILS_LIST, {
            '1': {
                accountID: 1,
                displayName: 'John Doe',
                login: 'john.doe@example.com',
                firstName: 'John',
                lastName: 'Doe',
            },
        });
        await waitForBatchedUpdates();

        // Get initial computed value reference
        const initialDerivedReportAttributes = await readReportAttributes();

        // Change the displayName - this should trigger full recomputation
        await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {
            '1': {
                displayName: 'Jane Doe',
                firstName: 'Jane',
            },
        });
        await waitForBatchedUpdates();

        // Get the computed value after displayName change
        const derivedReportAttributesAfterDisplayNameChange = await readReportAttributes();

        // Then the DM name follows the new display name
        expect(derivedReportAttributesAfterDisplayNameChange).not.toBe(initialDerivedReportAttributes);
        expect(derivedReportAttributesAfterDisplayNameChange.reports[mockDMReport.reportID]?.reportName).toContain('Jane');
        expect(initialDerivedReportAttributes.reports[mockDMReport.reportID]?.reportName).toContain('John');
    });

    it('should only recompute reports that reference the changed accountID when a display name changes', () => {
        // One compute keeps its baselines between calls, like the cache does between writes.
        const computeReportAttributes = createReportAttributesComputer();
        // Two reports: one owned by account 2, the other owned by account 3.
        const reports: OnyxCollection<Report> = {
            [`${ONYXKEYS.COLLECTION.REPORT}ref_report`]: {...mockDMReport, reportID: 'ref_report', ownerAccountID: 2, participants: {'2': {notificationPreference: 'always'}}},
            [`${ONYXKEYS.COLLECTION.REPORT}unrelated_report`]: {...mockReport, reportID: 'unrelated_report', policyID: '456', ownerAccountID: 3},
        };
        const personalDetails = {
            '2': {accountID: 2, displayName: 'Alice', login: 'alice@example.com'},
            '3': {accountID: 3, displayName: 'Bob', login: 'bob@example.com'},
        };
        const changedPersonalDetails = {...personalDetails, '2': {accountID: 2, displayName: 'Alice Smith', login: 'alice@example.com'}};

        // PERSONAL_DETAILS_LIST is a valid runtime source key (hasKeyTriggeredCompute reads it), but the
        // sourceValues type only models collection keys, so there's no representable type for this marker.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- non-collection source keys aren't modeled by DerivedSourceValues
        const personalDetailsSource = {
            sourceValues: {[ONYXKEYS.PERSONAL_DETAILS_LIST]: true},
            triggeredKeys: new Set([ONYXKEYS.PERSONAL_DETAILS_LIST]),
        } as unknown as Parameters<ReturnType<typeof createReportAttributesComputer>>[1];

        // Reset the module-level diff baseline (no sourceValues clears it) so the seed below is deterministic.
        computeReportAttributes(
            [
                reports,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                personalDetails,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
            ],
            {},
        );
        // First personal-details compute computes both reports (no prior currentValue) and seeds the baseline.
        const initial = computeReportAttributes(
            [
                reports,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                personalDetails,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
            ],
            personalDetailsSource,
        );
        // Changing only account 2's display name should recompute just its report, carrying the other by reference.
        const afterChange = computeReportAttributes(
            [
                reports,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                changedPersonalDetails,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
            ],
            {...personalDetailsSource, currentValue: initial},
        );

        // A recomputed report whose name changed gets a new object; an untouched report is carried over by reference.
        expect(afterChange.reports.ref_report).not.toBe(initial.reports.ref_report);
        expect(afterChange.reports.ref_report?.reportName).toContain('Alice Smith');
        expect(afterChange.reports.unrelated_report).toBe(initial.reports.unrelated_report);
    });

    describe('reportErrors', () => {
        it('returns empty errors when no errors exist', async () => {
            const report = createRandomReport(1, undefined);
            await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${report.reportID}`, report);
            await waitForBatchedUpdates();

            const derivedReportAttributes = await readReportAttributes();
            expect(derivedReportAttributes?.reports[report.reportID].reportErrors).toEqual({});
        });

        it('combines report error fields with report action errors', async () => {
            const report = {
                ...createRandomReport(1, undefined),
                errorFields: {
                    field1: {
                        '1234567890': 'Error message 1',
                    },
                },
            };

            const reportActions: ReportActions = {
                '1': {
                    reportActionID: '1',
                    actionName: 'ADDCOMMENT',
                    created: '2024-01-01',
                    message: [{html: 'some content', text: 'some content', type: 'text'}],
                    errors: {
                        field2: {
                            '1234567891': 'Error message 2',
                        },
                    },
                },
            };

            await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${report.reportID}`, report);
            await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.reportID}`, reportActions);

            await waitForBatchedUpdates();

            const derivedReportAttributes = await readReportAttributes();

            await waitForBatchedUpdates();

            expect(derivedReportAttributes?.reports[report.reportID].reportErrors).toEqual({
                '1234567890': 'Error message 1',
                '1234567891': 'Error message 2',
            });
        });

        it('handles multiple error sources', async () => {
            const report = {
                ...createRandomReport(1, undefined),
                errorFields: {
                    field1: {
                        '1234567890': 'Error message 1',
                    },
                    field2: {
                        '1234567891': 'Error message 2',
                    },
                },
            };

            const reportActions: ReportActions = {
                '1': {
                    reportActionID: '1',
                    actionName: 'ADDCOMMENT',
                    created: '2024-01-01',
                    message: [{html: 'some content', text: 'some content', type: 'text'}],
                    errors: {
                        field3: {
                            '1234567892': 'Error message 3',
                        },
                    },
                },
                '2': {
                    reportActionID: '2',
                    actionName: 'ADDCOMMENT',
                    created: '2024-01-01',
                    message: [{html: 'some content', text: 'some content', type: 'text'}],
                    errors: {
                        field4: {
                            '1234567893': 'Error message 4',
                        },
                    },
                },
            };

            await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${report.reportID}`, report);
            await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.reportID}`, reportActions);
            await waitForBatchedUpdates();

            const derivedReportAttributes = await readReportAttributes();
            expect(derivedReportAttributes?.reports[report.reportID].reportErrors).toEqual({
                '1234567890': 'Error message 1',
                '1234567891': 'Error message 2',
                '1234567892': 'Error message 3',
                '1234567893': 'Error message 4',
            });
        });

        it('handles empty error objects in sources', async () => {
            const report = {
                ...createRandomReport(1, undefined),
                errorFields: {
                    field1: {},
                    field2: {
                        '1234567890': 'Error message 1',
                    },
                },
            };

            const reportActions: ReportActions = {
                '1': {
                    reportActionID: '1',
                    actionName: 'ADDCOMMENT',
                    created: '2024-01-01',
                    message: [{html: 'some content', text: 'some content', type: 'text'}],
                    errors: {},
                },
                '2': {
                    reportActionID: '2',
                    actionName: 'ADDCOMMENT',
                    created: '2024-01-01',
                    message: [{html: 'some content', text: 'some content', type: 'text'}],
                    errors: {
                        field3: {
                            '1234567891': 'Error message 2',
                        },
                    },
                },
            };

            await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${report.reportID}`, report);
            await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.reportID}`, reportActions);
            await waitForBatchedUpdates();

            const derivedReportAttributes = await readReportAttributes();
            expect(derivedReportAttributes?.reports[report.reportID].reportErrors).toEqual({
                '1234567890': 'Error message 1',
                '1234567891': 'Error message 2',
            });
        });
    });

    describe('RBR handling for support tickets', () => {
        it('does not show a Fix badge for a support ticket error', async () => {
            const supportTicket = {
                ...createRandomReport(1, undefined),
                type: CONST.REPORT.TYPE.SUPPORT_TICKET,
                errorFields: {
                    createReport: {
                        '1234567890': 'Support ticket error',
                    },
                },
            };

            await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${supportTicket.reportID}`, supportTicket);
            await waitForBatchedUpdates();

            const derivedReportAttributes = await readReportAttributes();
            expect(derivedReportAttributes?.reports[supportTicket.reportID]).toMatchObject({
                reportErrors: {'1234567890': 'Support ticket error'},
            });
            expect(derivedReportAttributes?.reports[supportTicket.reportID].brickRoadStatus).toBeUndefined();
            expect(derivedReportAttributes?.reports[supportTicket.reportID].actionBadge).toBeUndefined();
        });
    });

    describe('RBR propagation for IOU reports', () => {
        it('should correctly propagate and resolve RBR for IOU reports', async () => {
            const parentReport = createRandomReport(2, undefined);
            const iouReport = {
                ...createRandomReport(2, undefined),
                chatReportID: parentReport.reportID,
                ownerAccountID: 1,
                type: CONST.REPORT.TYPE.IOU,
                errorFields: {
                    generic: {
                        '1234567890': 'Generic error',
                    },
                },
            };

            // --- Setup ---
            // Set the reports in Onyx.
            await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${parentReport.reportID}`, parentReport);
            await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${iouReport.reportID}`, iouReport);
            await waitForBatchedUpdates();

            // --- Assertion 1: Propagation Works ---
            // The parent report should have an error RBR because the child IOU report has an error.
            let derivedReportAttributes = await readReportAttributes();
            expect(derivedReportAttributes?.reports[parentReport.reportID].brickRoadStatus).toBe(CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR);

            // --- Action: Resolve Error ---
            // Remove the error from the IOU report. This will trigger a partial update.
            await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${iouReport.reportID}`, {errorFields: null});
            await waitForBatchedUpdates();

            // --- Assertion 2: RBR is Cleared ---
            // The parent report's RBR should be cleared now that the child's error is gone.
            derivedReportAttributes = await readReportAttributes();
            expect(derivedReportAttributes?.reports[parentReport.reportID].brickRoadStatus).toBeUndefined();
        });

        it('should not propagate RBR from an IOU report whose preview action in the chat was deleted', async () => {
            // Given a chat and an IOU report with an error, whose preview action in the chat was deleted
            const parentReport = {...createRandomReport(3, undefined), reportID: '700', type: CONST.REPORT.TYPE.CHAT};
            const previewAction = getFakeReportAction(701, {reportActionID: '701', actionName: CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW, childReportID: '702'});
            const deletedPreviewAction = {...previewAction, message: [{type: 'COMMENT', html: '', text: '', deleted: '2024-01-01 10:00:00'}]};
            const iouReport = {
                ...createRandomReport(4, undefined),
                reportID: '702',
                chatReportID: parentReport.reportID,
                parentReportID: parentReport.reportID,
                parentReportActionID: previewAction.reportActionID,
                ownerAccountID: 1,
                type: CONST.REPORT.TYPE.IOU,
                errorFields: {generic: {'1234567890': 'Generic error'}},
            };
            await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${parentReport.reportID}`, {[deletedPreviewAction.reportActionID]: deletedPreviewAction});
            await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${parentReport.reportID}`, parentReport);
            await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${iouReport.reportID}`, iouReport);
            await waitForBatchedUpdates();

            // Then the chat does not show the error, since it has no surface left to fix it from
            let derivedReportAttributes = await readReportAttributes();
            expect(derivedReportAttributes?.reports[parentReport.reportID].brickRoadStatus).toBeUndefined();

            // When the preview action is restored
            await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${parentReport.reportID}`, {[previewAction.reportActionID]: previewAction});
            await waitForBatchedUpdates();

            // Then the chat shows the child's error
            derivedReportAttributes = await readReportAttributes();
            expect(derivedReportAttributes?.reports[parentReport.reportID].brickRoadStatus).toBe(CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR);
        });
    });
});
