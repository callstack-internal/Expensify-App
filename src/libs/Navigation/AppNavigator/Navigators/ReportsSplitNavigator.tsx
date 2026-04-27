import React, {useState} from 'react';
import NavigationDeferredMount from '@components/NavigationDeferredMount';
import useArchivedReportsIdSet from '@hooks/useArchivedReportsIdSet';
import usePermissions from '@hooks/usePermissions';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import createSplitNavigator from '@libs/Navigation/AppNavigator/createSplitNavigator';
import FreezeWrapper from '@libs/Navigation/AppNavigator/FreezeWrapper';
import useSplitNavigatorScreenOptions from '@libs/Navigation/AppNavigator/useSplitNavigatorScreenOptions';
import getCurrentUrl from '@libs/Navigation/currentUrl';
import shouldOpenOnAdminRoom from '@libs/Navigation/helpers/shouldOpenOnAdminRoom';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {ReportsSplitNavigatorParamList, TabNavigatorParamList} from '@libs/Navigation/types';
import * as ReportUtils from '@libs/ReportUtils';
import CONST from '@src/CONST';
import type NAVIGATORS from '@src/NAVIGATORS';
import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import type ReactComponentModule from '@src/types/utils/ReactComponentModule';

// On wide layout the central ReportScreen mounts in the same tick as the LHN sidebar, competing for JS
// frame budget during the ManualNavigateToInboxTab span. Deferring the central pane past the navigation
// transition lets the LHN paint and end the span first; ReportScreen then hydrates non-urgently.
// On narrow layout the central screen only mounts in response to a user tap, so we render it immediately.
const loadReportScreen = () => {
    const ReportScreen = require<ReactComponentModule>('@pages/inbox/ReportScreen').default;
    function DeferredReportScreen({route, navigation}: PlatformStackScreenProps<ReportsSplitNavigatorParamList, typeof SCREENS.REPORT>) {
        const {shouldUseNarrowLayout} = useResponsiveLayout();
        if (shouldUseNarrowLayout) {
            return (
                <ReportScreen
                    route={route}
                    navigation={navigation}
                />
            );
        }
        return (
            <NavigationDeferredMount>
                <ReportScreen
                    route={route}
                    navigation={navigation}
                />
            </NavigationDeferredMount>
        );
    }
    return DeferredReportScreen;
};
const loadSidebarScreen = () => require<ReactComponentModule>('@pages/inbox/sidebar/BaseSidebarScreen').default;
const Split = createSplitNavigator<ReportsSplitNavigatorParamList>();

/**
 * This SplitNavigator includes the HOME screen (<BaseSidebarScreen /> component) with a list of reports as a sidebar screen and the REPORT screen displayed as a central one.
 * There can be multiple report screens in the stack with different report IDs.
 */
function ReportsSplitNavigator({route}: PlatformStackScreenProps<TabNavigatorParamList, typeof NAVIGATORS.REPORTS_SPLIT_NAVIGATOR>) {
    const {isBetaEnabled} = usePermissions();
    const splitNavigatorScreenOptions = useSplitNavigatorScreenOptions();
    const archivedReportsIdSet = useArchivedReportsIdSet();
    const isOpenOnAdminRoom = shouldOpenOnAdminRoom();

    const [initialReportID] = useState(() => {
        // Deep links and REPORT_WITH_ID navigation pass the reportID in nested params,
        // which lets us skip the O(n) findLastAccessedReport scan over all reports.
        if (route.params?.screen === SCREENS.REPORT && route.params.params?.reportID) {
            return route.params.params.reportID;
        }

        const currentURL = getCurrentUrl();
        const isTransitioning = currentURL.includes(ROUTES.TRANSITION_BETWEEN_APPS);

        const reportIdFromPath = currentURL ? new URL(currentURL).pathname.match(CONST.REGEX.REPORT_ID_FROM_PATH)?.at(1) : undefined;
        if (reportIdFromPath) {
            return reportIdFromPath;
        }

        // If we are in a transition, we explicitly do NOT want to load the last accessed report.
        // Returning an empty string here will cause ReportScreen to skip the `openReport` call initially.
        if (isTransitioning) {
            return '';
        }

        const initialReport = ReportUtils.findLastAccessedReport(!isBetaEnabled(CONST.BETAS.DEFAULT_ROOMS), isOpenOnAdminRoom, undefined, archivedReportsIdSet);
        // eslint-disable-next-line rulesdir/no-default-id-values
        return initialReport?.reportID ?? '';
    });

    const reportScreenInitialParams = {
        reportID: initialReportID,
        openOnAdminRoom: isOpenOnAdminRoom ? true : undefined,
    };

    return (
        <FreezeWrapper>
            <Split.Navigator
                persistentScreens={[SCREENS.INBOX]}
                sidebarScreen={SCREENS.INBOX}
                defaultCentralScreen={SCREENS.REPORT}
                parentRoute={route}
                screenOptions={splitNavigatorScreenOptions.centralScreen}
            >
                <Split.Screen
                    name={SCREENS.INBOX}
                    getComponent={loadSidebarScreen}
                    options={splitNavigatorScreenOptions.sidebarScreen}
                />
                <Split.Screen
                    name={SCREENS.REPORT}
                    initialParams={reportScreenInitialParams}
                    getComponent={loadReportScreen}
                />
            </Split.Navigator>
        </FreezeWrapper>
    );
}

export default ReportsSplitNavigator;
