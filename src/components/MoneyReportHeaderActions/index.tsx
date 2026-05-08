import React, {useRef} from 'react';
import {View} from 'react-native';
import type {ValueOf} from 'type-fest';
import type {ButtonWithDropdownMenuRef} from '@components/ButtonWithDropdownMenu/types';
import MoneyReportHeaderPrimaryAction from '@components/MoneyReportHeaderPrimaryAction';
import useExportAgainModal from '@hooks/useExportAgainModal';
import useOnyx from '@hooks/useOnyx';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useResponsiveLayoutOnWideRHP from '@hooks/useResponsiveLayoutOnWideRHP';
import useThemeStyles from '@hooks/useThemeStyles';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import MoneyReportHeaderSecondaryActions from './MoneyReportHeaderSecondaryActions';
import type {MoneyReportHeaderActionsProps} from './types';

/**
 * Narrow the wide primaryAction union to what report-level secondary actions accept.
 * TRANSACTION_PRIMARY_ACTIONS values (e.g. "keepThisOne") are irrelevant here.
 */
function narrowPrimaryAction(primaryAction: MoneyReportHeaderActionsProps['primaryAction']): ValueOf<typeof CONST.REPORT.PRIMARY_ACTIONS> | '' {
    if ((Object.values(CONST.REPORT.PRIMARY_ACTIONS) as string[]).includes(primaryAction)) {
        return primaryAction as ValueOf<typeof CONST.REPORT.PRIMARY_ACTIONS>;
    }
    return '';
}

function MoneyReportHeaderActions({reportID, primaryAction, isReportInSearch, backTo}: MoneyReportHeaderActionsProps) {
    const styles = useThemeStyles();
    const dropdownMenuRef = useRef<ButtonWithDropdownMenuRef>(null) as React.RefObject<ButtonWithDropdownMenuRef>;

    // We need isSmallScreenWidth for the hold expense modal layout https://github.com/Expensify/App/pull/47990#issuecomment-2362382026

    const {shouldUseNarrowLayout, isMediumScreenWidth} = useResponsiveLayout();
    const shouldDisplayNarrowVersion = shouldUseNarrowLayout || isMediumScreenWidth;
    const {isWideRHPDisplayedOnWideLayout, isSuperWideRHPDisplayedOnWideLayout} = useResponsiveLayoutOnWideRHP();
    const shouldDisplayNarrowMoreButton = !shouldDisplayNarrowVersion || isWideRHPDisplayedOnWideLayout || isSuperWideRHPDisplayedOnWideLayout;

    const [moneyRequestReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const [chatReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getNonEmptyStringOnyxID(moneyRequestReport?.chatReportID)}`);

    const {triggerExportOrConfirm} = useExportAgainModal(moneyRequestReport?.reportID, moneyRequestReport?.policyID);

    // Selection-mode swap moved out of this component.
    // `MoneyRequestReport.SelectionToolbar` owns the wide selection dropdown and the
    // narrow selection toolbar; this component now only renders the report-level
    // primary/secondary action buttons.
    const narrowedPrimaryAction = narrowPrimaryAction(primaryAction);

    return (
        <View style={[styles.flexRow, styles.gap2, ...(!shouldDisplayNarrowMoreButton ? [styles.pb3, styles.ph5, styles.w100, styles.alignItemsCenter, styles.justifyContentCenter] : [])]}>
            {!!primaryAction && (
                <View style={!shouldDisplayNarrowMoreButton ? [styles.flex1] : undefined}>
                    <MoneyReportHeaderPrimaryAction
                        reportID={reportID}
                        chatReportID={chatReport?.reportID}
                        primaryAction={primaryAction}
                        onExportModalOpen={() => triggerExportOrConfirm(CONST.REPORT.EXPORT_OPTIONS.EXPORT_TO_INTEGRATION)}
                    />
                </View>
            )}
            <MoneyReportHeaderSecondaryActions
                reportID={reportID}
                primaryAction={narrowedPrimaryAction}
                isReportInSearch={isReportInSearch}
                backTo={backTo}
                dropdownMenuRef={dropdownMenuRef}
            />
        </View>
    );
}

export default MoneyReportHeaderActions;
export type {MoneyReportHeaderActionsProps};
