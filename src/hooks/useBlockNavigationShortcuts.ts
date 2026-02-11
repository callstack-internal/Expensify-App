import {useEffect, useRef} from 'react';
import KeyboardShortcut from '@libs/KeyboardShortcut';
import CONST from '@src/CONST';

/**
 * Blocks all NAVIGATION_SHORTCUT-type keyboard shortcuts while mounted.
 * When `shouldBubble` is true, the shortcuts will bubble through (i.e. stop being blocked).
 */
function useBlockNavigationShortcuts(shouldBubble: boolean): void {
    const shouldBubbleRef = useRef(shouldBubble);
    useEffect(() => {
        shouldBubbleRef.current = shouldBubble;
    });

    useEffect(() => {
        const shortcutsToBlock = Object.values(CONST.KEYBOARD_SHORTCUTS).filter((shortcut) => 'type' in shortcut && shortcut.type === CONST.KEYBOARD_SHORTCUTS_TYPES.NAVIGATION_SHORTCUT);

        const unsubscribes = shortcutsToBlock.map((shortcut) =>
            KeyboardShortcut.subscribe(
                shortcut.shortcutKey,
                () => {},
                shortcut.descriptionKey,
                shortcut.modifiers,
                false,
                () => shouldBubbleRef.current,
            ),
        );

        return () => {
            for (const unsubscribe of unsubscribes) {
                unsubscribe();
            }
        };
    }, []);
}

export default useBlockNavigationShortcuts;
