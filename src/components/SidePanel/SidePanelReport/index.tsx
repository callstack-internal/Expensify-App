import {NavigationRouteContext} from '@react-navigation/native';
import React from 'react';
import ReportKindDispatcher from '@components/report/ReportKindDispatcher';
import {IsInSidePanelContext} from '@hooks/useIsInSidePanel';
import type {ExtraContentProps} from '@libs/Navigation/PlatformStackNavigation/types';
import SCREENS from '@src/SCREENS';

type SidePanelReportProps = Pick<ExtraContentProps, 'navigation'> & {
    reportID: string;
};

// Side-panel host: mounts the dispatcher under a synthetic route context so leaf
// components that still call `useRoute()` (HeaderView, ReportFooter, etc.) resolve
// the side-panel report id. The dispatcher itself reads `reportID` from props, so the
// switch is internal-shape-only — visible behavior unchanged from the prior
// `ReportScreen`-based shell. `navigation` stays on the prop contract because the
// caller (`SidePanel`) forwards it from the navigator's `extraContent` slot, but the
// new compound architecture resolves navigation via `useNavigation()` inside the
// kind-specific shell, so the prop is unused here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- See block comment above.
function SidePanelReport({navigation, reportID}: SidePanelReportProps) {
    // eslint-disable-next-line react/jsx-no-constructed-context-values
    const route = {name: SCREENS.REPORT, params: {reportID}, key: `Report-SidePanel-${reportID}`} as const;

    return (
        <IsInSidePanelContext.Provider value>
            <NavigationRouteContext.Provider value={route}>
                <ReportKindDispatcher reportID={reportID} />
            </NavigationRouteContext.Provider>
        </IsInSidePanelContext.Provider>
    );
}

export default SidePanelReport;
