import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const entryKey = "sb.visitor-entry.v1";
const welcomeKey = "sb.visitor-welcome.v1";
const welcomeHandoffKey = "sb.visitor-welcome-handoff.v1";
const handoffWindowMs = 24 * 60 * 60 * 1000;
let handledThisSession = false;
let seenThisSession = false;
let transferredWelcome = false;
const handledTutorials = new Set<string>();

function read(key: string) {
  return Platform.OS === "web"
    ? localStorage.getItem(key)
    : SecureStore.getItem(key);
}

function write(key: string, value = "yes") {
  if (Platform.OS === "web") localStorage.setItem(key, value);
  else SecureStore.setItem(key, value);
}

export function tutorialHandled(section: string) {
  if (handledTutorials.has(section)) return true;
  try {
    return read(`sb.tutorial-${section}.v1`) === "yes";
  } catch {
    return false;
  }
}

export function finishTutorial(section: string) {
  handledTutorials.add(section);
  try {
    write(`sb.tutorial-${section}.v1`);
  } catch {
    // Keep the dismissal for the current session when storage is unavailable.
  }
}

export function reserveFirstVisitorEntry() {
  try {
    if (read(entryKey)) return false;
    write(entryKey);
    return true;
  } catch {
    return false;
  }
}

export function visitorWelcomeHandled() {
  if (handledThisSession) return true;
  try {
    return read(welcomeKey) === "yes";
  } catch {
    return false;
  }
}

export function finishVisitorWelcome() {
  handledThisSession = true;
  try {
    write(welcomeKey);
  } catch {
    // The dismissal remains available until the app session ends.
  }
}

export function noteVisitorWelcomeSeen() {
  if (seenThisSession) return;
  seenThisSession = true;
  try {
    // An email confirmation can reopen the app in a different tab.
    write(welcomeHandoffKey, String(Date.now() + handoffWindowMs));
  } catch {
    // The current session still records the welcome.
  }
}

export function consumeVisitorWelcomeForNewAccount() {
  if (transferredWelcome) return false;
  let pendingHandoff = false;
  try {
    pendingHandoff = Number(read(welcomeHandoffKey)) > Date.now();
  } catch {
    // The current session still records the welcome.
  }
  if (!seenThisSession && !handledThisSession && !pendingHandoff) return false;
  transferredWelcome = true;
  try {
    write(welcomeHandoffKey, "");
  } catch {
    // Progress for this account still records the handoff.
  }
  return true;
}
