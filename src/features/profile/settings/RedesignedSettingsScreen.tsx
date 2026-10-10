import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { router, type Href } from "expo-router";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  Bell,
  BellOff,
  Check,
  Clock3,
  Eye,
  FileText,
  HelpCircle,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Palette,
  Radar,
  Shield,
  ShieldAlert,
  Trash2,
  UsersRound,
  type LucideIcon,
} from "lucide-react-native";
import { AvatarToggle } from "@/src/features/profile/AvatarToggle";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { usePreferences } from "@/src/shared/preferences";
import {
  themeNames,
  themeVariants,
  type AppearanceMode,
} from "@/src/shared/themes";
import {
  stopDeviceLocation,
  enablePush,
  clearPush,
} from "@/src/platform/device";
import { supabase } from "@/src/shared/supabase";
import {
  SegmentedControl,
  Skeleton,
  uiHaptics,
  useReducedMotion,
} from "@/src/shared/design-system";
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
import type { Audience, Profile } from "@/src/shared/types";
import { SettingsGroup, SettingsRow } from "./SettingsRow";
import {
  defaultAudienceOptions,
  eligibleDefaultTargets,
  resolveDefaultAudience,
} from "./beaconDefaults";
import {
  readViewerDeviceDefaults,
  writeViewerDeviceDefaults,
  type ViewerDeviceDefaults,
  type SonarDurationMinutes,
} from "./deviceDefaults";
import {
  acknowledgePushRegistration,
  clearPushRegistrationReceipt,
  readDeviceNotificationState,
  type DeviceNotificationState,
} from "./notificationState";
import {
  readLocationPermissionState,
  requestForegroundLocation,
  type LocationPermissionState,
} from "./locationPermissions";
import QuietHoursPicker from "./QuietHoursPicker";
import { profileSavePayload } from "@/src/features/profile/profileEditorDraft";

type Panel =
  | "quiet"
  | "defaults"
  | "sonar"
  | "location"
  | "blocked"
  | "reports"
  | "notifications"
  | "email"
  | "password"
  | "signout"
  | "delete"
  | null;
const audienceLabel: Record<Audience, string> = {
  private: "Private",
  friends: "Friends",
  list: "List",
  squad: "Squad",
  organization: "Organization",
};
const panelTitle: Record<Exclude<Panel, null>, string> = {
  quiet: "Quiet hours",
  defaults: "Default Beacon audience",
  sonar: "Sonar defaults",
  location: "Location permission",
  blocked: "Blocked people",
  reports: "Report history",
  notifications: "Notification preferences",
  email: "Email address",
  password: "Password",
  signout: "Sign out",
  delete: "Delete your account",
};
const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

export default function RedesignedSettingsScreen() {
  const { data, userId, loading, refresh } = useBeacon();
  const profile =
    data.viewer_id === userId
      ? data.profiles.find((row) => row.id === userId)
      : undefined;
  if (!profile)
    return (
      <Screen title="Settings" eyebrow="YOUR ACCOUNT" create={false}>
        {loading ? (
          <View style={{ gap: 16 }}>
            <Skeleton height={56} />
            <Skeleton height={180} />
            <Skeleton height={220} />
          </View>
        ) : (
          <>
            <Txt muted>Account settings are unavailable right now.</Txt>
            <Action title="Retry settings" run={refresh} />
          </>
        )}
      </Screen>
    );
  return <SettingsForm key={profile.id} profile={profile} />;
}

function SettingsForm({ profile }: { profile: Profile }) {
  const { colors, styles } = useTheme();
  const { data, userId, demo, act, signOut, session, getCurrentProfile } =
    useBeacon();
  const preferences = usePreferences();
  const reducedMotion = useReducedMotion();
  const contentOpacity = useSharedValue(1);
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));
  const themeSignature = useRef(
    `${preferences.theme}:${preferences.appearanceMode}`,
  );
  const lifecycle = useRef({ active: false, generation: 0 });
  const now = useNow();
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [quietStart, setQuietStart] = useState(profile.quiet_start);
  const [quietEnd, setQuietEnd] = useState(profile.quiet_end);
  const [defaults, setDefaults] = useState<ViewerDeviceDefaults>({});
  const [defaultsReady, setDefaultsReady] = useState(false);
  const [defaultAudience, setDefaultAudience] = useState<Audience>(
    profile.default_audience ?? "friends",
  );
  const [defaultTarget, setDefaultTarget] = useState<string | null>(null);
  const [sonarDuration, setSonarDuration] = useState<SonarDurationMinutes>(15);
  const [deviceError, setDeviceError] = useState("");
  const [deviceBusy, setDeviceBusy] = useState(false);
  const pushLock = useRef(false);
  const [push, setPush] = useState<DeviceNotificationState | null>(null);
  const [location, setLocation] = useState<LocationPermissionState | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(session?.user.email ?? "");
  const [password, setPassword] = useState("");
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteText, setDeleteText] = useState("");
  const [unblockId, setUnblockId] = useState<string | null>(null);
  const viewer = profile.id;
  const latestProfile =
    data.profiles.find((row) => row.id === viewer) ?? profile;
  const viewerCurrent = userId === viewer && data.viewer_id === viewer;
  const blocks = viewerCurrent
    ? data.blocks.filter((row) => row.blocker_id === viewer)
    : [];
  const reports = viewerCurrent
    ? data.reports
        .filter((row) => row.reporter_id === viewer)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    : [];
  const liveLocation = viewerCurrent
    ? data.locations.find(
        (row) => row.owner_id === viewer && Date.parse(row.expires_at) > now,
      )
    : undefined;
  const targets = eligibleDefaultTargets(data, viewer, defaultAudience);
  const resolvedDefault = resolveDefaultAudience(data, viewer, defaults);

  const checkDevice = useCallback(async () => {
    const generation = lifecycle.current.generation;
    const [notifications, permissions] = await Promise.allSettled([
      readDeviceNotificationState(viewer),
      readLocationPermissionState(),
    ]);
    if (
      !lifecycle.current.active ||
      lifecycle.current.generation !== generation
    )
      return;
    if (notifications.status === "fulfilled") setPush(notifications.value);
    if (permissions.status === "fulfilled") setLocation(permissions.value);
    if (
      notifications.status === "rejected" ||
      permissions.status === "rejected"
    )
      throw new Error(
        "Device permission status could not be read. Try checking again.",
      );
  }, [viewer]);

  useEffect(() => {
    let active = true;
    const mountedLifecycle = lifecycle.current;
    mountedLifecycle.active = true;
    mountedLifecycle.generation += 1;
    void readViewerDeviceDefaults(viewer)
      .then((value) => {
        if (!active) return;
        setDefaults(value);
        setDefaultAudience(
          value.beaconAudience &&
            value.beaconAudience !== "private" &&
            value.beaconAudience !== "friends"
            ? value.beaconAudience
            : (profile.default_audience ?? "friends"),
        );
        setDefaultTarget(value.beaconAudienceId ?? null);
        setSonarDuration(value.sonarDurationMinutes ?? 15);
        setDefaultsReady(true);
      })
      .catch(() => {
        if (active)
          setDeviceError(
            "Device defaults could not be loaded. Retry before changing them.",
          );
      });
    void Promise.resolve()
      .then(checkDevice)
      .catch((error: Error) => {
        if (active) setDeviceError(error.message);
      });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active")
        void checkDevice().catch((error: Error) => {
          if (active) setDeviceError(error.message);
        });
    });
    return () => {
      active = false;
      mountedLifecycle.active = false;
      mountedLifecycle.generation += 1;
      subscription.remove();
    };
  }, [viewer, profile.default_audience, checkDevice]);

  useEffect(() => {
    const next = `${preferences.theme}:${preferences.appearanceMode}`;
    if (themeSignature.current === next) return;
    themeSignature.current = next;
    contentOpacity.set(reducedMotion ? 1 : 0.72);
    if (!reducedMotion) contentOpacity.set(withTiming(1, { duration: 180 }));
  }, [
    preferences.theme,
    preferences.appearanceMode,
    reducedMotion,
    contentOpacity,
  ]);

  const requireViewer = () => {
    const current = getCurrentProfile();
    if (!viewerCurrent || !current || current.id !== viewer)
      throw new Error("Your account changed. Reopen Settings to continue.");
    return current;
  };
  const registerPush = async () => {
    requireViewer();
    if (demo || !supabase)
      throw new Error("Push needs a real account on a configured phone.");
    await enablePush();
    const { data: currentAuth } = await supabase.auth.getSession();
    if (!lifecycle.current.active || currentAuth.session?.user.id !== viewer)
      throw new Error(
        "Your account changed during registration. Reopen Settings to check this device.",
      );
    await acknowledgePushRegistration(viewer);
    if (!lifecycle.current.active) return;
    await checkDevice();
  };
  const open = (next: Panel) => {
    setMessage("");
    if (next === "quiet") {
      setQuietStart(latestProfile.quiet_start);
      setQuietEnd(latestProfile.quiet_end);
    }
    if (next === "delete") {
      setDeleteStep(1);
      setDeleteText("");
    }
    if (next === "password") setPassword("");
    setPanel(next);
  };
  const match = (text: string) =>
    !query.trim() || text.toLowerCase().includes(query.trim().toLowerCase());
  const rows = (
    items: {
      title: string;
      detail?: string;
      icon: LucideIcon;
      keywords?: string;
      onPress?: () => void;
      danger?: boolean;
      trailing?: React.ReactNode;
    }[],
  ) =>
    items.filter((item) =>
      match(`${item.title} ${item.detail ?? ""} ${item.keywords ?? ""}`),
    );
  const togglePush = async (enabled: boolean) => {
    if (pushLock.current) return;
    pushLock.current = true;
    setDeviceBusy(true);
    setDeviceError("");
    try {
      requireViewer();
      if (enabled) {
        if (demo || !supabase)
          throw new Error(
            "Push registration is available with a real account on a configured phone.",
          );
        await registerPush();
      } else {
        await clearPush();
        await clearPushRegistrationReceipt();
      }
      await checkDevice();
      if (lifecycle.current.active) void uiHaptics.light();
    } catch (error) {
      if (lifecycle.current.active)
        setDeviceError(
          error instanceof Error
            ? error.message
            : "Notification setting could not be changed.",
        );
    } finally {
      pushLock.current = false;
      if (lifecycle.current.active) setDeviceBusy(false);
    }
  };
  const pushRegistered =
    push?.permission === "granted" && push.registration === "verified";
  const canEnablePush =
    !!push?.supported && push.physicalDevice && push.projectConfigured && !demo;
  const pushSummary = !push
    ? "Checking this device…"
    : !push.supported
      ? "Available in the mobile app"
      : `Permission: ${push.permission} · ${push.registration === "verified" ? "Registered for this account" : push.registration === "unknown" ? "Registration needs checking" : "Not registered"}${!push.physicalDevice ? " · Physical phone required" : !push.projectConfigured ? " · Push project is not configured" : ""}`;
  const groups = [
    {
      title: "Privacy",
      items: rows([
        {
          title: "Profile visibility",
          detail:
            latestProfile.profile_visibility === "custom"
              ? "Custom audience"
              : latestProfile.profile_visibility === "friends"
                ? "Friends"
                : "Public",
          keywords: "privacy who can see profile",
          icon: Eye,
          onPress: () => router.push("/settings/privacy" as Href),
        },
        {
          title: "Blocked people",
          detail: `${blocks.length} blocked`,
          keywords: "privacy safety",
          icon: ShieldAlert,
          onPress: () => open("blocked"),
        },
        {
          title: "Report history",
          detail: `${reports.length} returned reports`,
          keywords: "privacy safety",
          icon: FileText,
          onPress: () => open("reports"),
        },
      ]),
    },
    {
      title: "Notifications",
      items: rows([
        {
          title: "Push notifications",
          detail: pushSummary,
          icon: Bell,
          trailing: (
            <Switch
              accessibilityLabel="Push notifications"
              disabled={
                deviceBusy || demo || (!pushRegistered && !canEnablePush)
              }
              value={pushRegistered}
              trackColor={{ false: colors.line, true: colors.green }}
              onValueChange={(value) => void togglePush(value)}
            />
          ),
        },
        {
          title: "Notification preferences",
          detail: "Device delivery and in-app updates",
          icon: BellOff,
          onPress: () => open("notifications"),
        },
        {
          title: "Quiet hours",
          detail:
            latestProfile.quiet_start === latestProfile.quiet_end
              ? "Off"
              : `${hourLabel(latestProfile.quiet_start)}–${hourLabel(latestProfile.quiet_end)} · ${latestProfile.timezone}`,
          icon: Clock3,
          onPress: () => open("quiet"),
        },
      ]),
    },
    {
      title: "Beacon defaults",
      items: rows([
        {
          title: "Default Beacon audience",
          detail: `${audienceLabel[resolvedDefault.audience]}${resolvedDefault.fellBack ? " · saved target unavailable" : ""}`,
          keywords: "beacon defaults private friends list squad organization",
          icon: UsersRound,
          onPress: () => open("defaults"),
        },
      ]),
    },
    {
      title: "Location",
      items: rows([
        {
          title: "Sonar defaults",
          detail: `${defaults.sonarDurationMinutes ?? 15} minutes · on this device`,
          keywords: "location temporary sharing",
          icon: Radar,
          onPress: () => open("sonar"),
        },
        {
          title: "Temporary location sharing",
          detail: liveLocation
            ? `Sharing until ${new Date(liveLocation.expires_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : "Off · choose friends before starting",
          keywords: "location sonar",
          icon: MapPin,
          onPress: () => router.push("/location" as Href),
        },
        {
          title: "Location permission",
          detail: location?.supported
            ? `Foreground: ${location.foreground} · background: ${location.background}`
            : "Mobile app only",
          icon: Shield,
          onPress: () => open("location"),
        },
      ]),
    },
    {
      title: "Account",
      items: rows([
        {
          title: "Email address",
          detail: demo
            ? "Demo account"
            : (session?.user.email ?? "No email address"),
          icon: Mail,
          onPress: () => open("email"),
        },
        {
          title: "Password",
          detail: "Update your account password",
          icon: KeyRound,
          onPress: () => open("password"),
        },
        {
          title: demo ? "Leave demo" : "Sign out",
          icon: LogOut,
          danger: true,
          onPress: () => open("signout"),
        },
        ...(!demo
          ? [
              {
                title: "Delete account",
                detail: "Permanently remove your account",
                icon: Trash2,
                danger: true,
                onPress: () => open("delete"),
              },
            ]
          : []),
      ]),
    },
    {
      title: "Help & policies",
      items: rows([
        {
          title: "Help & support",
          keywords: "guide",
          icon: HelpCircle,
          onPress: () => router.push("/help" as Href),
        },
        {
          title: "Privacy, safety & policies",
          keywords: "terms legal support",
          icon: FileText,
          onPress: () => router.push("/legal" as Href),
        },
        ...(data.is_moderator
          ? [
              {
                title: "Moderation inbox",
                icon: ShieldAlert,
                onPress: () => router.push("/moderation" as Href),
              },
            ]
          : []),
      ]),
    },
  ];
  const showAppearance = match(
    "Appearance palette theme Mint Sunset Midnight Ocean Berry Light Dark Device avatars",
  );
  const hasResults =
    showAppearance || groups.some((group) => group.items.length);

  return (
    <Screen title="Settings" eyebrow="MAKE IT YOURS" create={false}>
      <Field
        label="Search settings"
        placeholder="Privacy, location, appearance…"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
      />
      <Animated.View style={[{ gap: 20 }, contentStyle]}>
        {showAppearance ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(180)}
          >
            <SettingsGroup title="Appearance">
              <SettingsRow
                title="Palette"
                detail="Applies live across the app"
                icon={Palette}
              />
              <View style={{ padding: 12, gap: 14 }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10, paddingBottom: 2 }}
                >
                  {themeNames.map((name) => {
                    const palette =
                      themeVariants[name][preferences.resolvedAppearance];
                    const selected = preferences.theme === name;
                    return (
                      <Pressable
                        key={name}
                        accessibilityRole="button"
                        accessibilityLabel={`${name} palette`}
                        aria-pressed={selected}
                        accessibilityState={{
                          selected,
                          disabled: !preferences.ready,
                        }}
                        disabled={!preferences.ready}
                        onPress={() => {
                          preferences.setTheme(name);
                          void uiHaptics.light();
                        }}
                        style={{
                          width: 80,
                          minHeight: 88,
                          borderRadius: 16,
                          borderColor: selected ? colors.green : colors.line,
                          borderWidth: selected ? 2 : 1,
                          backgroundColor: palette.bg,
                          padding: 8,
                          justifyContent: "space-between",
                        }}
                      >
                        <View style={{ flexDirection: "row", gap: 3 }}>
                          {[palette.green, palette.lime, palette.ink].map(
                            (swatch, index) => (
                              <View
                                key={index}
                                style={{
                                  width: 16,
                                  height: 22,
                                  borderRadius: 5,
                                  backgroundColor: swatch,
                                }}
                              />
                            ),
                          )}
                        </View>
                        <View
                          style={{ flexDirection: "row", alignItems: "center" }}
                        >
                          <Text
                            style={{
                              color: palette.ink,
                              fontSize: 12,
                              fontWeight: "600",
                              flex: 1,
                            }}
                          >
                            {name}
                          </Text>
                          {selected ? (
                            <Check size={13} color={palette.green} />
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <SegmentedControl<AppearanceMode>
                  accessibilityLabel="Appearance"
                  options={[
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                    { value: "system", label: "Device" },
                  ]}
                  value={preferences.appearanceMode}
                  onChange={preferences.setAppearanceMode}
                />
                <Text style={styles.muted}>
                  Device follows your phone or browser. Palette and avatar
                  choices stay on this device.
                </Text>
                <AvatarToggle description />
              </View>
            </SettingsGroup>
          </Animated.View>
        ) : null}
        {groups
          .filter((group) => group.items.length)
          .map((group, index) => (
            <Animated.View
              key={group.title}
              entering={
                reducedMotion
                  ? undefined
                  : FadeInDown.duration(180).delay(Math.min(index + 1, 4) * 35)
              }
            >
              <SettingsGroup title={group.title}>
                {group.items.map((item, rowIndex) => (
                  <SettingsRow
                    key={item.title}
                    {...item}
                    last={rowIndex === group.items.length - 1}
                  />
                ))}
              </SettingsGroup>
            </Animated.View>
          ))}
        {!hasResults ? (
          <Txt muted>
            No settings match “{query}”. Try privacy, location, or appearance.
          </Txt>
        ) : null}
      </Animated.View>
      {deviceError ? (
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="alert" style={styles.error}>
            {deviceError}
          </Text>
          <Action
            secondary
            compact
            title="Check device settings again"
            run={async () => {
              setDeviceError("");
              await checkDevice();
              const value = await readViewerDeviceDefaults(viewer);
              setDefaults(value);
              setDefaultsReady(true);
            }}
          />
        </View>
      ) : null}

      <Sheet
        title={panel ? panelTitle[panel] : "Settings"}
        visible={panel !== null}
        onClose={() => setPanel(null)}
      >
        {panel === "quiet" ? (
          <>
            <Txt muted>
              Quiet hours use {latestProfile.timezone}. Set matching start and
              end hours to turn them off.
            </Txt>
            <QuietHoursPicker
              start={quietStart}
              end={quietEnd}
              onStart={setQuietStart}
              onEnd={setQuietEnd}
            />
            <Action
              title="Save quiet hours"
              feedback="success"
              run={async () => {
                requireViewer();
                await act(
                  "save_profile",
                  profileSavePayload(requireViewer(), {
                    quiet_start: quietStart,
                    quiet_end: quietEnd,
                  }),
                );
                setPanel(null);
              }}
            />
          </>
        ) : null}
        {panel === "defaults" ? (
          <>
            <Txt muted>
              Private and Friends are account defaults. List, Squad, and
              Organization targets are saved only on this device and rechecked
              when creating a Beacon.
            </Txt>
            <Chips
              options={defaultAudienceOptions}
              value={defaultAudience}
              accessibilityPrefix="Default Beacon audience"
              showSelectedCheckmark={false}
              onChange={(value) => {
                setDefaultAudience(value);
                setDefaultTarget(null);
              }}
            />
            {defaultAudience !== "private" && defaultAudience !== "friends" ? (
              <>
                {targets.map((target) => (
                  <Button
                    key={target.id}
                    title={target.name}
                    secondary={defaultTarget !== target.id}
                    onPress={() => setDefaultTarget(target.id)}
                  />
                ))}
                {!targets.length ? (
                  <Txt muted>
                    No eligible {audienceLabel[defaultAudience].toLowerCase()}{" "}
                    targets are available.
                  </Txt>
                ) : null}
              </>
            ) : null}
            <Action
              title="Save Beacon default"
              disabled={
                !defaultsReady ||
                (defaultAudience !== "private" &&
                  defaultAudience !== "friends" &&
                  !targets.some((target) => target.id === defaultTarget))
              }
              feedback="success"
              run={async () => {
                requireViewer();
                const patch = {
                  beaconAudience: defaultAudience,
                  beaconAudienceId: defaultTarget,
                };
                if (
                  defaultAudience === "private" ||
                  defaultAudience === "friends"
                )
                  await act(
                    "save_profile",
                    profileSavePayload(requireViewer(), {
                      default_audience: defaultAudience,
                    }),
                  );
                await writeViewerDeviceDefaults(viewer, patch);
                setDefaults((current) => ({ ...current, ...patch }));
                setPanel(null);
              }}
            />
          </>
        ) : null}
        {panel === "sonar" ? (
          <>
            <Txt muted>
              Choose the duration offered when you open Sonar. This does not
              select friends, request permission, or start sharing.
            </Txt>
            <Chips
              options={["15 min", "30 min", "1 hour", "4 hours"] as const}
              value={
                sonarDuration === 15
                  ? "15 min"
                  : sonarDuration === 30
                    ? "30 min"
                    : sonarDuration === 60
                      ? "1 hour"
                      : "4 hours"
              }
              onChange={(value) =>
                setSonarDuration(
                  value === "15 min"
                    ? 15
                    : value === "30 min"
                      ? 30
                      : value === "1 hour"
                        ? 60
                        : 240,
                )
              }
            />
            <Action
              title="Save Sonar default"
              disabled={!defaultsReady}
              feedback="success"
              run={async () => {
                requireViewer();
                await writeViewerDeviceDefaults(viewer, {
                  sonarDurationMinutes: sonarDuration,
                });
                setDefaults((current) => ({
                  ...current,
                  sonarDurationMinutes: sonarDuration,
                }));
                setPanel(null);
              }}
            />
          </>
        ) : null}
        {panel === "location" ? (
          <>
            <Txt>
              Foreground location is used after you tap a location action, such
              as locating yourself on the map. Opening Settings does not fetch
              your location.
            </Txt>
            <Txt muted>
              Sonar also needs background access to keep a confirmed sharing
              session current while the app is closed. Only friends you select
              can receive it, for up to four hours.
            </Txt>
            <Txt muted>
              {location?.supported
                ? `Foreground: ${location.foreground}. Background: ${location.background}.`
                : "Device location is available in the mobile app."}
            </Txt>
            {location?.supported ? (
              <>
                <Action
                  secondary
                  title="Allow foreground location"
                  run={async () => {
                    requireViewer();
                    if (demo)
                      throw new Error(
                        "Use a real account to change device location permission.",
                      );
                    await requestForegroundLocation();
                    await checkDevice();
                  }}
                />
                <Action
                  secondary
                  title="Open device permission settings"
                  run={() => Linking.openSettings()}
                />
              </>
            ) : null}
            <Button
              secondary
              title="Choose Sonar friends & duration"
              onPress={() => {
                setPanel(null);
                router.push("/location" as Href);
              }}
            />
          </>
        ) : null}
        {panel === "notifications" ? (
          <>
            <Txt>{pushSummary}</Txt>
            <Txt muted>
              Beacon invitations, replies, and reminders use this device’s push
              registration. In-app updates remain available when push is off.
            </Txt>
            <Txt muted>
              Separate notification category preferences are not available yet.
              Quiet hours apply to supported server notifications.
            </Txt>
            {demo ? (
              <Txt muted>
                Demo notifications are sample data. Push needs a real account on
                a configured phone.
              </Txt>
            ) : null}
            {push?.supported ? (
              <>
                <Action
                  secondary
                  title="Register this device for push"
                  disabled={deviceBusy || !canEnablePush}
                  run={registerPush}
                />
                <Action
                  secondary
                  title="Disable this device’s push"
                  run={async () => {
                    requireViewer();
                    await clearPush();
                    await clearPushRegistrationReceipt();
                    await checkDevice();
                  }}
                />
                {!push.canAskAgain && push.permission === "denied" ? (
                  <Action
                    secondary
                    title="Open notification permission settings"
                    run={() => Linking.openSettings()}
                  />
                ) : null}
              </>
            ) : null}
            <Button
              secondary
              title="Edit quiet hours"
              onPress={() => open("quiet")}
            />
          </>
        ) : null}
        {panel === "blocked" ? (
          <>
            <Txt muted>
              Unblocking does not restore friendships or location sharing.
            </Txt>
            {blocks.map((block, index) => (
              <SettingsRow
                key={block.blocked_id}
                title={`Blocked account ${index + 1}`}
                detail="Profile details are hidden while blocked"
                icon={ShieldAlert}
                onPress={() => setUnblockId(block.blocked_id)}
              />
            ))}
            {!blocks.length ? (
              <Txt muted>
                You have no blocked accounts in this account’s returned data.
              </Txt>
            ) : null}
          </>
        ) : null}
        {panel === "reports" ? (
          <>
            {reports.map((report) => (
              <View key={report.id} style={styles.card}>
                <Txt>{report.reason}</Txt>
                <Txt muted>
                  {new Date(report.created_at).toLocaleDateString()} ·{" "}
                  {report.resolved ? "Resolved" : "Submitted"}
                </Txt>
              </View>
            ))}
            {!reports.length ? (
              <Txt muted>No reports were returned for this account.</Txt>
            ) : null}
            <Txt muted>
              This shows only reports returned for you. It does not expose other
              people’s reports.
            </Txt>
          </>
        ) : null}
        {panel === "email" ? (
          demo || !supabase ? (
            <Txt muted>
              Email changes are available after signing in to a real account.
            </Txt>
          ) : (
            <>
              <Field
                label="New email address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <Action
                title="Update email address"
                run={async () => {
                  requireViewer();
                  if (!email.trim().includes("@"))
                    throw new Error("Enter a valid email address.");
                  if (!supabase)
                    throw new Error("Account service is unavailable.");
                  const { error } = await supabase.auth.updateUser(
                    { email: email.trim() },
                    { emailRedirectTo: "squadbeacon://auth/callback" },
                  );
                  if (error) throw error;
                  setMessage(
                    "Check your email to confirm the change. Your current address remains until confirmation.",
                  );
                }}
              />
            </>
          )
        ) : null}
        {panel === "password" ? (
          demo || !supabase ? (
            <Txt muted>
              Password changes are available after signing in to a real account.
            </Txt>
          ) : (
            <>
              <Field
                label="New password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
              />
              <Txt muted>Use at least 10 characters.</Txt>
              <Action
                title="Update password"
                run={async () => {
                  requireViewer();
                  if (password.length < 10)
                    throw new Error("Use at least 10 characters.");
                  if (!supabase)
                    throw new Error("Account service is unavailable.");
                  const { error } = await supabase.auth.updateUser({
                    password,
                  });
                  if (error) throw error;
                  setPassword("");
                  setMessage("Your password was updated.");
                }}
              />
            </>
          )
        ) : null}
        {panel === "signout" ? (
          <>
            <Txt>
              {demo
                ? "Leave this demo session?"
                : "Sign out of this account on this device?"}
            </Txt>
            <DangerAction
              title={demo ? "Leave demo" : "Sign out"}
              run={async () => {
                requireViewer();
                await signOut();
              }}
            />
            <Button
              secondary
              title="Keep using this account"
              onPress={() => setPanel(null)}
            />
          </>
        ) : null}
        {panel === "delete" ? (
          deleteStep === 1 ? (
            <>
              <Text style={[styles.body, { color: colors.red }]}>
                This permanently removes your profile, Beacons, messages, and
                sharing sessions. Squads and Organizations you own are removed
                too. Safety reports remain under the published retention policy.
              </Text>
              <Button
                secondary
                title="Cancel account deletion"
                onPress={() => setPanel(null)}
              />
              <DangerAction
                title="Continue to account deletion"
                run={async () => {
                  setDeleteStep(2);
                }}
              />
            </>
          ) : (
            <>
              <Txt>Type DELETE to permanently delete your account.</Txt>
              <Field
                label="Type DELETE to confirm"
                value={deleteText}
                onChangeText={setDeleteText}
                autoCapitalize="characters"
              />
              <DangerAction
                title="Permanently delete account"
                disabled={deleteText !== "DELETE"}
                run={async () => {
                  requireViewer();
                  if (deleteText !== "DELETE" || !supabase || demo)
                    throw new Error("Account deletion is unavailable.");
                  await act("stop_location");
                  await stopDeviceLocation();
                  const { error } =
                    await supabase.functions.invoke("delete-account");
                  if (error) throw error;
                  await supabase.auth.signOut({ scope: "local" });
                }}
              />
            </>
          )
        ) : null}
        {message ? <Txt>{message}</Txt> : null}
      </Sheet>
      <Sheet
        title="Unblock this account?"
        visible={unblockId !== null}
        onClose={() => setUnblockId(null)}
      >
        <Txt>
          They may be able to see what your current privacy settings allow.
          Friendships and location sharing are not restored.
        </Txt>
        <Action
          title="Unblock account"
          run={async () => {
            requireViewer();
            if (
              !unblockId ||
              !blocks.some((block) => block.blocked_id === unblockId)
            )
              throw new Error("This block is no longer available.");
            await act("unblock", { id: unblockId });
            setUnblockId(null);
          }}
        />
        <Button
          secondary
          title="Keep blocked"
          onPress={() => setUnblockId(null)}
        />
      </Sheet>
    </Screen>
  );
}

function DangerAction({
  title,
  run,
  disabled = false,
}: {
  title: string;
  run: () => Promise<void>;
  disabled?: boolean;
}) {
  const { colors, styles } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: disabled || busy, busy }}
        disabled={disabled || busy}
        onPress={() => {
          if (lock.current) return;
          lock.current = true;
          setBusy(true);
          setError("");
          void Promise.resolve()
            .then(run)
            .catch((failure: unknown) =>
              setError(
                failure instanceof Error
                  ? failure.message
                  : "This action could not be completed.",
              ),
            )
            .finally(() => {
              lock.current = false;
              setBusy(false);
            });
        }}
        style={({ pressed }) => ({
          minHeight: 48,
          borderRadius: 16,
          backgroundColor: colors.red,
          alignItems: "center",
          justifyContent: "center",
          padding: 12,
          opacity: disabled || busy ? 0.5 : pressed ? 0.75 : 1,
        })}
      >
        <Text style={{ color: colors.bg, fontSize: 16, fontWeight: "700" }}>
          {busy ? "Working…" : title}
        </Text>
      </Pressable>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
