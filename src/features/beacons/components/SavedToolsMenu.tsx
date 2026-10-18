import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  Bookmark,
  CalendarDays,
  FolderOpen,
  LayoutTemplate,
  Star,
  UsersRound,
} from "lucide-react-native";
import { ActionRow, ContextMenu, MenuGroup } from "@/src/shared/ContextMenu";
import { useDesignTheme } from "@/src/shared/design-system";
import { useBeacon } from "@/src/shared/store";
import {
  personalCollections,
  type BeaconCollection,
} from "../personalCollections";
export function SavedToolsMenu({
  visible,
  onClose,
  anchorRef,
  onCollection,
  onTemplates,
}: {
  visible: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<View | null>;
  onCollection: (kind: BeaconCollection) => void;
  onTemplates: () => void;
}) {
  const { data, userId } = useBeacon();
  const { colors } = useDesignTheme();
  const groups = personalCollections(data, userId);
  const next = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      next.current = null;
    },
    [],
  );
  const choose = (callback: () => void) => {
    next.current = callback;
    onClose();
  };
  return (
    <ContextMenu
      title="Saved & Tools"
      visible={visible}
      onClose={onClose}
      anchorRef={anchorRef}
      onDismiss={() => {
        const callback = next.current;
        next.current = null;
        callback?.();
      }}
    >
      <MenuGroup title="Saved / Personal">
        <ActionRow
          label="Saved Beacons"
          count={groups.saved.length}
          icon={<Bookmark size={18} color={colors.textSecondary} />}
          onPress={() => choose(() => onCollection("saved"))}
        />
        <ActionRow
          label="Favorite friends"
          count={groups.friends.length}
          icon={<Star size={18} color={colors.textSecondary} />}
          onPress={() => choose(() => onCollection("friends"))}
        />
        <ActionRow
          label="Favorite Squads"
          count={groups.squads.length}
          icon={<UsersRound size={18} color={colors.textSecondary} />}
          onPress={() => choose(() => onCollection("squads"))}
        />
        <ActionRow
          label="My Plans"
          icon={<CalendarDays size={18} color={colors.textSecondary} />}
          onPress={() => choose(() => router.push("/plans"))}
        />
      </MenuGroup>
      <MenuGroup title="Tools">
        <ActionRow
          label="My Templates"
          icon={<LayoutTemplate size={18} color={colors.textSecondary} />}
          onPress={() => choose(onTemplates)}
        />
        <ActionRow
          label="Library"
          icon={<FolderOpen size={18} color={colors.textSecondary} />}
          onPress={() => choose(() => router.push("/library"))}
        />
      </MenuGroup>
    </ContextMenu>
  );
}
