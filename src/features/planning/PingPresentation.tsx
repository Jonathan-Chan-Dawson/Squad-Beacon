import { CalendarClock, Check, Radio, UsersRound } from "lucide-react-native";
import { Text, View } from "react-native";
import { useTheme } from "@/src/shared/ui";
import type { PlanningSlot } from "./types";

export function PingIntro({ time = false }: { time?: boolean }) {
  const { styles, colors, semanticColors } = useTheme();
  const Icon = time ? CalendarClock : Radio;
  return (
    <View
      style={{
        padding: 16,
        borderRadius: 18,
        backgroundColor: colors.lime,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: semanticColors.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={23} color={colors.green} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.h2}>
            {time ? "Find a time together" : "Put an idea out there"}
          </Text>
          <Text style={styles.muted}>
            {time
              ? "Offer a few times. See what works for everyone."
              : "See who’s interested in your next plan."}
          </Text>
        </View>
      </View>
      {time && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {[
            { label: "Propose times", Icon: CalendarClock },
            { label: "Collect availability", Icon: UsersRound },
            { label: "Choose a time", Icon: Check },
          ].map(({ label, Icon: StepIcon }) => (
            <View
              key={label}
              style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
            >
              <StepIcon size={13} color={colors.green} />
              <Text style={styles.label}>{label}</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.label}>
        {time
          ? "Sharing availability keeps the final commitment for later."
          : "Interested is not Going. You can create a Beacon when you’re ready."}
      </Text>
    </View>
  );
}

/** The date and time use the option's timezone, including daylight saving changes. */
export function TimeSlotHeading({
  slot,
  index,
}: {
  slot: PlanningSlot;
  index: number;
}) {
  const { styles, colors } = useTheme();
  const date = new Date(slot.starts_at);
  const format = (options: Intl.DateTimeFormatOptions) =>
    date.toLocaleDateString(undefined, { ...options, timeZone: slot.timezone });
  const time = (value: string) =>
    new Date(value).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: slot.timezone,
    });
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        flex: 1,
        minWidth: 0,
      }}
    >
      <View
        style={{
          width: 48,
          minHeight: 54,
          paddingVertical: 6,
          borderRadius: 12,
          backgroundColor: colors.lime,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={[styles.label, { color: colors.green }]}>
          {format({ month: "short" })}
        </Text>
        <Text style={[styles.h2, { color: colors.green }]}>
          {format({ day: "numeric" })}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={styles.label}>
          Option {index + 1} · {format({ weekday: "long" })}
        </Text>
        <Text style={[styles.body, { fontWeight: "600" }]}>
          {time(slot.starts_at)} – {time(slot.ends_at)}
        </Text>
        {format({ year: "numeric", month: "short", day: "numeric" }) !==
          new Date(slot.ends_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: slot.timezone,
          }) && (
          <Text style={styles.label}>
            Ends{" "}
            {new Date(slot.ends_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              timeZone: slot.timezone,
            })}
          </Text>
        )}
      </View>
    </View>
  );
}
