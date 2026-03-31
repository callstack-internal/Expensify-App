import React from 'react';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import ImportedStateIndicator from '@components/ImportedStateIndicator';
import useOnyx from '@hooks/useOnyx';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import type * as OnyxCommon from '@src/types/onyx/OnyxCommon';
import ComposerBox from './ComposerBox';
import type {SuggestionsRef} from './ComposerContext';
import ComposerDropZone from './ComposerDropZone';
import ComposerFooter from './ComposerFooter';
import ComposerLocalTime from './ComposerLocalTime';
import ComposerProvider from './ComposerProvider';
import type {ComposerRef} from './ComposerWithSuggestions/ComposerWithSuggestions';

type ReportActionComposeProps = {
    reportID: string;
    lastReportAction?: OnyxEntry<OnyxTypes.ReportAction>;
    pendingAction?: OnyxCommon.PendingAction;
    reportTransactions?: OnyxEntry<OnyxTypes.Transaction[]>;
    transactionThreadReportID?: string;
};

function Composer({reportID, lastReportAction, pendingAction, reportTransactions, transactionThreadReportID}: ReportActionComposeProps) {
    const styles = useThemeStyles();
    // eslint-disable-next-line rulesdir/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth
    const {isSmallScreenWidth} = useResponsiveLayout();
    const [isComposerFullSize = false] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_IS_COMPOSER_FULL_SIZE}${reportID}`);

    return (
        <View style={[isComposerFullSize && styles.chatItemFullComposeRow]}>
            <ComposerProvider
                reportID={reportID}
                transactionThreadReportID={transactionThreadReportID}
            >
                <Composer.LocalTime
                    reportID={reportID}
                    pendingAction={pendingAction}
                />
                <View style={isComposerFullSize ? styles.flex1 : {}}>
                    <Composer.DropZone
                        reportID={reportID}
                        reportTransactions={reportTransactions}
                    >
                        <Composer.Box
                            reportID={reportID}
                            lastReportAction={lastReportAction}
                            isComposerFullSize={isComposerFullSize}
                            pendingAction={pendingAction}
                        />
                    </Composer.DropZone>
                    <Composer.Footer reportID={reportID} />
                    {!isSmallScreenWidth && (
                        <View style={[styles.mln5, styles.mrn5]}>
                            <ImportedStateIndicator />
                        </View>
                    )}
                </View>
            </ComposerProvider>
        </View>
    );
}

Composer.LocalTime = ComposerLocalTime;
Composer.Box = ComposerBox;
Composer.DropZone = ComposerDropZone;
Composer.Footer = ComposerFooter;
// Future: Composer.Input, Composer.ActionMenu, Composer.SendButton, Composer.EmojiPicker, Composer.Suggestions

export default Composer;
export type {SuggestionsRef, ComposerRef, ReportActionComposeProps};
