/**
 * Utils for OpenTelemetry-like functionality. It enables creating spans and marking contextual, linked performance metrics.
 */
import Log from '@libs/Log';

type SpanId = symbol;

type Span = {
    id: SpanId;
    parentId: SpanId | undefined;
    children: Set<Span>;
    start: number;
    end: number | undefined;
    extraData?: Record<string, unknown>;
};

type SpanOptions = {
    parentSpanId?: SpanId;
    extraData?: Record<string, unknown>;
};

type WithSpanOptions<TArgs extends any[]> = {
    parentSpanId?: SpanId;
    extraData?: Record<string, unknown> | ((...args: TArgs) => Record<string, unknown>);
};

const spans = new Map<SpanId, Span>();

function startSpan<TArgs extends any[]>(spanId: SpanId, opts: SpanOptions = {}) {
    const span: Span = {
        id: spanId,
        parentId: opts.parentSpanId,
        children: new Set<Span>(),
        extraData: opts.extraData,
        start: Date.now(),
        end: undefined,
    };

    if (span.parentId) {
        const parentSpan = spans.get(span.parentId);
        if (parentSpan) {
            parentSpan.children.add(span);
        }

        Log.warn('[OTel] Parent span not found', {spanId: span.parentId});
    }
    spans.set(spanId, span);
}

// If span has no parent (i.e. root span), ending it should result in logging it with Log.info
// If span has children and is ending, they should be ended as well recursively
// If span is children (i.e. has parent), it should not be logged
// Ending the span results in 'freezing' it
// TODO: Extra data should be passed in
function endSpan(spanId: SpanId) {
    const span = spans.get(spanId);
    if (!span) {
        Log.warn('[OTel] Span not found', {spanId});
        return;
    }
    span.children.forEach((child) => endSpan(child.id));

    span.end = Date.now();

    if (!span.parentId) {
        Log.info(`[OTel] Span completed`, false, {span});
    }

    spans.delete(spanId);
}

function stringifySpan(span: Span): string {
    const children = Array.from(span.children).map((child) => stringifySpan(child));

    return JSON.stringify({
        id: span.id.toString(),
        parentId: span.parentId?.toString(),
        children,
        start: span.start,
        end: span.end,
        extraData: span.extraData,
    });
}

/** Higher-order function that starts a span, runs the function, and ends the span. */
function withSpan<RT, Args extends any[]>(fn: (...args: Args) => RT, tag: string, opts: WithSpanOptions<Args> = {}): (...args: Args) => RT {
    function wrappedFn(...args: Args) {
        const spanId = createSpanId(tag);

        const extraData = prepareExtraData(opts.extraData, args);
        // TODO: This won't work when we have indirect parent spanId :(((((
        const parentSpanId = opts.parentSpanId ?? args[args.length - 1];

        startSpan(spanId, {extraData, parentSpanId});
        //@ts-expect-error
        const result = fn(...args, spanId);

        if (isPromise(result)) {
            result.then((result) => endSpan(spanId));
        } else {
            endSpan(spanId);
        }

        return result;
    }

    return wrappedFn;
}

function prepareExtraData<Args extends any[]>(extraData: WithSpanOptions<Args>['extraData'], args: Args) {
    if (typeof extraData === 'function') {
        return extraData(...args);
    }
    return extraData;
}

function createSpanId(name: string): SpanId {
    return Symbol(`${name}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
}

function isPromise(value: any): value is Promise<any> {
    return value && typeof value === 'object' && 'then' in value && typeof value.then === 'function';
}

export {withSpan, startSpan, endSpan, createSpanId};
