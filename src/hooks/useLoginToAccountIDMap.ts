import {loginToAccountIDMapSelector} from '@selectors/PersonalDetails';

import {useAllPersonalDetailsWithoutSnapshots} from './usePersonalDetails';

function useLoginToAccountIDMap() {
    const [loginToAccountIDMap] = useAllPersonalDetailsWithoutSnapshots(loginToAccountIDMapSelector);
    return loginToAccountIDMap;
}

export default useLoginToAccountIDMap;
