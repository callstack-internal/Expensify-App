import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import {createMoveExpenseReportNVPSelector, getStableReportSelector, outstandingReportsByPolicyIDSelector, policyChatRoomsSelector} from '@src/selectors/Report';
import type {Report} from '@src/types/onyx';

describe('policyChatRoomsSelector', () => {
    const REPORT_KEY_PREFIX = ONYXKEYS.COLLECTION.REPORT;
    const REPORT_NVP_KEY_PREFIX = ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS;
    const policyID = 'policy1';
    const otherPolicyID = 'policy2';
    const emptyReportNameValuePairs = {};

    const policyRoom = {reportID: '1', policyID, chatType: CONST.REPORT.CHAT_TYPE.POLICY_ROOM} as Report;
    const policyAdmins = {reportID: '2', policyID, chatType: CONST.REPORT.CHAT_TYPE.POLICY_ADMINS} as Report;
    const policyExpenseChat = {reportID: '3', policyID, chatType: CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT} as Report;
    const invoiceRoom = {reportID: '4', policyID, chatType: CONST.REPORT.CHAT_TYPE.INVOICE} as Report;
    const otherPolicyRoom = {reportID: '5', policyID: otherPolicyID, chatType: CONST.REPORT.CHAT_TYPE.POLICY_ROOM} as Report;
    const selfDM = {reportID: '6', policyID, chatType: CONST.REPORT.CHAT_TYPE.SELF_DM} as Report;
    const groupChat = {reportID: '7', policyID, chatType: CONST.REPORT.CHAT_TYPE.GROUP} as Report;
    const expenseReport = {reportID: '8', policyID, type: CONST.REPORT.TYPE.EXPENSE} as Report;

    it('returns an empty array when policyID is undefined', () => {
        expect(policyChatRoomsSelector(undefined, emptyReportNameValuePairs)({[`${REPORT_KEY_PREFIX}1`]: policyRoom})).toEqual([]);
    });

    it('returns an empty array when reports is undefined', () => {
        expect(policyChatRoomsSelector(policyID, emptyReportNameValuePairs)(undefined)).toEqual([]);
    });

    it('returns an empty array when no reports match the policyID', () => {
        const reports = {[`${REPORT_KEY_PREFIX}5`]: otherPolicyRoom};
        expect(policyChatRoomsSelector(policyID, emptyReportNameValuePairs)(reports)).toEqual([]);
    });

    it('includes chat rooms and policy expense chats for the given policy', () => {
        const reports = {
            [`${REPORT_KEY_PREFIX}1`]: policyRoom,
            [`${REPORT_KEY_PREFIX}2`]: policyAdmins,
            [`${REPORT_KEY_PREFIX}3`]: policyExpenseChat,
            [`${REPORT_KEY_PREFIX}4`]: invoiceRoom,
        };
        const result = policyChatRoomsSelector(policyID, emptyReportNameValuePairs)(reports);
        expect(result).toHaveLength(4);
        expect(result.map((report) => report.reportID).sort()).toEqual(['1', '2', '3', '4']);
    });

    it('excludes reports that are not chat rooms or policy expense chats', () => {
        const reports = {
            [`${REPORT_KEY_PREFIX}6`]: selfDM,
            [`${REPORT_KEY_PREFIX}7`]: groupChat,
            [`${REPORT_KEY_PREFIX}8`]: expenseReport,
        };
        expect(policyChatRoomsSelector(policyID, emptyReportNameValuePairs)(reports)).toEqual([]);
    });

    it('excludes reports belonging to a different policy', () => {
        const reports = {
            [`${REPORT_KEY_PREFIX}1`]: policyRoom,
            [`${REPORT_KEY_PREFIX}5`]: otherPolicyRoom,
        };
        const result = policyChatRoomsSelector(policyID, emptyReportNameValuePairs)(reports);
        expect(result).toEqual([policyRoom]);
    });

    it('skips missing entries in the collection', () => {
        const reports = {
            [`${REPORT_KEY_PREFIX}1`]: policyRoom,
            [`${REPORT_KEY_PREFIX}_missing`]: undefined,
        };
        const result = policyChatRoomsSelector(policyID, emptyReportNameValuePairs)(reports);
        expect(result).toEqual([policyRoom]);
    });

    it('excludes archived reports', () => {
        const reports = {
            [`${REPORT_KEY_PREFIX}1`]: policyRoom,
            [`${REPORT_KEY_PREFIX}2`]: policyAdmins,
        };
        const archivedReportNameValuePairs = {[`${REPORT_NVP_KEY_PREFIX}1`]: {private_isArchived: '2024-01-01'}};
        const result = policyChatRoomsSelector(policyID, archivedReportNameValuePairs)(reports);
        expect(result).toEqual([policyAdmins]);
    });

    it('excludes rooms the user has left (closed reports)', () => {
        const leftRoom = {
            reportID: '1',
            policyID,
            chatType: CONST.REPORT.CHAT_TYPE.POLICY_ROOM,
            statusNum: CONST.REPORT.STATUS_NUM.CLOSED,
            stateNum: CONST.REPORT.STATE_NUM.APPROVED,
        } as Report;
        const reports = {
            [`${REPORT_KEY_PREFIX}1`]: leftRoom,
            [`${REPORT_KEY_PREFIX}2`]: policyAdmins,
        };
        const result = policyChatRoomsSelector(policyID, emptyReportNameValuePairs)(reports);
        expect(result).toEqual([policyAdmins]);
    });
});

describe('createMoveExpenseReportNVPSelector', () => {
    const currentReport = {reportID: '1'} as Report;
    const outstandingReport = {reportID: '2'} as Report;
    const nonArchivedOutstandingReport = {reportID: '3'} as Report;
    const archivedAt = '2024-01-01';
    const outstandingReportsByPolicyID = {
        policy1: {
            [`${ONYXKEYS.COLLECTION.REPORT}${outstandingReport.reportID}`]: outstandingReport,
            [`${ONYXKEYS.COLLECTION.REPORT}${nonArchivedOutstandingReport.reportID}`]: nonArchivedOutstandingReport,
        },
    };

    it('selects archived NVPs for current and outstanding reports only', () => {
        const currentReportNVPKey = `${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${currentReport.reportID}`;
        const outstandingReportNVPKey = `${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${outstandingReport.reportID}`;
        const unrelatedReportNVPKey = `${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}4`;
        const reportNameValuePairs = {
            [currentReportNVPKey]: {private_isArchived: archivedAt},
            [outstandingReportNVPKey]: {private_isArchived: archivedAt},
            [`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${nonArchivedOutstandingReport.reportID}`]: {},
            [unrelatedReportNVPKey]: {private_isArchived: archivedAt},
        };

        expect(createMoveExpenseReportNVPSelector(outstandingReportsByPolicyID, currentReport.reportID)(reportNameValuePairs)).toEqual({
            [currentReportNVPKey]: {private_isArchived: archivedAt},
            [outstandingReportNVPKey]: {private_isArchived: archivedAt},
        });
    });
});

describe('outstandingReportsByPolicyIDSelector', () => {
    const REPORT_KEY_PREFIX = ONYXKEYS.COLLECTION.REPORT;
    const policyID = 'policy1';
    const otherPolicyID = 'policy2';

    const openReport = {reportID: '1', policyID, type: CONST.REPORT.TYPE.EXPENSE, stateNum: CONST.REPORT.STATE_NUM.OPEN} as Report;
    const submittedReport = {reportID: '2', policyID, type: CONST.REPORT.TYPE.EXPENSE, stateNum: CONST.REPORT.STATE_NUM.SUBMITTED} as Report;
    const reportWithoutState = {reportID: '3', policyID, type: CONST.REPORT.TYPE.EXPENSE} as Report;
    const otherPolicyReport = {reportID: '4', policyID: otherPolicyID, type: CONST.REPORT.TYPE.EXPENSE, stateNum: CONST.REPORT.STATE_NUM.OPEN} as Report;
    const approvedReport = {reportID: '5', policyID, type: CONST.REPORT.TYPE.EXPENSE, stateNum: CONST.REPORT.STATE_NUM.APPROVED} as Report;
    const deletingReport = {
        reportID: '6',
        policyID,
        type: CONST.REPORT.TYPE.EXPENSE,
        stateNum: CONST.REPORT.STATE_NUM.OPEN,
        pendingFields: {preview: CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE},
    } as Report;
    const iouReport = {reportID: '7', policyID, type: CONST.REPORT.TYPE.IOU, stateNum: CONST.REPORT.STATE_NUM.OPEN} as Report;
    const reportWithoutPolicy = {reportID: '8', type: CONST.REPORT.TYPE.EXPENSE, stateNum: CONST.REPORT.STATE_NUM.OPEN} as Report;
    const chatReport = {reportID: '9', policyID, chatType: CONST.REPORT.CHAT_TYPE.POLICY_ROOM, reportName: 'Before'} as Report;

    const buildReports = (overrides: Record<string, Report | undefined> = {}) => ({
        [`${REPORT_KEY_PREFIX}1`]: openReport,
        [`${REPORT_KEY_PREFIX}2`]: submittedReport,
        [`${REPORT_KEY_PREFIX}3`]: reportWithoutState,
        [`${REPORT_KEY_PREFIX}4`]: otherPolicyReport,
        [`${REPORT_KEY_PREFIX}5`]: approvedReport,
        [`${REPORT_KEY_PREFIX}6`]: deletingReport,
        [`${REPORT_KEY_PREFIX}7`]: iouReport,
        [`${REPORT_KEY_PREFIX}8`]: reportWithoutPolicy,
        [`${REPORT_KEY_PREFIX}9`]: chatReport,
        ...overrides,
    });

    it('should return an empty map when there are no reports', () => {
        // Given no report collection, or an empty one
        // When the outstanding reports are selected
        // Then no policy has outstanding reports
        expect(outstandingReportsByPolicyIDSelector(undefined)).toEqual({});
        expect(outstandingReportsByPolicyIDSelector({})).toEqual({});
    });

    it('should group open and submitted expense reports by policy with the same filter as getOutstandingReportsForUser', () => {
        // Given expense reports in every state next to reports that are not outstanding for other reasons
        const reports = buildReports();

        // When the outstanding reports are selected
        // Then only open or submitted expense reports with a policy that are not being deleted are kept, keyed by their collection key under their policy
        expect(outstandingReportsByPolicyIDSelector(reports)).toEqual({
            [policyID]: {
                [`${REPORT_KEY_PREFIX}1`]: openReport,
                [`${REPORT_KEY_PREFIX}2`]: submittedReport,
                [`${REPORT_KEY_PREFIX}3`]: reportWithoutState,
            },
            [otherPolicyID]: {[`${REPORT_KEY_PREFIX}4`]: otherPolicyReport},
        });
    });

    it('should return the same map for the same report collection', () => {
        // Given one report collection
        const reports = buildReports();

        // When the outstanding reports are selected twice, as two mounted consumers do after the same write
        // Then both get the same object, so the map is built once per collection
        expect(outstandingReportsByPolicyIDSelector(reports)).toBe(outstandingReportsByPolicyIDSelector(reports));
    });

    it('should return the previous map when a write leaves every outstanding report unchanged', () => {
        // Given the map built from a report collection
        const before = outstandingReportsByPolicyIDSelector(buildReports());

        // When a new collection only renames a chat and replaces the approved report
        const after = outstandingReportsByPolicyIDSelector(
            buildReports({
                [`${REPORT_KEY_PREFIX}9`]: {...chatReport, reportName: 'After'},
                [`${REPORT_KEY_PREFIX}5`]: {...approvedReport},
            }),
        );

        // Then consumers get the same object back, so they skip the re-render without a deep compare
        expect(after).toBe(before);
    });

    it('should keep the reports of a policy whose outstanding reports did not change', () => {
        // Given the map built from a report collection
        const before = outstandingReportsByPolicyIDSelector(buildReports());

        // When an outstanding report of the other policy changes
        const changedOtherPolicyReport = {...otherPolicyReport, total: 100};
        const after = outstandingReportsByPolicyIDSelector(buildReports({[`${REPORT_KEY_PREFIX}4`]: changedOtherPolicyReport}));

        // Then only that policy gets new reports, so a consumer that reads one policy keeps its reference
        expect(after).not.toBe(before);
        expect(after[policyID]).toBe(before[policyID]);
        expect(after[otherPolicyID]).toEqual({[`${REPORT_KEY_PREFIX}4`]: changedOtherPolicyReport});
    });

    it('should drop a report from its policy once it is approved', () => {
        // Given the map built from a report collection
        const before = outstandingReportsByPolicyIDSelector(buildReports());

        // When the submitted report is approved
        const after = outstandingReportsByPolicyIDSelector(buildReports({[`${REPORT_KEY_PREFIX}2`]: {...submittedReport, stateNum: CONST.REPORT.STATE_NUM.APPROVED}}));

        // Then its policy loses it and the other policy keeps its reports
        expect(after[policyID]).toEqual({
            [`${REPORT_KEY_PREFIX}1`]: openReport,
            [`${REPORT_KEY_PREFIX}3`]: reportWithoutState,
        });
        expect(after[otherPolicyID]).toBe(before[otherPolicyID]);
    });

    it('should remove a policy whose last outstanding report is deleted', () => {
        // Given the map built from a report collection
        outstandingReportsByPolicyIDSelector(buildReports());

        // When the only outstanding report of the other policy is removed
        const after = outstandingReportsByPolicyIDSelector(buildReports({[`${REPORT_KEY_PREFIX}4`]: undefined}));

        // Then that policy is gone from the map
        expect(after).not.toHaveProperty(otherPolicyID);
    });
});

describe('getStableReportSelector', () => {
    const {READ, WRITE, SHARE} = CONST.REPORT.PERMISSIONS;

    it('returns the same permissions reference for content-equal but referentially-new arrays', () => {
        // Onyx merge replaces arrays wholesale even when content is identical, so consecutive
        // report pushes deliver new `permissions` instances. The projection must intern them,
        // otherwise its shallow equality breaks and subscribed subtrees re-render for no reason.
        const first = getStableReportSelector({reportID: '1', permissions: [READ, WRITE]} as Report);
        const second = getStableReportSelector({reportID: '1', permissions: [READ, WRITE]} as Report);
        expect(second?.permissions).toBe(first?.permissions);
    });

    it('shares the interned permissions instance across different reports', () => {
        const first = getStableReportSelector({reportID: '1', permissions: [READ, WRITE]} as Report);
        const second = getStableReportSelector({reportID: '2', permissions: [READ, WRITE]} as Report);
        expect(second?.permissions).toBe(first?.permissions);
    });

    it('returns a different permissions reference when content differs', () => {
        const first = getStableReportSelector({reportID: '1', permissions: [READ, WRITE]} as Report);
        const second = getStableReportSelector({reportID: '1', permissions: [READ, WRITE, SHARE]} as Report);
        expect(second?.permissions).not.toBe(first?.permissions);
        expect(second?.permissions).toEqual([READ, WRITE, SHARE]);
    });

    it('passes undefined permissions through', () => {
        expect(getStableReportSelector({reportID: '1'} as Report)?.permissions).toBeUndefined();
    });
});
