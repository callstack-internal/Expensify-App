import ONYXKEYS from "@src/ONYXKEYS";
import { NativeEventEmitter, NativeModule } from "react-native";
import Onyx from "react-native-onyx";

const nativeModuleTemplate: NativeModule = {
    addListener: () => {},
    removeListeners: () => {},
};

const eventTypeWait = 'observe_transaction_wait_';
const eventTypeWithoutWait = 'observe_transaction_';

class BaseClass {
    /**
     * @property eventHandler - the NativeEventEmitter instance
     */
    protected eventHandler: NativeEventEmitter;
    protected constructor() {
        this.eventHandler = new NativeEventEmitter(nativeModuleTemplate);
    }
}

class TransactionCollectionObserverWithWait extends BaseClass {
    private static instance: TransactionCollectionObserverWithWait;
    protected constructor() {
        super();
        TransactionCollectionObserverWithWait.instance = this;
        Onyx.connect({
            key: ONYXKEYS.COLLECTION.TRANSACTION,
            waitForCollectionCallback: true,
            callback: (value) => {
                this.eventHandler.emit(eventTypeWait, value);
            },
        });
    }

    public static getInstance(): TransactionCollectionObserverWithWait {
        // Ensure singleton instance
        return TransactionCollectionObserverWithWait.instance ?? new TransactionCollectionObserverWithWait();
    }

    addListener(listener: (event: unknown) => void, context?: unknown) {
        this.eventHandler.addListener(eventTypeWait, listener, Object(context));
    }
}

class TransactionCollectionObserverWithOutWait extends BaseClass {
    private static instance: TransactionCollectionObserverWithOutWait;
    protected constructor() {
        super();
        TransactionCollectionObserverWithOutWait.instance = this;
        Onyx.connect({
            key: ONYXKEYS.COLLECTION.TRANSACTION,
            callback: (value, key) => {
                this.eventHandler.emit(eventTypeWithoutWait, value, key);
            },
        });
    }

    public static getInstance(): TransactionCollectionObserverWithOutWait {
        // Ensure singleton instance
        return TransactionCollectionObserverWithOutWait.instance ?? new TransactionCollectionObserverWithOutWait();
    }

    addListener(listener: (event: unknown) => void, context?: unknown) {
        this.eventHandler.addListener(eventTypeWithoutWait, listener, Object(context));
    }
}

class TransactionCollectionObserver {
    public static getInstance(waitForCollectionCallback?: boolean): TransactionCollectionObserverWithWait | TransactionCollectionObserverWithOutWait {
        if (waitForCollectionCallback) {
            return TransactionCollectionObserverWithWait.getInstance();
        }
        return TransactionCollectionObserverWithOutWait.getInstance();
    }
}

export default TransactionCollectionObserver;