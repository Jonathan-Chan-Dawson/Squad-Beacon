import React, { type ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  KeyboardAvoidingView,
  KeyboardProvider,
  useKeyboardState,
} from "react-native-keyboard-controller";

export function ChatKeyboardProvider({ children }: { children: ReactNode }) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}
export function ChatKeyboardFrame({
  children,
  compact = false,
  avoidKeyboard = true,
}: {
  children: ReactNode;
  compact?: boolean;
  avoidKeyboard?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const visible = useKeyboardState((state) => state.isVisible);
  if (!avoidKeyboard)
    return <View style={{ flex: 1, minHeight: 0 }}>{children}</View>;
  return (
    <KeyboardAvoidingView
      automaticOffset
      behavior="padding"
      style={{
        flex: 1,
        minHeight: 0,
      }}
    >
      <View
        style={{
          flex: 1,
          minHeight: 0,
          paddingBottom: compact || visible ? 0 : insets.bottom,
        }}
      >
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}
