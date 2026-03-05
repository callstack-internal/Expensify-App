import type {ReactNode} from 'react';
import React from 'react';
import type {GestureResponderEvent} from 'react-native';
import {useLHNListContext} from '@components/LHNOptionsList/LHNListContext';
import {useSession} from '@components/OnyxListItemProvider';
import {useProductTrainingContext} from '@components/ProductTrainingContext';
import EducationalTooltip from '@components/Tooltip/EducationalTooltip';
import useOnyx from '@hooks/useOnyx';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import {isAdminRoom, isChatUsedForOnboarding as isChatUsedForOnboardingReportUtils, isConciergeChatReport} from '@libs/ReportUtils';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

type RowTooltipWrapperProps = {
    reportID: string;
    onOptionPress: (event: GestureResponderEvent | KeyboardEvent | undefined) => void;
    children: ReactNode;
};

function RowTooltipWrapper({reportID, onOptionPress, children}: RowTooltipWrapperProps) {
    const styles = useThemeStyles();
    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const {isReportsSplitNavigatorLast, isScreenFocused, firstReportIDWithGBRorRBR} = useLHNListContext();
    const session = useSession();
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const [conciergeReportID] = useOnyx(ONYXKEYS.CONCIERGE_REPORT_ID);
    const [introSelected] = useOnyx(ONYXKEYS.NVP_INTRO_SELECTED);
    const [onboarding] = useOnyx(ONYXKEYS.NVP_ONBOARDING);
    const [isFullscreenVisible] = useOnyx(ONYXKEYS.FULLSCREEN_VISIBILITY);
    const onboardingPurpose = introSelected?.choice;

    const shouldShowRBRorGBRTooltip = firstReportIDWithGBRorRBR === reportID;
    const isOnboardingGuideAssigned = onboardingPurpose === CONST.ONBOARDING_CHOICES.MANAGE_TEAM && !session?.email?.includes('+');
    const isChatUsedForOnboarding = isChatUsedForOnboardingReportUtils(report, onboarding, conciergeReportID, onboardingPurpose);
    const shouldShowGetStartedTooltip = isOnboardingGuideAssigned ? isAdminRoom(report) && isChatUsedForOnboarding : isConciergeChatReport(report);

    // TODO: CONCIERGE_LHN_GBR tooltip will be replaced by a tooltip in the #admins room
    // https://github.com/Expensify/App/issues/57045#issuecomment-2701455668
    const tooltipToRender = CONST.PRODUCT_TRAINING_TOOLTIP_NAMES.CONCIERGE_LHN_GBR;
    const shouldShowTooltips = shouldShowRBRorGBRTooltip || shouldShowGetStartedTooltip;
    const shouldTooltipBeVisible = shouldUseNarrowLayout ? isScreenFocused && isReportsSplitNavigatorLast : isReportsSplitNavigatorLast && !isFullscreenVisible;
    const shouldShowTooltip = shouldShowTooltips && shouldTooltipBeVisible;

    const {shouldShowProductTrainingTooltip, renderProductTrainingTooltip, hideProductTrainingTooltip} = useProductTrainingContext(tooltipToRender, shouldShowTooltip);

    const handleTooltipPress = (event: GestureResponderEvent | KeyboardEvent | undefined) => {
        hideProductTrainingTooltip();
        onOptionPress(event);
    };

    return (
        <EducationalTooltip
            shouldRender={shouldShowProductTrainingTooltip}
            renderTooltipContent={renderProductTrainingTooltip}
            anchorAlignment={{
                horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.RIGHT,
                vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.TOP,
            }}
            shiftHorizontal={variables.gbrTooltipShiftHorizontal}
            shiftVertical={variables.gbrTooltipShiftVertical}
            wrapperStyle={styles.productTrainingTooltipWrapper}
            onTooltipPress={handleTooltipPress}
            shouldHideOnScroll
        >
            {children}
        </EducationalTooltip>
    );
}

RowTooltipWrapper.displayName = 'RowTooltipWrapper';

export default RowTooltipWrapper;
