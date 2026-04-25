type ActionPayloadParams = {
    screen?: string;
    params?: unknown;
    path?: string;
};

type ActionPayload = {
    params?: ActionPayloadParams;
};

type LinkToOptions = {
    // To explicitly set the action type to replace.
    forceReplace?: boolean;
    // Callback to execute after the navigation transition animation completes.
    afterTransition?: () => void;
    // If true, waits for ongoing transitions to finish before navigating. Defaults to false (navigates immediately).
    waitForTransition?: boolean;
    // Extra params merged into the target route's params after navigation completes.
    // These live only in navigation state — they are NOT serialized to the URL.
    // Use for transient context the target screen needs at mount time (e.g., parent-report
    // references known at click-time but not yet hydrated in Onyx).
    stateParams?: Record<string, unknown>;
};

export type {ActionPayload, ActionPayloadParams, LinkToOptions};
