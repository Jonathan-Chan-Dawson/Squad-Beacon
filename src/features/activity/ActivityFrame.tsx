import React, { createContext, useContext, useEffect, useRef } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen, useTheme } from "@/src/shared/ui";

export const ActivityEmbedded = createContext(false);
export function ActivityFrame(props: React.ComponentProps<typeof Screen>) {
  const embedded = useContext(ActivityEmbedded);
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const requestY = props.scrollRequest?.y;
  const requestSequence = props.scrollRequest?.sequence;
  useEffect(() => {
    if (requestY != null)
      scroll.current?.scrollTo({ y: requestY, animated: false });
  }, [requestY, requestSequence]);
  if (!embedded) return <Screen {...props} />;
  return (
    <ScrollView
      ref={scroll}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        width: "100%",
        maxWidth: tokens.layout.contentMaxWidth,
        alignSelf: "center",
        paddingHorizontal: tokens.layout.screenGutter,
        paddingTop: tokens.space.sm,
        paddingBottom: insets.bottom + tokens.layout.scrollClearance,
        gap: tokens.space.sm,
      }}
    >
      {props.children}
    </ScrollView>
  );
}
