import {guideAccountIDsSelector} from '@selectors/PersonalDetails';

import {useAllPersonalDetailsWithoutSnapshots} from './usePersonalDetails';

function useGuideAccountIDs() {
    const [guideAccountIDs] = useAllPersonalDetailsWithoutSnapshots(guideAccountIDsSelector);
    return guideAccountIDs;
}

export default useGuideAccountIDs;
