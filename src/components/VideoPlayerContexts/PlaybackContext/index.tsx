import {useVideoPlayer} from 'expo-video';
import type {VideoPlayer} from 'expo-video';
import React, {useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import type {View} from 'react-native';
import type {VideoWithOnFullScreenUpdate} from '@components/VideoPlayer/types';
import {getReportOrDraftReport, isChatThread} from '@libs/ReportUtils';
import Navigation from '@navigation/Navigation';
import type ChildrenProps from '@src/types/utils/ChildrenProps';
import type {ProtectedCurrentRouteReportID} from './playbackContextReportIDUtils';
import {findURLInReportOrAncestorAttachments, getCurrentRouteReportID, NO_REPORT_ID, NO_REPORT_ID_IN_PARAMS, normalizeReportID} from './playbackContextReportIDUtils';
import type {OriginalParent, PlaybackContext, PlaybackContextValues} from './types';
import usePlaybackContextVideoRefs from './usePlaybackContextVideoRefs';

const Context = React.createContext<PlaybackContext | null>(null);

function PlaybackContextProvider({children}: ChildrenProps) {
    const [currentlyPlayingURL, setCurrentlyPlayingURL] = useState<PlaybackContextValues['currentlyPlayingURL']>(null);
    const [sharedElement, setSharedElement] = useState<PlaybackContextValues['sharedElement']>(null);
    const [originalParent, setOriginalParent] = useState<OriginalParent>(null);
    const [currentRouteReportID, setCurrentRouteReportID] = useState<ProtectedCurrentRouteReportID>(NO_REPORT_ID);
    
    // Shared video player management for expo-video
    const sharedVideoPlayers = useRef<Map<string, VideoPlayer>>(new Map());
    const sharedPlayerCleanupTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
    
    // Shared video element rendering management
    const sharedVideoRenderers = useRef<Map<string, Set<string>>>(new Map());
    const primaryVideoRenderers = useRef<Map<string, string>>(new Map());
    const rendererCallbacks = useRef<Map<string, Map<string, (isPrimary: boolean) => void>>>(new Map());
    
    const resetContextProperties = () => {
        setSharedElement(null);
        setOriginalParent(null);
        setCurrentlyPlayingURL(null);
        setCurrentRouteReportID(NO_REPORT_ID);
    };

    const video = usePlaybackContextVideoRefs(resetContextProperties);

    const updateCurrentURLAndReportID: PlaybackContextValues['updateCurrentURLAndReportID'] = useCallback(
        (url, reportID) => {
            if (!url || !reportID) {
                return;
            }

            if (currentlyPlayingURL && url !== currentlyPlayingURL) {
                video.pause();
            }

            const report = getReportOrDraftReport(reportID);
            const isReportAChatThread = isChatThread(report);
            let reportIDtoSet;
            if (isReportAChatThread) {
                reportIDtoSet = findURLInReportOrAncestorAttachments(report, url) ?? NO_REPORT_ID;
            } else {
                reportIDtoSet = reportID;
            }

            const routeReportID = getCurrentRouteReportID(url);

            if (reportIDtoSet === routeReportID || routeReportID === NO_REPORT_ID_IN_PARAMS) {
                setCurrentRouteReportID(reportIDtoSet);
            }

            setCurrentlyPlayingURL(url);
        },
        [currentlyPlayingURL, video],
    );

    const shareVideoPlayerElements: PlaybackContextValues['shareVideoPlayerElements'] = useCallback(
        (
            ref: VideoWithOnFullScreenUpdate | null,
            parent: View | HTMLDivElement | null,
            child: View | HTMLDivElement | null,
            shouldNotAutoPlay: boolean,
            {shouldUseSharedVideoElement, url, reportID},
        ) => {
            if (shouldUseSharedVideoElement || url !== currentlyPlayingURL || reportID !== currentRouteReportID) {
                return;
            }

            video.updateRef(ref);
            setOriginalParent(parent);
            setSharedElement(child);
            // Prevents autoplay when uploading the attachment
            if (!shouldNotAutoPlay) {
                video.play();
            }
        },
        [currentRouteReportID, currentlyPlayingURL, video],
    );

    // Shared video player management functions for expo-video
    const registerSharedVideoPlayer = useCallback((url: string, player: VideoPlayer) => {
        sharedVideoPlayers.current.set(url, player);
        
        // Cancel any pending cleanup for this URL
        const cleanupTimer = sharedPlayerCleanupTimers.current.get(url);
        if (cleanupTimer) {
            clearTimeout(cleanupTimer);
            sharedPlayerCleanupTimers.current.delete(url);
        }
    }, []);

    const getSharedVideoPlayer = useCallback((url: string): VideoPlayer | null => {
        return sharedVideoPlayers.current.get(url) || null;
    }, []);

    const releaseSharedVideoPlayer = useCallback((url: string) => {
        // Set a cleanup timer to remove the player after a delay
        // This prevents immediate recreation if the player is needed again soon
        const cleanupTimer = setTimeout(() => {
            sharedVideoPlayers.current.delete(url);
            sharedPlayerCleanupTimers.current.delete(url);
        }, 5000); // 5 second delay
        
        sharedPlayerCleanupTimers.current.set(url, cleanupTimer);
    }, []);

    // Shared video element rendering management functions
    const registerSharedVideoRenderer = useCallback((url: string, componentId: string, callback?: (isPrimary: boolean) => void): boolean => {
        let renderers = sharedVideoRenderers.current.get(url);
        if (!renderers) {
            renderers = new Set();
            sharedVideoRenderers.current.set(url, renderers);
        }
        
        renderers.add(componentId);
        
        // Store callback if provided
        if (callback) {
            let callbacks = rendererCallbacks.current.get(url);
            if (!callbacks) {
                callbacks = new Map();
                rendererCallbacks.current.set(url, callbacks);
            }
            callbacks.set(componentId, callback);
        }
        
        // If this is the first renderer for this URL, make it the primary
        if (!primaryVideoRenderers.current.has(url)) {
            primaryVideoRenderers.current.set(url, componentId);
            callback?.(true);
            return true; // This component should render the VideoView
        }
        
        callback?.(false);
        return false; // This component should not render the VideoView
    }, []);

    const isPrimaryVideoRenderer = useCallback((url: string, componentId: string): boolean => {
        return primaryVideoRenderers.current.get(url) === componentId;
    }, []);

    const releaseSharedVideoRenderer = useCallback((url: string, componentId: string) => {
        const renderers = sharedVideoRenderers.current.get(url);
        const callbacks = rendererCallbacks.current.get(url);
        
        if (renderers) {
            renderers.delete(componentId);
            callbacks?.delete(componentId);
            
            // If this was the primary renderer, assign a new one
            if (primaryVideoRenderers.current.get(url) === componentId) {
                primaryVideoRenderers.current.delete(url);
                
                // Assign the next available renderer as primary
                const nextRenderer = renderers.values().next().value;
                if (nextRenderer) {
                    primaryVideoRenderers.current.set(url, nextRenderer);
                    
                    // Notify all components about the change
                    callbacks?.forEach((callback, rendererComponentId) => {
                        callback(rendererComponentId === nextRenderer);
                    });
                }
            }
            
            // Clean up if no renderers left
            if (renderers.size === 0) {
                sharedVideoRenderers.current.delete(url);
                primaryVideoRenderers.current.delete(url);
                rendererCallbacks.current.delete(url);
            }
        }
    }, []);

    useEffect(() => {
        Navigation.isNavigationReady().then(() => {
            // This logic ensures that resetVideoPlayerData is only called when currentReportID
            // changes from one valid value (i.e., not an empty string or '-1') to another valid value.
            // This prevents the video that plays when the app opens from being interrupted when currentReportID
            // is initially empty or '-1', or when it changes from empty/'-1' to another value
            // after the report screen in the central pane is mounted on the large screen.
            const routeReportID = currentlyPlayingURL ? getCurrentRouteReportID(currentlyPlayingURL) : undefined;

            const isSameReportID = routeReportID === currentRouteReportID || routeReportID === NO_REPORT_ID;
            const isOnRouteWithoutReportID = !!currentlyPlayingURL && getCurrentRouteReportID(currentlyPlayingURL) === NO_REPORT_ID_IN_PARAMS;

            if (isSameReportID || isOnRouteWithoutReportID) {
                return;
            }

            // We call another setStatusAsync inside useLayoutEffect on the video component,
            // so we add a delay here to prevent the error from appearing.
            setTimeout(() => {
                video.resetPlayerData();
            }, 0);
        });
    }, [currentRouteReportID, currentlyPlayingURL, video, video.resetPlayerData]);

    const contextValue: PlaybackContext = useMemo(
        () => ({
            updateCurrentURLAndReportID,
            currentlyPlayingURL,
            currentRouteReportID: normalizeReportID(currentRouteReportID),
            originalParent,
            sharedElement,
            shareVideoPlayerElements,
            setCurrentlyPlayingURL,
            currentVideoPlayerRef: video.ref,
            playVideo: video.play,
            pauseVideo: video.pause,
            checkIfVideoIsPlaying: video.isPlaying,
            videoResumeTryNumberRef: video.resumeTryNumberRef,
            resetVideoPlayerData: video.resetPlayerData,
            // Shared video player functions for expo-video
            registerSharedVideoPlayer,
            getSharedVideoPlayer,
            releaseSharedVideoPlayer,
            // Shared video element rendering management
            registerSharedVideoRenderer,
            isPrimaryVideoRenderer,
            releaseSharedVideoRenderer,
        }),
        [updateCurrentURLAndReportID, currentlyPlayingURL, currentRouteReportID, originalParent, sharedElement, video, shareVideoPlayerElements, registerSharedVideoPlayer, getSharedVideoPlayer, releaseSharedVideoPlayer, registerSharedVideoRenderer, isPrimaryVideoRenderer, releaseSharedVideoRenderer],
    );

    return <Context.Provider value={contextValue}>{children}</Context.Provider>;
}

function usePlaybackContext() {
    const playbackContext = useContext(Context);
    if (!playbackContext) {
        throw new Error('usePlaybackContext must be used within a PlaybackContextProvider');
    }
    return playbackContext;
}

PlaybackContextProvider.displayName = 'PlaybackContextProvider';

export {Context as PlaybackContext, PlaybackContextProvider, usePlaybackContext};
