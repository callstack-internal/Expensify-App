/* eslint-disable */
import React, {useEffect} from 'react';
import type {OnyxUpdate} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import useOnyx from '@hooks/useOnyx';
import ONYXKEYS from '@src/ONYXKEYS';
import {createRandomReport} from '../../tests/utils/collections/reports';
import Text from './Text';

function TestComponent() {
    const [reportMetadata1] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_METADATA}1`);
    const [report1] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}1`);

    useEffect(() => {
        console.log('RERENDER', {report1, reportMetadata1});
    }, [report1, reportMetadata1]);

    const applyTestUpdates = () => {
        const optimisticReports: Record<string, unknown> = {};
        for (let i = 1; i < 5; i++) {
            optimisticReports[`${ONYXKEYS.COLLECTION.REPORT}${i}`] = createRandomReport(i);
        }

        const updates: OnyxUpdate[] = [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}1`,
                value: {
                    isLoadingInitialReportActions: false,
                    isLoadingOlderReportActions: false,
                    hasLoadingOlderReportActionsError: false,
                    isLoadingNewerReportActions: false,
                    hasLoadingNewerReportActionsError: false,
                },
            },
            {
                onyxMethod: Onyx.METHOD.MERGE_COLLECTION,
                key: ONYXKEYS.COLLECTION.REPORT,
                value: optimisticReports,
            },
        ];

        Onyx.update(updates);
    };

    return (
        <Text
            style={{backgroundColor: 'yellow'}}
            onPress={applyTestUpdates}
        >
            test ONYX.UPDATE with setCollection
        </Text>
    );
}

export default TestComponent;
