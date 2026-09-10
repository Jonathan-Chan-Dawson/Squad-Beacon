import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Radio, ShieldCheck, X } from "lucide-react-native";
import { router } from "expo-router";
import { useBeacon } from "./store";
import type { Audience } from "./types";
import { usePreferences } from "./preferences";
export const colors = {
  bg: "#F4F5F0",
  ink: "#172C29",
  muted: "#6F7C75",
  line: "#E0E5DD",
  green: "#26735A",
  lime: "#DDF19A",
  white: "#FFFFFF",
  red: "#AA3D36",
};
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: 16,
    gap: 14,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -1,
  },
  h2: {
    fontSize: 19,
    flexShrink: 1,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.4,
  },
  body: { fontSize: 15, lineHeight: 23, color: colors.ink },
  muted: { fontSize: 13, lineHeight: 20, color: colors.muted },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
    color: colors.green,
    textTransform: "none",
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  button: {
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
  },
  buttonText: { fontSize: 14, fontWeight: "700", color: colors.white },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    padding: 14,
    minHeight: 48,
    color: colors.ink,
    fontSize: 15,
    backgroundColor: colors.white,
  },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "capitalize",
  },
  error: { color: colors.red, fontSize: 13, lineHeight: 20 },
  hero: { backgroundColor: colors.ink, borderRadius: 18, padding: 18, gap: 10 },
});
export function Txt({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return <Text style={muted ? styles.muted : styles.body}>{children}</Text>;
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && { backgroundColor: colors.lime },
        (disabled || pressed) && { opacity: 0.55 },
      ]}
    >
      <Text style={[styles.buttonText, secondary && { color: colors.ink }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function Action({
  title,
  run,
  secondary = false,
}: {
  title: string;
  run: () => Promise<unknown>;
  secondary?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <View style={{ gap: 6 }}>
      <Button
        title={busy ? "Working…" : title}
        disabled={busy}
        secondary={secondary}
        onPress={() => {
          setBusy(true);
          setError("");
          Promise.resolve()
            .then(run)
            .catch((e) => setError(e.message ?? "Something went wrong."))
            .finally(() => setBusy(false));
        }}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={[styles.muted, { fontWeight: "600" }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#949D97"
        {...props}
        style={[
          styles.input,
          props.multiline && { minHeight: 86, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: value === o }}
          key={o}
          onPress={() => onChange(o)}
          style={[
            styles.chip,
            value === o && {
              backgroundColor: colors.ink,
              borderColor: colors.ink,
            },
          ]}
        >
          <Text
            style={[styles.chipText, value === o && { color: colors.white }]}
          >
            {o}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  const { showAvatars } = usePreferences();
  if (!showAvatars) return null;
  const tone = ["#E4E9CF", "#DFE8F2", "#F2DDCC", "#E7DDF0"][
    name.charCodeAt(0) % 4
  ];
  return (
    <View
      testID="user-avatar"
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tone,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: colors.white,
      }}
    >
      <Text
        style={{ color: colors.ink, fontSize: size * 0.3, fontWeight: "700" }}
      >
        {name
          .split(" ")
          .map((x) => x[0])
          .slice(0, 2)
          .join("")}
      </Text>
    </View>
  );
}
export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View
      style={[
        styles.card,
        { borderStyle: "dashed", alignItems: "center", padding: 28 },
      ]}
    >
      <Radio color={colors.green} size={26} />
      <Text style={styles.h2}>{title}</Text>
      <Txt muted>{body}</Txt>
    </View>
  );
}
export function Sheet({
  title,
  visible,
  onClose,
  children,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!visible) return null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#102B2966",
          justifyContent: "flex-end",
        }}
      >
        <SafeAreaView
          edges={["bottom", "top"]}
          style={{
            maxHeight: "94%",
            backgroundColor: colors.bg,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            width: "100%",
            maxWidth: 660,
            alignSelf: "center",
          }}
        >
          <View style={[styles.between, { padding: 22 }]}>
            <Text style={styles.h2}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={{ padding: 10 }}
            >
              <X color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 22, paddingTop: 0, gap: 18 }}
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
export function Screen({
  title,
  eyebrow,
  children,
  create = true,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  create?: boolean;
}) {
  const { demo, error, refresh } = useBeacon();
  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.between}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.label}>{eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
          {create && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create activity"
              onPress={() => router.push("/create")}
              style={[styles.button, styles.row, { paddingHorizontal: 12 }]}
            >
              <Plus color="white" size={18} />
              <Text style={styles.buttonText}>Create</Text>
            </Pressable>
          )}
        </View>
        {demo && (
          <View
            style={[
              styles.row,
              { backgroundColor: "#E7EDD9", padding: 10, borderRadius: 12 },
            ]}
          >
            <ShieldCheck size={16} color={colors.green} />
            <Text style={{ fontSize: 12, color: colors.green, flex: 1 }}>
              Demo · Sample people and plans
            </Text>
          </View>
        )}
        {error && (
          <View style={styles.card}>
            <Text style={styles.error}>
              Could not refresh. Protected data has been cleared. {error}
            </Text>
            <Action title="Try again" run={refresh} />
          </View>
        )}
        {children}
        <View style={{ height: 12 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
export function AudiencePicker({
  value,
  id,
  onChange,
}: {
  value: Audience;
  id: string | null;
  onChange: (value: Audience, id: string | null) => void;
}) {
  const { data } = useBeacon();
  return (
    <View style={{ gap: 9 }}>
      <Text style={styles.muted}>Who can see this?</Text>
      <Chips
        options={["private", "friends", "list", "squad"] as const}
        value={value}
        onChange={(v) => onChange(v, null)}
      />
      {(value === "list" || value === "squad") && (
        <View style={{ gap: 8 }}>
          {(value === "list" ? data.lists : data.squads).map((x) => (
            <Button
              key={x.id}
              secondary={id !== x.id}
              title={(id === x.id ? "✓ " : "") + x.name}
              onPress={() => onChange(value, x.id)}
            />
          ))}
          {!(value === "list" ? data.lists : data.squads).length && (
            <Txt muted>Create a {value} in Squads first.</Txt>
          )}
        </View>
      )}
    </View>
  );
}
export function Loading() {
  return (
    <View
      style={[
        styles.screen,
        { alignItems: "center", justifyContent: "center" },
      ]}
    >
      <ActivityIndicator color={colors.green} />
      <Txt muted>Finding your people…</Txt>
    </View>
  );
}
