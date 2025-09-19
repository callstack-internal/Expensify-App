import CONST from '@src/CONST';
import Log from './Log';
import type {RequestError} from './Network/SequentialQueue';
import {generateRandomInt} from './NumberUtils';

class RequestThrottle {
    private requestWaitTime = 0;

    private requestRetryCount = 0;

    private timeoutID?: NodeJS.Timeout;

    private name: string;

    constructor(name: string) {
        this.name = name;
    }

    clear() {
        this.requestWaitTime = 0;
        this.requestRetryCount = 0;
        if (this.timeoutID) {
            Log.info(`[RequestThrottle - ${this.name}] clearing timeoutID: ${String(this.timeoutID)}`);
            clearTimeout(this.timeoutID);
            this.timeoutID = undefined;
        }
        Log.info(`[RequestThrottle - ${this.name}] cleared`);
    }

    getRequestWaitTime() {
        if (this.requestWaitTime) {
            this.requestWaitTime = Math.min(this.requestWaitTime * 2, CONST.NETWORK.MAX_RETRY_WAIT_TIME_MS);
        } else {
            this.requestWaitTime = generateRandomInt(CONST.NETWORK.MIN_RETRY_WAIT_TIME_MS, CONST.NETWORK.MAX_RANDOM_RETRY_WAIT_TIME_MS);
        }
        return this.requestWaitTime;
    }

    getLastRequestWaitTime() {
        return this.requestWaitTime;
    }

    sleep(error: RequestError, command: string): Promise<void> {
        this.requestRetryCount++;
        return new Promise((resolve, reject) => {
            if (this.requestRetryCount <= CONST.NETWORK.MAX_REQUEST_RETRIES) {
                const currentRequestWaitTime = this.getRequestWaitTime();

                // Enhanced debugging for throttle behavior
                Log.info(`[RequestThrottle - ${this.name}] Exponential backoff details`, false, {
                    command,
                    errorName: error.name,
                    errorMessage: error.message,
                    errorStatus: error.status,
                    retryCount: this.requestRetryCount,
                    maxRetries: CONST.NETWORK.MAX_REQUEST_RETRIES,
                    waitTime: `${currentRequestWaitTime}ms`,
                    previousWaitTime: this.requestRetryCount > 1 ? `${Math.floor(currentRequestWaitTime / 2)}ms` : 'N/A',
                    timeoutID: this.timeoutID ? String(this.timeoutID) : 'none',
                    timestamp: new Date().toISOString(),
                });

                this.timeoutID = setTimeout(resolve, currentRequestWaitTime);
            } else {
                Log.info(`[RequestThrottle - ${this.name}] WARNING: Max retries exceeded`, false, {
                    command,
                    finalRetryCount: this.requestRetryCount,
                    maxRetries: CONST.NETWORK.MAX_REQUEST_RETRIES,
                    finalError: `${error.name}: ${error.message}`,
                });
                reject();
            }
        });
    }
}

export default RequestThrottle;
