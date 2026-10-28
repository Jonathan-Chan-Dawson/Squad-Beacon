import React, { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { supabase } from "@/src/shared/supabase";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Field, Screen, Txt } from "@/src/shared/ui";
import { ChatKeyboardFrame } from "@/src/features/messages/ChatKeyboard";
import { consumeEntryIntent } from "./entryIntent";
import { completeAuthLink, type LinkParams } from "./authLink";

export default function AuthCallback() {
  const params = useLocalSearchParams<LinkParams>();
  const key = JSON.stringify([
    params.code,
    params.token_hash,
    params.type,
    params.error_description,
  ]);
  return <AuthCallbackBody key={key} params={params} />;
}

function AuthCallbackBody({ params }: { params: LinkParams }) {
  const { getViewerEpoch } = useBeacon();
  const [message, setMessage] = useState("Checking your account link…");
  const [ready, setReady] = useState(false);
  const [finished, setFinished] = useState(false);
  const [password, setPassword] = useState("");
  const lock = useRef(false);
  const owner = useRef<{ id: string; epoch: number } | null>(null);
  const operation = useRef<{
    key: string;
    promise: ReturnType<typeof completeAuthLink>;
  } | null>(null);
  const key = JSON.stringify([
    params.code,
    params.token_hash,
    params.type,
    params.error_description,
  ]);
  useEffect(() => {
    let active = true;
    if (operation.current?.key !== key)
      operation.current = {
        key,
        promise: completeAuthLink(JSON.parse(JSON.stringify(params))),
      };
    void operation.current.promise
      .then(async ({ session, recovery }) => {
        if (session) {
          const current = await supabase!.auth.getSession();
          if (
            current.error ||
            current.data.session?.user.id !== session.user.id
          )
            throw new Error("Your account changed.");
        }
        if (!active) return;
        if (!session) {
          setMessage(
            "Your link was processed, but you are not signed in. Sign in to continue, or request a new link.",
          );
          setFinished(true);
        } else if (recovery) {
          owner.current = { id: session.user.id, epoch: getViewerEpoch() };
          setReady(true);
          setMessage("Choose a new password with at least 10 characters.");
        } else router.replace(consumeEntryIntent() as Href);
      })
      .catch(() => {
        if (active) {
          setMessage(
            "This link could not be used. It may have expired or opened on another device. Return to sign in to request a fresh link.",
          );
          setFinished(true);
        }
      });
    return () => {
      active = false;
    };
    // The serialized token tuple prevents rerunning single-use exchanges on rerenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, getViewerEpoch]);
  return (
    <ChatKeyboardFrame>
      <Screen
        title={ready ? "Reset your password" : "Account link"}
        eyebrow="ACCOUNT"
        compactHeader
        create={false}
      >
        <Txt>{message}</Txt>
        {ready && (
          <>
            <Field
              label="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Action
              title="Set new password"
              run={async () => {
                if (lock.current || !supabase) return;
                lock.current = true;
                try {
                  if (password.length < 10)
                    throw new Error("Use at least 10 characters.");
                  const expected = owner.current;
                  const assertOwner = () => {
                    if (!expected || expected.epoch !== getViewerEpoch())
                      throw new Error(
                        "Your account changed. Request a fresh reset link.",
                      );
                  };
                  assertOwner();
                  const { data, error: sessionError } =
                    await supabase.auth.getSession();
                  assertOwner();
                  if (sessionError || data.session?.user.id !== expected?.id)
                    throw new Error(
                      "Sign in again or request a fresh reset link.",
                    );
                  const { error } = await supabase.auth.updateUser({
                    password,
                  });
                  assertOwner();
                  if (error) throw error;
                  router.replace(consumeEntryIntent() as Href);
                } finally {
                  lock.current = false;
                }
              }}
            />
          </>
        )}
        {(finished || ready) && (
          <Button
            secondary
            compact
            title={ready ? "Cancel password reset" : "Return to sign in"}
            onPress={() => router.replace(consumeEntryIntent() as Href)}
          />
        )}
      </Screen>
    </ChatKeyboardFrame>
  );
}
