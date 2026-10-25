import React, { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ModalProps } from "react-native";

/** Use the shared overlay lifecycle instead of RN Web's independent modal focus stack. */
export function DialogPortal({
  visible,
  children,
  onShow,
  onDismiss,
}: Omit<ModalProps, "onShow"> & { onShow?: () => void }) {
  const previous = useRef(false);
  const callbacks = useRef({ onShow, onDismiss });
  useLayoutEffect(() => {
    callbacks.current = { onShow, onDismiss };
  });
  useEffect(() => {
    if (visible) callbacks.current.onShow?.();
    else if (previous.current) callbacks.current.onDismiss?.();
    previous.current = !!visible;
  }, [visible]);
  if (!visible || typeof document === "undefined") return null;
  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
