import React from 'react';
import {RenderHTMLSource} from 'react-native-render-html';
import useWindowDimensions from '@hooks/useWindowDimensions';
import {View} from "react-native";

type RenderHTMLProps = {
    /** HTML string to render */
    html: string;
};

// We are using the explicit composite architecture for performance gains.
// Configuration for RenderHTML is handled in a top-level component providing
// context to RenderHTMLSource components. See https://git.io/JRcZb
// The provider is available at src/components/HTMLEngineProvider/
function RenderHTML({html}: RenderHTMLProps) {
    const {windowWidth} = useWindowDimensions();

    console.log('content', html);
    return (
        <View style={{overflow: 'hidden', backgroundColor: 'yellow', flexShrink: 1}}>
            <RenderHTMLSource
                contentWidth={windowWidth * 0.8}
                source={{html}}
                fsClass="test-class"
            />
        </View>
    );
}

RenderHTML.displayName = 'RenderHTML';

export default RenderHTML;
