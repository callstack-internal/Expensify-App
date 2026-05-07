import React from 'react';
import TaskHeaderActionButton from '@components/TaskHeaderActionButton';
import useOnyx from '@hooks/useOnyx';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import ONYXKEYS from '@src/ONYXKEYS';
import HeaderSkeleton from './HeaderSkeleton';

type HeaderProps = {
    /** Identity of the task report whose header content this block renders. */
    reportID: string | undefined;
};

/**
 * Task-kind header content. This is the kind-specific block that the future TaskReport
 * shell will mount in place of today's generic `HeaderView` task branch. For this slice
 * the production tree still renders today's `HeaderView` via the fallthrough; this block
 * exists so issue 02 can swap it in without renaming, and so the test suite can assert
 * the task-kind contract today.
 *
 * Renders `TaskHeaderActionButton` as an internal sub-component when the report exists
 * and is writable; renders `HeaderSkeleton` when the report record is still null.
 */
function Header({reportID}: HeaderProps) {
    const onyxReportID = getNonEmptyStringOnyxID(reportID);
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${onyxReportID}`);

    if (!report) {
        return <HeaderSkeleton />;
    }

    return <TaskHeaderActionButton report={report} />;
}

Header.displayName = 'TaskReport.Header';

export default Header;
