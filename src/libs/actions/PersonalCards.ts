import Onyx, {NullishDeep} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import type {AddNewPersonalCardFeedData, AddNewPersonalCardFeedStep} from '@src/types/onyx/PersonalCard';

type AddNewPersonalCardFlowData = {
    /** Step to be set in Onyx */
    step?: AddNewPersonalCardFeedStep;

    /** Whether the user is editing step */
    isEditing?: boolean;

    /** Data required to be sent to issue a new card */
    data?: Partial<AddNewPersonalCardFeedData>;
};

function setAddNewPersonalCardStepAndData({data, isEditing, step}: NullishDeep<AddNewPersonalCardFlowData>) {
    Onyx.merge(ONYXKEYS.ADD_NEW_PERSONAL_CARD, {data, isEditing, currentStep: step});
}

function clearAddNewPersonalCardFlow() {
    Onyx.set(ONYXKEYS.ADD_NEW_PERSONAL_CARD, {
        currentStep: null,
        data: {},
    });
}

export {clearAddNewPersonalCardFlow, setAddNewPersonalCardStepAndData};
