import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Bell, Radio, ShieldCheck, X } from "lucide-react-native";
import { pendingSocialCount } from "@/src/features/people/communication";
import { useNow } from "@/src/shared/useNow";
import {
  router,
  useSegments,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useBeacon } from "@/src/shared/store";
import type { Audience } from "@/src/shared/types";
import { usePreferences } from "@/src/shared/preferences";
import {
  themes,
  themeNames,
  themeVariants,
  type ResolvedAppearance,
  type ThemeName,
} from "@/src/shared/themes";
import { MotionPressable } from "@/src/shared/MotionPressable";
export const colors = themes.Mint;
const makeStyles = (colors: typeof themes.Mint) =>
  StyleSheet.create({
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
      minHeight: 48,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.ink,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.ink,
      elevation: 2,
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
    hero: {
      backgroundColor: colors.heroBg,
      borderRadius: 18,
      padding: 18,
      gap: 10,
    },
  });
const themedStyles = Object.fromEntries(
  themeNames.map((name) => [
    name,
    {
      light: makeStyles(themeVariants[name].light),
      dark: makeStyles(themeVariants[name].dark),
    },
  ]),
) as Record<
  ThemeName,
  Record<ResolvedAppearance, ReturnType<typeof makeStyles>>
>;
export const styles = themedStyles.Mint.light;
export function useTheme() {
  const { theme, resolvedAppearance } = usePreferences();
  return {
    colors: themeVariants[theme][resolvedAppearance],
    styles: themedStyles[theme][resolvedAppearance],
    theme,
    resolvedAppearance,
  };
}
export function Txt({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  const { styles } = useTheme();

  return <Text style={muted ? styles.muted : styles.body}>{children}</Text>;
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  compact = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  compact?: boolean;
  icon?: React.ReactNode;
}) {
  const { styles, colors } = useTheme();

  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && { paddingHorizontal: 12, paddingVertical: 9, minHeight: 44 },
        secondary && {
          backgroundColor: colors.lime,
          borderColor: colors.green,
          elevation: 1,
        },
        disabled && { opacity: 0.5, elevation: 0 },
        pressed && {
          opacity: 0.82,
          elevation: 0,
        },
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: icon ? 7 : 0,
        }}
      >
        {icon}
        <Text
          style={[
            styles.buttonText,
            compact && { fontSize: 12 },
            secondary && { color: colors.ink },
          ]}
        >
          {title}
        </Text>
      </View>
    </MotionPressable>
  );
}
/** One accessible, thumb-friendly target for contextual icon actions. */
export function IconButton({
  label,
  onPress,
  children,
  selected = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: selected ? colors.lime : colors.white,
        borderWidth: 1,
        borderColor: selected ? colors.green : colors.line,
        opacity: disabled ? 0.45 : pressed ? 0.76 : 1,
      })}
    >
      {children}
    </MotionPressable>
  );
}

export function Action({
  title,
  run,
  secondary = false,
  disabled = false,
  compact = false,
}: {
  title: string;
  run: () => Promise<unknown>;
  secondary?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { styles } = useTheme();

  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <View style={{ gap: 6 }}>
      <Button
        title={busy ? "Working…" : title}
        disabled={busy || disabled}
        compact={compact}
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
  const { styles } = useTheme();

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
  accessibilityPrefix,
  showSelectedCheckmark = false,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  accessibilityPrefix?: string;
  showSelectedCheckmark?: boolean;
}) {
  const { styles, colors } = useTheme();

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => (
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel={
            accessibilityPrefix ? `${accessibilityPrefix}: ${o}` : o
          }
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
            {showSelectedCheckmark && value === o ? "\u2713 " : ""}
            {o}
          </Text>
        </MotionPressable>
      ))}
    </View>
  );
}
export function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  const { colors } = useTheme();

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
        style={{ color: "#173D32", fontSize: size * 0.3, fontWeight: "700" }}
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
  const { styles, colors } = useTheme();

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
  maxHeightPercent = 94,
  footer,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightPercent?: number;
  footer?: React.ReactNode;
}) {
  const { colors, styles } = useTheme();

  if (!visible) return null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityLabel={title}
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
          role={Platform.OS === "web" ? undefined : "dialog"}
          accessibilityLabel={title}
          accessibilityViewIsModal
          aria-modal={Platform.OS === "web" ? undefined : true}
          style={{
            maxHeight: `${Math.max(35, Math.min(94, maxHeightPercent))}%`,
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
          {footer ? (
            <View
              style={{
                padding: 16,
                borderTopWidth: 1,
                borderTopColor: colors.line,
              }}
            >
              {footer}
            </View>
          ) : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
export function Screen({
  title,
  eyebrow,
  children,
  create: _create = true,
  footer,
  headerAction,
  showDemoNotice = true,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  create?: boolean;
  footer?: React.ReactNode;
  headerAction?: React.ReactNode;
  showDemoNotice?: boolean;
}) {
  const { styles, colors } = useTheme();

  const { demo, error, refresh } = useBeacon();
  const segments = useSegments();
  const inTabs = segments[0] === "(tabs)";
  const back = !inTabs;
  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      {inTabs && (
        <View style={[styles.content, { paddingBottom: 8 }]}>
          <View style={styles.between}>
            <View style={{ flex: 1, gap: 6 }}>
              {!!eyebrow && <Text style={styles.label}>{eyebrow}</Text>}
              <Text style={styles.title}>{title}</Text>
            </View>
            {headerAction ?? <InboxButton />}
          </View>
        </View>
      )}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: inTabs ? 42 : 24, gap: footer ? 10 : 14 },
        ]}
      >
        {back && <BackButton />}
        {!inTabs && (
          <>
            <View style={styles.between}>
              <View style={{ flex: 1, gap: 6 }}>
                {!!eyebrow && <Text style={styles.label}>{eyebrow}</Text>}
                <Text style={styles.title}>{title}</Text>
              </View>
              {headerAction}
            </View>
          </>
        )}
        {demo && showDemoNotice && !footer && (
          <View
            style={[
              styles.row,
              { backgroundColor: colors.lime, padding: 10, borderRadius: 12 },
            ]}
          >
            <ShieldCheck size={16} color={colors.green} />
            <Text style={{ fontSize: 12, color: colors.green, flex: 1 }}>
              Demo · Sample people and plans
            </Text>
          </View>
        )}
        {!!error && (
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
      {footer && (
        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.bg }}>
          <View style={[styles.content, { paddingVertical: 10 }]}>
            {footer}
          </View>
        </SafeAreaView>
      )}
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
  const { styles } = useTheme();

  const { data, userId } = useBeacon();
  const targets =
    value === "list"
      ? data.lists.filter((list) => list.owner_id === userId)
      : value === "organization"
        ? data.organizations.filter(
            (org) =>
              org.owner_id === userId ||
              data.organization_members.some(
                (member) =>
                  member.organization_id === org.id &&
                  member.user_id === userId &&
                  member.status === "active",
              ),
          )
        : data.squads.filter((squad) =>
            data.squad_members.some(
              (member) =>
                member.squad_id === squad.id && member.user_id === userId,
            ),
          );
  return (
    <View style={{ gap: 9 }}>
      <Text style={styles.muted}>Who can see this?</Text>
      <Chips
        options={
          ["private", "friends", "list", "squad", "organization"] as const
        }
        value={value}
        onChange={(v) => onChange(v, null)}
        showSelectedCheckmark={false}
      />
      {(value === "list" || value === "squad" || value === "organization") && (
        <View style={{ gap: 8 }}>
          {targets.map((x) => (
            <Button
              key={x.id}
              secondary={id !== x.id}
              title={x.name}
              onPress={() => onChange(value, x.id)}
            />
          ))}
          {!targets.length && (
            <Txt muted>Create a {value} in Squads first.</Txt>
          )}
        </View>
      )}
    </View>
  );
}
export function Loading() {
  const { styles, colors } = useTheme();

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

export function BackButton() {
  const { styles, colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() =>
        router.canGoBack() ? router.back() : router.replace("/(tabs)")
      }
      style={[styles.row, { minHeight: 44, alignSelf: "flex-start" }]}
    >
      <ArrowLeft size={20} color={colors.ink} />
      <Txt>Back</Txt>
    </Pressable>
  );
}

export function InboxButton() {
  const { colors, styles } = useTheme();

  const { data, userId, act } = useBeacon();
  const [open, setOpen] = useState(false);
  const pending = pendingSocialCount(data, userId, useNow());
  const params = useLocalSearchParams<{ inbox?: string }>();
  useFocusEffect(
    useCallback(() => {
      if (params.inbox === "yes") {
        setOpen(true);
        router.setParams({ inbox: undefined });
      }
    }, [params.inbox]),
  );
  const unread = data.notices.filter((n) => !n.read_at).length;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          unread ? `Notifications, ${unread} unread` : "Notifications"
        }
        onPress={() => setOpen(true)}
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: colors.white,
          borderWidth: 1,
          borderColor: colors.line,
          alignItems: "center",
          justifyContent: "center",
          elevation: 3,
        }}
      >
        <Bell size={21} color={colors.ink} />
        {unread > 0 && (
          <View
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              borderRadius: 10,
              backgroundColor: colors.green,
              minWidth: 20,
              alignItems: "center",
              padding: 2,
            }}
          >
            <Text style={{ color: "white", fontWeight: "700", fontSize: 10 }}>
              {unread > 99 ? "99+" : unread}
            </Text>
          </View>
        )}
      </Pressable>
      <Sheet
        title="Notifications"
        visible={open}
        onClose={() => setOpen(false)}
      >
        {pending > 0 ? (
          <Button
            title={`${pending} Pings & invitations need you`}
            onPress={() => {
              setOpen(false);
              router.push({
                pathname: "/(tabs)/squads",
                params: { tab: "Pings" },
              });
            }}
          />
        ) : null}
        {unread > 0 && (
          <Action
            title="Mark all read"
            secondary
            run={() => act("read_notices")}
          />
        )}
        {!data.notices.length && (
          <Txt muted>
            You are all caught up. Invitations and beacon updates will appear
            here.
          </Txt>
        )}
        {data.notices
          .slice()
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 50)
          .map((n) => (
            <View key={n.id} style={styles.card}>
              <Text
                style={[styles.body, { fontWeight: n.read_at ? "400" : "700" }]}
              >
                {n.body}
              </Text>
              <Button
                secondary
                title={
                  n.activity_id ? "Open on map" : "Review Pings & invitations"
                }
                onPress={() => {
                  setOpen(false);
                  router.push(
                    n.activity_id
                      ? {
                          pathname: "/(tabs)",
                          params: { beacon: n.activity_id },
                        }
                      : {
                          pathname: "/(tabs)/squads",
                          params: { tab: "Pings" },
                        },
                  );
                }}
              />
            </View>
          ))}
      </Sheet>
    </>
  );
}
