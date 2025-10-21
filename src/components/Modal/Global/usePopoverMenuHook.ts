import type {PopoverMenuProps} from '@components/PopoverMenu';
import {useModal} from './ModalContext';
import PopoverMenuWrapper from './PopoverMenuWrapper';

type PopoverMenuOptions = Omit<PopoverMenuProps, 'isVisible' | 'onClose'> & {id?: string};

const usePopoverMenu = () => {
    const context = useModal();

    const showPopoverMenu = (options: PopoverMenuOptions) => {
        const {id, ...props} = options;
        return context.showModal({
            component: PopoverMenuWrapper,
            props,
            id,
        });
    };

    return {
        ...context,
        showPopoverMenu,
    };
};

export default usePopoverMenu;
