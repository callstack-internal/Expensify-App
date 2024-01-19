import React from 'react';
import ONYXKEYS from '@src/ONYXKEYS';
import ComposeProviders from './ComposeProviders';
import createOnyxContext from './createOnyxContext';

// Set up any providers for individual keys. This should only be used in cases where many components will subscribe to
// the same key (e.g. FlatList renderItem components)
const [withNetwork, NetworkProvider, NetworkContext, useNetwork] = createOnyxContext(ONYXKEYS.NETWORK);
const [withPersonalDetails, PersonalDetailsProvider, , usePersonalDetails] = createOnyxContext(ONYXKEYS.PERSONAL_DETAILS_LIST);
const [withCurrentDate, CurrentDateProvider] = createOnyxContext(ONYXKEYS.CURRENT_DATE);
const [withReportActionsDrafts, ReportActionsDraftsProvider, , useReportActionsDrafts] = createOnyxContext(ONYXKEYS.COLLECTION.REPORT_ACTIONS_DRAFTS);
const [withBlockedFromConcierge, BlockedFromConciergeProvider] = createOnyxContext(ONYXKEYS.NVP_BLOCKED_FROM_CONCIERGE);
const [withBetas, BetasProvider, BetasContext] = createOnyxContext(ONYXKEYS.BETAS);
const [withReportCommentDrafts, ReportCommentDraftsProvider] = createOnyxContext(ONYXKEYS.COLLECTION.REPORT_DRAFT_COMMENT);
const [withPreferredTheme, PreferredThemeProvider, PreferredThemeContext] = createOnyxContext(ONYXKEYS.PREFERRED_THEME);
const [withFrequentlyUsedEmojis, FrequentlyUsedEmojisProvider, , useFrequentlyUsedEmojis] = createOnyxContext(ONYXKEYS.FREQUENTLY_USED_EMOJIS);
const [withPreferredEmojiSkinTone, PreferredEmojiSkinToneProvider, PreferredEmojiSkinToneContext] = createOnyxContext(ONYXKEYS.PREFERRED_EMOJI_SKIN_TONE);
const [withUserWallet, UserWalletProvider, UserWalletContext, useUserWallet] = createOnyxContext(ONYXKEYS.USER_WALLET);
const [withEmojiReactions, EmojiReactionsProvider, EmojiReactionsContext, useEmojiReactions] = createOnyxContext(ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS);
const [withReports, ReportsProvider, ReportsContext, useReports] = createOnyxContext(ONYXKEYS.COLLECTION.REPORT);

type OnyxProviderProps = {
    /** Rendered child component */
    children: React.ReactNode;
};

function OnyxProvider(props: OnyxProviderProps) {
    return (
        <ComposeProviders
            components={[
                NetworkProvider,
                PersonalDetailsProvider,
                ReportActionsDraftsProvider,
                CurrentDateProvider,
                BlockedFromConciergeProvider,
                BetasProvider,
                ReportCommentDraftsProvider,
                PreferredThemeProvider,
                FrequentlyUsedEmojisProvider,
                PreferredEmojiSkinToneProvider,
                UserWalletProvider,
                EmojiReactionsProvider,
                ReportsProvider,
            ]}
        >
            {props.children}
        </ComposeProviders>
    );
}

OnyxProvider.displayName = 'OnyxProvider';

export default OnyxProvider;

export {
    withNetwork,
    withPersonalDetails,
    usePersonalDetails,
    withReportActionsDrafts,
    withCurrentDate,
    withBlockedFromConcierge,
    withBetas,
    NetworkContext,
    BetasContext,
    withReportCommentDrafts,
    withPreferredTheme,
    PreferredThemeContext,
    withFrequentlyUsedEmojis,
    useFrequentlyUsedEmojis,
    withPreferredEmojiSkinTone,
    PreferredEmojiSkinToneContext,
    useReportActionsDrafts,
    withUserWallet,
    UserWalletContext,
    useUserWallet,
    withEmojiReactions,
    EmojiReactionsContext,
    useEmojiReactions,
    withReports,
    ReportsContext,
    useReports,
    useNetwork,
};
