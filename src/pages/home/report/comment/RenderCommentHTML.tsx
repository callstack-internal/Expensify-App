import React from 'react';
import RenderHTML from '@components/RenderHTML';
import type {OriginalMessageSource} from '@src/types/onyx/OriginalMessage';
import { View } from 'react-native';

type RenderCommentHTMLProps = {
    source: OriginalMessageSource;
    html: string;
    containsOnlyEmojis: boolean;
};

function RenderCommentHTML({html, source, containsOnlyEmojis}: RenderCommentHTMLProps) {
    const commentHtml =
        source === 'email' ? `<email-comment ${containsOnlyEmojis ? 'islarge' : ''}>${html}</email-comment>` : `<comment ${containsOnlyEmojis ? 'islarge' : ''}>${html}</comment>`;

    return (
        <View style={{overflow: 'hidden', backgroundColor: 'green'}}>
            <RenderHTML html={commentHtml} />
        </View>
    );
}

RenderCommentHTML.displayName = 'RenderCommentHTML';

export default RenderCommentHTML;
