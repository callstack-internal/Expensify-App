/** Keeps accessibility labels built from masked values out of FullStory recordings */
import FSClassContext from '@components/FSClassView/FSClassContext';

import type {FSClass} from '@libs/Fullstory/types';

import CONST from '@src/CONST';

import {useContext} from 'react';

/** Whether an element with this class, or with none inside the closest `FSClassView`, is masked in FullStory */
function useIsFSMasked(fsClass?: FSClass): boolean {
    const containerFSClass = useContext(FSClassContext);
    return (fsClass ?? containerFSClass) === CONST.FULLSTORY.CLASS.MASK;
}

/**
 * FullStory masks the text and input values of an `fs-mask` element but records its attributes as they are, so an
 * `aria-label` built from a masked value would leak it. Only use this for labels built from values the element shows: on a
 * masked element the label is emptied, which screen readers treat as no label, and screen readers name the element from its content instead, which is the same
 * text. Static labels, like those of icon buttons, should stay as they are.
 */
function useRecordableAccessibilityLabel(label: string, fsClass?: FSClass): string {
    return useIsFSMasked(fsClass) ? '' : label;
}

export default useRecordableAccessibilityLabel;
export {useIsFSMasked};
