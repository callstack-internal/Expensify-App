import {useRoute} from '@react-navigation/native';
import {hasSeenTourSelector} from '@selectors/Onboarding';
import mapValues from 'lodash/mapValues';
import React, {useEffect, useRef, useState} from 'react';
import {View} from 'react-native';
import type {StyleProp, ViewStyle} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import AttachmentPicker from '@components/AttachmentPicker';
import Icon from '@components/Icon';
import {ModalActions} from '@components/Modal/Global/ModalContext';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import PressableWithoutFeedback from '@components/Pressable/PressableWithoutFeedback';
import PressableWithoutFocus from '@components/Pressable/PressableWithoutFocus';
import ReceiptAudit from '@components/ReceiptAudit';
import ReceiptEmptyState from '@components/ReceiptEmptyState';
import {isElementHovered, resetButtonHoverState} from '@components/ReportActionItem/receiptHoverUtils';
import Tooltip from '@components/Tooltip';
import useActiveRoute from '@hooks/useActiveRoute';
import useAncestors from '@hooks/useAncestors';
import useCardFeedErrors from '@hooks/useCardFeedErrors';
import useConfirmModal from '@hooks/useConfirmModal';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useDelegateAccountID from '@hooks/useDelegateAccountID';
import useEnvironment from '@hooks/useEnvironment';
import useFilesValidation from '@hooks/useFilesValidation';
import useGetIOUReportFromReportAction from '@hooks/useGetIOUReportFromReportAction';
import useHover from '@hooks/useHover';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import useOriginalReportID from '@hooks/useOriginalReportID';
import usePrevious from '@hooks/usePrevious';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {getBrokenConnectionUrlToFixPersonalCard} from '@libs/CardUtils';
import {hasHoverSupport} from '@libs/DeviceCapabilities';
import {getMicroSecondOnyxErrorObject, getMicroSecondOnyxErrorWithTranslationKey, isReceiptError} from '@libs/ErrorUtils';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import {getThumbnailAndImageURIs} from '@libs/ReceiptUtils';
import {isMoneyRequestAction, wasActionTakenByCurrentUser} from '@libs/ReportActionsUtils';
import {isMarkAsCashActionForTransaction} from '@libs/ReportPrimaryActionUtils';
import {getCreationReportErrors, isInvoiceReport, isPaidGroupPolicy} from '@libs/ReportUtils';
import trackExpenseCreationError from '@libs/telemetry/trackExpenseCreationError';
import {
    didReceiptScanSucceed as didReceiptScanSucceedTransactionUtils,
    hasReceipt as hasReceiptTransactionUtils,
    isDistanceRequest as isDistanceRequestTransactionUtils,
    isManualDistanceRequest,
    isScanning,
} from '@libs/TransactionUtils';
import ViolationsUtils, {filterReceiptViolations} from '@libs/Violations/ViolationsUtils';
import Navigation from '@navigation/Navigation';
import variables from '@styles/variables';
import {clearAllRelatedReportActionErrors} from '@userActions/ClearReportActionErrors';
import {cleanUpMoneyRequest} from '@userActions/IOU/DeleteMoneyRequest';
import {replaceReceipt} from '@userActions/IOU/Receipt';
import {addAttachmentWithComment, navigateToConciergeChatAndDeleteReport, setDeleteTransactionNavigateBackUrl} from '@userActions/Report';
import {clearError, getLastModifiedExpense, revert} from '@userActions/Transaction';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Transaction, ViolationName} from '@src/types/onyx';
import type {TransactionPendingFieldsKey} from '@src/types/onyx/Transaction';
import type {FileObject} from '@src/types/utils/Attachment';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import {useLiveTransactionField} from '../contexts/LiveTransactionProvider';
import {useSnapshotTransactionField} from '../contexts/SnapshotTransactionProvider';
import {useFieldEditPermission, useParentReportID, useTransactionThreadReport} from '../contexts/ThreadProvider';
import {useAllViolations} from '../contexts/ViolationsProvider';
import ReceiptDisplay from './ReceiptDisplay';

type ReceiptCardProps = {
    readonly?: boolean;
    updatedTransaction?: OnyxEntry<Transaction>;
    mergeTransactionID?: string;
    fillSpace?: boolean;
    isDisplayedInWideRHP?: boolean;
    hasParentPendingAction?: boolean;
};

const receiptImageViolationNames = new Set<ViolationName>([
    CONST.VIOLATIONS.RECEIPT_REQUIRED,
    CONST.VIOLATIONS.ITEMIZED_RECEIPT_REQUIRED,
    CONST.VIOLATIONS.RECEIPT_NOT_SMART_SCANNED,
    CONST.VIOLATIONS.CASH_EXPENSE_WITH_NO_RECEIPT,
    CONST.VIOLATIONS.SMARTSCAN_FAILED,
    CONST.VIOLATIONS.PROHIBITED_EXPENSE,
    CONST.VIOLATIONS.RECEIPT_GENERATED_WITH_AI,
]);

const receiptFieldViolationNames = new Set<ViolationName>([CONST.VIOLATIONS.MODIFIED_AMOUNT, CONST.VIOLATIONS.MODIFIED_DATE]);

function ReceiptCard({readonly = false, updatedTransaction, mergeTransactionID, fillSpace = false, isDisplayedInWideRHP = false, hasParentPendingAction = false}: ReceiptCardProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const {environmentURL} = useEnvironment();
    const {shouldUseNarrowLayout, isInNarrowPaneModal} = useResponsiveLayout();
    const {getReportRHPActiveRoute} = useActiveRoute();
    const route = useRoute();
    const routeBackTo = (route.params as {backTo?: string} | undefined)?.backTo;

    const transaction = useLiveTransactionField((tx: Transaction) => tx);
    const transactionViolations = useAllViolations();
    const transactionThreadReport = useTransactionThreadReport();
    const parentReportID = useParentReportID();
    const canEditReceiptBase = useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.RECEIPT);

    const report = transactionThreadReport;
    const [parentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getNonEmptyStringOnyxID(parentReportID)}`);
    const [chatReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getNonEmptyStringOnyxID(parentReport?.parentReportID)}`);
    const [parentReportActions] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${parentReportID}`);
    const [conciergeReportID] = useOnyx(ONYXKEYS.CONCIERGE_REPORT_ID);
    const [introSelected] = useOnyx(ONYXKEYS.NVP_INTRO_SELECTED);
    const [isSelfTourViewed] = useOnyx(ONYXKEYS.NVP_ONBOARDING, {selector: hasSeenTourSelector});
    const [betas] = useOnyx(ONYXKEYS.BETAS);
    const delegateAccountID = useDelegateAccountID();

    const [isLoading, setIsLoading] = useState(true);
    const parentReportAction = report?.parentReportActionID ? parentReportActions?.[report.parentReportActionID] : undefined;
    const originalReportID = useOriginalReportID(report?.reportID, parentReportAction);
    const {iouReport, chatReport: chatIOUReport, isChatIOUReportArchived} = useGetIOUReportFromReportAction(parentReportAction);
    const moneyRequestReport = parentReport;
    const linkedTransactionID = transaction?.transactionID;

    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${moneyRequestReport?.policyID}`);
    const [policyCategories] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_CATEGORIES}${moneyRequestReport?.policyID}`);
    const [policyTagList] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_TAGS}${policy?.id}`);
    const [cardList] = useOnyx(ONYXKEYS.CARD_LIST);

    const isDistanceRequest = isDistanceRequestTransactionUtils(transaction);
    const hasReceipt = hasReceiptTransactionUtils(updatedTransaction ?? transaction);
    const isTransactionScanning = isScanning(updatedTransaction ?? transaction);
    const didReceiptScanSucceed = hasReceipt && didReceiptScanSucceedTransactionUtils(transaction);
    const isInvoice = isInvoiceReport(moneyRequestReport);
    const {login: currentUserLogin, accountID: currentUserAccountID, timezone: currentUserTimezone} = useCurrentUserPersonalDetails();
    const theme = useTheme();
    const ancestors = useAncestors(report);
    const {hovered, bind: hoverBind} = useHover();
    const {isOffline} = useNetwork();
    const receiptContainerRef = useRef<View | null>(null);
    const addButtonRef = useRef<View | null>(null);
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const deviceHasHoverSupport = hasHoverSupport();
    const lazyIcons = useMemoizedLazyExpensifyIcons(['Expand', 'ReceiptPlus']);

    useEffect(() => {
        if (isLoading) {
            return;
        }
        if (isElementHovered(receiptContainerRef)) {
            hoverBind.onMouseEnter();
        }
    }, [isLoading, hoverBind]);

    const displayedReceiptSource = transaction?.receipt?.localSource ?? transaction?.receipt?.source;
    const prevDisplayedReceiptSource = usePrevious(displayedReceiptSource);

    useEffect(() => {
        if (!displayedReceiptSource || prevDisplayedReceiptSource === displayedReceiptSource) {
            return;
        }
        // Reset loading when the source URL changes so the new image triggers onLoad again.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsLoading(true);
    }, [displayedReceiptSource, prevDisplayedReceiptSource]);

    const canEditReceipt = canEditReceiptBase && !readonly;
    const isActionTakenByCurrentUser = isMoneyRequestAction(parentReportAction) && wasActionTakenByCurrentUser(parentReportAction);
    const companyCardPageURL = `${environmentURL}/${ROUTES.WORKSPACE_COMPANY_CARDS.getRoute(report?.policyID)}`;
    const {personalCardsWithBrokenConnection} = useCardFeedErrors();
    const connectionLink = getBrokenConnectionUrlToFixPersonalCard(personalCardsWithBrokenConnection, environmentURL);

    const onAttachmentFilesValidated = (files: FileObject[]) => {
        if (!report?.reportID) {
            return;
        }
        const notifyReportID = moneyRequestReport?.reportID ? [report.reportID, moneyRequestReport.reportID] : report.reportID;
        addAttachmentWithComment({
            report,
            notifyReportID,
            ancestors,
            attachments: files,
            currentUserAccountID,
            timezone: currentUserTimezone,
            delegateAccountID,
        });
    };

    const {validateFiles, PDFValidationComponent, ErrorModal: AttachmentErrorModal} = useFilesValidation(onAttachmentFilesValidated);

    let iouType: ValueOf<typeof CONST.IOU.TYPE> = CONST.IOU.TYPE.SUBMIT;
    if (isInvoice) {
        iouType = CONST.IOU.TYPE.INVOICE;
    }

    let receiptURIs;
    if (hasReceipt) {
        receiptURIs = getThumbnailAndImageURIs(updatedTransaction ?? transaction);
    }
    const pendingAction = transaction?.pendingAction;
    const getPendingFieldAction = (fieldPath: TransactionPendingFieldsKey) => {
        if (hasParentPendingAction) {
            return undefined;
        }
        if (isDisplayedInWideRHP) {
            return transaction?.pendingFields?.[fieldPath] ?? pendingAction;
        }
        return pendingAction ? undefined : transaction?.pendingFields?.[fieldPath];
    };

    const transactionToCheck = updatedTransaction ?? transaction;
    const doesTransactionHaveReceipt = !!transactionToCheck?.receipt && !isEmptyObject(transactionToCheck?.receipt);
    const shouldShowReceiptEmptyState = (isDisplayedInWideRHP || !isInvoice) && !hasReceipt && !!transactionToCheck && !doesTransactionHaveReceipt;
    const isMarkAsCash = parentReport && currentUserLogin ? isMarkAsCashActionForTransaction(currentUserLogin, parentReport, transactionViolations, policy) : false;

    const routeDistanceMeters = transaction?.comment?.customUnit?.routeDistanceMeters;
    const distanceUnit = transaction?.comment?.customUnit?.distanceUnit;

    const receiptImageViolations: string[] = [];
    const receiptViolations: string[] = [];
    const filteredViolations = filterReceiptViolations(transactionViolations ?? []);
    for (const violation of filteredViolations) {
        const isReceiptFieldViolation = receiptFieldViolationNames.has(violation.name);
        const isReceiptImageViolation = receiptImageViolationNames.has(violation.name);
        const isRTERViolation = violation.name === CONST.VIOLATIONS.RTER;
        if (isReceiptFieldViolation || isReceiptImageViolation || isRTERViolation) {
            const cardID = violation.data?.cardID;
            const card = cardID ? cardList?.[cardID] : undefined;
            const violationMessage = ViolationsUtils.getViolationTranslation({
                violation,
                translate,
                canEdit: isActionTakenByCurrentUser && canEditReceiptBase,
                companyCardPageURL,
                connectionLink,
                card,
                isMarkAsCash,
                routeDistanceMeters,
                distanceUnit,
            });
            receiptViolations.push(violationMessage);
            if (isReceiptImageViolation || isRTERViolation) {
                receiptImageViolations.push(violationMessage);
            }
        }
    }

    const receiptRequiredViolation = transactionViolations?.some((violation) => violation.name === CONST.VIOLATIONS.RECEIPT_REQUIRED);
    const itemizedReceiptRequiredViolation = transactionViolations?.some((violation) => violation.name === CONST.VIOLATIONS.ITEMIZED_RECEIPT_REQUIRED);
    const customRulesViolation = transactionViolations?.some((violation) => violation.name === CONST.VIOLATIONS.CUSTOM_RULES);

    const errorsWithoutReportCreation = {
        ...(transaction?.errorFields?.route ?? transaction?.errorFields?.waypoints ?? transaction?.errors),
        ...parentReportAction?.errors,
    };
    const reportCreationError = getCreationReportErrors(report) ? getMicroSecondOnyxErrorWithTranslationKey('report.genericCreateReportFailureMessage') : {};
    const hasReceiptUploadError = Object.values(errorsWithoutReportCreation).some((error) => isReceiptError(error));

    const shouldShowAuditMessage =
        !isTransactionScanning &&
        (hasReceipt || !!receiptRequiredViolation || !!itemizedReceiptRequiredViolation || !!customRulesViolation) &&
        !!(receiptViolations.length || didReceiptScanSucceed) &&
        isPaidGroupPolicy(report);
    const shouldShowReceiptAudit = !isInvoice && (shouldShowReceiptEmptyState || hasReceipt || hasReceiptUploadError);

    let fallbackReceiptError: ReturnType<typeof getMicroSecondOnyxErrorObject> = {};
    if (!hasReceiptUploadError && !isEmptyObject(reportCreationError) && hasReceipt && !!transaction?.receipt) {
        fallbackReceiptError = getMicroSecondOnyxErrorObject({
            error: CONST.IOU.RECEIPT_ERROR,
            source: transaction.receipt.source?.toString() ?? '',
            filename: transaction.receipt.filename ?? '',
        });
    }

    let errors: typeof errorsWithoutReportCreation;
    if (hasReceiptUploadError) {
        errors = errorsWithoutReportCreation;
    } else if (!isEmptyObject(fallbackReceiptError)) {
        errors = {...errorsWithoutReportCreation, ...fallbackReceiptError};
    } else {
        errors = {...errorsWithoutReportCreation, ...reportCreationError};
    }
    const showReceiptErrorWithEmptyState = shouldShowReceiptEmptyState && !hasReceipt && !isEmptyObject(errors);

    const {showConfirmModal} = useConfirmModal();

    const transactionAndReportActionErrors = {
        ...transaction?.errors,
        ...parentReportAction?.errors,
    };

    const dismissReceiptError = () => {
        if (!report?.reportID) {
            return;
        }

        if (!isEmptyObject(errors)) {
            let errorType: ValueOf<typeof CONST.TELEMETRY.EXPENSE_ERROR_TYPE>;
            let errorSource: ValueOf<typeof CONST.TELEMETRY.EXPENSE_ERROR_SOURCE>;

            if (!isEmptyObject(reportCreationError)) {
                errorType = CONST.TELEMETRY.EXPENSE_ERROR_TYPE.REPORT_CREATION_FAILED;
                errorSource = CONST.TELEMETRY.EXPENSE_ERROR_SOURCE.REPORT_CREATION;
            } else if (parentReportAction?.errors && !isEmptyObject(parentReportAction.errors)) {
                errorType = CONST.TELEMETRY.EXPENSE_ERROR_TYPE.TRANSACTION_MISSING;
                errorSource = CONST.TELEMETRY.EXPENSE_ERROR_SOURCE.REPORT_ACTION;
            } else {
                errorType = CONST.TELEMETRY.EXPENSE_ERROR_TYPE.TRANSACTION_MISSING;
                errorSource = CONST.TELEMETRY.EXPENSE_ERROR_SOURCE.TRANSACTION;
            }

            const errorValue = Object.values(errors).at(0);
            const errorMessage = typeof errorValue === 'string' ? errorValue : JSON.stringify(errorValue);
            const isRequestPending = transaction?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD;
            const isTransactionMissing = !transaction?.transactionID && !!linkedTransactionID;

            trackExpenseCreationError(null, {
                errorType,
                errorSource,
                reportID: report.reportID,
                transactionID: linkedTransactionID,
                hasReceipt,
                pendingAction: transaction?.pendingAction,
                iouType,
                errorMessage,
                isRequestPending,
                isTransactionMissing,
            });
        }
        if (transaction?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD) {
            if (chatReport?.reportID && getCreationReportErrors(chatReport)) {
                navigateToConciergeChatAndDeleteReport(chatReport.reportID, conciergeReportID, currentUserAccountID, introSelected, isSelfTourViewed, betas, true, true);
                return;
            }
            if (parentReportAction) {
                const backToRoute = routeBackTo ?? Navigation.getActiveRoute();
                setDeleteTransactionNavigateBackUrl(backToRoute);
                cleanUpMoneyRequest(
                    transaction?.transactionID ?? linkedTransactionID,
                    parentReportAction,
                    report.reportID,
                    iouReport,
                    chatIOUReport,
                    isChatIOUReportArchived,
                    originalReportID,
                    true,
                );
                return;
            }
        }

        if (!transaction?.transactionID) {
            if (!linkedTransactionID) {
                return;
            }
            clearError(linkedTransactionID);
            clearAllRelatedReportActionErrors(report.reportID, parentReportAction, originalReportID);
            return;
        }
        if (!isEmptyObject(transactionAndReportActionErrors)) {
            revert(transaction, getLastModifiedExpense(report?.reportID));
        }
        if (!isEmptyObject(errorsWithoutReportCreation)) {
            clearError(transaction.transactionID);
            clearAllRelatedReportActionErrors(report.reportID, parentReportAction, originalReportID);
        }
        if (!isEmptyObject(reportCreationError)) {
            if (isInNarrowPaneModal) {
                Navigation.goBack();
            }
            navigateToConciergeChatAndDeleteReport(report.reportID, conciergeReportID, currentUserAccountID, introSelected, isSelfTourViewed, betas, true, true);
        }
    };

    let receiptStyle: StyleProp<ViewStyle>;
    if (fillSpace && shouldShowReceiptEmptyState) {
        receiptStyle = styles.h100;
    } else if (fillSpace) {
        receiptStyle = styles.flexibleHeight;
    } else {
        receiptStyle = shouldUseNarrowLayout ? styles.expenseViewImageSmall : styles.expenseViewImage;
    }

    const showBorderlessLoading = isLoading && fillSpace;
    const isMapDistanceRequest = !!transaction && isDistanceRequest && !isManualDistanceRequest(transaction);
    const canShowReceiptActions = hasReceipt && !isLoading && canEditReceiptBase && !isMapDistanceRequest && !mergeTransactionID;
    const receiptPendingAction = isDistanceRequest ? getPendingFieldAction('waypoints') : getPendingFieldAction('receipt');
    const isReceiptOfflinePending = isOffline && !!receiptPendingAction;

    const setReceiptFile = (files: FileObject[]) => {
        if (files.length === 0) {
            return;
        }
        const file = files.at(0);
        if (!file || !linkedTransactionID) {
            return;
        }
        const source = URL.createObjectURL(file as Blob);
        replaceReceipt({
            transactionID: linkedTransactionID,
            file: file as File,
            source,
            transactionPolicy: policy,
            transactionPolicyCategories: policyCategories,
            transactionPolicyTagList: policyTagList,
        });
    };

    const auditMessagesRow = !hasReceiptUploadError && !!shouldShowAuditMessage;
    const auditMessagesStyleForBlock = isEmptyObject(errors) && isDisplayedInWideRHP ? styles.mb3 : undefined;

    return (
        <View style={fillSpace ? styles.flex1 : styles.pRelative}>
            {shouldShowReceiptAudit && (
                <OfflineWithFeedback pendingAction={getPendingFieldAction('receipt')}>
                    <ReceiptAudit
                        notes={receiptViolations}
                        shouldShowAuditResult={!!shouldShowAuditMessage}
                        hasReceiptUploadError={hasReceiptUploadError}
                    />
                </OfflineWithFeedback>
            )}
            {shouldShowReceiptEmptyState && (
                <OfflineWithFeedback
                    pendingAction={getPendingFieldAction('receipt')}
                    style={[styles.mt3, isEmptyObject(errors) && styles.mb3, styles.flex1]}
                    contentContainerStyle={styles.flex1}
                >
                    <ReceiptEmptyState
                        disabled={!canEditReceipt}
                        onPress={() => {
                            if (!transaction?.transactionID || !report?.reportID) {
                                return;
                            }
                            Navigation.navigate(
                                ROUTES.MONEY_REQUEST_STEP_SCAN.getRoute(CONST.IOU.ACTION.EDIT, iouType, transaction.transactionID, report.reportID, getReportRHPActiveRoute()),
                            );
                        }}
                        isThumbnail={!canEditReceipt}
                        isInMoneyRequestView
                        style={receiptStyle}
                        isDisplayedInWideRHP={isDisplayedInWideRHP}
                        setReceiptFile={setReceiptFile}
                    />
                </OfflineWithFeedback>
            )}
            {(hasReceipt || !isEmptyObject(errors)) && (
                <OfflineWithFeedback
                    shouldDisableOpacity={canShowReceiptActions}
                    pendingAction={receiptPendingAction}
                    errors={errors}
                    errorRowStyles={[styles.mh4, !shouldShowReceiptEmptyState && styles.mt3]}
                    onClose={() => {
                        if (!transaction?.transactionID && !linkedTransactionID) {
                            return;
                        }
                        const errorEntries = Object.entries(errors ?? {});
                        const errorMessages = mapValues(Object.fromEntries(errorEntries), (error) => error);
                        const hasReceiptErr = Object.values(errorMessages).some((error) => isReceiptError(error));
                        if (!hasReceiptErr) {
                            dismissReceiptError();
                            return;
                        }
                        showConfirmModal({
                            title: translate('iou.dismissReceiptError'),
                            prompt: translate('iou.dismissReceiptErrorConfirmation'),
                            confirmText: translate('common.dismiss'),
                            cancelText: translate('common.cancel'),
                            shouldShowCancelButton: true,
                            danger: true,
                        }).then((result) => {
                            if (result.action !== ModalActions.CONFIRM) {
                                return;
                            }
                            dismissReceiptError();
                        });
                    }}
                    dismissError={dismissReceiptError}
                    style={[shouldShowAuditMessage ? styles.mt3 : styles.mv3, !showReceiptErrorWithEmptyState && styles.flex1]}
                    contentContainerStyle={styles.flex1}
                >
                    {hasReceipt && (
                        <View
                            ref={receiptContainerRef}
                            onMouseEnter={() => !isLoading && hoverBind.onMouseEnter()}
                            onMouseLeave={hoverBind.onMouseLeave}
                        >
                            <ReceiptDisplay
                                transaction={updatedTransaction ?? transaction}
                                report={report}
                                receiptURIs={receiptURIs}
                                receiptStyle={receiptStyle}
                                fillSpace={fillSpace}
                                showBorderlessLoading={showBorderlessLoading}
                                isReceiptOfflinePending={isReceiptOfflinePending}
                                readonly={readonly}
                                canEditReceipt={canEditReceipt}
                                mergeTransactionID={mergeTransactionID}
                                onLoad={() => setIsLoading(false)}
                                onLoadFailure={() => setIsLoading(false)}
                                auditMessages={receiptImageViolations}
                                shouldShowAuditMessages={auditMessagesRow && hasReceipt && (!isLoading || !fillSpace)}
                                auditMessagesStyle={auditMessagesStyleForBlock}
                            >
                                {canShowReceiptActions && (
                                    <View style={[styles.receiptActionButtonsContainer, styles.pointerEventsBoxNone, !hovered && !isPickerOpen && deviceHasHoverSupport && styles.opacity0]}>
                                        <AttachmentPicker acceptedFileTypes={[...CONST.API_ATTACHMENT_VALIDATIONS.ALLOWED_RECEIPT_EXTENSIONS]}>
                                            {({openPicker}) => (
                                                <Tooltip text={translate('receipt.addAdditionalReceipt')}>
                                                    <PressableWithoutFeedback
                                                        ref={addButtonRef}
                                                        onPress={() => {
                                                            setIsPickerOpen(true);
                                                            resetButtonHoverState(addButtonRef);
                                                            const onPickerClosed = () => {
                                                                setIsPickerOpen(false);
                                                                if (isElementHovered(receiptContainerRef)) {
                                                                    hoverBind.onMouseEnter();
                                                                }
                                                            };
                                                            openPicker({
                                                                onPicked: (files) => {
                                                                    onPickerClosed();
                                                                    validateFiles(files, undefined, {isValidatingReceipts: false});
                                                                },
                                                                onCanceled: onPickerClosed,
                                                            });
                                                        }}
                                                        style={styles.receiptActionButton}
                                                        hoverStyle={styles.buttonDefaultHovered}
                                                        accessibilityLabel={translate('receipt.addAdditionalReceipt')}
                                                        role={CONST.ROLE.BUTTON}
                                                        sentryLabel={CONST.SENTRY_LABEL.RECEIPT.ADD_ATTACHMENT_BUTTON}
                                                    >
                                                        <Icon
                                                            src={lazyIcons.ReceiptPlus}
                                                            height={variables.iconSizeSmall}
                                                            width={variables.iconSizeSmall}
                                                            fill={theme.icon}
                                                        />
                                                    </PressableWithoutFeedback>
                                                </Tooltip>
                                            )}
                                        </AttachmentPicker>
                                        <Tooltip text={translate('reportActionCompose.expand')}>
                                            <PressableWithoutFocus
                                                onPress={() =>
                                                    Navigation.navigate(
                                                        ROUTES.TRANSACTION_RECEIPT.getRoute(
                                                            report?.reportID,
                                                            (updatedTransaction ?? transaction)?.transactionID,
                                                            readonly || !canEditReceipt,
                                                        ),
                                                    )
                                                }
                                                style={styles.receiptActionButton}
                                                hoverStyle={styles.buttonDefaultHovered}
                                                accessibilityLabel={translate('accessibilityHints.viewAttachment')}
                                                role={CONST.ROLE.BUTTON}
                                                sentryLabel={CONST.SENTRY_LABEL.RECEIPT.ENLARGE_BUTTON}
                                            >
                                                <Icon
                                                    src={lazyIcons.Expand}
                                                    height={variables.iconSizeSmall}
                                                    width={variables.iconSizeSmall}
                                                    fill={theme.icon}
                                                />
                                            </PressableWithoutFocus>
                                        </Tooltip>
                                    </View>
                                )}
                            </ReceiptDisplay>
                        </View>
                    )}
                </OfflineWithFeedback>
            )}
            {!shouldShowReceiptEmptyState && !hasReceipt && <View style={{marginVertical: 6}} />}
            {auditMessagesRow && !hasReceipt && (
                <View style={[styles.mt3, isEmptyObject(errors) && isDisplayedInWideRHP && styles.mb3]}>
                    <ReceiptAudit
                        notes={receiptImageViolations}
                        shouldShowAuditResult={false}
                        hasReceiptUploadError={false}
                    />
                </View>
            )}
            {AttachmentErrorModal}
            {PDFValidationComponent}
        </View>
    );
}

function ReceiptCardSnapshot() {
    const styles = useThemeStyles();
    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const transaction = useSnapshotTransactionField((tx: Transaction) => tx);
    const hasReceipt = hasReceiptTransactionUtils(transaction);

    if (!hasReceipt) {
        return null;
    }

    const receiptURIs = getThumbnailAndImageURIs(transaction);
    const receiptStyle = shouldUseNarrowLayout ? styles.expenseViewImageSmall : styles.expenseViewImage;

    return (
        <View style={styles.pRelative}>
            <ReceiptDisplay
                transaction={transaction}
                receiptURIs={receiptURIs}
                receiptStyle={receiptStyle}
                fillSpace={false}
                showBorderlessLoading={false}
                isReceiptOfflinePending={false}
                readonly
                canEditReceipt={false}
                onLoad={() => {}}
                onLoadFailure={() => {}}
                auditMessages={[]}
                shouldShowAuditMessages={false}
            />
        </View>
    );
}

export {ReceiptCard, ReceiptCardSnapshot};
