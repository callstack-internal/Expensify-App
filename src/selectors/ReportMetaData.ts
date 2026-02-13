import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';
import type {ReportMetadata} from '@src/types/onyx';

type IsActionLoadingMap = Record<string, true>;

const isActionLoadingSelector = (reportMetadata: OnyxEntry<ReportMetadata>) => reportMetadata?.isActionLoading ?? false;

const isActionLoadingMapSelector = (all: OnyxCollection<ReportMetadata>): IsActionLoadingMap => {
    const map: IsActionLoadingMap = {};
    if (!all) {
        return map;
    }

    for (const [key, value] of Object.entries(all)) {
        if (value?.isActionLoading) {
            map[key] = true;
        }
    }
    return map;
};

export type {IsActionLoadingMap};
export {isActionLoadingSelector, isActionLoadingMapSelector};
