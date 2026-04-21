import {PortalHost} from '@gorhom/portal';
import React from 'react';
import type {ViewStyle} from 'react-native';
import {View} from 'react-native';
import ScreenWrapper from '@components/ScreenWrapper';
import WideRHPOverlayWrapper from '@components/WideRHPOverlayWrapper';
import useActionListContextValue from '@hooks/useActionListContextValue';
import {useCurrentReportIDState} from '@hooks/useCurrentReportID';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useSubmitToDestinationVisible from '@hooks/useSubmitToDestinationVisible';
import useThemeStyles from '@hooks/useThemeStyles';
import useViewportOffsetTop from '@hooks/useViewportOffsetTop';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {RightModalNavigatorParamList} from '@navigation/types';
import CONST from '@src/CONST';
import type SCREENS from '@src/SCREENS';
import AccountManagerBanner from './AccountManagerBanner';
import {AgentZeroStatusProvider} from './AgentZeroStatusContext';
import DeleteTransactionNavigateBackHandler from './DeleteTransactionNavigateBackHandler';
import LinkedActionNotFoundGuard from './LinkedActionNotFoundGuard';
import ReactionListWrapper from './ReactionListWrapper';
import ReportFooter from './report/ReportFooter';
import ReportActionsList from './ReportActionsList';
import ReportDragAndDropProvider from './ReportDragAndDropProvider';
import ReportFetchHandler from './ReportFetchHandler';
import ReportHeader from './ReportHeader';
import ReportLifecycleHandler from './ReportLifecycleHandler';
import ReportNavigateAwayHandler from './ReportNavigateAwayHandler';
import ReportNotFoundGuard from './ReportNotFoundGuard';
import ReportRouteParamHandler from './ReportRouteParamHandler';
import {ActionListContext} from './ReportScreenContext';
import WideRHPReceiptPanel from './WideRHPReceiptPanel';

type PageProps = PlatformStackScreenProps<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.SEARCH_REPORT>;

// When switching search reports using arrows SET_PARAMS action is performed, but it's necessary to remount the whole component after changing the reportID due to the hooks dependencies.
// It's suggested to refactor hooks in this screen to remove this wrapper and perform SET_PARAMS without the screen remount.
export default function RHPReportScreen({route, navigation}: PageProps) {
    return (
        <RHPReportScreenInner
            key={route.params?.reportID}
            route={route}
            navigation={navigation}
        />
    );
}

function RHPReportScreenInner({route, navigation}: PageProps) {
    const styles = useThemeStyles();
    const reportIDFromRoute = getNonEmptyStringOnyxID(route.params?.reportID);
    const {isInNarrowPaneModal} = useResponsiveLayout();
    const {currentReportID: currentReportIDValue} = useCurrentReportIDState();
    const viewportOffsetTop = useViewportOffsetTop();
    const isTopMostReportId = currentReportIDValue === reportIDFromRoute;
    const screenWrapperStyle: ViewStyle[] = [styles.appContent, styles.flex1, {marginTop: viewportOffsetTop}];

    useSubmitToDestinationVisible(
        [CONST.TELEMETRY.SUBMIT_FOLLOW_UP_ACTION.DISMISS_MODAL_AND_OPEN_REPORT, CONST.TELEMETRY.SUBMIT_FOLLOW_UP_ACTION.DISMISS_MODAL_ONLY],
        reportIDFromRoute,
        CONST.TELEMETRY.SUBMIT_TO_DESTINATION_VISIBLE_TRIGGER.FOCUS,
    );

    const actionListValue = useActionListContextValue();

    return (
        <WideRHPOverlayWrapper>
            <ActionListContext.Provider value={actionListValue}>
                <ReactionListWrapper>
                    <ScreenWrapper
                        navigation={navigation}
                        style={screenWrapperStyle}
                        shouldEnableKeyboardAvoidingView={isTopMostReportId || isInNarrowPaneModal}
                        testID={`report-screen-${reportIDFromRoute}`}
                    >
                        <DeleteTransactionNavigateBackHandler />
                        <ReportRouteParamHandler />
                        <ReportFetchHandler />
                        <ReportNavigateAwayHandler />
                        <ReportNotFoundGuard>
                            <LinkedActionNotFoundGuard>
                                <ReportDragAndDropProvider>
                                    <ReportLifecycleHandler reportID={reportIDFromRoute} />
                                    <ReportHeader />
                                    <AccountManagerBanner reportID={reportIDFromRoute} />
                                    <View style={[styles.flex1, styles.flexRow]}>
                                        <WideRHPReceiptPanel />
                                        <AgentZeroStatusProvider reportID={reportIDFromRoute}>
                                            <View
                                                style={[styles.flex1, styles.justifyContentEnd, styles.overflowHidden]}
                                                testID="report-actions-view-wrapper"
                                            >
                                                <ReportActionsList />
                                                <ReportFooter />
                                            </View>
                                        </AgentZeroStatusProvider>
                                    </View>
                                    <PortalHost name="suggestions" />
                                </ReportDragAndDropProvider>
                            </LinkedActionNotFoundGuard>
                        </ReportNotFoundGuard>
                    </ScreenWrapper>
                </ReactionListWrapper>
            </ActionListContext.Provider>
        </WideRHPOverlayWrapper>
    );
}
