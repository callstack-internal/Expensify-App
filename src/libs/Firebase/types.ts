import type {FirebasePerformanceTypes} from '@react-native-firebase/perf';

type Trace = {
    trace: FirebasePerformanceTypes.Trace;
    start: number;
};

type TraceOptions = {
    userId: number;
    email: string;
    reports: number;
    personalDetails: number;
};
type TraceMap = Record<string, Trace>;
type StartTrace = (customEventName: string, options: TraceOptions) => void;
type StopTrace = (customEventName: string) => void;

export type {StartTrace, StopTrace, TraceMap, TraceOptions};
