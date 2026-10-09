import React, { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  KeyboardProvider,
} from "react-native-keyboard-controller";

export function ChatKeyboardProvider({ children }: { children: ReactNode }) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}
export function ChatKeyboardFrame({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView
      automaticOffset
      behavior="padding"
      style={{ flex: 1, minHeight: 200 }}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
