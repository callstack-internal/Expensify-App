import React from 'react';
import DotIndicatorMessage from '@components/DotIndicatorMessage';
import useCardFeedErrors from '@hooks/useCardFeedErrors';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {isEmptyObject} from '@src/types/utils/EmptyObject';

function CompanyCardConnectionWarning() {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const {personalCardsWithBrokenConnection} = useCardFeedErrors();

    if (isEmptyObject(personalCardsWithBrokenConnection)) {
        return null;
    }

    return (
        <DotIndicatorMessage
            type="error"
            style={[styles.mv3, styles.mh4]}
            messages={{error: translate('violations.companyCardRequired')}}
        />
    );
}

export default CompanyCardConnectionWarning;
