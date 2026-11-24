import ImageView from '@components/ImageView';
import PressableWithoutFeedback from '@components/Pressable/PressableWithoutFeedback';

import useLocalize from '@hooks/useLocalize';
import {useIsFSMasked} from '@hooks/useRecordableAccessibilityLabel';
import useThemeStyles from '@hooks/useThemeStyles';

import CONST from '@src/CONST';

import React from 'react';

import type {AttachmentViewProps} from '..';

type AttachmentViewImageProps = Pick<AttachmentViewProps, 'attachmentID' | 'isAuthTokenRequired' | 'file' | 'onPress'> & {
    url: string | number;

    loadComplete: boolean;

    isImage: boolean;
    onError?: () => void;
};

function AttachmentViewImage({attachmentID, url, file, isAuthTokenRequired, loadComplete, onPress, onError, isImage}: AttachmentViewImageProps) {
    // File names from a masked chat stay out of the label, which FullStory would record
    const isFileNameMasked = useIsFSMasked();
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const children = (
        <ImageView
            attachmentID={attachmentID}
            onError={onError}
            url={url}
            fileName={file?.name ?? ''}
            isAuthTokenRequired={isImage && isAuthTokenRequired}
        />
    );

    return onPress ? (
        <PressableWithoutFeedback
            onPress={onPress}
            disabled={loadComplete}
            style={[styles.flex1, styles.flexRow, styles.alignSelfStretch]}
            accessibilityRole={CONST.ROLE.BUTTON}
            accessibilityLabel={isFileNameMasked ? translate('common.attachment') : file?.name || translate('attachmentView.unknownFilename')}
            sentryLabel={CONST.SENTRY_LABEL.ATTACHMENT_CAROUSEL.ITEM}
        >
            {children}
        </PressableWithoutFeedback>
    ) : (
        children
    );
}

export default AttachmentViewImage;
