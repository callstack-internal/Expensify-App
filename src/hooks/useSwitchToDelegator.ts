import {useDelegateNoAccessActions, useDelegateNoAccessState} from '@components/DelegateNoAccessModalProvider';
import {ModalActions} from '@components/Modal/Global/ModalContext';

import {connect, disconnect} from '@libs/actions/Delegate';
import {close as modalClose} from '@libs/actions/Modal';
import {getGpsPoints, stopGpsTrip} from '@libs/GPSDraftDetailsUtils';
import OnyxUtils from '@libs/OnyxUtils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import {isTrackingSelector} from '@src/selectors/GPSDraftDetails';
import type {GpsDraftDetails} from '@src/types/onyx';
import type {DelegatedAccess} from '@src/types/onyx/Account';
import type {GPSPoint} from '@src/types/onyx/GpsDraftDetails';

import useConfirmModal from './useConfirmModal';
import useLocalize from './useLocalize';
import useNetwork from './useNetwork';

/**
 * Encapsulates the safety checks needed before switching to a delegator account:
 * 1. Offline check – blocks the switch and shows an offline modal.
 * 2. Chained delegation check – if already acting as a delegate and not returning
 *    to the original user, shows the "not so fast" modal.
 * 3. GPS tracking check – if a GPS trip is in progress, asks the user to confirm
 *    stopping the trip before switching.
 */
function useSwitchToDelegator() {
    const {translate} = useLocalize();
    const {isOffline} = useNetwork();
    const {showConfirmModal} = useConfirmModal();
    const {isActingAsDelegate} = useDelegateNoAccessState();
    const {showDelegateNoAccessModal} = useDelegateNoAccessActions();

    const showOfflineModal = () => {
        showConfirmModal({
            title: translate('common.youAppearToBeOffline'),
            prompt: translate('common.offlinePrompt'),
            confirmText: translate('common.buttonConfirm'),
            shouldShowCancelButton: false,
        });
    };

    const showGpsInProgressModal = async (gpsPoints: GPSPoint[][], switchAccount: () => ReturnType<typeof connect | typeof disconnect>) => {
        const result = await showConfirmModal({
            title: translate('gps.switchAccountWarningTripInProgress.title'),
            prompt: translate('gps.switchAccountWarningTripInProgress.prompt'),
            confirmText: translate('gps.switchAccountWarningTripInProgress.confirm'),
            cancelText: translate('common.cancel'),
        });

        if (result.action !== ModalActions.CONFIRM) {
            return;
        }

        await stopGpsTrip(false, gpsPoints, true);
        switchAccount();
    };

    const switchToDelegator = async (email: string) => {
        if (isOffline) {
            modalClose(() => showOfflineModal());
            return;
        }
        // Read everything up front, in one block, for two reasons. The subscriptions this replaced all came from
        // a single render snapshot, so every branch below saw a mutually consistent set of values, and reads
        // spread across the confirmation modal would not be. And every read sits before the first write, so
        // nothing here can observe a value that a write later in this handler has already invalidated.
        const [account, credentials, stashedCredentials, session, stashedSession, activePolicyID, gpsDraft] = await Promise.all([
            OnyxUtils.get(ONYXKEYS.ACCOUNT),
            OnyxUtils.get(ONYXKEYS.CREDENTIALS),
            OnyxUtils.get(ONYXKEYS.STASHED_CREDENTIALS),
            OnyxUtils.get(ONYXKEYS.SESSION),
            OnyxUtils.get(ONYXKEYS.STASHED_SESSION),
            OnyxUtils.get(ONYXKEYS.NVP_ACTIVE_POLICY_ID),
            OnyxUtils.get(ONYXKEYS.GPS_DRAFT_DETAILS),
        ]);
        // OnyxUtils.get resolves the cached object itself, so it is typed ReadonlyDeep, and the two consumers
        // below declare mutable parameters: Delegate.connect takes DelegatedAccess, and the GPS helpers take
        // GpsDraftDetails. Neither writes to what it is given, but neither says so in its signature, and
        // widening them means widening GPSPoint[][] through calculateTrimmedEndPoint and every other caller.
        // Both casts are read-only by inspection, so they are asserted here until those signatures are widened.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- consumer signature is mutable, this read is not written to
        const delegatedAccess = account?.delegatedAccess as DelegatedAccess | undefined;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- consumer signature is mutable, this read is not written to
        const gpsDraftDetails = gpsDraft as GpsDraftDetails | undefined;

        const isReturningToOriginalUser = isActingAsDelegate && email === stashedSession?.email;
        // Chained delegation isn't supported by the backend — if we're already acting as a delegate,
        // the only legal switch is back to the original user. Anything else triggers the "Not so fast" modal.
        if (isActingAsDelegate && !isReturningToOriginalUser) {
            modalClose(() => showDelegateNoAccessModal());
            return;
        }
        const switchAction = isReturningToOriginalUser
            ? () => disconnect({stashedCredentials: stashedCredentials ?? CONST.EMPTY_OBJECT, stashedSession})
            : () => connect({email, delegatedAccess, credentials, session, activePolicyID});
        if (isTrackingSelector(gpsDraftDetails)) {
            modalClose(() => showGpsInProgressModal(getGpsPoints(gpsDraftDetails), switchAction));
            return;
        }
        switchAction();
    };

    return switchToDelegator;
}

export default useSwitchToDelegator;
