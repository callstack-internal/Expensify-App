import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import FormProvider from '@components/Form/FormProvider';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import MenuItemWithTopDescription from '@components/MenuItemWithTopDescription';
import ScreenWrapper from '@components/ScreenWrapper';
import RadioListItem from '@components/SelectionList/RadioListItem';
import Text from '@components/Text';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import DateUtils from '@libs/DateUtils';
import Navigation from '@libs/Navigation/Navigation';
import {validateDateTimeIsAtLeastOneMinuteInFuture} from '@libs/ValidationUtils';
import {updateDraftCustomStatus} from '@userActions/User';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';

type CustomStatusTypes = ValueOf<typeof CONST.CUSTOM_STATUS_TYPES>;

type StatusType = {
    value: CustomStatusTypes;
    text: string;
    keyForList: string;
    isSelected: boolean;
};

/**
 * @param data - either a value from CONST.CUSTOM_STATUS_TYPES or a dateTime string in the format YYYY-MM-DD HH:mm
 */
function getSelectedStatusType(data: string): CustomStatusTypes {
    switch (data) {
        case DateUtils.getEndOfToday():
            return CONST.CUSTOM_STATUS_TYPES.AFTER_TODAY;
        case CONST.CUSTOM_STATUS_TYPES.NEVER:
        case '':
            return CONST.CUSTOM_STATUS_TYPES.NEVER;
        default:
            return CONST.CUSTOM_STATUS_TYPES.CUSTOM;
    }
}

const useValidateCustomDate = (data: string) => {
    const [customDateError, setCustomDateError] = useState('');
    const [customTimeError, setCustomTimeError] = useState('');
    const validate = () => {
        const {dateValidationErrorKey, timeValidationErrorKey} = validateDateTimeIsAtLeastOneMinuteInFuture(data);

        setCustomDateError(dateValidationErrorKey);
        setCustomTimeError(timeValidationErrorKey);

        return {
            dateError: dateValidationErrorKey,
            timeError: timeValidationErrorKey,
        };
    };

    useEffect(() => {
        if (!data) {
            return;
        }
        validate();
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, [data]);

    const validateCustomDate = () => validate();

    return {customDateError, customTimeError, validateCustomDate};
};

function StatusClearAfterPage() {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const clearAfter = currentUserPersonalDetails.status?.clearAfter ?? '';
    const [customStatus] = useOnyx(ONYXKEYS.CUSTOM_STATUS_DRAFT);

    const draftClearAfter = customStatus?.clearAfter ?? '';
    const [draftPeriod, setDraftPeriod] = useState(() => getSelectedStatusType(draftClearAfter || clearAfter));
    const statusType = useMemo<StatusType[]>(
        () =>
            Object.entries(CONST.CUSTOM_STATUS_TYPES).map(([key, value]) => ({
                value,
                text: translate(`statusPage.timePeriods.${value}`),
                keyForList: key,
                isSelected: draftPeriod === value,
            })),
        [draftPeriod, translate],
    );

    const {customDateError, customTimeError, validateCustomDate} = useValidateCustomDate(draftClearAfter);

    const {redBrickDateIndicator, redBrickTimeIndicator} = useMemo(
        () => ({
            redBrickDateIndicator: customDateError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined,
            redBrickTimeIndicator: customTimeError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined,
        }),
        [customTimeError, customDateError],
    );

    const onSubmit = () => {
        const {dateError, timeError} = validateCustomDate();
        if (dateError || timeError) {
            return;
        }
        let calculatedDraftDate: string;
        if (draftPeriod === CONST.CUSTOM_STATUS_TYPES.CUSTOM) {
            calculatedDraftDate = draftClearAfter;
        } else {
            const selectedRange = statusType.find((item) => item.isSelected);
            calculatedDraftDate = DateUtils.getDateFromStatusType(selectedRange?.value ?? CONST.CUSTOM_STATUS_TYPES.NEVER);
        }
        updateDraftCustomStatus({clearAfter: calculatedDraftDate});
        Navigation.goBack(ROUTES.SETTINGS_STATUS);
    };

    const updateMode = useCallback(
        (mode: StatusType) => {
            if (mode.value === draftPeriod) {
                return;
            }
            setDraftPeriod(mode.value);

            if (mode.value === CONST.CUSTOM_STATUS_TYPES.CUSTOM) {
                updateDraftCustomStatus({clearAfter: DateUtils.getOneHourFromNow()});
            } else {
                const selectedRange = statusType.find((item) => item.value === mode.value);
                const calculatedDraftDate = DateUtils.getDateFromStatusType(selectedRange?.value ?? CONST.CUSTOM_STATUS_TYPES.NEVER);
                updateDraftCustomStatus({clearAfter: calculatedDraftDate});
                Navigation.goBack(ROUTES.SETTINGS_STATUS);
            }
        },
        [draftPeriod, statusType],
    );

    useEffect(() => {
        updateDraftCustomStatus({
            clearAfter: draftClearAfter || clearAfter,
        });

        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, []);

    const customStatusDate = DateUtils.extractDate(draftClearAfter);
    const customStatusTime = DateUtils.extractTime12Hour(draftClearAfter);

    const timePeriodOptions = useCallback(
        () =>
            statusType.map((item) => (
                <RadioListItem
                    item={item}
                    onSelectRow={() => updateMode(item)}
                    showTooltip={false}
                    isFocused={item.isSelected}
                />
            )),
        [statusType, updateMode],
    );

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom
            shouldEnableMaxHeight
            testID={StatusClearAfterPage.displayName}
        >
            <HeaderWithBackButton
                title={translate('statusPage.clearAfter')}
                onBackButtonPress={() => Navigation.goBack(ROUTES.SETTINGS_STATUS)}
            />
            <Text style={[styles.textNormal, styles.mh5, styles.mv4]}>{translate('statusPage.whenClearStatus')}</Text>
            <FormProvider
                formID={ONYXKEYS.FORMS.SETTINGS_STATUS_SET_CLEAR_AFTER_FORM}
                submitButtonText={translate('statusPage.save')}
                onSubmit={onSubmit}
                style={[styles.flexGrow1, styles.mb4]}
                scrollContextEnabled={false}
                isSubmitButtonVisible={false}
                enabledWhenOffline
                shouldHideFixErrorsAlert
            >
                <View>
                    {timePeriodOptions()}
                    {draftPeriod === CONST.CUSTOM_STATUS_TYPES.CUSTOM && (
                        <>
                            <MenuItemWithTopDescription
                                title={customStatusDate}
                                description={translate('statusPage.date')}
                                shouldShowRightIcon
                                containerStyle={styles.pr2}
                                onPress={() => Navigation.navigate(ROUTES.SETTINGS_STATUS_CLEAR_AFTER_DATE)}
                                errorText={customDateError}
                                titleStyle={styles.flex1}
                                brickRoadIndicator={redBrickDateIndicator}
                            />
                            <MenuItemWithTopDescription
                                title={customStatusTime}
                                description={translate('statusPage.time')}
                                shouldShowRightIcon
                                containerStyle={styles.pr2}
                                onPress={() => Navigation.navigate(ROUTES.SETTINGS_STATUS_CLEAR_AFTER_TIME)}
                                errorText={customTimeError}
                                titleStyle={styles.flex1}
                                brickRoadIndicator={redBrickTimeIndicator}
                            />
                        </>
                    )}
                </View>
            </FormProvider>
        </ScreenWrapper>
    );
}

StatusClearAfterPage.displayName = 'StatusClearAfterPage';

export default StatusClearAfterPage;
