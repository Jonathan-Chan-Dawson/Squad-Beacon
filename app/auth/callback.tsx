import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/src/supabase";
import { Action, Button, Field, Screen, Txt } from "@/src/ui";
export default function Callback() {
  const params = useLocalSearchParams<{
      code?: string;
      token_hash?: string;
      type?: string;
      error_description?: string;
    }>(),
    [message, setMessage] = useState("Confirming your email…"),
    [ready, setReady] = useState(false),
    [password, setPassword] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) throw new Error("Backend is not configured.");
      if (params.error_description) throw new Error(params.error_description);
      if (params.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(
          params.code,
        );
        if (error) throw error;
      } else if (
        params.token_hash &&
        (params.type === "recovery" || params.type === "signup")
      ) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: params.token_hash,
          type: params.type,
        });
        if (error) throw error;
      } else
        throw new Error("This link is incomplete. Request a fresh email link.");
      if (active) {
        setReady(true);
        setMessage(
          "Email confirmed. Continue, or choose a new password if you requested a reset.",
        );
      }
    })().catch((e) => active && setMessage(e.message));
    return () => {
      active = false;
    };
  }, [params.code, params.token_hash, params.type, params.error_description]);
  return (
    <Screen title="Welcome back." eyebrow="ACCOUNT" create={false}>
      <Txt>{message}</Txt>
      {ready && (
        <>
          <Field
            label="New password (only for a password reset)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Action
            title="Set new password"
            run={async () => {
              if (password.length < 10)
                throw new Error("Use at least 10 characters.");
              const { error } = await supabase!.auth.updateUser({ password });
              if (error) throw error;
              router.replace("/");
            }}
          />
        </>
      )}
      <Button
        title="Continue to Squad Beacon"
        onPress={() => router.replace("/")}
      />
    </Screen>
  );
}
