import type {GpsDraftDetails} from '@src/types/onyx';

import type {OnyxEntry} from 'react-native-onyx';
import type {ReadonlyDeep} from 'type-fest';

const isTrackingSelector = (gpsDraftDetails?: ReadonlyDeep<OnyxEntry<GpsDraftDetails>>) => !!gpsDraftDetails?.isTracking;

// eslint-disable-next-line import/prefer-default-export
export {isTrackingSelector};
