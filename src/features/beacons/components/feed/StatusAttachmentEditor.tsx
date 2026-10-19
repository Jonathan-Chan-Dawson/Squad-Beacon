import React, { useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import {
  Radio,
  CircleHelp,
  Vote,
  Dices,
  X,
  ChevronRight,
} from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Button, Chips, Field, Txt, useTheme } from "@/src/shared/ui";
import { BeaconIcon } from "../BeaconIcon";
import {
  eligibleStatusAttachments,
  resolveStatusAttachment,
  type ResolvedStatusAttachment,
  type StatusAttachment,
  type StatusPresentation,
} from "../../statusAttachments";

const presentationOptions = [
  ["text_only", "Note"],
  ["activity_only", "Activity"],
  ["text_activity", "Both"],
] as const;

export function StatusAttachmentPreview({
  activity,
  onPress,
  embedded = false,
  compact = false,
}: {
  activity: ResolvedStatusAttachment;
  onPress?: () => void;
  embedded?: boolean;
  compact?: boolean;
}) {
  const { colors, tokens } = useTheme();
  const categoryStyle = tokens.categories[activity.category ?? "Social"];
  const Icon =
    activity.type === "ping"
      ? CircleHelp
      : activity.type === "vote"
        ? Vote
        : activity.type === "draw"
          ? Dices
          : Radio;
  const typeLabel = activity.type[0].toUpperCase() + activity.type.slice(1);
  const formattedTime = new Date(activity.time)
    .toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    .replace(/\s(?=[AP]M$)/i, "\u00a0");
  const compactTiming =
    activity.type === "draw" && activity.state === "Awaiting draw"
      ? "Awaiting draw"
      : `${activity.type === "beacon" ? (activity.state === "Live" ? "Live" : "Starts") : "By"} ${formattedTime}`;
  return (
    <Pressable
      testID="status-attachment-preview"
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${activity.type}: ${activity.title}`}
      disabled={!onPress}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? 8 : 12,
        padding: embedded || compact ? 0 : 12,
        borderRadius: 16,
        backgroundColor:
          embedded || compact ? "transparent" : colors.green + "12",
        borderWidth: embedded || compact ? 0 : 1,
        borderColor: colors.line,
        minHeight: compact ? 56 : 64,
      }}
    >
      <View
        style={{
          width: compact ? 34 : embedded ? 48 : 40,
          height: compact ? 34 : embedded ? 54 : 40,
          borderRadius: 12,
          backgroundColor: categoryStyle.tint,
          overflow: "hidden",
          flexShrink: 0,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {embedded && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 64,
              height: 64,
              borderRadius: 32,
              borderWidth: 1,
              borderColor: categoryStyle.color,
              opacity: 0.18,
              top: -24,
              right: -22,
            }}
          />
        )}
        {activity.type === "beacon" ||
        (activity.type === "ping" && activity.category) ? (
          <BeaconIcon
            category={activity.category}
            emoji={activity.emoji}
            size={30}
          />
        ) : (
          <Icon size={23} color={colors.green} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text
          numberOfLines={2}
          style={{
            color: colors.ink,
            fontSize: compact ? 14 : 15,
            lineHeight: compact ? 19 : undefined,
            fontWeight: compact ? "500" : "600",
          }}
        >
          {activity.title}
        </Text>
        {!embedded && !compact && (
          <Txt muted>
            {activity.type === "vote"
              ? "Vote Council"
              : activity.type[0].toUpperCase() + activity.type.slice(1)}{" "}
            · {activity.state}
          </Txt>
        )}
        {compact ? (
          <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 15 }}>
            {typeLabel} · {compactTiming}
          </Text>
        ) : (
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
            {activity.type === "draw" && activity.state === "Awaiting draw"
              ? "Deadline "
              : activity.type === "beacon"
                ? activity.state === "Live"
                  ? "Started "
                  : "Starts "
                : "Respond by "}
            {formattedTime}
          </Text>
        )}
      </View>
      {(embedded || compact) && onPress && (
        <ChevronRight size={16} color={colors.muted} />
      )}
    </Pressable>
  );
}

export function StatusAttachmentEditor({
  attachment,
  presentation,
  onAttachment,
  onPresentation,
  disabled,
  picking,
  onPicking,
}: {
  attachment: StatusAttachment | null;
  presentation: StatusPresentation;
  onAttachment(value: StatusAttachment | null): void;
  onPresentation(value: StatusPresentation): void;
  disabled?: boolean;
  picking: boolean;
  onPicking(value: boolean): void;
}) {
  const { data, userId } = useBeacon();
  const now = useNow();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [limit, setLimit] = useState(20);
  const modeRefs = useRef<(View | null)[]>([]);
  const { colors } = useTheme();
  if (!data.is_demo && data.capabilities?.status_attachments !== true)
    return (
      <Txt muted>
        Activity attachments require the Status update on this server.
      </Txt>
    );
  const eligible = eligibleStatusAttachments(data, userId, now);
  const selected = resolveStatusAttachment(data, attachment, userId, now);
  const options = eligible.filter(
    (row) =>
      (filter === "All" ||
        row.type ===
          (
            {
              Beacons: "beacon",
              Pings: "ping",
              Votes: "vote",
              Draws: "draw",
            } as Record<string, string>
          )[filter]) &&
      `${row.title} ${row.type}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <View style={{ gap: 10 }}>
      {picking ? (
        <>
          <Text
            accessibilityRole="header"
            style={{ color: colors.ink, fontWeight: "600", fontSize: 18 }}
          >
            Available to Feature
          </Text>
          <Txt muted>
            Choose one activity you own or cohost. Its existing audience still
            applies.
          </Txt>
          <Field
            label="Search your activities"
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              setLimit(20);
            }}
          />
          <Chips
            options={["All", "Beacons", "Pings", "Votes", "Draws"]}
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setLimit(20);
            }}
          />
          {options.slice(0, limit).map((row) => (
            <StatusAttachmentPreview
              key={`${row.type}:${row.id}`}
              activity={row}
              onPress={() => {
                // Recompute eligibility at the point of selection, not just initial load.
                if (
                  !eligibleStatusAttachments(data, userId, Date.now()).some(
                    (item) => item.type === row.type && item.id === row.id,
                  )
                )
                  return;
                onAttachment({ type: row.type, id: row.id });
                onPicking(false);
              }}
            />
          ))}
          {!options.length && <Txt muted>No eligible activities found.</Txt>}
          {options.length > limit && (
            <Button
              secondary
              title="Show more activities"
              onPress={() => setLimit((value) => value + 20)}
            />
          )}
          <Button
            secondary
            title="Back to note"
            onPress={() => onPicking(false)}
          />
        </>
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                attachment ? "Change attached activity" : "Attach Activity"
              }
              disabled={disabled}
              onPress={() => onPicking(true)}
              style={{ flex: 1, minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ color: colors.green, fontWeight: "500" }}>
                {attachment ? "Change attached activity" : "+ Attach Activity"}
              </Text>
            </Pressable>
            {attachment && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove attached activity"
                disabled={disabled}
                onPress={() => onAttachment(null)}
                style={{
                  width: 44,
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} color={colors.muted} />
              </Pressable>
            )}
          </View>
          {attachment && !selected ? (
            <Txt muted>Attached activity unavailable. Change or remove it.</Txt>
          ) : attachment && presentation === "text_only" ? (
            <Txt muted>Activity retained · hidden in Note mode</Txt>
          ) : null}
          {(attachment || presentation !== "text_only") && (
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Status display mode"
              style={{
                flexDirection: "row",
                padding: 3,
                borderRadius: 12,
                backgroundColor: colors.line + "60",
              }}
            >
              {presentationOptions.map(([value, label], index) => (
                <Pressable
                  key={value}
                  ref={(node) => {
                    modeRefs.current[index] = node;
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  aria-checked={presentation === value}
                  accessibilityState={{
                    checked: presentation === value,
                    disabled: !!disabled,
                  }}
                  disabled={disabled}
                  tabIndex={presentation === value ? 0 : -1}
                  {...(Platform.OS === "web"
                    ? {
                        onKeyDown: (
                          event: React.KeyboardEvent<HTMLElement>,
                        ) => {
                          if (disabled) return;
                          if (event.key === " ") {
                            event.preventDefault();
                            onPresentation(value);
                            return;
                          }
                          const direction = [
                            "ArrowRight",
                            "ArrowDown",
                          ].includes(event.key)
                            ? 1
                            : ["ArrowLeft", "ArrowUp"].includes(event.key)
                              ? -1
                              : 0;
                          if (
                            !direction &&
                            event.key !== "Home" &&
                            event.key !== "End"
                          )
                            return;
                          event.preventDefault();
                          const next =
                            event.key === "Home"
                              ? 0
                              : event.key === "End"
                                ? presentationOptions.length - 1
                                : (index +
                                    direction +
                                    presentationOptions.length) %
                                  presentationOptions.length;
                          onPresentation(presentationOptions[next][0]);
                          modeRefs.current[next]?.focus();
                        },
                      }
                    : {})}
                  onPress={() => onPresentation(value)}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 9,
                    backgroundColor:
                      presentation === value
                        ? colors.green + "20"
                        : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color:
                        presentation === value ? colors.green : colors.muted,
                      fontWeight: "500",
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}
