import React from "react";
import { Platform, View } from "react-native";
let webSheetScrollLocks = 0;
let previousWebBodyOverflow = "";
const activeSheetStack: string[] = [];
const sheetVisibility = new Map<string, boolean>();
const sheetLabels = new Map<string, string>();
export function getOverlayTitle(id: string) {
  return sheetLabels.get(id) ?? "";
}
const sheetStackSubscribers = new Set<() => void>();

export function subscribeToSheetStack(callback: () => void) {
  sheetStackSubscribers.add(callback);
  return () => {
    sheetStackSubscribers.delete(callback);
  };
}

function notifySheetStackChanged() {
  sheetStackSubscribers.forEach((callback) => callback());
}

export function registerActiveSheet(sheetId: string) {
  const previousLength = activeSheetStack.length;
  const existingIndex = activeSheetStack.indexOf(sheetId);
  if (existingIndex >= 0) activeSheetStack.splice(existingIndex, 1);
  activeSheetStack.push(sheetId);
  if (activeSheetStack.length !== previousLength || existingIndex >= 0) {
    notifySheetStackChanged();
  }
}

export function unregisterActiveSheet(sheetId: string) {
  const index = activeSheetStack.indexOf(sheetId);
  const hadVisibility = sheetVisibility.delete(sheetId);
  const hadLabel = sheetLabels.delete(sheetId);
  if (index >= 0) activeSheetStack.splice(index, 1);
  if (index >= 0 || hadVisibility || hadLabel) notifySheetStackChanged();
}

export function isTopActiveSheet(sheetId: string) {
  return (
    activeSheetStack.at(-1) === sheetId && sheetVisibility.get(sheetId) === true
  );
}

export function useTopOverlay(id: string) {
  return React.useSyncExternalStore(
    subscribeToSheetStack,
    () => isTopActiveSheet(id),
    () => false,
  );
}

export function setSheetVisibility(sheetId: string, visible: boolean) {
  if (sheetVisibility.get(sheetId) === visible) return;
  sheetVisibility.set(sheetId, visible);
  notifySheetStackChanged();
}

export function setSheetLabel(sheetId: string, title: string) {
  if (sheetLabels.get(sheetId) === title) return;
  sheetLabels.set(sheetId, title);
  notifySheetStackChanged();
}

/** Register anchored overlays with the existing sheet isolation and scroll lock. */
export function useOverlayPresence(
  id: string,
  visible: boolean,
  title: string,
) {
  React.useLayoutEffect(() => {
    if (!visible) return;
    registerActiveSheet(id);
    setSheetVisibility(id, true);
    setSheetLabel(id, title);
    if (Platform.OS === "web") lockWebSheetScroll();
    return () => {
      unregisterActiveSheet(id);
      if (Platform.OS === "web") unlockWebSheetScroll();
    };
  }, [id, visible, title]);
}

export function SheetIsolation({ children }: { children: React.ReactNode }) {
  const hasOpenSheet = React.useSyncExternalStore(
    subscribeToSheetStack,
    () => activeSheetStack.length > 0,
    () => false,
  );
  return (
    <View
      accessibilityElementsHidden={hasOpenSheet}
      importantForAccessibility={hasOpenSheet ? "no-hide-descendants" : "auto"}
      aria-hidden={hasOpenSheet}
      style={{ flex: 1 }}
    >
      {children}
    </View>
  );
}

export function lockWebSheetScroll() {
  if (typeof document === "undefined") return;
  if (webSheetScrollLocks === 0) {
    previousWebBodyOverflow = document.body.style.overflow;
  }
  webSheetScrollLocks += 1;
  document.body.style.overflow = "hidden";
}

export function unlockWebSheetScroll() {
  if (typeof document === "undefined" || webSheetScrollLocks === 0) return;
  webSheetScrollLocks -= 1;
  if (webSheetScrollLocks === 0) {
    document.body.style.overflow = previousWebBodyOverflow;
  }
}
