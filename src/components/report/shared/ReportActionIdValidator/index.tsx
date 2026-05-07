import {useFocusEffect, useNavigation} from '@react-navigation/native';
import Navigation from '@libs/Navigation/Navigation';
import {isNumeric} from '@libs/ValidationUtils';

type ReportActionIdValidatorProps = {
    /** The route's `reportActionID` param (when the route accepts it). */
    reportActionID?: string;
};

/**
 * Renderless block. Only acts when `reportActionID` is present and non-numeric.
 * Clears the param via `navigation.setParams({reportActionID: ''})` so downstream
 * blocks treat the route as if no linked action was passed.
 *
 * This is the "param sanitiser" half of the former `ReportRouteParamHandler`.
 */
function ReportActionIdValidator({reportActionID}: ReportActionIdValidatorProps) {
    const navigation = useNavigation();

    useFocusEffect(() => {
        if (!reportActionID || isNumeric(reportActionID)) {
            return;
        }
        Navigation.isNavigationReady().then(() => navigation.setParams({reportActionID: ''}));
    });

    return null;
}

ReportActionIdValidator.displayName = 'ReportActionIdValidator';

export default ReportActionIdValidator;
