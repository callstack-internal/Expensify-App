import {useRoute} from '@react-navigation/native';
import React, {useCallback, useMemo, useState} from 'react';
import {View} from 'react-native';
import type {ValueOf} from 'type-fest';
import useConfirmModal from '@hooks/useConfirmModal';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import usePolicy from '@hooks/usePolicy';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useResponsiveLayoutOnWideRHP from '@hooks/useResponsiveLayoutOnWideRHP';
import useSelectedTransactionsActions from '@hooks/useSelectedTransactionsActions';
import useThemeStyles from '@hooks/useThemeStyles';
import useTransactionsAndViolationsForReport from '@hooks/useTransactionsAndViolationsForReport';
import {dismissRejectUseExplanation} from '@userActions/IOU';
import {queueExportSearchWithTemplate} from '@libs/actions/Search';
import Navigation from '@libs/Navigation/Navigation';
import type {PlatformStackRouteProp} from '@libs/Navigation/PlatformStackNavigation/types';
import type {ReportsSplitNavigatorParamList, RightModalNavigatorParamList} from '@libs/Navigation/types';
import ButtonWithDropdownMenu from '@components/ButtonWithDropdownMenu';
import DecisionModal from '@components/DecisionModal';
import HoldOrRejectEducationalModal from '@components/HoldOrRejectEducationalModal';
import {ModalActions} from '@components/Modal/Global/ModalContext';
import {useSearchContext} from '@components/Search/SearchContext';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';

type SelectedTransactionsButtonProps = {
    /** The report ID */
    reportID: string;
};

function SelectedTransactionsButton({reportID}: SelectedTransactionsButtonProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const {isOffline} = useNetwork();
    // eslint-disable-next-line rulesdir/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth
    const {shouldUseNarrowLayout, isSmallScreenWidth, isMediumScreenWidth} = useResponsiveLayout();
    const shouldDisplayNarrowVersion = shouldUseNarrowLayout || isMediumScreenWidth;
    const {isWideRHPDisplayedOnWideLayout, isSuperWideRHPDisplayedOnWideLayout} = useResponsiveLayoutOnWideRHP();
    const shouldDisplayNarrowMoreButton = !shouldDisplayNarrowVersion || isWideRHPDisplayedOnWideLayout || isSuperWideRHPDisplayedOnWideLayout;
    const {showConfirmModal} = useConfirmModal();

    const route = useRoute<
        | PlatformStackRouteProp<ReportsSplitNavigatorParamList, typeof SCREENS.REPORT>
        | PlatformStackRouteProp<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.EXPENSE_REPORT>
        | PlatformStackRouteProp<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.SEARCH_MONEY_REQUEST_REPORT>
        | PlatformStackRouteProp<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.SEARCH_REPORT>
    >();

    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`, {canBeMissing: true});
    const policy = usePolicy(report?.policyID);
    const [session] = useOnyx(ONYXKEYS.SESSION, {canBeMissing: false});
    const [dismissedRejectUseExplanation] = useOnyx(ONYXKEYS.NVP_DISMISSED_REJECT_USE_EXPLANATION, {canBeMissing: true});
    const [chatReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${report?.chatReportID}`, {canBeMissing: true});
    const chatReportID = chatReport?.reportID;
    const reportActionsKey = `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}` as const;
    const [reportActionsMap] = useOnyx(reportActionsKey, {canBeMissing: true});
    const reportActions = useMemo(() => Object.values(reportActionsMap ?? {}), [reportActionsMap]);

    const {transactions: reportTransactionsMap} = useTransactionsAndViolationsForReport(reportID);
    const transactions = useMemo(() => Object.values(reportTransactionsMap), [reportTransactionsMap]);

    const {selectedTransactionIDs, clearSelectedTransactions} = useSearchContext();

    const isOnSearch = route.name.toLowerCase().startsWith('search');

    const [isDownloadErrorModalVisible, setIsDownloadErrorModalVisible] = useState(false);
    const [offlineModalVisible, setOfflineModalVisible] = useState(false);
    const [rejectModalAction, setRejectModalAction] = useState<ValueOf<typeof CONST.REPORT.TRANSACTION_SECONDARY_ACTIONS.REJECT_BULK> | null>(null);

    const showExportProgressModal = useCallback(() => {
        return showConfirmModal({
            title: translate('export.exportInProgress'),
            prompt: translate('export.conciergeWillSend'),
            confirmText: translate('common.buttonConfirm'),
            shouldShowCancelButton: false,
        });
    }, [showConfirmModal, translate]);

    const beginExportWithTemplate = useCallback(
        (templateName: string, templateType: string, transactionIDList: string[], policyID?: string) => {
            if (isOffline) {
                setOfflineModalVisible(true);
                return;
            }

            if (!report) {
                return;
            }

            showExportProgressModal().then((result) => {
                if (result.action !== ModalActions.CONFIRM) {
                    return;
                }
                clearSelectedTransactions(undefined, true);
            });
            queueExportSearchWithTemplate({
                templateName,
                templateType,
                jsonQuery: '{}',
                reportIDList: [report.reportID],
                transactionIDList,
                policyID,
            });
        },
        [isOffline, report, showExportProgressModal, clearSelectedTransactions],
    );

    const {
        options: originalSelectedTransactionsOptions,
        handleDeleteTransactions,
        handleDeleteTransactionsWithNavigation,
    } = useSelectedTransactionsActions({
        report: report ?? undefined,
        reportActions,
        allTransactionsLength: transactions.length,
        session: session ?? undefined,
        onExportFailed: () => setIsDownloadErrorModalVisible(true),
        onExportOffline: () => setOfflineModalVisible(true),
        policy: policy ?? undefined,
        beginExportWithTemplate: (templateName, templateType, transactionIDList, policyID) => beginExportWithTemplate(templateName, templateType, transactionIDList, policyID),
        isOnSearch,
    });

    const showDeleteModal = useCallback(() => {
        showConfirmModal({
            title: translate('iou.deleteExpense', {count: selectedTransactionIDs.length}),
            prompt: translate('iou.deleteConfirmation', {count: selectedTransactionIDs.length}),
            confirmText: translate('common.delete'),
            cancelText: translate('common.cancel'),
            danger: true,
        }).then((result) => {
            if (result.action !== ModalActions.CONFIRM) {
                return;
            }
            if (transactions.filter((trans) => trans.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE).length === selectedTransactionIDs.length) {
                const backToRoute = route.params?.backTo ?? (chatReportID ? ROUTES.REPORT_WITH_ID.getRoute(chatReportID) : undefined);
                handleDeleteTransactionsWithNavigation(backToRoute);
            } else {
                handleDeleteTransactions();
            }
        });
    }, [showConfirmModal, translate, selectedTransactionIDs.length, transactions, handleDeleteTransactions, handleDeleteTransactionsWithNavigation, route.params?.backTo, chatReportID]);

    const dismissRejectModalBasedOnAction = () => {
        dismissRejectUseExplanation();
        if (report?.reportID) {
            Navigation.navigate(ROUTES.SEARCH_MONEY_REQUEST_REPORT_REJECT_TRANSACTIONS.getRoute({reportID: report.reportID}));
        }
        setRejectModalAction(null);
    };

    const selectedTransactionsOptions = useMemo(() => {
        return originalSelectedTransactionsOptions.map((option) => {
            if (option.value === CONST.REPORT.SECONDARY_ACTIONS.DELETE) {
                return {
                    ...option,
                    onSelected: showDeleteModal,
                };
            }
            if (option.value === CONST.REPORT.SECONDARY_ACTIONS.REJECT) {
                return {
                    ...option,
                    onSelected: () => {
                        if (dismissedRejectUseExplanation) {
                            option.onSelected?.();
                        } else {
                            setRejectModalAction(CONST.REPORT.TRANSACTION_SECONDARY_ACTIONS.REJECT_BULK);
                        }
                    },
                };
            }
            return option;
        });
    }, [originalSelectedTransactionsOptions, showDeleteModal, dismissedRejectUseExplanation]);

    if (!selectedTransactionsOptions.length) {
        return null;
    }

    return (
        <>
            {shouldDisplayNarrowMoreButton ? (
                <View>
                    <ButtonWithDropdownMenu
                        onPress={() => null}
                        options={selectedTransactionsOptions}
                        customText={translate('workspace.common.selected', {count: selectedTransactionIDs.length})}
                        isSplitButton={false}
                        shouldAlwaysShowDropdownMenu
                    />
                </View>
            ) : (
                <View style={[styles.dFlex, styles.w100, styles.ph5, styles.pb3]}>
                    <ButtonWithDropdownMenu
                        onPress={() => null}
                        options={selectedTransactionsOptions}
                        customText={translate('workspace.common.selected', {count: selectedTransactionIDs.length})}
                        isSplitButton={false}
                        shouldAlwaysShowDropdownMenu
                        wrapperStyle={styles.w100}
                    />
                </View>
            )}
            <DecisionModal
                title={translate('common.downloadFailedTitle')}
                prompt={translate('common.downloadFailedDescription')}
                isSmallScreenWidth={isSmallScreenWidth}
                onSecondOptionSubmit={() => setIsDownloadErrorModalVisible(false)}
                secondOptionText={translate('common.buttonConfirm')}
                isVisible={isDownloadErrorModalVisible}
                onClose={() => setIsDownloadErrorModalVisible(false)}
            />
            <DecisionModal
                title={translate('common.youAppearToBeOffline')}
                prompt={translate('common.offlinePrompt')}
                isSmallScreenWidth={isSmallScreenWidth}
                onSecondOptionSubmit={() => setOfflineModalVisible(false)}
                secondOptionText={translate('common.buttonConfirm')}
                isVisible={offlineModalVisible}
                onClose={() => setOfflineModalVisible(false)}
            />
            {!!rejectModalAction && (
                <HoldOrRejectEducationalModal
                    onClose={dismissRejectModalBasedOnAction}
                    onConfirm={dismissRejectModalBasedOnAction}
                />
            )}
        </>
    );
}

SelectedTransactionsButton.displayName = 'SelectedTransactionsButton';

export default SelectedTransactionsButton;
