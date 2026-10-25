import { useEffect, type RefObject } from "react";
import { Platform, type View } from "react-native";

const selector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="button"][tabindex="0"], [tabindex="0"]';

export function focusOverlay(ref: RefObject<View | null>, label?: string) {
  if (Platform.OS !== "web") return;
  const root = ref.current as unknown as HTMLElement | null;
  const safe = label
    ? Array.from(root?.querySelectorAll<HTMLElement>(selector) ?? []).find(
        (node) =>
          node.getAttribute("aria-label") === label ||
          node.textContent === label,
      )
    : null;
  (safe ?? root?.querySelector<HTMLElement>(selector) ?? root)?.focus({
    preventScroll: true,
  });
}

/** Only the top registered overlay may contain focus or handle Escape. */
export function useOverlayKeyboardFocus(
  ref: RefObject<View | null>,
  active: boolean,
  onEscape: () => void,
  focus: () => void,
) {
  useEffect(() => {
    if (Platform.OS !== "web" || !active) return;
    const entryFrame = requestAnimationFrame(() => {
      const root = ref.current as unknown as HTMLElement | null;
      if (root && !root.contains(document.activeElement)) focus();
    });
    const focusIn = (event: FocusEvent) => {
      const root = ref.current as unknown as HTMLElement | null;
      if (root && event.target instanceof Node && !root.contains(event.target))
        focus();
    };
    const keyDown = (event: KeyboardEvent) => {
      const root = ref.current as unknown as HTMLElement | null;
      if (!root) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onEscape();
      }
      if (event.key !== "Tab") return;
      const items = Array.from(
        root.querySelectorAll<HTMLElement>(selector),
      ).filter(
        (node) =>
          node.getClientRects().length &&
          node.getAttribute("aria-disabled") !== "true" &&
          node.getAttribute("aria-label") !== "Dismiss sheet",
      );
      if (!items.length) {
        event.preventDefault();
        root.focus();
        return;
      }
      const first = items[0],
        last = items[items.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !root.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !root.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("focusin", focusIn, true);
    document.addEventListener("keydown", keyDown, true);
    return () => {
      cancelAnimationFrame(entryFrame);
      document.removeEventListener("focusin", focusIn, true);
      document.removeEventListener("keydown", keyDown, true);
    };
  }, [active, ref, onEscape, focus]);
}
