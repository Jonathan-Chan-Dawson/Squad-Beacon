import React from "react";
import { Pressable, Text, View } from "react-native";
import { Action, Empty, Sheet, useTheme } from "@/src/shared/ui";
import type { SocialDirectorySummary } from "@/src/features/social/types";
import { CommunityCover, communityTypeLabel } from "./CommunityCard";

export function directoryActionLabel(action: SocialDirectorySummary["action"]) {
  return {
    joined: "Joined",
    invited: "Accept invite",
    requested: "Cancel request",
    join: "Join",
    request: "Request",
    invite_required: "Invite only",
  }[action];
}

interface SummaryContentProps {
  summary: SocialDirectorySummary;
  onAction: () => Promise<boolean | void> | void;
  pending?: boolean;
}

function SummaryContent({ summary, onAction, pending }: SummaryContentProps) {
  const { styles, colors } = useTheme();
  return (
    <View style={{ gap: 9 }}>
      <CommunityCover type={summary.entity_type} />
      <View style={styles.between}>
        <Text style={styles.label}>
          {communityTypeLabel(summary.entity_type)}
        </Text>
        <Text style={[styles.label, { color: colors.green }]}>
          {summary.discoverability === "community"
            ? "Community-only"
            : summary.discoverability === "private"
              ? "Private"
              : "Public"}
        </Text>
      </View>
      <Text style={styles.h2}>{summary.name}</Text>
      {!!summary.description && (
        <Text style={styles.muted} numberOfLines={3}>
          {summary.description}
        </Text>
      )}
      <Text style={styles.muted}>
        {summary.member_count}{" "}
        {summary.member_count === 1 ? "member" : "members"}
      </Text>
      {summary.parent_name ? (
        <Text style={styles.muted}>Linked to {summary.parent_name}</Text>
      ) : null}
      <Action
        title={directoryActionLabel(summary.action)}
        disabled={pending || summary.action === "invite_required"}
        run={async () => {
          if ((await onAction()) === false)
            throw new Error("Community action was not completed.");
        }}
      />
      {summary.action === "invite_required" ? (
        <Text style={styles.muted}>
          An invitation from this community is required to join.
        </Text>
      ) : null}
    </View>
  );
}

/** Summary-only presentation: never accepts a roster, message, or child-entity fallback. */
export function SocialDirectorySummaryCard(
  props: SummaryContentProps & { onPreview: () => void },
) {
  const { styles } = useTheme();
  return (
    <View style={[styles.card, { gap: 8 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Preview ${props.summary.name}`}
        onPress={props.onPreview}
        style={{ minHeight: 44, justifyContent: "center" }}
      >
        <Text style={styles.label}>Preview community</Text>
      </Pressable>
      <SummaryContent {...props} />
    </View>
  );
}

export function SocialDirectorySummaryPreview({
  summary,
  visible,
  onClose,
  onAction,
  pending,
}: {
  summary: SocialDirectorySummary | null;
  visible: boolean;
  onClose: () => void;
  onAction: () => Promise<boolean | void> | void;
  pending?: boolean;
}) {
  return (
    <Sheet title="Community preview" visible={visible} onClose={onClose}>
      {summary ? (
        <SummaryContent
          summary={summary}
          onAction={onAction}
          pending={pending}
        />
      ) : (
        <Empty
          title="Community unavailable"
          body="Refresh discovery to see current summaries."
        />
      )}
    </Sheet>
  );
}
