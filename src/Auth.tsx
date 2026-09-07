import React, { useState } from "react";
import { Text, View } from "react-native";
import { Radio } from "lucide-react-native";
import { useBeacon } from "./store";
import { supabase } from "./supabase";
import {
  Action,
  Button,
  Chips,
  Field,
  Screen,
  Txt,
  colors,
  styles,
} from "./ui";
export function Auth() {
  const { startDemo } = useBeacon();
  const [mode, setMode] = useState<
    "Sign in" | "Create account" | "Reset password"
  >("Sign in");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState("");
  return (
    <Screen
      title="Good things happen together."
      eyebrow="SQUAD BEACON"
      create={false}
    >
      <View style={styles.hero}>
        <Radio size={46} color={colors.lime} />
        <Text style={[styles.title, { color: "white", fontSize: 30 }]}>
          Your people.{"\n"}Your plans.{"\n"}A little more progress.
        </Text>
        <Text style={{ color: "#BDCFC5", fontSize: 15, lineHeight: 24 }}>
          Find a friend to train with, make time to create, or turn “we should
          hang out” into a plan.
        </Text>
      </View>
      {supabase ? (
        <View style={styles.card}>
          <Chips
            options={["Sign in", "Create account", "Reset password"] as const}
            value={mode}
            onChange={setMode}
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          {mode !== "Reset password" && (
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={
                mode === "Sign in" ? "current-password" : "new-password"
              }
            />
          )}
          <Action
            title={mode}
            run={async () => {
              setMessage("");
              if (!email.includes("@"))
                throw new Error("Enter a valid email address.");
              if (mode === "Reset password") {
                const { error } = await supabase!.auth.resetPasswordForEmail(
                  email,
                  { redirectTo: "squadbeacon://auth/callback" },
                );
                if (error) throw error;
                setMessage("Check your email for a password reset link.");
              } else if (mode === "Create account") {
                if (password.length < 10)
                  throw new Error(
                    "Choose a password with at least 10 characters.",
                  );
                const { error } = await supabase!.auth.signUp({
                  email,
                  password,
                  options: { emailRedirectTo: "squadbeacon://auth/callback" },
                });
                if (error) throw error;
                setMessage(
                  "Check your email to verify your account, then sign in.",
                );
              } else {
                const { error } = await supabase!.auth.signInWithPassword({
                  email,
                  password,
                });
                if (error) throw error;
              }
            }}
          />
          {!!message && <Txt>{message}</Txt>}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.h2}>Take a look around</Text>
          <Txt muted>
            Explore the demo now. Real accounts become available once the app’s
            backend is configured.
          </Txt>
        </View>
      )}
      <Button secondary title="Explore the demo →" onPress={startDemo} />
      <Txt muted>For ages 16+. Location sharing is always your choice.</Txt>
    </Screen>
  );
}
export function Onboard() {
  const { act, signOut } = useBeacon();
  const [name, setName] = useState(""),
    [username, setUsername] = useState(""),
    [birth, setBirth] = useState("");
  return (
    <Screen
      title="Make yourself at home."
      eyebrow="YOUR PROFILE"
      create={false}
    >
      <View style={styles.card}>
        <Field label="Your name" value={name} onChangeText={setName} />
        <Field
          label="Username · 3–24 letters, numbers, or underscores"
          value={username}
          autoCapitalize="none"
          onChangeText={setUsername}
        />
        <Field
          label="Birth date · YYYY-MM-DD · kept private"
          placeholder="2000-01-31"
          value={birth}
          onChangeText={setBirth}
        />
        <Txt muted>
          Squad Beacon is for people 16 and older. Your profile starts
          invite-only, and location sharing starts off.
        </Txt>
        <Action
          title="Create my profile"
          run={() =>
            act("onboard", {
              name,
              username,
              birth_date: birth,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            })
          }
        />
        <Action title="Sign out" secondary run={signOut} />
      </View>
    </Screen>
  );
}
