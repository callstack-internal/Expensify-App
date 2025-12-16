import {deepEqual} from 'fast-equals';
import Onyx from 'react-native-onyx';
import Log from '@libs/Log';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Request} from '@src/types/onyx';

let persistedRequests: Request[] = [];
let ongoingRequest: Request | null = null;
let pendingSaveOperations: Request[] = [];
let isInitialized = false;
let initializationCallback: () => void;
function triggerInitializationCallback() {
    if (typeof initializationCallback !== 'function') {
        return;
    }
    return initializationCallback();
}

function onInitialization(callbackFunction: () => void) {
    initializationCallback = callbackFunction;
}

// We have opted for connectWithoutView here as this module is strictly non-UI
Onyx.connectWithoutView({
    key: ONYXKEYS.PERSISTED_REQUESTS,
    callback: (val) => {
        Log.info('[PersistedRequests] hit Onyx connect callback', false, {val});
        Log.info('[PersistedRequests] ongoingRequest', false, {ongoingRequest});

        if (ongoingRequest && !val?.some((req: Request) => deepEqual(req, ongoingRequest))) {
            // ongoingRequest is being processed but not yet in Onyx, don't overwrite
            return;
        }

        persistedRequests = val ?? [];

        // Process any pending save operations that were queued before initialization
        if (pendingSaveOperations.length > 0) {
            Log.info(`[PersistedRequests] Processing pending save operations, size: ${pendingSaveOperations.length}`, false);
            const requests = [...persistedRequests, ...pendingSaveOperations];
            persistedRequests = requests;
            Onyx.set(ONYXKEYS.PERSISTED_REQUESTS, requests);
            pendingSaveOperations = [];
        }

        if (ongoingRequest && persistedRequests.length > 0) {
            const nextRequestToProcess = persistedRequests.at(0);

            // We try to remove the next request from the persistedRequests if it is the same as ongoingRequest
            // so we don't process it twice.
            if (deepEqual(nextRequestToProcess, ongoingRequest)) {
                persistedRequests = persistedRequests.slice(1);
            }
        }

        if (!isInitialized && persistedRequests.length > 0) {
            Log.info('[PersistedRequests] Triggering initialization callback', false);
            triggerInitializationCallback();
        }
        isInitialized = true;
    },
});
// We have opted for connectWithoutView here as this module is strictly non-UI
Onyx.connectWithoutView({
    key: ONYXKEYS.PERSISTED_ONGOING_REQUESTS,
    callback: (val) => {
        ongoingRequest = val ?? null;
        const restoredOngoingRequest = val ?? null;

        // If null, just clear ongoingRequest (this happens when we explicitly clear it)
        if (!restoredOngoingRequest) {
            // Only clear if there's no ongoingRequest being actively processed
            // (don't overwrite an active ongoingRequest)
            if (!ongoingRequest) {
                ongoingRequest = null;
            }
            return;
        }

        // Helper function to compare requests ignoring isRollback flag
        const requestsMatch = (req1: Request, req2: Request): boolean => {
            const req1WithoutRollback = {...req1};
            delete req1WithoutRollback.isRollback;
            const req2WithoutRollback = {...req2};
            delete req2WithoutRollback.isRollback;
            return deepEqual(req1WithoutRollback, req2WithoutRollback);
        };

        // Check if there's already an ongoingRequest that matches (being actively processed)
        if (ongoingRequest && requestsMatch(ongoingRequest, restoredOngoingRequest)) {
            Log.info('[PersistedRequests] Ongoing request already being processed, skipping rollback', false, {
                command: restoredOngoingRequest.command,
                requestID: restoredOngoingRequest.requestID,
            });
            // Don't clear PERSISTED_ONGOING_REQUESTS - it's correct as is
            return;
        }

        // Check if this request already exists in the queue (ignoring isRollback flag)
        const requestExistsInQueue = persistedRequests.some((req: Request) => requestsMatch(req, restoredOngoingRequest));

        if (requestExistsInQueue) {
            Log.info('[PersistedRequests] Ongoing request already rolled back to queue, skipping duplicate rollback', false, {
                command: restoredOngoingRequest.command,
                requestID: restoredOngoingRequest.requestID,
            });
            // Clear PERSISTED_ONGOING_REQUESTS since it's already in the queue
            Onyx.set(ONYXKEYS.PERSISTED_ONGOING_REQUESTS, null);
            ongoingRequest = null;
            return;
        }

        // Request doesn't exist in queue and isn't being processed - roll it back
        Log.info('[PersistedRequests] Restoring ongoing request from storage and rolling back to queue', false, {
            command: restoredOngoingRequest.command,
            requestID: restoredOngoingRequest.requestID,
        });

        // Roll back to queue
        const rolledBackRequest = {...restoredOngoingRequest, isRollback: true};
        persistedRequests.unshift(rolledBackRequest);
        Onyx.set(ONYXKEYS.PERSISTED_REQUESTS, persistedRequests);

        // Clear PERSISTED_ONGOING_REQUESTS
        Onyx.set(ONYXKEYS.PERSISTED_ONGOING_REQUESTS, null);
        ongoingRequest = null;
    },
});

/**
 * This promise is only used by tests. DO NOT USE THIS PROMISE IN THE APPLICATION CODE
 */
function clear() {
    ongoingRequest = null;
    Onyx.set(ONYXKEYS.PERSISTED_ONGOING_REQUESTS, null);
    return Onyx.set(ONYXKEYS.PERSISTED_REQUESTS, []);
}

function getLength(): number {
    // Making it backwards compatible with the old implementation
    return persistedRequests.length + (ongoingRequest ? 1 : 0);
}

function save(requestToPersist: Request) {
    // If not initialized yet, queue the request for later processing
    if (!isInitialized) {
        Log.info('[PersistedRequests] Queueing request until initialization completes', false);
        pendingSaveOperations.push(requestToPersist);
        return;
    }

    // If the command is not in the keepLastInstance array, add the new request as usual
    const requests = [...persistedRequests, requestToPersist];
    persistedRequests = requests;
    Onyx.set(ONYXKEYS.PERSISTED_REQUESTS, requests).then(() => {
        Log.info(`[SequentialQueue] '${requestToPersist.command}' command queued. Queue length is ${getLength()}`);
    });
}

function endRequestAndRemoveFromQueue(requestToRemove: Request) {
    ongoingRequest = null;
    /**
     * We only remove the first matching request because the order of requests matters.
     * If we were to remove all matching requests, we can end up with a final state that is different than what the user intended.
     */
    const requests = [...persistedRequests];
    const index = requests.findIndex((persistedRequest) => deepEqual(persistedRequest, requestToRemove));

    if (index !== -1) {
        requests.splice(index, 1);
    }

    persistedRequests = requests;

    Onyx.multiSet({
        [ONYXKEYS.PERSISTED_REQUESTS]: persistedRequests,
        [ONYXKEYS.PERSISTED_ONGOING_REQUESTS]: null,
    }).then(() => {
        Log.info(`[SequentialQueue] '${requestToRemove.command}' removed from the queue. Queue length is ${getLength()}`);
    });
}

function deleteRequestsByIndices(indices: number[]) {
    // Create a Set from the indices array for efficient lookup
    const indicesSet = new Set(indices);

    // Create a new array excluding elements at the specified indices
    persistedRequests = persistedRequests.filter((_, index) => !indicesSet.has(index));

    // Update the persisted requests in storage or state as necessary
    Onyx.set(ONYXKEYS.PERSISTED_REQUESTS, persistedRequests).then(() => {
        Log.info(`Multiple (${indices.length}) requests removed from the queue. Queue length is ${persistedRequests.length}`);
    });
}

function update(oldRequestIndex: number, newRequest: Request) {
    const requests = [...persistedRequests];
    const oldRequest = requests.at(oldRequestIndex);
    Log.info('[PersistedRequests] Updating a request', false, {oldRequest, newRequest, oldRequestIndex});
    requests.splice(oldRequestIndex, 1, newRequest);
    persistedRequests = requests;
    Onyx.set(ONYXKEYS.PERSISTED_REQUESTS, requests);
}

function updateOngoingRequest(newRequest: Request) {
    Log.info('[PersistedRequests] Updating the ongoing request', false, {ongoingRequest, newRequest});
    ongoingRequest = newRequest;

    if (newRequest.persistWhenOngoing) {
        Onyx.set(ONYXKEYS.PERSISTED_ONGOING_REQUESTS, newRequest);
    }
}

function processNextRequest(): Request | null {
    if (ongoingRequest) {
        Log.info(`Ongoing Request already set returning same one ${ongoingRequest.commandName}`);
        return ongoingRequest;
    }

    // You must handle the case where there are no requests to process
    if (persistedRequests.length === 0) {
        throw new Error('No requests to process');
    }

    ongoingRequest = persistedRequests.length > 0 ? (persistedRequests.at(0) ?? null) : null;

    // Create a new array without the first element
   const newPersistedRequests = persistedRequests.slice(1);
    Log.info('[PersistedRequests] processNextRequest - persistedRequests', false, {persistedRequests});
    Log.info('[PersistedRequests] processNextRequest - ongoingRequest', false, {ongoingRequest});
    Log.info('[PersistedRequests] processNextRequest - newPersistedRequests', false, {newPersistedRequests});
    persistedRequests = newPersistedRequests;

    Onyx.set(ONYXKEYS.PERSISTED_REQUESTS, newPersistedRequests);

    if (ongoingRequest && ongoingRequest.persistWhenOngoing) {
        Onyx.set(ONYXKEYS.PERSISTED_ONGOING_REQUESTS, ongoingRequest);
    }

    return ongoingRequest;
}

function rollbackOngoingRequest() {
    if (!ongoingRequest) {
        return;
    }

    // Prepend ongoingRequest to persistedRequests
    persistedRequests.unshift({...ongoingRequest, isRollback: true});
    const rolledBackRequest = {...ongoingRequest, isRollback: true};
    persistedRequests.unshift(rolledBackRequest);

    // Capture command before clearing
    const wasPersistedWhenOngoing = ongoingRequest.persistWhenOngoing;

    Onyx.set(ONYXKEYS.PERSISTED_REQUESTS, persistedRequests);

    // Clear PERSISTED_ONGOING_REQUESTS if it was set
    if (wasPersistedWhenOngoing) {
        Onyx.set(ONYXKEYS.PERSISTED_ONGOING_REQUESTS, null);
    }

    // Clear the ongoingRequest
    ongoingRequest = null;
}

function getAll(): Request[] {
    return persistedRequests;
}

function getOngoingRequest(): Request | null {
    return ongoingRequest;
}

export {
    clear,
    save,
    getAll,
    endRequestAndRemoveFromQueue,
    update,
    getLength,
    getOngoingRequest,
    processNextRequest,
    updateOngoingRequest,
    rollbackOngoingRequest,
    deleteRequestsByIndices,
    onInitialization,
};
