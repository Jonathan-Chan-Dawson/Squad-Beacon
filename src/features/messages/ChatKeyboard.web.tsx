import React, { type ReactNode } from "react";
import { View } from "react-native";

export function ChatKeyboardProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function ChatKeyboardFrame({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1, minHeight: 200 }}>{children}</View>;
}
