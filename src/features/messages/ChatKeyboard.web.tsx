import React, { type ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function ChatKeyboardProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function ChatKeyboardFrame({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
  avoidKeyboard?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        paddingBottom: compact ? 0 : insets.bottom,
      }}
    >
      {children}
    </View>
  );
}
