import type { ImageContentFit } from "expo-image";
import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import ImageSVG from "@components/ImageSVG";
import useStyleUtils from "@hooks/useStyleUtils";
import useThemeStyles from "@hooks/useThemeStyles";
import { canUseTouchScreen } from "@libs/DeviceCapabilities";
import variables from "@styles/variables";
import type IconAsset from "@src/types/utils/IconAsset";
import IconWrapperStyles from "./IconWrapperStyles";
import IconWithGestureCanvas from "./IconWithGestureCanvas";

type IconProps = {
  /** The asset to render. */
  src: IconAsset | undefined;

  /** The width of the icon. */
  width?: number;

  /** The height of the icon. */
  height?: number;

  /** The fill color for the icon. Can be hex, rgb, rgba, or valid react-native named color such as 'red' or 'blue'. */
  fill?: string;

  /** Is small icon */
  extraSmall?: boolean;
  small?: boolean;

  /** Is large icon */
  large?: boolean;

  /** Is medium icon */
  medium?: boolean;

  /** Is inline icon */
  inline?: boolean;

  /** Is icon hovered */
  hovered?: boolean;

  /** Is icon pressed */
  pressed?: boolean;

  /** Additional styles to add to the Icon */
  additionalStyles?: StyleProp<ViewStyle>;

  /** Used to locate this icon in end-to-end tests. */
  testID?: string;

  /** Determines how the image should be resized to fit its container */
  contentFit?: ImageContentFit;

  /** Determines whether the icon is being used within a button. The icon size will remain the same for both icon-only buttons and buttons with text. */
  isButtonIcon?: boolean;

  /** Renders the Icon component within a MultiGestureCanvas for improved gesture controls. */
  enableMultiGestureCanvas?: boolean;
};

function Icon({
  src,
  width = variables.iconSizeNormal,
  height = variables.iconSizeNormal,
  fill = undefined,
  extraSmall = false,
  small = false,
  large = false,
  medium = false,
  inline = false,
  additionalStyles = [],
  hovered = false,
  pressed = false,
  testID = "",
  contentFit = "cover",
  isButtonIcon = false,
  enableMultiGestureCanvas = false,
}: IconProps) {
  const StyleUtils = useStyleUtils();
  const styles = useThemeStyles();
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
  const iconStyles = [
    StyleUtils.getWidthAndHeightStyle(width ?? 0, height),
    IconWrapperStyles,
    styles.pAbsolute,
    additionalStyles,
  ];

  if (!src) {
    return null;
  }

  if (inline) {
    return (
      <View
        testID={testID}
        style={[
          StyleUtils.getWidthAndHeightStyle(width ?? 0, height),
          styles.bgTransparent,
          styles.overflowVisible,
        ]}
        pointerEvents="none"
      >
        <View style={iconStyles}>
          <ImageSVG
            src={src}
            width={iconWidth}
            height={iconHeight}
            fill={fill}
            hovered={hovered}
            pressed={pressed}
            contentFit={contentFit}
            pointerEvents="none"
          />
        </View>
      </View>
    );
  }

  // IconWithGestureCanvas is a separate module so its heavy deps (react-native-reanimated,
  // MultiGestureCanvas, AttachmentCarouselPagerContext) are not required unless this
  // branch is actually entered. With inlineRequires:true the require() is deferred to
  // the point of first use, keeping them out of the cold-start module graph.
  if (canUseTouchScreen() && enableMultiGestureCanvas) {
    return (
      <IconWithGestureCanvas
        src={src}
        width={width}
        height={height}
        fill={fill}
        extraSmall={extraSmall}
        small={small}
        large={large}
        medium={medium}
        additionalStyles={additionalStyles}
        hovered={hovered}
        pressed={pressed}
        testID={testID}
        contentFit={contentFit}
        isButtonIcon={isButtonIcon}
      />
    );
  }

  return (
    <View
      testID={testID}
      style={additionalStyles}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      accessible={false}
      pointerEvents="none"
    >
      <ImageSVG
        src={src}
        width={iconWidth}
        height={iconHeight}
        fill={fill}
        hovered={hovered}
        pressed={pressed}
        contentFit={contentFit}
        pointerEvents="none"
      />
    </View>
  );
}

export default Icon;
export type { IconProps };
