import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {ActivityIndicator, View} from 'react-native';
import Icon from '@components/Icon';
import * as Expensicons from '@components/Icon/Expensicons';
import Text from '@components/Text';
import Tooltip from '@components/Tooltip';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import type IconAsset from '@src/types/utils/IconAsset';
import FontUtils from "@styles/utils/FontUtils";

type DefaultAttachmentViewProps = {
    /** The name of the file */
    fileName?: string;

    /** Should show the download icon */
    shouldShowDownloadIcon?: boolean;

    /** Should show the loading spinner icon */
    shouldShowLoadingSpinnerIcon?: boolean;

    /** Additional styles for the container */
    containerStyles?: StyleProp<ViewStyle>;

    icon?: IconAsset;

    /** Whether the attachment is deleted */
    isDeleted?: boolean;

    /** Flag indicating if the attachment is being uploaded. */
    isUploading?: boolean;
};

function DefaultAttachmentView({fileName = '', shouldShowLoadingSpinnerIcon = false, shouldShowDownloadIcon, containerStyles, icon, isUploading, isDeleted}: DefaultAttachmentViewProps) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const {translate} = useLocalize();

    console.log('style view', styles.defaultAttachmentView, containerStyles);
    console.log('style text', styles.textStrong, styles.flexShrink1, styles.breakAll, styles.flexWrap, styles.mw100, isDeleted && styles.lineThrough);

    return (
        <View style={[{flexGrow: 1, position: 'relative', alignItems: 'center', flexDirection: 'row', backgroundColor: 'white', padding: 20, whiteSpace: 'nowrap'}, /*styles.defaultAttachmentView,*/ containerStyles, {marginBottom: 0, fontFamily: FontUtils.fontFamily.platform.SYSTEM.fontFamily}]}>
            <View style={styles.mr2}>
                <Icon
                    fill={theme.icon}
                    src={icon ?? Expensicons.Paperclip}
                />
            </View>

            <Text style={[{wordWrap: 'break-word'}, styles.textStrong, styles.flexShrink1, styles.breakAll, styles.flexWrap, styles.mw100, {alignSelf: 'stretch', textAlign: 'center'}, isDeleted && styles.lineThrough]}>{fileName}</Text>
            {!shouldShowLoadingSpinnerIcon && !!shouldShowDownloadIcon && (
                <Tooltip text={translate('common.download')}>
                    <View style={styles.ml2}>
                        <Icon
                            fill={theme.icon}
                            src={Expensicons.Download}
                        />
                    </View>
                </Tooltip>
            )}
            {shouldShowLoadingSpinnerIcon && (
                <View style={styles.ml2}>
                    <Tooltip text={isUploading ? translate('common.uploading') : translate('common.downloading')}>
                        <ActivityIndicator
                            size="small"
                            color={theme.textSupporting}
                            testID="attachment-loading-spinner"
                        />
                    </Tooltip>
                </View>
            )}
        </View>
    );
}

DefaultAttachmentView.displayName = 'DefaultAttachmentView';

export default DefaultAttachmentView;
