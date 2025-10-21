import noop from 'lodash/noop';
import React, {useCallback, useContext, useMemo, useState} from 'react';
import Log from '@libs/Log';
import CONST from '@src/CONST';

// type ModalAction = 'CONFIRM' | 'CLOSE';

const ModalActions = {
    CONFIRM: 'CONFIRM',
    CLOSE: 'CLOSE',
} as const;

type ModalAction = (typeof ModalActions)[keyof typeof ModalActions];

type ModalStateChangePayload<A extends ModalAction = ModalAction> = {action: A};

type ModalProps = {
    closeModal: (param?: ModalStateChangePayload) => void;
};

type ModalContextType = {
    showModal<P extends ModalProps>(options: {component: React.FunctionComponent<P>; props?: Omit<P, 'closeModal'>; id?: string; isCloseable?: boolean}): Promise<ModalStateChangePayload>;
    closeModal(data?: ModalStateChangePayload): void;
    closeModalById: (id: string, data?: ModalStateChangePayload) => void;
};

const ModalContext = React.createContext<ModalContextType>({
    showModal: () => Promise.resolve({action: 'CLOSE'}),
    closeModal: noop,
    closeModalById: noop as unknown as ModalContextType['closeModalById'],
});

const useModal = () => useContext(ModalContext);

let modalID = 1;

type ModalInfo = {
    id: string;
    component: React.FunctionComponent<ModalProps>;
    props?: Record<string, unknown>;
    promiseWithResolvers: ReturnType<typeof Promise.withResolvers<ModalStateChangePayload>>;
    isCloseable: boolean;
};

function PromiseModalProvider({children}: {children: React.ReactNode}) {
    const [modalStack, setModalStack] = useState<{modals: ModalInfo[]}>({modals: []});

    const showModal = useCallback<ModalContextType['showModal']>(({component, props, id, isCloseable = true}) => {
        // This is a promise that will be resolved when the modal is closed
        const promiseWithResolvers = Promise.withResolvers<ModalStateChangePayload>();

        setModalStack((prevState) => {
            // Check current state for existing modal
            const existingModal = id ? prevState.modals.find((modal: ModalInfo) => modal.id === id) : undefined;
            if (existingModal) {
                // There is already a modal with this ID. Resolve the new promise with the existing one's result
                existingModal.promiseWithResolvers.promise.then((result) => {
                    promiseWithResolvers.resolve(result);
                });
                return prevState; // No state change needed
            }
            return {
                ...prevState,
                modals: [...prevState.modals, {component: component as React.FunctionComponent<ModalProps>, props, promiseWithResolvers, isCloseable, id: id ?? String(modalID++)}],
            };
        });

        return promiseWithResolvers.promise;
    }, []);

    const closeModal = useCallback<ModalContextType['closeModal']>((data = {action: 'CLOSE'}) => {
        setModalStack((prevState) => {
            const lastModal = prevState.modals.at(-1);
            lastModal?.promiseWithResolvers.resolve(data);
            return {
                ...prevState,
                modals: prevState.modals.slice(0, -1),
            };
        });
    }, []);

    const closeModalById = useCallback<ModalContextType['closeModalById']>((id, data = {action: 'CLOSE'}) => {
        setModalStack((prevState) => {
            const idx = prevState.modals.findIndex((m) => m.id === id);
            if (idx === -1) {
                return prevState;
            }
            const modal = prevState.modals[idx];
            modal?.promiseWithResolvers.resolve(data);
            return {
                ...prevState,
                modals: prevState.modals.filter((m) => m.id !== id),
            };
        });
    }, []);

    const contextValue = useMemo(() => ({showModal, closeModal, closeModalById}), [closeModal, closeModalById, showModal]);
    const modalToRender = modalStack.modals.length > 0 ? modalStack.modals.at(modalStack.modals.length - 1) : null;
    const ModalComponent = modalToRender?.component;

    return (
        <ModalContext.Provider value={contextValue}>
            {children}
            {!!ModalComponent && (
                <ModalComponent
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...modalToRender.props}
                    key={modalToRender.id}
                    closeModal={closeModal}
                />
            )}
        </ModalContext.Provider>
    );
}

export type {ModalProps};
export {PromiseModalProvider, useModal, ModalActions};
