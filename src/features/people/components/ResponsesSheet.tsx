import { useEffect, useRef } from "react";
import { router, type Href } from "expo-router";
import type {
  PlanningCardAction,
  PlanningResponseCardProps,
} from "./PlanningResponseCard";

export interface ResponseInvitation {
  id: string;
  title: string;
  sourceLabel?: string;
  pending?: boolean;
  actions: PlanningCardAction[];
}

export interface ResponsesSheetProps {
  visible: boolean;
  onClose: () => void;
  pings?: PlanningResponseCardProps[];
  votes?: PlanningResponseCardProps[];
  draws?: PlanningResponseCardProps[];
  invitations?: ResponseInvitation[];
  onCreate: () => void;
  createLabel?: "New Ping" | "New Vote" | "New Ping or Vote";
}

/** Compatibility entry for existing Beacons/Chats launchers; the inbox owns live data. */
export function ResponsesSheet({ visible, onClose }: ResponsesSheetProps) {
  const opened = useRef(false);
  useEffect(() => {
    if (!visible) {
      opened.current = false;
      return;
    }
    if (opened.current) return;
    opened.current = true;
    onClose();
    router.push("/responses" as Href);
  }, [visible, onClose]);
  return null;
}
