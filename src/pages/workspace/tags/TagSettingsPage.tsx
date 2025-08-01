import React, {useEffect, useMemo, useState} from 'react';
import {View} from 'react-native';
import ConfirmModal from '@components/ConfirmModal';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import * as Expensicons from '@components/Icon/Expensicons';
import MenuItem from '@components/MenuItem';
import MenuItemWithTopDescription from '@components/MenuItemWithTopDescription';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import ScreenWrapper from '@components/ScreenWrapper';
import Switch from '@components/Switch';
import Text from '@components/Text';
import TextLink from '@components/TextLink';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import usePolicy from '@hooks/usePolicy';
import useThemeStyles from '@hooks/useThemeStyles';
import {getLatestErrorMessageField} from '@libs/ErrorUtils';
import Navigation from '@libs/Navigation/Navigation';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import {isDisablingOrDeletingLastEnabledTag} from '@libs/OptionsListUtils';
import {getPersonalDetailByEmail} from '@libs/PersonalDetailsUtils';
import {
    getCleanedTagName,
    getTagApproverRule,
    getTagListByOrderWeight,
    getWorkflowApprovalsUnavailable,
    hasAccountingConnections as hasAccountingConnectionsPolicyUtils,
    hasDependentTags as hasDependentTagsPolicyUtils,
    isControlPolicy,
    isMultiLevelTags as isMultiLevelTagsPolicyUtils,
} from '@libs/PolicyUtils';
import type {SettingsNavigatorParamList} from '@navigation/types';
import NotFoundPage from '@pages/ErrorPage/NotFoundPage';
import AccessOrNotFoundWrapper from '@pages/workspace/AccessOrNotFoundWrapper';
import {clearPolicyTagErrors, deletePolicyTags, setWorkspaceTagEnabled} from '@userActions/Policy/Tag';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';

type TagSettingsPageProps =
    | PlatformStackScreenProps<SettingsNavigatorParamList, typeof SCREENS.WORKSPACE.TAG_SETTINGS>
    | PlatformStackScreenProps<SettingsNavigatorParamList, typeof SCREENS.SETTINGS_TAGS.SETTINGS_TAG_SETTINGS>;

function TagSettingsPage({route, navigation}: TagSettingsPageProps) {
    const [policyTags] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_TAGS}${route.params.policyID}`, {canBeMissing: true});
    const {orderWeight, policyID, tagName, backTo, parentTagsFilter} = route.params;
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const policyTag = useMemo(() => getTagListByOrderWeight(policyTags, orderWeight), [policyTags, orderWeight]);
    const policy = usePolicy(policyID);
    const hasAccountingConnections = hasAccountingConnectionsPolicyUtils(policy);
    const [isDeleteTagModalOpen, setIsDeleteTagModalOpen] = React.useState(false);
    const [isCannotDeleteOrDisableLastTagModalVisible, setIsCannotDeleteOrDisableLastTagModalVisible] = useState(false);
    const isQuickSettingsFlow = route.name === SCREENS.SETTINGS_TAGS.SETTINGS_TAG_SETTINGS;
    const tagApprover = getTagApproverRule(policyID, route.params?.tagName)?.approver ?? '';
    const approver = getPersonalDetailByEmail(tagApprover);
    const approverText = approver?.displayName ?? tagApprover;
    const hasDependentTags = useMemo(() => hasDependentTagsPolicyUtils(policy, policyTags), [policy, policyTags]);
    const currentPolicyTag = useMemo(() => {
        if (hasDependentTags) {
            return Object.values(policyTag.tags ?? {}).find((tag) => tag?.name === tagName && tag.rules?.parentTagsFilter === parentTagsFilter);
        }
        return policyTag.tags[tagName] ?? Object.values(policyTag.tags ?? {}).find((tag) => tag.previousTagName === tagName);
    }, [policyTag, tagName, parentTagsFilter, hasDependentTags]);

    const shouldPreventDisableOrDelete = isDisablingOrDeletingLastEnabledTag(policyTag, [currentPolicyTag]);

    useEffect(() => {
        if (currentPolicyTag?.name === tagName || !currentPolicyTag) {
            return;
        }
        navigation.setParams({tagName: currentPolicyTag?.name});
    }, [tagName, currentPolicyTag, navigation]);

    if (!currentPolicyTag) {
        return <NotFoundPage />;
    }

    const deleteTagAndHideModal = () => {
        deletePolicyTags(policyID, [currentPolicyTag.name]);
        setIsDeleteTagModalOpen(false);
        Navigation.goBack(isQuickSettingsFlow ? ROUTES.SETTINGS_TAGS_ROOT.getRoute(policyID, backTo) : undefined);
    };

    const updateWorkspaceTagEnabled = (value: boolean) => {
        if (shouldPreventDisableOrDelete) {
            setIsCannotDeleteOrDisableLastTagModalVisible(true);
            return;
        }
        setWorkspaceTagEnabled(policyID, {[currentPolicyTag.name]: {name: currentPolicyTag.name, enabled: value}}, policyTag.orderWeight);
    };

    const navigateToEditTag = () => {
        Navigation.navigate(
            isQuickSettingsFlow
                ? ROUTES.SETTINGS_TAG_EDIT.getRoute(policyID, orderWeight, currentPolicyTag.name, backTo)
                : ROUTES.WORKSPACE_TAG_EDIT.getRoute(policyID, orderWeight, currentPolicyTag.name),
        );
    };

    const navigateToEditGlCode = () => {
        if (!isControlPolicy(policy)) {
            Navigation.navigate(
                ROUTES.WORKSPACE_UPGRADE.getRoute(
                    policyID,
                    CONST.UPGRADE_FEATURE_INTRO_MAPPING.glCodes.alias,
                    isQuickSettingsFlow
                        ? ROUTES.SETTINGS_TAG_GL_CODE.getRoute(policyID, orderWeight, tagName, backTo)
                        : ROUTES.WORKSPACE_TAG_GL_CODE.getRoute(policyID, orderWeight, tagName),
                ),
            );
            return;
        }
        Navigation.navigate(
            isQuickSettingsFlow
                ? ROUTES.SETTINGS_TAG_GL_CODE.getRoute(policyID, orderWeight, currentPolicyTag.name, backTo)
                : ROUTES.WORKSPACE_TAG_GL_CODE.getRoute(policyID, orderWeight, currentPolicyTag.name),
        );
    };

    const navigateToEditTagApprover = () => {
        Navigation.navigate(
            isQuickSettingsFlow
                ? ROUTES.SETTINGS_TAG_APPROVER.getRoute(policyID, orderWeight, currentPolicyTag.name, backTo)
                : ROUTES.WORKSPACE_TAG_APPROVER.getRoute(policyID, orderWeight, currentPolicyTag.name),
        );
    };

    const isThereAnyAccountingConnection = Object.keys(policy?.connections ?? {}).length !== 0;
    const isMultiLevelTags = isMultiLevelTagsPolicyUtils(policyTags);

    const shouldShowDeleteMenuItem = !isThereAnyAccountingConnection && !isMultiLevelTags;
    const workflowApprovalsUnavailable = getWorkflowApprovalsUnavailable(policy);
    const approverDisabled = !policy?.areWorkflowsEnabled || workflowApprovalsUnavailable;

    return (
        <AccessOrNotFoundWrapper
            accessVariants={[CONST.POLICY.ACCESS_VARIANTS.ADMIN, CONST.POLICY.ACCESS_VARIANTS.PAID]}
            policyID={policyID}
            featureName={CONST.POLICY.MORE_FEATURES.ARE_TAGS_ENABLED}
        >
            <ScreenWrapper
                enableEdgeToEdgeBottomSafeAreaPadding
                style={[styles.defaultModalContainer]}
                testID={TagSettingsPage.displayName}
            >
                <HeaderWithBackButton
                    title={getCleanedTagName(tagName)}
                    shouldSetModalVisibility={false}
                    onBackButtonPress={() => Navigation.goBack(isQuickSettingsFlow ? ROUTES.SETTINGS_TAGS_ROOT.getRoute(policyID, backTo) : undefined)}
                />
                <ConfirmModal
                    title={translate('workspace.tags.deleteTag')}
                    isVisible={isDeleteTagModalOpen}
                    onConfirm={deleteTagAndHideModal}
                    onCancel={() => setIsDeleteTagModalOpen(false)}
                    shouldSetModalVisibility={false}
                    prompt={translate('workspace.tags.deleteTagConfirmation')}
                    confirmText={translate('common.delete')}
                    cancelText={translate('common.cancel')}
                    danger
                />
                <ConfirmModal
                    isVisible={isCannotDeleteOrDisableLastTagModalVisible}
                    onConfirm={() => setIsCannotDeleteOrDisableLastTagModalVisible(false)}
                    onCancel={() => setIsCannotDeleteOrDisableLastTagModalVisible(false)}
                    title={translate('workspace.tags.cannotDeleteOrDisableAllTags.title')}
                    prompt={translate('workspace.tags.cannotDeleteOrDisableAllTags.description')}
                    confirmText={translate('common.buttonConfirm')}
                    shouldShowCancelButton={false}
                />

                <View style={styles.flexGrow1}>
                    {!hasDependentTags && (
                        <OfflineWithFeedback
                            errors={getLatestErrorMessageField(currentPolicyTag)}
                            pendingAction={currentPolicyTag.pendingFields?.enabled}
                            errorRowStyles={styles.mh5}
                            onClose={() => clearPolicyTagErrors(policyID, tagName, orderWeight)}
                        >
                            <View style={[styles.mt2, styles.mh5]}>
                                <View style={[styles.flexRow, styles.mb5, styles.mr2, styles.alignItemsCenter, styles.justifyContentBetween]}>
                                    <Text>{translate('workspace.tags.enableTag')}</Text>
                                    <Switch
                                        isOn={currentPolicyTag.enabled}
                                        accessibilityLabel={translate('workspace.tags.enableTag')}
                                        onToggle={updateWorkspaceTagEnabled}
                                        showLockIcon={shouldPreventDisableOrDelete}
                                    />
                                </View>
                            </View>
                        </OfflineWithFeedback>
                    )}
                    <OfflineWithFeedback pendingAction={currentPolicyTag.pendingFields?.name}>
                        <MenuItemWithTopDescription
                            title={getCleanedTagName(currentPolicyTag.name)}
                            description={translate(`common.name`)}
                            onPress={navigateToEditTag}
                            interactive={!hasDependentTags}
                            shouldShowRightIcon={!hasDependentTags}
                        />
                    </OfflineWithFeedback>
                    {(!hasDependentTags || !!currentPolicyTag?.['GL Code']) && (
                        <OfflineWithFeedback pendingAction={currentPolicyTag.pendingFields?.['GL Code']}>
                            <MenuItemWithTopDescription
                                description={translate(`workspace.tags.glCode`)}
                                title={currentPolicyTag?.['GL Code']}
                                onPress={navigateToEditGlCode}
                                iconRight={hasAccountingConnections ? Expensicons.Lock : undefined}
                                interactive={!hasAccountingConnections && !hasDependentTags}
                                shouldShowRightIcon={!hasDependentTags}
                            />
                        </OfflineWithFeedback>
                    )}

                    {!!policy?.areRulesEnabled && !isMultiLevelTags && (
                        <>
                            <View style={[styles.mh5, styles.mv3, styles.pt3, styles.borderTop]}>
                                <Text style={[styles.textNormal, styles.textStrong, styles.mv3]}>{translate('workspace.tags.tagRules')}</Text>
                            </View>
                            <MenuItemWithTopDescription
                                title={approverText}
                                description={translate(`workspace.tags.approverDescription`)}
                                onPress={navigateToEditTagApprover}
                                shouldShowRightIcon
                                disabled={approverDisabled}
                            />
                            {approverDisabled && (
                                <Text style={[styles.flexRow, styles.alignItemsCenter, styles.mv2, styles.mh5]}>
                                    <Text style={[styles.textLabel, styles.colorMuted]}>{translate('workspace.rules.categoryRules.goTo')}</Text>{' '}
                                    <TextLink
                                        style={[styles.link, styles.label]}
                                        onPress={() => Navigation.navigate(ROUTES.WORKSPACE_MORE_FEATURES.getRoute(policyID))}
                                    >
                                        {translate('workspace.common.moreFeatures')}
                                    </TextLink>{' '}
                                    <Text style={[styles.textLabel, styles.colorMuted]}>{translate('workspace.rules.categoryRules.andEnableWorkflows')}</Text>
                                </Text>
                            )}
                        </>
                    )}

                    {shouldShowDeleteMenuItem && (
                        <MenuItem
                            icon={Expensicons.Trashcan}
                            title={translate('common.delete')}
                            onPress={() => {
                                if (shouldPreventDisableOrDelete) {
                                    setIsCannotDeleteOrDisableLastTagModalVisible(true);
                                    return;
                                }
                                setIsDeleteTagModalOpen(true);
                            }}
                        />
                    )}
                </View>
            </ScreenWrapper>
        </AccessOrNotFoundWrapper>
    );
}

TagSettingsPage.displayName = 'TagSettingsPage';

export default TagSettingsPage;
