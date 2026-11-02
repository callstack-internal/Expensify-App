import ONYXKEYS from '@src/ONYXKEYS';

import {getOneOnOneChatReportID} from '@selectors/OneOnOneChatReportID';
import {useOnyxState} from 'react-native-onyx';

const ONE_ON_ONE_CHAT_REPORT_ID_DEPENDENCIES = [ONYXKEYS.COLLECTION.REPORT, ONYXKEYS.SESSION] as const;

/** Returns the reportID of the 1:1 or system chat with exactly these participants. */
function useOneOnOneChatReportID(participantsChatKey: string | undefined): string | undefined {
    return useOnyxState((state) => (participantsChatKey ? getOneOnOneChatReportID(state[ONYXKEYS.COLLECTION.REPORT], state[ONYXKEYS.SESSION]?.accountID, participantsChatKey) : undefined), {
        dependencies: ONE_ON_ONE_CHAT_REPORT_ID_DEPENDENCIES,
    });
}

export default useOneOnOneChatReportID;
