// TaskReport compound. The dispatcher mounts the default export below (the compound
// shell) directly, and tests / future slices import named blocks via
// `TaskReport.Header`, `TaskReport.Actions`, `TaskReport.Composer`,
// `TaskReport.InitHandler`, `TaskReport.HeaderSkeleton`.
//
// In this first decomposition slice the shell delegates the visible render to today's
// generic `ReportScreen` (the same component the dispatcher's chat fallthrough uses)
// and only adds `InitHandler` as a renderless block on top. Today's `ReportScreen`
// already covers tasks; replacing its chrome with kind-specific blocks is issue 02's
// scope, not this slice's.
import {useNavigation, useRoute} from '@react-navigation/native';
import React from 'react';
import type {PlatformStackNavigationProp, PlatformStackRouteProp} from '@libs/Navigation/PlatformStackNavigation/types';
import type {ReportsSplitNavigatorParamList} from '@libs/Navigation/types';
import ReportScreen from '@pages/inbox/ReportScreen';
import type SCREENS from '@src/SCREENS';
import Actions from './Actions';
import Composer from './Composer';
import Header from './Header';
import HeaderSkeleton from './Header/HeaderSkeleton';
import InitHandler from './InitHandler';

type TaskReportProps = {
    /** Identity of the task report being rendered. */
    reportID: string | undefined;

    /**
     * Optional linked-action id (chat-stream routes only). Forwarded by the dispatcher
     * for parity with the other compounds; unused by the transitional shell because
     * today's `ReportScreen` reads the same value via `useRoute()` itself. Issue 02
     * wires the prop into the kind-specific shell.
     */
    reportActionID?: string;

    /**
     * Optional analytics tag. Forwarded by the dispatcher for parity with the other
     * compounds; unused by the transitional shell for the same reason as
     * `reportActionID`. Issue 02 wires the prop into the kind-specific shell.
     */
    referrer?: string;
};

// Both `SCREENS.REPORT` and `SCREENS.RIGHT_MODAL.SEARCH_REPORT` can host a task report;
// the route shapes are structurally identical for the props we forward, so we type
// to the central-screen variant here and pass to `ReportScreen` (which itself accepts
// the union) below.
type TaskReportScreenRoute = PlatformStackRouteProp<ReportsSplitNavigatorParamList, typeof SCREENS.REPORT>;
type TaskReportScreenNavigation = PlatformStackNavigationProp<ReportsSplitNavigatorParamList, typeof SCREENS.REPORT>;

// `reportActionID` and `referrer` are documented in the prop contract for
// forward-compatibility: issue 02 wires them into the kind-specific shell. For this
// slice today's transitional shell (`ReportScreen`) resolves them via `useRoute()`,
// so the wrapper reads them only to keep them in the prop type.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- See block comment above.
function TaskReport({reportID, reportActionID, referrer}: TaskReportProps) {
    // The compound shell sits at the screen-equivalent boundary, so reading
    // `route` / `navigation` here is allowed (and is the only way to forward them to
    // the transitional `ReportScreen` shell without changing the dispatcher contract).
    // The named compound blocks below NEVER call `useRoute()` — they take ids as props.
    const route = useRoute<TaskReportScreenRoute>();
    const navigation = useNavigation<TaskReportScreenNavigation>();

    return (
        <>
            <InitHandler reportID={reportID} />
            <ReportScreen
                route={route}
                navigation={navigation}
            />
        </>
    );
}

TaskReport.displayName = 'TaskReport';

TaskReport.Header = Header;
TaskReport.HeaderSkeleton = HeaderSkeleton;
TaskReport.Actions = Actions;
TaskReport.Composer = Composer;
TaskReport.InitHandler = InitHandler;

export default TaskReport;
