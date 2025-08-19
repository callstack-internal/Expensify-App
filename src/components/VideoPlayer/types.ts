import type {VideoView} from 'expo-video';
import type {StyleProp, ViewStyle} from 'react-native';
import type {ValueOf} from 'type-fest';
import type CONST from '@src/CONST';
import type {AVPlaybackStatus, AVPlaybackStatusToSet, VideoFullscreenUpdateEvent, VideoReadyForDisplayEvent} from './videoCompatibilityTypes';

type VideoWithOnFullScreenUpdate = VideoView & {
    _onFullscreenUpdate: (event: VideoFullscreenUpdateEvent) => void;
    // TODO: Remove these stub methods when migrating to expo-video context system
    setStatusAsync?: (status: AVPlaybackStatusToSet) => Promise<AVPlaybackStatus>;
    getStatusAsync?: () => Promise<AVPlaybackStatus>;
    unloadAsync?: () => Promise<void>;
};

type VideoPlayerProps = {
    url: string;
    onVideoLoaded?: (event: VideoReadyForDisplayEvent) => void;
    resizeMode?: string;
    isLooping?: boolean;
    // style for the whole video player component
    style?: StyleProp<ViewStyle>;
    // style for the video player inside the component
    videoPlayerStyle?: StyleProp<ViewStyle>;
    // style for the video element inside the video player
    videoStyle?: StyleProp<ViewStyle>;
    videoControlsStyle?: StyleProp<ViewStyle>;
    videoDuration?: number;
    shouldUseSharedVideoElement?: boolean;
    shouldUseSmallVideoControls?: boolean;
    shouldShowVideoControls?: boolean;
    isVideoHovered?: boolean;
    onFullscreenUpdate?: (event: VideoFullscreenUpdateEvent) => void;
    onPlaybackStatusUpdate?: (status: AVPlaybackStatus) => void;
    shouldUseControlsBottomMargin?: boolean;
    controlsStatus?: ValueOf<typeof CONST.VIDEO_PLAYER.CONTROLS_STATUS>;
    shouldPlay?: boolean;
    isPreview?: boolean;
    reportID?: string;
};

export type {VideoPlayerProps, VideoWithOnFullScreenUpdate};
