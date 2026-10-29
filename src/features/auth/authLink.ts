import { supabase } from "@/src/shared/supabase";
import { usableAuthLink } from "./accountEntry";

export type LinkParams = {
  code?: string;
  token_hash?: string;
  type?: string;
  error_description?: string;
};
async function completeLink(params: LinkParams) {
  if (!supabase)
    throw new Error("Account services are unavailable. Try again later.");
  if (params.error_description)
    throw new Error(
      "This link is invalid or expired. Request a fresh email link.",
    );
  if (!usableAuthLink(params))
    throw new Error("This link is incomplete. Request a fresh email link.");
  let recovery = false;
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") recovery = true;
  });
  try {
    let linkedUser: string | undefined;
    if (params.code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        params.code,
      );
      if (error) throw error;
      linkedUser = data.session?.user.id;
    } else if (
      params.token_hash &&
      (params.type === "recovery" ||
        params.type === "signup" ||
        params.type === "email")
    ) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: params.token_hash,
        type: params.type,
      });
      if (error) throw error;
      linkedUser = data.session?.user.id;
      recovery = params.type === "recovery";
    } else
      throw new Error("This link is incomplete. Request a fresh email link.");
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (linkedUser && data.session?.user.id !== linkedUser)
      throw new Error(
        "Your account changed. Request a fresh link to continue.",
      );
    return { session: linkedUser ? data.session : null, recovery };
  } finally {
    subscription.unsubscribe();
  }
}

// Account providers remount their children when a link establishes a session.
// Reuse this single in-memory exchange so a one-use token is never consumed twice.
let operation: {
  key: string;
  promise: ReturnType<typeof completeLink>;
} | null = null;
function linkKey(params: LinkParams) {
  return JSON.stringify([
    params.code,
    params.token_hash,
    params.type,
    params.error_description,
  ]);
}
/** Only resumes an exchange already initiated by the user for this exact link. */
export function existingAuthLink(params: LinkParams) {
  return operation?.key === linkKey(params) ? operation.promise : null;
}
export function completeAuthLink(params: LinkParams) {
  const key = linkKey(params);
  if (operation?.key !== key)
    operation = { key, promise: completeLink(params) };
  return operation.promise;
}
export function clearAuthLink() {
  operation = null;
}
