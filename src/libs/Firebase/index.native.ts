/* eslint-disable no-unused-vars */
import perf from '@react-native-firebase/perf';
import * as Environment from '@libs/Environment/Environment';
import type {StartTrace, StopTrace, TraceMap, TraceOptions} from './types';

const traceMap: TraceMap = {};

const startTrace: StartTrace = (customEventName, {userId, email, reports, personalDetails}: TraceOptions) => {
    const start = global.performance.now();
    // if (Environment.isDevelopment()) {
    //     return;
    // }

    if (traceMap[customEventName]) {
        return;
    }

    perf()
        .startTrace(customEventName)
        .then((trace) => {
            trace.putAttribute('userId', userId.toString());
            trace.putAttribute('email', email);
            trace.putAttribute('reports', reports.toString());
            trace.putAttribute('personalDetails', personalDetails.toString());
            traceMap[customEventName] = {
                trace,
                start,
            };
        });
};

const stopTrace: StopTrace = (customEventName) => {
    // Uncomment to inspect logs on release builds
    // const stop = global.performance.now();
    // if (Environment.isDevelopment()) {
    //     return;
    // }

    const trace = traceMap[customEventName].trace;
    if (!trace) {
        return;
    }

    trace.stop();

    // Uncomment to inspect logs on release builds
    // const start = lodashGet(traceMap, [customEventName, 'start']);
    // Log.info(`sidebar_loaded: ${stop - start} ms`, true);

    delete traceMap[customEventName];
};

export default {
    startTrace,
    stopTrace,
};
