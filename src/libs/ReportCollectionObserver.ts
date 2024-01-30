import ONYXKEYS from "@src/ONYXKEYS";
import { NativeEventEmitter, NativeModule } from "react-native";
import Onyx from "react-native-onyx";

const nativeModuleTemplate: NativeModule = {
    addListener: () => {},
    removeListeners: () => {},
};

const eventTypeWait = 'observe_report_wait_';
const eventTypeWithoutWait = 'observe_report_';

class BaseClass {
    /**
     * @property eventHandler - the NativeEventEmitter instance
     */
    protected eventHandler: NativeEventEmitter;
    protected constructor() {
        this.eventHandler = new NativeEventEmitter(nativeModuleTemplate);
    }
}

class ReportCollectionObserverWithWait extends BaseClass {
    private static instance: ReportCollectionObserverWithWait;
    protected constructor() {
        super();
        ReportCollectionObserverWithWait.instance = this;
        Onyx.connect({
            key: ONYXKEYS.COLLECTION.REPORT,
            waitForCollectionCallback: true,
            callback: (value) => {
                this.eventHandler.emit(eventTypeWait, value);
            },
        });
    }

    public static getInstance(): ReportCollectionObserverWithWait {
        // Ensure singleton instance
        return ReportCollectionObserverWithWait.instance ?? new ReportCollectionObserverWithWait();
    }

    addListener(listener: (event: unknown) => void, context?: unknown) {
        this.eventHandler.addListener(eventTypeWait, listener, Object(context));
    }
}

class ReportCollectionObserverWithOutWait extends BaseClass {
    private static instance: ReportCollectionObserverWithOutWait;
    protected constructor() {
        super();
        ReportCollectionObserverWithOutWait.instance = this;
        Onyx.connect({
            key: ONYXKEYS.COLLECTION.REPORT,
            callback: (value, key) => {
                this.eventHandler.emit(eventTypeWithoutWait, value, key);
            },
        });
    }

    public static getInstance(): ReportCollectionObserverWithOutWait {
        // Ensure singleton instance
        return ReportCollectionObserverWithOutWait.instance ?? new ReportCollectionObserverWithOutWait();
    }

    addListener(listener: (event: unknown) => void, context?: unknown) {
        this.eventHandler.addListener(eventTypeWithoutWait, listener, Object(context));
    }
}

class ReportCollectionObserver {
    public static getInstance(waitForCollectionCallback?: boolean): ReportCollectionObserverWithWait | ReportCollectionObserverWithOutWait {
        if (waitForCollectionCallback) {
            return ReportCollectionObserverWithWait.getInstance();
        }
        return ReportCollectionObserverWithOutWait.getInstance();
    }
}

export default ReportCollectionObserver;