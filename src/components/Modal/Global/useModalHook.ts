import ConfirmModalWrapper from './ConfirmModalWrapper';
import {useModal} from './ModalContext';
import type {ModalProps} from './ModalContext';

type ConfirmModalOptions = Omit<React.ComponentProps<typeof ConfirmModalWrapper>, keyof ModalProps> & {id?: string};

const useConfirmModal = () => {
    const context = useModal();

    const showConfirmModal = (options: ConfirmModalOptions) => {
        const {id, ...props} = options;
        return context.showModal({
            component: ConfirmModalWrapper,
            props,
            id,
        });
    };

    return {
        ...context,
        showConfirmModal,
    };
};

export default useConfirmModal;
