import React from 'react';
import PopoverMenu from '@components/PopoverMenu';
import type {PopoverMenuProps} from '@components/PopoverMenu';
import type {ModalProps} from './ModalContext';

type PopoverMenuWrapperProps = ModalProps & Omit<PopoverMenuProps, 'onClose' | 'isVisible'>;

// Wrapper to present PopoverMenu via the global promise-based modal system
// TODO: after migrating all PopoverMenu instances to use showPopoverMenu, remove this wrapper
function PopoverMenuWrapper({closeModal, ...props}: PopoverMenuWrapperProps) {
    return (
        <PopoverMenu
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...props}
            isVisible
            onClose={() => closeModal({action: 'CLOSE'})}
        />
    );
}

PopoverMenuWrapper.displayName = 'PopoverMenuWrapper';

export default PopoverMenuWrapper;
