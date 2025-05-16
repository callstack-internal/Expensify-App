import axios, {AxiosError, AxiosRequestConfig, AxiosResponse} from 'axios';
import Onyx from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import alert from '@components/Alert';
import Log from '@libs/Log';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {RequestType} from '@src/types/onyx/Request';
import type Response from '@src/types/onyx/Response';
import {setTimeSkew} from './actions/Network';
import {alertUser} from './actions/UpdateRequired';
import {READ_COMMANDS, SIDE_EFFECT_REQUEST_COMMANDS, WRITE_COMMANDS} from './API/types';
import {getCommandURL} from './ApiUtils';
import HttpsError from './Errors/HttpsError';
import prepareRequestPayload from './prepareRequestPayload';

let shouldFailAllRequests = false;
let shouldForceOffline = false;

const ABORT_COMMANDS = {
    All: 'All',
    [READ_COMMANDS.SEARCH_FOR_REPORTS]: READ_COMMANDS.SEARCH_FOR_REPORTS,
} as const;

type AbortCommand = keyof typeof ABORT_COMMANDS;

Onyx.connect({
    key: ONYXKEYS.NETWORK,
    callback: (network) => {
        if (!network) {
            return;
        }
        shouldFailAllRequests = !!network.shouldFailAllRequests;
        shouldForceOffline = !!network.shouldForceOffline;
    },
});

// We use the AbortController API to terminate pending request in `cancelPendingRequests`
const abortControllerMap = new Map<AbortCommand, AbortController>();
abortControllerMap.set(ABORT_COMMANDS.All, new AbortController());
abortControllerMap.set(ABORT_COMMANDS.SearchForReports, new AbortController());

/**
 * The API commands that require the skew calculation
 */
const addSkewList: string[] = [WRITE_COMMANDS.OPEN_REPORT, SIDE_EFFECT_REQUEST_COMMANDS.RECONNECT_APP, WRITE_COMMANDS.OPEN_APP];

/**
 * Regex to get API command from the command
 */
const APICommandRegex = /\/api\/([^&?]+)\??.*/;

/**
 * Send an HTTP request, and attempt to resolve the json response.
 * If there is a network error, we'll set the application offline.
 */
async function processHTTPRequest(url: string, method: RequestType = 'get', body: FormData | null = null, abortSignal: AbortSignal | undefined = undefined): Promise<Response> {
    const startTime = new Date().valueOf();
    console.log('processHTTPRequest>>>>', url);
    const config: AxiosRequestConfig = {
        url,
        method,
        data: body,
        signal: abortSignal,

        headers: {
            'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
            if (url === '/api/RequestMoney?') {
                console.log('progressEvent', progressEvent, url);
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);

                const logParams: Record<string, unknown> = {
                    command: 'RequestMoney',
                    shouldUseSecure: false,
                };
                const extraData: Record<string, unknown> = {
                    percentCompleted,
                };
                Log.info('[Network] Uploading API request', false, logParams, false, extraData);
                console.log('uploaded', percentCompleted);
            }
        },
    };

    try {
        const response: AxiosResponse<Response> = await axios(config);

        // Handle time skew calculation
        const match = url.match(APICommandRegex)?.[1];
        if (match && addSkewList.includes(match) && response.headers) {
            const dateHeaderValue = response.headers.date;
            const serverTime = dateHeaderValue ? new Date(dateHeaderValue).valueOf() : Date.now();
            const endTime = Date.now();
            const latency = (endTime - startTime) / 2;
            const skew = serverTime - startTime + latency;
            setTimeSkew(dateHeaderValue ? skew : 0);
        }

        if (shouldFailAllRequests || shouldForceOffline) {
            throw new HttpsError({
                message: CONST.ERROR.FAILED_TO_FETCH,
            });
        }

        // Handle HTTP error statuses
        if (response.status >= 400) {
            const serviceInterruptedStatuses: Array<ValueOf<typeof CONST.HTTP_STATUS>> = [
                CONST.HTTP_STATUS.INTERNAL_SERVER_ERROR,
                CONST.HTTP_STATUS.BAD_GATEWAY,
                CONST.HTTP_STATUS.GATEWAY_TIMEOUT,
                CONST.HTTP_STATUS.UNKNOWN_ERROR,
            ];

            if (serviceInterruptedStatuses.includes(response.status as ValueOf<typeof CONST.HTTP_STATUS>)) {
                throw new HttpsError({
                    message: CONST.ERROR.EXPENSIFY_SERVICE_INTERRUPTED,
                    status: response.status.toString(),
                    title: 'Issue connecting to Expensify site',
                });
            }

            if (response.status === CONST.HTTP_STATUS.TOO_MANY_REQUESTS) {
                throw new HttpsError({
                    message: CONST.ERROR.THROTTLED,
                    status: response.status.toString(),
                    title: 'API request throttled',
                });
            }

            throw new HttpsError({
                message: response.statusText,
                status: response.status.toString(),
            });
        }

        // Handle business logic errors
        const responseData = response.data;
        if (responseData.jsonCode === CONST.JSON_CODE.BAD_REQUEST && responseData.message === CONST.ERROR_TITLE.DUPLICATE_RECORD) {
            throw new HttpsError({
                message: CONST.ERROR.DUPLICATE_RECORD,
                status: CONST.JSON_CODE.BAD_REQUEST.toString(),
                title: CONST.ERROR_TITLE.DUPLICATE_RECORD,
            });
        }

        if (responseData.jsonCode === CONST.JSON_CODE.EXP_ERROR && responseData.title === CONST.ERROR_TITLE.SOCKET && responseData.type === CONST.ERROR_TYPE.SOCKET) {
            throw new HttpsError({
                message: CONST.ERROR.EXPENSIFY_SERVICE_INTERRUPTED,
                status: CONST.JSON_CODE.EXP_ERROR.toString(),
                title: CONST.ERROR_TITLE.SOCKET,
            });
        }

        if (responseData.data?.authWriteCommands?.length) {
            const {phpCommandName, authWriteCommands} = responseData.data;
            const message = `The API command ${phpCommandName} is doing too many Auth writes. Count ${authWriteCommands.length}, commands: ${authWriteCommands.join(', ')}.`;
            alert('Too many auth writes', message);
        }

        if (responseData.jsonCode === CONST.JSON_CODE.UPDATE_REQUIRED) {
            alertUser();
        }

        return responseData;
    } catch (error) {
        if (axios.isCancel(error)) {
            throw new HttpsError({
                message: 'Request cancelled',
                status: '0',
                title: 'Cancelled',
            });
        }

        const axiosError = error as AxiosError;
        if (!axiosError.response) {
            throw new HttpsError({
                message: CONST.ERROR.FAILED_TO_FETCH,
                status: '0',
                title: 'Network Error',
            });
        }

        throw error;
    }
}

/**
 * Makes XHR request
 * @param command the name of the API command
 * @param data parameters for the API command
 * @param type HTTP request type (get/post)
 * @param shouldUseSecure should we use the secure server
 */
function xhr(command: string, data: Record<string, unknown>, type: RequestType = CONST.NETWORK.METHOD.POST, shouldUseSecure = false, initiatedOffline = false): Promise<Response> {
    return prepareRequestPayload(command, data, initiatedOffline).then((formData) => {
        const url = getCommandURL({shouldUseSecure, command});
        const abortSignalController = data.canCancel ? abortControllerMap.get(command as AbortCommand) ?? abortControllerMap.get(ABORT_COMMANDS.All) : undefined;

        return processHTTPRequest(url, type, formData, abortSignalController?.signal);
    });
}

function cancelPendingRequests(command: AbortCommand = ABORT_COMMANDS.All) {
    const controller = abortControllerMap.get(command);

    controller?.abort();

    // We create a new instance because once `abort()` is called any future requests using the same controller would
    // automatically get rejected: https://dom.spec.whatwg.org/#abortcontroller-api-integration
    abortControllerMap.set(command, new AbortController());
}

export default {
    xhr,
    cancelPendingRequests,
};
