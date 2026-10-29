import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { router, useLocalSearchParams, type Href } from "expo-router";
import Head from "expo-router/head";
import { supabase } from "@/src/shared/supabase";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Field, Screen, Txt } from "@/src/shared/ui";
import { ChatKeyboardFrame } from "@/src/features/messages/ChatKeyboard";
import { consumeEntryIntent } from "./entryIntent";
import {
  completeAuthLink,
  existingAuthLink,
  type LinkParams,
} from "./authLink";
import { usableAuthLink } from "./accountEntry";
import { ResendAuthEmail } from "./ResendAuthEmail";

const subscribe = () => () => {};
export function AuthConfirm() {
  return <AuthCallback requireConfirmation />;
}

export default function AuthCallback({
  requireConfirmation = false,
}: { requireConfirmation?: boolean } = {}) {
  const params = useLocalSearchParams<LinkParams>();
  const key = JSON.stringify([
    params.code,
    params.token_hash,
    params.type,
    params.error_description,
  ]);
  return (
    <AuthCallbackBody
      key={key}
      params={params}
      requireConfirmation={requireConfirmation}
    />
  );
}

function AuthCallbackBody({
  params,
  requireConfirmation,
}: {
  params: LinkParams;
  requireConfirmation: boolean;
}) {
  const { getViewerEpoch } = useBeacon();
  const [message, setMessage] = useState(
    requireConfirmation
      ? "Confirm this account link to continue into Squad Beacon."
      : "Checking your account link…",
  );
  const [started, setStarted] = useState(
    () => !requireConfirmation || !!existingAuthLink(params),
  );
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const usable = hydrated && usableAuthLink(params);
  const [ready, setReady] = useState(false);
  const [finished, setFinished] = useState(false);
  const [password, setPassword] = useState("");
  const lock = useRef(false);
  const owner = useRef<{ id: string; epoch: number } | null>(null);
  const key = JSON.stringify([
    params.code,
    params.token_hash,
    params.type,
    params.error_description,
  ]);
  useEffect(() => {
    if (!started) return;
    let active = true;
    void completeAuthLink(JSON.parse(JSON.stringify(params)))
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
            "This link could not be used. It may be invalid, expired, or already used. Request a fresh link below.",
          );
          setFinished(true);
        }
      });
    return () => {
      active = false;
    };
    // The serialized token tuple prevents rerunning single-use exchanges on rerenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, getViewerEpoch, started]);
  const invalid = requireConfirmation && hydrated && !usable && !started;
  return (
    <ChatKeyboardFrame>
      <Screen
        title={
          ready
            ? "Reset password"
            : requireConfirmation
              ? "Confirm account"
              : "Account link"
        }
        eyebrow="ACCOUNT"
        compactHeader
        create={false}
        headerAction={<></>}
      >
        <Head>
          <meta name="referrer" content="no-referrer" />
        </Head>
        <Txt>
          {invalid
            ? "This link is incomplete or invalid. Request a fresh link below."
            : started && !ready && !finished && requireConfirmation
              ? "Confirming your account…"
              : message}
        </Txt>
        {requireConfirmation && !started && (
          <Button
            title="Confirm and continue"
            disabled={!usable}
            onPress={() => {
              if (usable) setStarted(true);
            }}
          />
        )}
        {(finished || invalid) && (
          <ResendAuthEmail recovery={params.type === "recovery"} />
        )}
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
        {(finished || ready || invalid) && (
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
