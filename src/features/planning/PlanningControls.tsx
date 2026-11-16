import { ThemedSwitch } from "@/src/shared/ThemedSwitch";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react-native";
import { useTheme } from "@/src/shared/ui";

/** Keep response submission and its quieter reset action together. */
export function PlanningActionRow({ primary, secondary }: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 8, paddingTop: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: colors.line }}>
      {secondary && <View style={{ minWidth: 96 }}>{secondary}</View>}
      <View style={{ flexGrow: 1, flexBasis: 140, minWidth: 140 }}>{primary}</View>
    </View>
  );
}

export function PlanningLink({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors, styles } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text
        style={[
          styles.body,
          { color: colors.green, flexShrink: 1, fontSize: 14 },
        ]}
      >
        {title}
      </Text>
      <ArrowUpRight size={16} color={colors.green} />
    </Pressable>
  );
}

export function PlanningDisclosure({
  title,
  summary,
  children,
  initialOpen = false,
  icon,
}: {
  title: string;
  summary?: string;
  children: React.ReactNode;
  initialOpen?: boolean;
  icon?: React.ReactNode;
}) {
  const { colors, styles } = useTheme();
  const [open, setOpen] = useState(initialOpen);
  return (
    <View style={{ gap: open ? 8 : 0, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={() => setOpen(!open)}
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        {icon}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.body, { fontSize: 14, fontWeight: "600" }]}>
            {title}
          </Text>
          {summary && <Text style={[styles.label, { fontSize: 12, lineHeight: 17, fontWeight: "400", color: colors.muted }]}>{summary}</Text>}
        </View>
        {open ? (
          <ChevronDown size={17} color={colors.muted} />
        ) : (
          <ChevronRight size={17} color={colors.muted} />
        )}
      </Pressable>
      {open && children}
    </View>
  );
}

export function PlanningToggle({
  title,
  description,
  value,
  onChange,
  disabled = false,
}: {
  title: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { styles } = useTheme();
  return (
    <View
      style={{
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.body, { fontSize: 14, fontWeight: "600" }]}>
          {title}
        </Text>
        {description && <Text style={styles.muted}>{description}</Text>}
      </View>
      <ThemedSwitch
        accessibilityLabel={title}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      />
    </View>
  );
}

export function PlanningChoiceRow({
  title,
  description,
  selected,
  onSelect,
  disabled = false,
  icon,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const { styles, colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ checked: selected, disabled }}
      onPress={onSelect}
      disabled={disabled}
      style={{
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          style={[
            styles.body,
            { fontSize: 14, fontWeight: selected ? "700" : "500" },
          ]}
        >
          {title}
        </Text>
        {description && <Text style={styles.muted}>{description}</Text>}
      </View>
      <View
        style={{
          height: 22,
          width: 22,
          borderRadius: 11,
          borderWidth: 1,
          borderColor: selected ? colors.green : colors.muted,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? colors.green : "transparent",
        }}
      >
        {selected && <Check size={14} color={colors.surface} />}
      </View>
    </Pressable>
  );
}
