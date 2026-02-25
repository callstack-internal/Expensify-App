import type { ImageContentFit } from "expo-image";
import React, { useCallback, useMemo, useState } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { PixelRatio, StyleSheet, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import type { AttachmentCarouselPagerStateContextType } from "@components/Attachments/AttachmentCarousel/Pager/AttachmentCarouselPagerContext";
import {
  useAttachmentCarouselPagerActions,
  useAttachmentCarouselPagerState,
} from "@components/Attachments/AttachmentCarousel/Pager/AttachmentCarouselPagerContext";
import ImageSVG from "@components/ImageSVG";
import MultiGestureCanvas, {
  DEFAULT_ZOOM_RANGE,
} from "@components/MultiGestureCanvas";
import useStyleUtils from "@hooks/useStyleUtils";
import variables from "@styles/variables";
import type IconAsset from "@src/types/utils/IconAsset";
import type { Dimensions } from "@src/types/utils/Layout";

type IconCarouselPagerProps = {
  pagerRef: AttachmentCarouselPagerStateContextType["pagerRef"];
  isScrollEnabled: SharedValue<boolean>;
  onTap: () => void;
  onSwipeDown: () => void;
};

type IconWithGestureCanvasProps = {
  src: IconAsset | undefined;
  width?: number;
  height?: number;
  fill?: string;
  extraSmall?: boolean;
  small?: boolean;
  large?: boolean;
  medium?: boolean;
  additionalStyles?: StyleProp<ViewStyle>;
  hovered?: boolean;
  pressed?: boolean;
  testID?: string;
  contentFit?: ImageContentFit;
  isButtonIcon?: boolean;
};

function IconWithGestureCanvas({
  src,
  width = variables.iconSizeNormal,
  height = variables.iconSizeNormal,
  fill = undefined,
  extraSmall = false,
  small = false,
  large = false,
  medium = false,
  additionalStyles = [],
  hovered = false,
  pressed = false,
  testID = "",
  contentFit = "cover",
  isButtonIcon = false,
}: IconWithGestureCanvasProps) {
  const StyleUtils = useStyleUtils();
  const { width: iconWidth, height: iconHeight } =
    StyleUtils.getIconWidthAndHeightStyle(
      extraSmall,
      small,
      medium,
      large,
      width,
      height,
      isButtonIcon,
    );
  const contentSize: Dimensions = {
    width: iconWidth as number,
    height: iconHeight as number,
  };
  const [canvasSize, setCanvasSize] = useState<Dimensions>();
  const isCanvasLoading = canvasSize === undefined;
  const updateCanvasSize = useCallback(
    ({
      nativeEvent: {
        layout: { width: layoutWidth, height: layoutHeight },
      },
    }: LayoutChangeEvent) =>
      setCanvasSize({
        width: PixelRatio.roundToNearestPixel(layoutWidth),
        height: PixelRatio.roundToNearestPixel(layoutHeight),
      }),
    [],
  );

  const isScrollingEnabledFallback = useSharedValue(false);
  const state = useAttachmentCarouselPagerState();
  const actions = useAttachmentCarouselPagerActions();

  const {
    onTap,
    onSwipeDown,
    pagerRef,
    isScrollEnabled,
  }: IconCarouselPagerProps = useMemo((): IconCarouselPagerProps => {
    if (state === null || actions === null) {
      return {
        pagerRef: undefined,
        isScrollEnabled: isScrollingEnabledFallback,
        onTap: () => {},
        onSwipeDown: () => {},
      };
    }
    return {
      pagerRef: state.pagerRef,
      isScrollEnabled: state.isScrollEnabled,
      onTap: actions.onTap ?? (() => {}),
      onSwipeDown: actions.onSwipeDown ?? (() => {}),
    };
  }, [state, actions, isScrollingEnabledFallback]);

  return (
    <View style={StyleSheet.absoluteFill} onLayout={updateCanvasSize}>
      {!isCanvasLoading && (
        <MultiGestureCanvas
          isActive
          canvasSize={canvasSize}
          contentSize={contentSize}
          zoomRange={DEFAULT_ZOOM_RANGE}
          pagerRef={pagerRef}
          isUsedInCarousel={false}
          isPagerScrollEnabled={isScrollEnabled}
          onTap={onTap}
          onSwipeDown={onSwipeDown}
        >
          <View testID={testID} style={[additionalStyles]}>
            <ImageSVG
              src={src}
              width={iconWidth}
              height={iconHeight}
              fill={fill}
              hovered={hovered}
              pressed={pressed}
              contentFit={contentFit}
            />
          </View>
        </MultiGestureCanvas>
      )}
    </View>
  );
}

export default IconWithGestureCanvas;
