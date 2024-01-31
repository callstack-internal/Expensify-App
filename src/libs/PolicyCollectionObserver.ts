import ONYXKEYS from "@src/ONYXKEYS";
import { NativeEventEmitter, NativeModule } from "react-native";
import Onyx from "react-native-onyx";

const nativeModuleTemplate: NativeModule = {
    addListener: () => {},
    removeListeners: () => {},
};

const eventTypeWait = 'observe_policy_wait_';
const eventTypeWithoutWait = 'observe_policy_';

class BaseClass {
    /**
     * @property eventHandler - the NativeEventEmitter instance
     */
    protected eventHandler: NativeEventEmitter;
    protected constructor() {
        this.eventHandler = new NativeEventEmitter(nativeModuleTemplate);
    }
}

class PolicyCollectionObserverWithWait extends BaseClass {
    private static instance: PolicyCollectionObserverWithWait;
    protected constructor() {
        super();
        PolicyCollectionObserverWithWait.instance = this;
        Onyx.connect({
            key: ONYXKEYS.COLLECTION.POLICY,
            waitForCollectionCallback: true,
            callback: (value) => {
                this.eventHandler.emit(eventTypeWait, value);
            },
        });
    }

    public static getInstance(): PolicyCollectionObserverWithWait {
        // Ensure singleton instance
        return PolicyCollectionObserverWithWait.instance ?? new PolicyCollectionObserverWithWait();
    }

    addListener(listener: (event: unknown) => void, context?: unknown) {
        this.eventHandler.addListener(eventTypeWait, listener, Object(context));
    }
}

class PolicyCollectionObserverWithOutWait extends BaseClass {
    private static instance: PolicyCollectionObserverWithOutWait;
    protected constructor() {
        super();
        PolicyCollectionObserverWithOutWait.instance = this;
        Onyx.connect({
            key: ONYXKEYS.COLLECTION.POLICY,
            callback: (value, key) => {
                this.eventHandler.emit(eventTypeWithoutWait, value, key);
            },
        });
    }

    public static getInstance(): PolicyCollectionObserverWithOutWait {
        // Ensure singleton instance
        return PolicyCollectionObserverWithOutWait.instance ?? new PolicyCollectionObserverWithOutWait();
    }

    addListener(listener: (event: unknown) => void, context?: unknown) {
        this.eventHandler.addListener(eventTypeWithoutWait, listener, Object(context));
    }
}

class PolicyCollectionObserver {
    public static getInstance(waitForCollectionCallback?: boolean): PolicyCollectionObserverWithWait | PolicyCollectionObserverWithOutWait {
        if (waitForCollectionCallback) {
            return PolicyCollectionObserverWithWait.getInstance();
        }
        return PolicyCollectionObserverWithOutWait.getInstance();
    }
}

export default PolicyCollectionObserver;