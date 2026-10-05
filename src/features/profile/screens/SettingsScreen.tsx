import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { ChevronDown, ShieldCheck } from "lucide-react-native";
import { AvatarToggle } from "@/src/features/profile/AvatarToggle";
import { themeNames, type AppearanceMode } from "@/src/shared/themes";
import { usePreferences } from "@/src/shared/preferences";
import {
  stopDeviceLocation,
  clearPush,
  enablePush,
} from "@/src/platform/device";
import { supabase } from "@/src/shared/supabase";
import { useBeacon } from "@/src/shared/store";
import type { Profile } from "@/src/shared/types";
import {
  Action,
  Button,
  Chips,
  Field,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";

function SettingsGroup({
  title,
  description,
  expanded,
  onPress,
  children,
}: {
  title: string;
  description: string;
  expanded: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { styles, colors } = useTheme();
  return (
    <View style={[styles.card, { gap: 10 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        onPress={onPress}
        style={({ pressed }) => [
          styles.between,
          { minHeight: 48, opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.h2}>{title}</Text>
          <Text style={styles.muted}>{description}</Text>
        </View>
        <ChevronDown
          size={19}
          color={colors.muted}
          style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
        />
      </Pressable>
      {expanded && <View style={{ gap: 10 }}>{children}</View>}
    </View>
  );
}

export default function SettingsScreen() {
  const { data, userId, loading } = useBeacon();
  const profile = data.profiles.find((item) => item.id === userId);
  if (!profile)
    return (
      <Screen title="Settings" eyebrow="YOUR ACCOUNT" create={false}>
        <Txt muted>
          {loading
            ? "Your account settings are loading."
            : "Account settings are unavailable right now."}
        </Txt>
      </Screen>
    );
  return <SettingsForm key={profile.id} profile={profile} />;
}

function SettingsForm({ profile }: { profile: Profile }) {
  const { styles, colors } = useTheme();
  const { data, demo, act, signOut, session } = useBeacon();
  const { theme, setTheme, appearanceMode, setAppearanceMode } =
    usePreferences();
  const [openGroup, setOpenGroup] = useState("appearance");
  const [quietStart, setQuietStart] = useState(String(profile.quiet_start));
  const [quietEnd, setQuietEnd] = useState(String(profile.quiet_end));
  const [sharing, setSharing] = useState(profile.default_audience ?? "friends");
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");

  const toggleGroup = (name: string) =>
    setOpenGroup((current) => (current === name ? "" : name));
  const saveQuietHours = async () => {
    if (
      !/^(?:[0-9]|1[0-9]|2[0-3])$/.test(quietStart.trim()) ||
      !/^(?:[0-9]|1[0-9]|2[0-3])$/.test(quietEnd.trim())
    )
      throw new Error("Enter whole hours from 0 to 23.");
    await act("save_profile", {
      ...profile,
      timezone: profile.timezone,
      quiet_start: Number(quietStart),
      quiet_end: Number(quietEnd),
    });
  };

  return (
    <Screen title="Settings" eyebrow="YOUR ACCOUNT" create={false}>
      <Txt muted>
        Choose what people see and how Squad Beacon works for you.
      </Txt>

      <SettingsGroup
        title="Appearance"
        description="Theme, device/light/dark mode, and avatar display"
        expanded={openGroup === "appearance"}
        onPress={() => toggleGroup("appearance")}
      >
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>THEME</Text>
          <Chips
            options={themeNames}
            value={theme}
            onChange={setTheme}
            showSelectedCheckmark={false}
          />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>APPEARANCE</Text>
          <Text style={styles.muted}>
            Device switches automatically. Light and Dark stay fixed.
          </Text>
          <View style={[styles.row, { flexWrap: "wrap", gap: 8 }]}>
            {(
              [
                { value: "system", label: "Device" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ] as const satisfies readonly {
                value: AppearanceMode;
                label: string;
              }[]
            ).map(({ value, label }) => {
              const selected = appearanceMode === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                  aria-selected={selected}
                  onPress={() => setAppearanceMode(value)}
                  style={[
                    styles.chip,
                    selected && {
                      backgroundColor: colors.ink,
                      borderColor: colors.ink,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { textTransform: "none" },
                      selected && { color: colors.white },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <AvatarToggle description />
      </SettingsGroup>

      <SettingsGroup
        title="Privacy & location"
        description="Profile details and temporary location sharing"
        expanded={openGroup === "privacy"}
        onPress={() => toggleGroup("privacy")}
      >
        <Txt muted>
          Location stays off unless you start a temporary sharing session.
        </Txt>
        <View style={{ gap: 8 }}>
          <Button
            compact
            secondary
            title="Profile visibility"
            onPress={() => router.push("/settings/privacy" as Href)}
          />
          <Button
            compact
            secondary
            title="Temporary location"
            onPress={() => router.push("/location" as Href)}
          />
        </View>
      </SettingsGroup>

      <SettingsGroup
        title="Notifications"
        description="Push access and quiet hours for this account"
        expanded={openGroup === "notifications"}
        onPress={() => toggleGroup("notifications")}
      >
        <Txt muted>
          Quiet hours use {profile.timezone}. Set the same start and end hour to
          turn quiet hours off.
        </Txt>
        <View style={{ gap: 8 }}>
          <Field
            label="Quiet hours start · 0–23"
            value={quietStart}
            onChangeText={setQuietStart}
            keyboardType="numeric"
          />
          <Field
            label="Quiet hours end · 0–23"
            value={quietEnd}
            onChangeText={setQuietEnd}
            keyboardType="numeric"
          />
        </View>
        <Action compact title="Save quiet hours" run={saveQuietHours} />
        <View style={[styles.row, { alignItems: "flex-start", gap: 9 }]}>
          <ShieldCheck size={18} color={colors.green} />
          <Txt muted>
            Push is controlled for this device. App updates remain available
            when push is off.
          </Txt>
        </View>
        <Action
          title="Enable push notifications"
          secondary
          run={async () => {
            if (demo)
              throw new Error(
                "Push is available with a real account on your phone.",
              );
            await enablePush();
          }}
        />
        <Action title="Disable this device’s push" secondary run={clearPush} />
      </SettingsGroup>

      <SettingsGroup
        title="Beacon defaults"
        description="Start new Beacons with your usual audience"
        expanded={openGroup === "defaults"}
        onPress={() => toggleGroup("defaults")}
      >
        <Chips
          options={["friends", "private"] as const}
          value={sharing}
          onChange={setSharing}
          accessibilityPrefix="Default Beacon audience"
          showSelectedCheckmark={false}
        />
        <Action
          compact
          title="Save Beacon default"
          run={() =>
            act("save_profile", {
              ...profile,
              default_audience: sharing,
            })
          }
        />
      </SettingsGroup>

      <SettingsGroup
        title="Account & help"
        description={
          demo
            ? "Demo account and support"
            : "Sign out, account removal, and support"
        }
        expanded={openGroup === "account"}
        onPress={() => toggleGroup("account")}
      >
        {!demo && session?.user.email && (
          <View style={[styles.row, { gap: 8 }]}>
            <Text style={styles.label}>SIGNED IN AS</Text>
            <Text style={styles.body}>{session.user.email}</Text>
          </View>
        )}
        {data.is_moderator && (
          <Button
            compact
            secondary
            title="Moderation inbox"
            onPress={() => router.push("/moderation" as Href)}
          />
        )}
        <Button
          compact
          secondary
          title="Help & product guide"
          onPress={() => router.push("/help" as Href)}
        />
        <Button
          compact
          secondary
          title="Privacy, safety & support"
          onPress={() => router.push("/legal" as Href)}
        />
        <Action title={demo ? "Leave demo" : "Sign out"} run={signOut} />
        {!demo && (
          <Button
            compact
            secondary
            title="Delete my account"
            onPress={() => setDeleting(true)}
          />
        )}
      </SettingsGroup>

      <Sheet
        title="Delete your account"
        visible={deleting}
        onClose={() => setDeleting(false)}
      >
        <Txt>
          This permanently removes your profile, Beacons, messages, and sharing
          sessions. Squads and Organizations you own are removed too. Safety
          reports are retained under the published retention policy.
        </Txt>
        <Field
          label="Type DELETE to confirm"
          value={confirm}
          onChangeText={setConfirm}
        />
        <Action
          title="Permanently delete account"
          run={async () => {
            if (confirm !== "DELETE")
              throw new Error("Type DELETE to confirm.");
            await act("stop_location");
            await stopDeviceLocation();
            const { error } =
              await supabase!.functions.invoke("delete-account");
            if (error) throw error;
            await supabase!.auth.signOut({ scope: "local" });
          }}
        />
      </Sheet>
    </Screen>
  );
}
