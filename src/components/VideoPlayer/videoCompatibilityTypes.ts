/**
 * Compatibility types for migrating from expo-av to expo-video
 * These types help maintain backwards compatibility during migration
 */

// Type to match expo-av's AVPlaybackStatus structure
type AVPlaybackStatus =
    | {
        isLoaded: false;
        error?: string;
    }
    | {
        isLoaded: true;
        isPlaying: boolean;
        isBuffering: boolean;
        isMuted: boolean;
        volume: number;
        durationMillis?: number;
        positionMillis: number;
        didJustFinish: boolean;
        isLooping: boolean;
        rate: number;
        shouldCorrectPitch: boolean;
    };

type AVPlaybackStatusSuccess = Extract<AVPlaybackStatus, {isLoaded: true}>;

type AVPlaybackStatusToSet = {
    isMuted?: boolean;
    volume?: number;
    positionMillis?: number;
    shouldPlay?: boolean;
    rate?: number;
    shouldCorrectPitch?: boolean;
    isLooping?: boolean;
};

type VideoFullscreenUpdateEvent = {
    fullscreenUpdate: 0 | 1 | 2 | 3; // VideoFullscreenUpdate enum values
    status?: AVPlaybackStatus;
};

type VideoReadyForDisplayEvent = {
    naturalSize: {
        width: number;
        height: number;
        orientation: 'portrait' | 'landscape';
    };
    status?: AVPlaybackStatus;
};

export type {AVPlaybackStatus, AVPlaybackStatusSuccess, AVPlaybackStatusToSet, VideoFullscreenUpdateEvent, VideoReadyForDisplayEvent};
