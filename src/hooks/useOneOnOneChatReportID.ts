import ONYXKEYS from '@src/ONYXKEYS';
import type {Report} from '@src/types/onyx';

import type {OnyxCollection} from 'react-native-onyx';

import {getOneOnOneChatReportID} from '@selectors/OneOnOneChatReportID';
import {useOnyxState} from 'react-native-onyx';

const ONE_ON_ONE_CHAT_REPORT_ID_DEPENDENCIES = [ONYXKEYS.COLLECTION.REPORT, ONYXKEYS.SESSION];

/** Returns the reportID of the 1:1 or system chat with exactly these participants, read live so the Search snapshot never applies. */
function useOneOnOneChatReportID(participantsChatKey: string | undefined): string | undefined {
    return useOnyxState(
        (state) => {
            if (!participantsChatKey) {
                return undefined;
            }
            // useOnyxState's state view types a collection key as one member, but at runtime it returns the whole collection
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            const reports = state[ONYXKEYS.COLLECTION.REPORT] as OnyxCollection<Report>;
            return getOneOnOneChatReportID(reports, state[ONYXKEYS.SESSION]?.accountID, participantsChatKey);
        },
        {dependencies: ONE_ON_ONE_CHAT_REPORT_ID_DEPENDENCIES},
    );
}

export default useOneOnOneChatReportID;
