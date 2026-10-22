import { sheetSurface } from "@/src/shared/mobilePresentation";
import React, { useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import BottomSheet, { useBottomSheetSpringConfigs } from "@gorhom/bottom-sheet";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/shared/ui";
import { MapPanel } from "./MapPanel";
import { useBeacon } from "@/src/shared/store";
import { communityReturnSheetIndex, rememberCommunityReturnSheet } from "./communityReturnState";

/** One map-owned sheet; secondary features replace its content rather than opening a modal. */
export function BeaconOverviewSheet(
  props: React.ComponentProps<typeof MapPanel> & {
    onMapSpaceChange?: (height: number) => void;
  },
) {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const animationConfigs = useBottomSheetSpringConfigs(tokens.motion.sheetSpring);
  const close = () => Platform.OS === "web" ? props.onClose() : ref.current?.close();
  const ref = useRef<BottomSheet>(null);
  const { userId } = useBeacon();
  const [index, setIndex] = useState(() => communityReturnSheetIndex(userId, props.beaconId));
  const { width, height } = useWindowDimensions();
  const [containerHeight, setContainerHeight] = useState(height);
  const { onMapSpaceChange } = props;
  useEffect(() => {
    onMapSpaceChange?.(
      index === 0
        ? containerHeight - 208 - insets.bottom
        : containerHeight * (index === 1 ? 0.3 : 0.06),
    );
  }, [index, containerHeight, insets.bottom, onMapSpaceChange]);
  const position = useSharedValue(height);
  const contentStyle = useAnimatedStyle(() => ({
    height: Math.max(0, containerHeight - position.value - 24),
    overflow: "hidden",
  }));
  const mapDismissStyle = useAnimatedStyle(() => ({
    height: Math.max(0, position.value),
  }));
  const sheetWidth = Math.min(
    width - insets.left - insets.right,
    tokens.layout.contentMaxWidth,
  );
  return (
    <View
      pointerEvents="box-none"
      testID="beacon-overview-sheet"
      onLayout={(event) => setContainerHeight(event.nativeEvent.layout.height)}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        elevation: 30,
        ...(Platform.OS === "web"
          ? ({ overflow: "clip" } as unknown as ViewStyle)
          : {}),
      }}
    >
      <BottomSheet
        ref={ref}
        animatedPosition={position}
        index={communityReturnSheetIndex(userId, props.beaconId)}
        animateOnMount={Platform.OS !== "web"}
        animationConfigs={Platform.OS !== "web" ? animationConfigs : undefined}
        overrideReduceMotion={ReduceMotion.System}
        snapPoints={[208 + insets.bottom, "70%", "94%"]}
        enableDynamicSizing={false}
        enablePanDownToClose
        enableContentPanningGesture={Platform.OS !== "web"}
        // Gorhom's hosting container forces overflow:hidden unless detached.
        // Web clips at our outer frame so focus cannot scroll that container.
        detached={Platform.OS === "web"}
        bottomInset={0}
        topInset={insets.top}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        onChange={(next) => {
          setIndex(next);
          rememberCommunityReturnSheet(userId, props.beaconId, next);
        }}
        onClose={props.onClose}
        handleComponent={() => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              index === 2 ? "Reduce Beacon sheet" : "Expand Beacon sheet"
            }
            accessibilityHint="Drag to resize, or activate to expand or reduce the panel"
            accessibilityState={{ expanded: index === 2 }}
            hitSlop={10}
            onPress={() => ref.current?.snapToIndex(index === 2 ? 1 : 2)}
            style={{
              height: 24,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                height: 4,
                width: 36,
                borderRadius: 2,
                backgroundColor: colors.muted,
              }}
            />
          </Pressable>
        )}
        style={{
          marginHorizontal: (width - sheetWidth) / 2,
        }}
        backgroundStyle={{
          ...(Platform.OS !== "web" ? sheetSurface(colors.white, tokens.radius.sheet) : { backgroundColor: colors.white }),
          borderWidth: 1,
          borderColor: colors.line,
          borderTopLeftRadius: tokens.radius.sheet,
          borderTopRightRadius: tokens.radius.sheet,
        }}
        handleIndicatorStyle={{ backgroundColor: colors.muted, width: 36 }}
      >
        <Animated.View style={contentStyle}>
          <MapPanel
            {...props}
            onClose={close}
            collapsed={index === 0}
            expanded={index === 2}
            onResize={() => ref.current?.snapToIndex(index === 2 ? 1 : 2)}
            onCollapse={() => ref.current?.snapToIndex(0)}
          />
        </Animated.View>
      </BottomSheet>
      <Animated.View
        style={[
          { position: "absolute", top: 0, left: 0, right: 0, zIndex: 50 },
          mapDismissStyle,
        ]}
      >
        <Pressable
          testID="beacon-sheet-dismiss-area"
          accessibilityRole="button"
          accessibilityLabel="Dismiss Beacon panel by tapping the map"
          onPress={close}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}
