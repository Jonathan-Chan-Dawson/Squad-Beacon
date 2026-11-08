import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Compass, Eye, EyeOff, Radio } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBeacon } from "@/src/shared/store";
import { supabase } from "@/src/shared/supabase";
import {
  Action,
  Button,
  Field,
  IconButton,
  Screen,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { ChatKeyboardFrame } from "@/src/features/messages/ChatKeyboard";
import {
  authCallbackUrl,
  basicProfilePayload,
  profileEntryError,
  accountEmail,
} from "./accountEntry";
import { ResendAuthEmail } from "./ResendAuthEmail";

const entryModes = ["Sign in", "Create account"] as const;

export function Auth() {
  const { colors, semanticColors, styles } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 840 && fontScale <= 1.3;
  const { startDemo } = useBeacon();
  const [mode, setMode] = useState<
    "Sign in" | "Create account" | "Reset password"
  >("Sign in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  function changeMode(next: typeof mode) {
    if (lock.current) return;
    setMode(next);
    setMessage("");
    setNeedsConfirmation(false);
    setVisible(false);
  }
  async function submit() {
    if (lock.current || !supabase) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const address = accountEmail(email);
      if (mode === "Reset password") {
        const { error } = await supabase.auth.resetPasswordForEmail(address, {
          redirectTo: authCallbackUrl(true),
        });
        if (error) throw error;
        if (active.current)
          setMessage(
            "If an account uses this email, you’ll receive a password reset link. Check your inbox and spam folder.",
          );
      } else if (mode === "Create account") {
        if (password.length < 10)
          throw new Error("Choose a password with at least 10 characters.");
        const { data, error } = await supabase.auth.signUp({
          email: address,
          password,
          options: { emailRedirectTo: authCallbackUrl() },
        });
        if (error) throw error;
        if (!data.session && active.current) {
          setNeedsConfirmation(true);
          setMessage(
            "Check your email, then select Confirm and continue on the page that opens.",
          );
        }
      } else {
        if (!password) throw new Error("Enter your password.");
        const { error } = await supabase.auth.signInWithPassword({
          email: address,
          password,
        });
        if (error) throw error;
      }
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  const resetting = mode === "Reset password";
  const registering = mode === "Create account";
  const heading = resetting
    ? "Reset your password"
    : registering
      ? "Join Squad Beacon"
      : "Welcome back";
  const description = resetting
    ? "Enter your email and we’ll send you a reset link."
    : registering
      ? "Start making plans with your people."
      : "Sign in to get back to your people and plans.";

  return (
    <ChatKeyboardFrame>
      <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={entryStyles.scroll}
        >
          <View style={[entryStyles.layout, wide && entryStyles.wideLayout]}>
            <View
              style={[
                entryStyles.intro,
                wide && entryStyles.wideIntro,
                { backgroundColor: semanticColors.primaryContainer },
              ]}
            >
              <View
                pointerEvents="none"
                accessible={false}
                style={entryStyles.signal}
              >
                {[96, 152, 208].map((size) => (
                  <View
                    key={size}
                    style={[
                      entryStyles.ring,
                      {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        borderColor: colors.green,
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={entryStyles.brand}>
                <View
                  style={[
                    entryStyles.brandIcon,
                    { backgroundColor: semanticColors.primary },
                  ]}
                >
                  <Radio size={22} color={semanticColors.onPrimary} />
                </View>
                <Text style={[styles.body, entryStyles.brandName]}>
                  Squad Beacon
                </Text>
              </View>
              <Text
                style={[wide ? styles.title : styles.h2, entryStyles.tagline]}
              >
                Make plans. Show up together.
              </Text>
              {wide && (
                <Txt muted>
                  Find your people and turn the group chat into real plans.
                </Txt>
              )}
            </View>
            <View style={entryStyles.main}>
              {supabase ? (
                <View
                  style={[
                    styles.card,
                    entryStyles.form,
                    wide && entryStyles.wideForm,
                  ]}
                >
                  {!resetting && (
                    <View
                      style={[
                        entryStyles.switcher,
                        { backgroundColor: semanticColors.bg },
                      ]}
                    >
                      {entryModes.map((option) => {
                        const selected = mode === option;
                        return (
                          <Pressable
                            key={option}
                            accessibilityRole="button"
                            accessibilityState={{ selected, disabled: busy }}
                            disabled={busy}
                            onPress={() => changeMode(option)}
                            style={({ pressed }) => [
                              entryStyles.mode,
                              selected && {
                                backgroundColor: semanticColors.surface,
                                borderColor: semanticColors.border,
                              },
                              pressed && entryStyles.pressed,
                            ]}
                          >
                            <Text
                              style={[
                                selected ? styles.body : styles.muted,
                                entryStyles.modeText,
                              ]}
                            >
                              {option}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                  <View style={entryStyles.heading}>
                    <Text accessibilityRole="header" style={styles.h2}>
                      {heading}
                    </Text>
                    <Txt muted>{description}</Txt>
                  </View>
                  <View style={entryStyles.fields}>
                    <Field
                      label="Email"
                      value={email}
                      onChangeText={setEmail}
                      editable={!busy}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      autoComplete="email"
                      style={entryStyles.input}
                    />
                    {!resetting && (
                      <View style={entryStyles.heading}>
                        <View>
                          <Field
                            label="Password"
                            value={password}
                            onChangeText={setPassword}
                            editable={!busy}
                            secureTextEntry={!visible}
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete={
                              registering ? "new-password" : "current-password"
                            }
                            style={[
                              entryStyles.input,
                              entryStyles.passwordInput,
                            ]}
                          />
                          <View style={entryStyles.passwordToggle}>
                            <IconButton
                              label={
                                visible ? "Hide password" : "Show password"
                              }
                              onPress={() => setVisible((shown) => !shown)}
                            >
                              {visible ? (
                                <EyeOff size={20} color={colors.ink} />
                              ) : (
                                <Eye size={20} color={colors.ink} />
                              )}
                            </IconButton>
                          </View>
                        </View>
                        {registering && (
                          <Txt muted>Use at least 10 characters.</Txt>
                        )}
                      </View>
                    )}
                  </View>
                  <Action
                    key={mode}
                    title={
                      busy
                        ? "Please wait…"
                        : resetting
                          ? "Send reset link"
                          : mode
                    }
                    disabled={busy}
                    run={submit}
                  />
                  {!!message && (
                    <View
                      accessibilityLiveRegion="polite"
                      style={[
                        entryStyles.notice,
                        { backgroundColor: semanticColors.primaryContainer },
                      ]}
                    >
                      <Txt>{message}</Txt>
                    </View>
                  )}
                  {needsConfirmation && registering && (
                    <ResendAuthEmail email={email} />
                  )}
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() =>
                      changeMode(resetting ? "Sign in" : "Reset password")
                    }
                    style={({ pressed }) => [
                      entryStyles.textAction,
                      pressed && entryStyles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.body,
                        entryStyles.modeText,
                        { color: colors.green },
                      ]}
                    >
                      {resetting ? "Back to sign in" : "Forgot password?"}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.h2}>Take a look around</Text>
                  <Txt muted>
                    Explore the demo now. Real accounts become available once
                    the app’s backend is configured.
                  </Txt>
                </View>
              )}
              <View style={entryStyles.footer}>
                <Button
                  secondary
                  compact
                  title="Explore the demo →"
                  icon={<Compass size={17} color={colors.ink} />}
                  disabled={busy}
                  onPress={startDemo}
                />
                <Text style={[styles.label, entryStyles.center]}>
                  For ages 16+. Location sharing is always your choice.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ChatKeyboardFrame>
  );
}

const entryStyles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  layout: { width: "100%", maxWidth: 460, alignSelf: "center", gap: 14 },
  wideLayout: {
    flexDirection: "row",
    alignItems: "stretch",
    maxWidth: 920,
    gap: 24,
  },
  intro: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  wideIntro: { flex: 1, justifyContent: "center", padding: 36, gap: 20 },
  signal: {
    position: "absolute",
    top: -12,
    right: -22,
    width: 208,
    height: 208,
    opacity: 0.15,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: { position: "absolute", borderWidth: 1 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { flexShrink: 1, fontWeight: "700" },
  tagline: { maxWidth: 340 },
  main: { flex: 1, minWidth: 0, gap: 12 },
  form: { padding: 16, gap: 14 },
  wideForm: { padding: 24, gap: 18 },
  switcher: { flexDirection: "row", borderRadius: 14, gap: 4, padding: 4 },
  mode: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  modeText: { fontWeight: "700", textAlign: "center" },
  pressed: { opacity: 0.72 },
  heading: { gap: 5 },
  fields: { gap: 12 },
  input: { minHeight: 50, paddingVertical: 11 },
  passwordInput: { paddingRight: 52 },
  passwordToggle: { position: "absolute", right: 3, bottom: 3 },
  notice: { borderRadius: 12, padding: 12 },
  textAction: {
    alignSelf: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
    marginVertical: -5,
  },
  footer: { gap: 9 },
  center: { textAlign: "center" },
});

export function Onboard() {
  const { styles } = useTheme();
  const { act, signOut } = useBeacon();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [birth, setBirth] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const payload = basicProfilePayload(
        name,
        username,
        birth.trim(),
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
      await act("onboard", payload);
    } catch (failure) {
      throw new Error(profileEntryError(failure));
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <ChatKeyboardFrame>
      <Screen
        title="Almost there."
        eyebrow="YOUR PROFILE"
        compactHeader
        create={false}
      >
        <Txt>Just the basics, then you’re in.</Txt>
        <View style={styles.card}>
          <Field
            label="Your name"
            value={name}
            onChangeText={setName}
            autoComplete="name"
            maxLength={80}
            editable={!busy}
          />
          <Field
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username-new"
            maxLength={24}
            editable={!busy}
          />
          <Txt muted>3–24 letters, numbers, or underscores.</Txt>
          <Field
            label="Date of birth · YYYY-MM-DD"
            placeholder="2000-01-31"
            value={birth}
            onChangeText={setBirth}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={10}
            editable={!busy}
          />
          <Txt muted>
            For ages 16+. Your birth date stays private, and location sharing
            starts off.
          </Txt>
          <Action
            title={busy ? "Creating profile…" : "Enter Squad Beacon"}
            disabled={busy}
            run={submit}
          />
          <Action
            title="Sign out"
            secondary
            compact
            disabled={busy}
            run={signOut}
          />
        </View>
      </Screen>
    </ChatKeyboardFrame>
  );
}
