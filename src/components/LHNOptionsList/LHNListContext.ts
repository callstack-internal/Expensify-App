import {createContext, useContext} from 'react';
import type {ValueOf} from 'type-fest';
import type CONST from '@src/CONST';

type OptionMode = ValueOf<typeof CONST.OPTION_MODE>;

type LHNListContextValue = {
    isReportsSplitNavigatorLast: boolean;
    isScreenFocused: boolean;
    optionMode: OptionMode;
    isOptionFocusEnabled: boolean;
    firstReportIDWithGBRorRBR?: string;
};

const LHNListContext = createContext<LHNListContextValue | null>(null);

function useLHNListContext(): LHNListContextValue {
    const context = useContext(LHNListContext);
    if (!context) {
        throw new Error('useLHNListContext must be used within an LHNListContext.Provider');
    }
    return context;
}

export {LHNListContext, useLHNListContext};
export type {LHNListContextValue};
