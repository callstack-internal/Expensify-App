/* eslint-disable no-underscore-dangle */
import {useVideoPlayer, VideoView} from 'expo-video';
import debounce from 'lodash/debounce';
import React, {useCallback, useEffect, useId, useMemo, useRef, useState} from 'react';
import {Platform, View} from 'react-native';
import {runOnJS, useSharedValue, withTiming} from 'react-native-reanimated';
import AttachmentOfflineIndicator from '@components/AttachmentOfflineIndicator';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import Hoverable from '@components/Hoverable';
import PressableWithoutFeedback from '@components/Pressable/PressableWithoutFeedback';
import {useFullScreenContext} from '@components/VideoPlayerContexts/FullScreenContext';
import {usePlaybackContext} from '@components/VideoPlayerContexts/PlaybackContext';
import VideoPopoverMenu from '@components/VideoPopoverMenu';
import useNetwork from '@hooks/useNetwork';
import useThemeStyles from '@hooks/useThemeStyles';
import addEncryptedAuthTokenToURL from '@libs/addEncryptedAuthTokenToURL';
import {canUseTouchScreen as canUseTouchScreenLib} from '@libs/DeviceCapabilities';
import CONST from '@src/CONST';
import type {VideoPlayerProps} from './types';
import type {AVPlaybackStatus, VideoFullscreenUpdateEvent} from './videoCompatibilityTypes';
import * as VideoUtils from './utils';
import VideoErrorIndicator from './VideoErrorIndicator';
import VideoPlayerControls from './VideoPlayerControls';

function BaseVideoPlayer({
    url,
    isLooping = false,
    style,
    videoPlayerStyle,
    videoStyle,
    videoControlsStyle,
    videoDuration = 0,
    controlsStatus = CONST.VIDEO_PLAYER.CONTROLS_STATUS.SHOW,
    shouldUseSharedVideoElement = false,
    shouldUseSmallVideoControls = false,
    onPlaybackStatusUpdate,
    onFullscreenUpdate,
    shouldPlay,
    // TODO: investigate what is the root cause of the bug with unexpected video switching
    // isVideoHovered caused a bug with unexpected video switching. We are investigating the root cause of the issue,
    // but current workaround is just not to use it here for now. This causes not displaying the video controls when
    // user hovers the mouse over the carousel arrows, but this UI bug feels much less troublesome for now.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isVideoHovered = false,
    isPreview,
    reportID,
}: VideoPlayerProps & {reportID: string}) {
    const styles = useThemeStyles();
    const {
        pauseVideo,
        playVideo,
        currentlyPlayingURL,
        updateCurrentURLAndReportID,
        videoResumeTryNumberRef,
        registerSharedVideoPlayer,
        getSharedVideoPlayer,
        releaseSharedVideoPlayer,
        registerSharedVideoRenderer,
        releaseSharedVideoRenderer,
    } = usePlaybackContext();
    const {isFullScreenRef} = useFullScreenContext();
    const {isOffline} = useNetwork();
    const [duration, setDuration] = useState(videoDuration * 1000);
    const [position, setPosition] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isEnded, setIsEnded] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [hasError] = useState(false);
    // we add "#t=0.001" at the end of the URL to skip first millisecond of the video and always be able to show proper video preview when video is paused at the beginning
    const [sourceURL] = useState(() => VideoUtils.addSkipTimeTagToURL(url.includes('blob:') || url.includes('file:///') ? url : addEncryptedAuthTokenToURL(url), 0.001));
    const [isPopoverVisible, setIsPopoverVisible] = useState(false);
    const [controlStatusState, setControlStatusState] = useState(controlsStatus);
    const controlsOpacity = useSharedValue(1);

    const videoViewRef = useRef<VideoView | null>(null);
    const canUseTouchScreen = canUseTouchScreenLib();
    const isCurrentlyURLSet = currentlyPlayingURL === url;
    const videoStateRef = useRef<AVPlaybackStatus | null>(null);

    const componentId = useId();
    const [shouldRenderVideoView, setShouldRenderVideoView] = useState(!shouldUseSharedVideoElement);

    // Create player with setup function using Object.assign to avoid ESLint no-param-reassign
    const localPlayer = useVideoPlayer(sourceURL, (playerInstance) => {
        Object.assign(playerInstance, {
            loop: isLooping,
            muted: false,
            volume: 1
        });
        if (shouldPlay) {
            playerInstance.play();
        }
    });

    // Get the actual player to use (shared or local)
    const player = useMemo(() => {
        if (shouldUseSharedVideoElement) {
            const sharedPlayer = getSharedVideoPlayer(sourceURL);
            return sharedPlayer ?? localPlayer;
        }
        return localPlayer;
    }, [shouldUseSharedVideoElement, sourceURL, localPlayer, getSharedVideoPlayer]);

    // Handle shared video player registration and cleanup
    useEffect(() => {
        if (!shouldUseSharedVideoElement) {
            return;
        }

        // Register this local player as shared if no shared player exists
        const existingPlayer = getSharedVideoPlayer(sourceURL);
        if (!existingPlayer) {
            registerSharedVideoPlayer(sourceURL, localPlayer);
        }

        // Register as a renderer with callback for primary status changes
        const shouldRender = registerSharedVideoRenderer(sourceURL, componentId, (isPrimary: boolean) => {
            setShouldRenderVideoView(isPrimary);
        });
        setShouldRenderVideoView(shouldRender);

        // Cleanup: release shared player and renderer when component unmounts
        return () => {
            releaseSharedVideoPlayer(sourceURL);
            releaseSharedVideoRenderer(sourceURL, componentId);
        };
    }, [sourceURL, shouldUseSharedVideoElement, localPlayer, componentId, getSharedVideoPlayer, registerSharedVideoPlayer, releaseSharedVideoPlayer, registerSharedVideoRenderer, releaseSharedVideoRenderer]);

    // Track player state
    useEffect(() => {
        if (!player) {return;}

        const statusInterval = setInterval(() => {
            const playing = player.playing;
            const currentPosition = player.currentTime * 1000; // Convert to milliseconds
            const totalDuration = player.duration * 1000; // Convert to milliseconds
            const buffering = player.status === 'loading';
            const ended = currentPosition >= totalDuration && totalDuration > 0;

            setIsPlaying(playing);
            setPosition(currentPosition);
            setDuration(totalDuration || videoDuration * 1000);
            setIsBuffering(buffering);
            setIsLoading(totalDuration === 0);

            if (ended && !player.loop) {
                setIsEnded(true);
                setControlStatusState(CONST.VIDEO_PLAYER.CONTROLS_STATUS.SHOW);
                controlsOpacity.set(1);
            }

            // Create AVPlaybackStatus compatible object
            const status: AVPlaybackStatus = {
                isLoaded: true,
                isPlaying: playing,
                isBuffering: buffering,
                isMuted: player.muted,
                volume: player.volume,
                durationMillis: totalDuration,
                positionMillis: currentPosition,
                didJustFinish: ended,
                isLooping: player.loop,
                rate: player.playbackRate,
                shouldCorrectPitch: true,
            };

            videoStateRef.current = status;
            onPlaybackStatusUpdate?.(status);
        }, 100);

        return () => clearInterval(statusInterval);
    }, [player, videoDuration, onPlaybackStatusUpdate, controlsOpacity]);

    const togglePlayCurrentVideo = useCallback(() => {
        setIsEnded(false);
        videoResumeTryNumberRef.current = 0;
        if (!isCurrentlyURLSet) {
            updateCurrentURLAndReportID(url, reportID);
        } else if (isPlaying) {
            player.pause();
            pauseVideo();
        } else {
            player.play();
            playVideo();
        }
    }, [isCurrentlyURLSet, isPlaying, pauseVideo, playVideo, reportID, updateCurrentURLAndReportID, url, videoResumeTryNumberRef, player]);

    const hideControl = useCallback(() => {
        if (isEnded) {
            return;
        }

        controlsOpacity.set(withTiming(0, {duration: 500}, () => runOnJS(setControlStatusState)(CONST.VIDEO_PLAYER.CONTROLS_STATUS.HIDE)));
    }, [controlsOpacity, isEnded]);

    const debouncedHideControl = useMemo(() => debounce(hideControl, 1500), [hideControl]);

    useEffect(() => {
        if (canUseTouchScreen) {
            return;
        }
        // If the device cannot use touch screen, always set the control status as 'show'.
        // Then if user hover over the video, controls is shown.
        setControlStatusState(CONST.VIDEO_PLAYER.CONTROLS_STATUS.SHOW);
    }, [canUseTouchScreen]);

    useEffect(() => {
        // We only auto hide the control if the device can use touch screen.
        if (!canUseTouchScreen) {
            return;
        }
        if (controlStatusState !== CONST.VIDEO_PLAYER.CONTROLS_STATUS.SHOW) {
            return;
        }
        if (!isPlaying || isPopoverVisible) {
            debouncedHideControl.cancel();
            return;
        }
        debouncedHideControl();
    }, [canUseTouchScreen, controlStatusState, debouncedHideControl, isPlaying, isPopoverVisible]);

    const showControl = useCallback(() => {
        if (controlStatusState === CONST.VIDEO_PLAYER.CONTROLS_STATUS.SHOW) {
            return;
        }

        setControlStatusState(CONST.VIDEO_PLAYER.CONTROLS_STATUS.SHOW);
        controlsOpacity.set(withTiming(1, {duration: 300}));
    }, [controlStatusState, controlsOpacity]);

    const handleOnFullscreenUpdate = useCallback(
        (event: {fullscreenUpdate: number}) => {
            const isFullscreenEnter = event.fullscreenUpdate === 0 || event.fullscreenUpdate === 1;
            const isFullscreenExit = event.fullscreenUpdate === 2 || event.fullscreenUpdate === 3;

            if (isFullscreenEnter) {
                // eslint-disable-next-line react-compiler/react-compiler
                isFullScreenRef.current = true;
            }
            if (isFullscreenExit) {
                // eslint-disable-next-line react-compiler/react-compiler
                isFullScreenRef.current = false;
                if (isPlaying) {
                    player.play();
                }
            }

            const fullscreenEvent: VideoFullscreenUpdateEvent = {
                fullscreenUpdate: event.fullscreenUpdate as 0 | 1 | 2 | 3,
                status: videoStateRef.current ?? undefined,
            };

            onFullscreenUpdate?.(fullscreenEvent);
        },
        [isFullScreenRef, isPlaying, player, onFullscreenUpdate]
    );

    if (hasError) {
        return (
            <VideoErrorIndicator
                isPreview={isPreview}
            />
        );
    }

    return (
        <>
            {/* We need to wrap the video component in a component that will catch unhandled pointer events. Otherwise, these
            events will bubble up the tree, and it will cause unexpected press behavior. */}
            <PressableWithoutFeedback
                accessible={false}
                style={[styles.cursorDefault, style]}
            >
                <Hoverable shouldFreezeCapture={isPopoverVisible}>
                    {(isHovered) => (
                        <View style={[styles.w100, styles.h100]}>
                            <PressableWithoutFeedback
                                accessibilityRole="button"
                                accessible={false}
                                onPress={showControl}
                                style={[styles.flex1, styles.noSelect]}
                            >
                                <View style={styles.flex1}>
                                    {shouldRenderVideoView && (
                                        <VideoView
                                            ref={videoViewRef}
                                            style={[styles.w100, styles.h100, videoPlayerStyle, videoStyle]}
                                            player={player}
                                            contentFit="contain"
                                            // On iOS/Android: nativeControls=true enables fullscreen functionality
                                            // On Web: nativeControls=false prevents dual controls
                                            nativeControls={Platform.OS !== 'web'}
                                            fullscreenOptions={{enable: true}}
                                            allowsPictureInPicture={false}
                                            onFullscreenEnter={() => handleOnFullscreenUpdate({fullscreenUpdate: 1})}
                                            onFullscreenExit={() => handleOnFullscreenUpdate({fullscreenUpdate: 3})}
                                        />
                                    )}

                                    {!shouldRenderVideoView && shouldUseSharedVideoElement && (
                                        <View style={[styles.w100, styles.h100, styles.flex1, videoStyle]} />
                                    )}
                                </View>
                            </PressableWithoutFeedback>

                            {((isLoading && !isOffline) || isBuffering) && <FullScreenLoadingIndicator style={[styles.opacity1, styles.bgTransparent]} />}
                            {isLoading && isOffline && <AttachmentOfflineIndicator />}

                            {!isLoading &&
                             !(shouldUseSharedVideoElement && !shouldRenderVideoView) &&
                             (canUseTouchScreen ? controlStatusState === CONST.VIDEO_PLAYER.CONTROLS_STATUS.SHOW : isHovered) && (
                                <VideoPlayerControls
                                    duration={duration}
                                    position={position}
                                    url={url}
                                    videoPlayerRef={videoViewRef}
                                    player={player}
                                    isPlaying={isPlaying}
                                    small={shouldUseSmallVideoControls}
                                    style={videoControlsStyle}
                                    showPopoverMenu={() => setIsPopoverVisible(true)}
                                    togglePlayCurrentVideo={togglePlayCurrentVideo}
                                    controlsStatus={controlStatusState}
                                    reportID={reportID}
                                />
                            )}
                        </View>
                    )}
                </Hoverable>
            </PressableWithoutFeedback>

            <VideoPopoverMenu
                isPopoverVisible={isPopoverVisible}
                hidePopover={() => setIsPopoverVisible(false)}
                anchorPosition={{horizontal: 0, vertical: 0}}
            />
        </>
    );
}

BaseVideoPlayer.displayName = 'BaseVideoPlayer';

export default BaseVideoPlayer;
