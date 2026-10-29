import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Eye, EyeOff, Radio } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { supabase } from "@/src/shared/supabase";
import {
  Action,
  Button,
  Chips,
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

export function Auth() {
  const { colors, styles } = useTheme();
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
  return (
    <ChatKeyboardFrame>
      <Screen
        title="Squad Beacon"
        eyebrow="ACCOUNT"
        compactHeader
        create={false}
      >
        <View style={{ gap: 10 }}>
          <Radio size={32} color={colors.green} />
          <Text style={styles.h2}>Make plans. Show up together.</Text>
          <Txt muted>
            Find your people and turn the group chat into real plans.
          </Txt>
        </View>
        {supabase ? (
          <View style={styles.card}>
            {mode === "Reset password" ? (
              <Text style={styles.h2}>Reset your password</Text>
            ) : (
              <Chips
                options={["Sign in", "Create account"] as const}
                value={mode}
                onChange={changeMode}
              />
            )}
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              editable={!busy}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
            />
            {mode !== "Reset password" && (
              <>
                <Field
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  editable={!busy}
                  secureTextEntry={!visible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete={
                    mode === "Sign in" ? "current-password" : "new-password"
                  }
                />
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <IconButton
                    label={visible ? "Hide password" : "Show password"}
                    onPress={() => setVisible(!visible)}
                  >
                    {visible ? (
                      <EyeOff size={20} color={colors.ink} />
                    ) : (
                      <Eye size={20} color={colors.ink} />
                    )}
                  </IconButton>
                  <Txt muted>
                    {visible ? "Password visible" : "Password hidden"}
                  </Txt>
                </View>
                {mode === "Create account" && (
                  <Txt muted>Use at least 10 characters.</Txt>
                )}
              </>
            )}
            <Action
              key={mode}
              title={
                busy
                  ? "Please wait…"
                  : mode === "Reset password"
                    ? "Send reset link"
                    : mode
              }
              disabled={busy}
              run={submit}
            />
            {!!message && <Txt>{message}</Txt>}
            {needsConfirmation && mode === "Create account" && (
              <ResendAuthEmail email={email} />
            )}
            <Button
              secondary
              compact
              disabled={busy}
              title={
                mode === "Reset password"
                  ? "Back to sign in"
                  : "Forgot password?"
              }
              onPress={() =>
                changeMode(
                  mode === "Reset password" ? "Sign in" : "Reset password",
                )
              }
            />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.h2}>Take a look around</Text>
            <Txt muted>
              Explore the demo now. Real accounts become available once the
              app’s backend is configured.
            </Txt>
          </View>
        )}
        <Button
          secondary
          compact
          title="Explore the demo →"
          disabled={busy}
          onPress={startDemo}
        />
        <Txt muted>For ages 16+. Location sharing is always your choice.</Txt>
      </Screen>
    </ChatKeyboardFrame>
  );
}

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
