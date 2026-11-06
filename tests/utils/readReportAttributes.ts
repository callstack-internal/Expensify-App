import {renderHook} from '@testing-library/react-native';

import {useReportAttributesSelector} from '@hooks/useReportAttributes';

import waitForBatchedUpdatesWithAct from './waitForBatchedUpdatesWithAct';

/** Reads the report attributes the way a component gets them right now, through a reader mounted only for this read. */
export default async function readReportAttributes() {
    const {result, unmount} = renderHook(() => useReportAttributesSelector((attributes) => attributes));
    await waitForBatchedUpdatesWithAct();
    const attributes = result.current;
    unmount();
    return attributes;
}
