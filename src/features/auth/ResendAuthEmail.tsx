import { useRef, useState } from "react";
import { View } from "react-native";
import { Action, Field, Txt } from "@/src/shared/ui";
import { supabase } from "@/src/shared/supabase";
import { accountEmail, authCallbackUrl } from "./accountEntry";

export function ResendAuthEmail({
  email,
  recovery = false,
}: {
  email?: string;
  recovery?: boolean;
}) {
  const [enteredEmail, setEnteredEmail] = useState("");
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  return (
    <View style={{ gap: 10 }}>
      {email == null && (
        <Field
          label="Email for a new link"
          value={enteredEmail}
          onChangeText={(value) => {
            setEnteredEmail(value);
            setMessage("");
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
        />
      )}
      <Action
        secondary
        compact
        title={recovery ? "Send a new reset link" : "Resend confirmation email"}
        run={async () => {
          if (lock.current) return;
          lock.current = true;
          setMessage("");
          try {
            const address = accountEmail(email ?? enteredEmail);
            const redirect = authCallbackUrl(recovery);
            if (!supabase)
              throw new Error(
                "Account services are unavailable. Try again later.",
              );
            const { error } = recovery
              ? await supabase.auth.resetPasswordForEmail(address, {
                  redirectTo: redirect,
                })
              : await supabase.auth.resend({
                  type: "signup",
                  email: address,
                  options: { emailRedirectTo: redirect },
                });
            if (error)
              throw new Error(
                error.status === 429
                  ? "Please wait before requesting another link."
                  : "Could not send a new link. Check the address and try again shortly.",
              );
            setMessage(
              "If this address can receive the link, a new email is on its way. Check your inbox and spam folder.",
            );
          } finally {
            lock.current = false;
          }
        }}
      />
      {!!message && (
        <View accessibilityLiveRegion="polite">
          <Txt>{message}</Txt>
        </View>
      )}
    </View>
  );
}
