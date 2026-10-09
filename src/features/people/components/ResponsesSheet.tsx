import React from "react";
import { Text, View } from "react-native";
import { Action, Button, Empty, Sheet, useTheme } from "@/src/shared/ui";
import {
  PlanningResponseCard,
  type PlanningCardAction,
  type PlanningResponseCardProps,
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

/** Data is supplied by canonical selectors; invitations preserve their original acceptance callbacks. */
export function ResponsesSheet({
  visible,
  onClose,
  pings = [],
  votes = [],
  draws = [],
  invitations = [],
  onCreate,
  createLabel = "New Ping or Vote",
}: ResponsesSheetProps) {
  const { styles } = useTheme();
  const groups = [
    { title: "Pings", items: pings },
    { title: "Votes", items: votes },
    { title: "Draws", items: draws },
  ];
  return (
    <Sheet
      title="Responses & invitations"
      visible={visible}
      onClose={onClose}
      footer={<Button title={createLabel} onPress={onCreate} />}
    >
      <View style={{ gap: 18 }}>
        {groups.map(({ title, items }) =>
          items.length ? (
            <View key={title} style={{ gap: 9 }}>
              <Text style={styles.h2}>
                {title} · {items.length}
              </Text>
              {items.map((item) => (
                <PlanningResponseCard key={item.id} {...item} />
              ))}
            </View>
          ) : null,
        )}
        {invitations.length ? (
          <View style={{ gap: 9 }}>
            <Text style={styles.h2}>Invitations · {invitations.length}</Text>
            {invitations.map((item) => (
              <View key={item.id} style={[styles.card, { gap: 9 }]}>
                <Text style={styles.h2}>{item.title}</Text>
                {item.sourceLabel ? (
                  <Text style={styles.muted}>{item.sourceLabel}</Text>
                ) : null}
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {item.actions.map((action) => (
                    <Action
                      key={action.id}
                      compact
                      title={action.label}
                      disabled={item.pending || action.disabled}
                      run={async () => {
                        if ((await action.onPress()) === false)
                          throw new Error("Invitation was not updated.");
                      }}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}
        {!pings.length &&
        !votes.length &&
        !draws.length &&
        !invitations.length ? (
          <Empty
            title="You're all caught up"
            body="New responses and invitations will appear here."
          />
        ) : null}
      </View>
    </Sheet>
  );
}
