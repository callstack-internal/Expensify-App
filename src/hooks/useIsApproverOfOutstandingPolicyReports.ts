import {isApproverOfOutstandingPolicyReports} from '@libs/ReportUtils';

import useCurrentUserPersonalDetails from './useCurrentUserPersonalDetails';
import {useOutstandingReportsForPolicy} from './useOutstandingReportsByPolicyID';
import usePrivateIsArchivedMap from './usePrivateIsArchivedMap';

/**
 * Whether the current user is the approver of any report in the workspace that is waiting for their approval,
 * including the ones they were assigned to through "Change approver".
 */
function useIsApproverOfOutstandingPolicyReports(policyID: string | undefined): boolean {
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const outstandingReportsForPolicy = useOutstandingReportsForPolicy(policyID);
    const privateIsArchivedMap = usePrivateIsArchivedMap();

    return isApproverOfOutstandingPolicyReports(currentUserPersonalDetails.accountID, outstandingReportsForPolicy, privateIsArchivedMap);
}

export default useIsApproverOfOutstandingPolicyReports;
