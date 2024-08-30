import {useSuspenseQuery} from '@tanstack/react-query';
import db from '@libs/DatabaseConnector/index.web';

function useOnyxSuspenseQuery(key: string) {
    const query = useSuspenseQuery({
        queryKey: [key],
        queryFn: () => db.keyvaluepairs.get(key),
        meta: {
            automaticRevalidationKeys: [key],
        },
    });
    return query;
}

export default useOnyxSuspenseQuery;
