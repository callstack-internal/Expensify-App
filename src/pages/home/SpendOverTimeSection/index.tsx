import React, {useMemo} from 'react';
import type {OnyxCollection} from 'react-native-onyx';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useOnyx from '@hooks/useOnyx';
import {isPolicyEligibleForSpendOverTime} from '@libs/SearchUIUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Policy} from '@src/types/onyx';
import SpendOverTimeSectionContent from './SpendOverTimeSectionContent';

function SpendOverTimeSection() {
    const {login} = useCurrentUserPersonalDetails();
    const isAnyPolicyEligibleForSpendOverTimeSelector = useMemo(
        () => (policies: OnyxCollection<Policy>) => Object.values(policies ?? {}).some((policy) => !!policy && isPolicyEligibleForSpendOverTime(policy, login)),
        [login],
    );
    const [isAnyPolicyEligibleForSpendOverTime] = useOnyx(ONYXKEYS.COLLECTION.POLICY, {selector: isAnyPolicyEligibleForSpendOverTimeSelector});

    // The widget is only shown for workspace admins/auditors/approvers.
    if (!isAnyPolicyEligibleForSpendOverTime) {
        return null;
    }

    return <SpendOverTimeSectionContent />;
}

export default SpendOverTimeSection;
