import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import useDeviceAppearance from "@/src/platform/useDeviceAppearance";

import {
  getInitialThemePreferences,
  resolveAppearanceMode,
  type AppearanceMode,
  type ResolvedAppearance,
  type ThemeName,
} from "@/src/shared/themes";

const avatarsKey = "beacon.show-avatars";
const themeKey = "beacon.theme";
const appearanceKey = "beacon.appearance";
type PreferencesValue = {
  theme: ThemeName;
  setTheme: (value: ThemeName) => void;
  appearanceMode: AppearanceMode;
  resolvedAppearance: ResolvedAppearance;
  setAppearanceMode: (value: AppearanceMode) => void;
  showAvatars: boolean;
  ready: boolean;
  error: string;
  setShowAvatars: (value: boolean) => void;
};
const Preferences = createContext<PreferencesValue>({
  theme: "Midnight",
  setTheme: () => {},
  appearanceMode: "dark",
  resolvedAppearance: "dark",
  setAppearanceMode: () => {},
  showAvatars: true,
  ready: false,
  error: "",
  setShowAvatars: () => {},
});
export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const deviceAppearance = useDeviceAppearance();
  const [theme, setThemeValue] = useState<ThemeName>("Midnight");
  const [appearanceMode, setAppearanceModeValue] =
    useState<AppearanceMode>("dark");
  const [showAvatars, setValue] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    const read = async () => {
      try {
        const get = (storageKey: string) =>
          Platform.OS === "web"
            ? Promise.resolve(localStorage.getItem(storageKey))
            : SecureStore.getItemAsync(storageKey);
        const [saved, savedTheme, savedAppearance] = await Promise.all([
          get(avatarsKey),
          get(themeKey),
          get(appearanceKey),
        ]);
        if (active) {
          setValue(saved !== "false");
          const initial = getInitialThemePreferences(
            savedTheme,
            savedAppearance,
          );
          setThemeValue(initial.theme);
          setAppearanceModeValue(initial.appearanceMode);
        }
      } catch {
        if (active) setError("Display settings could not be loaded.");
      } finally {
        if (active) setReady(true);
      }
    };
    void read();
    return () => {
      active = false;
    };
  }, []);
  const persist = (
    storageKey: string,
    value: string,
    failureMessage = "Changed for now. This device could not save your preference.",
  ) => {
    writes.current = writes.current.then(async () => {
      try {
        if (Platform.OS === "web") localStorage.setItem(storageKey, value);
        else await SecureStore.setItemAsync(storageKey, value);
      } catch {
        setError(failureMessage);
      }
    });
  };
  const setShowAvatars = (value: boolean) => {
    setValue(value);
    setError("");
    persist(avatarsKey, String(value));
  };
  const setTheme = (value: ThemeName) => {
    setThemeValue(value);
    setError("");
    persist(themeKey, value, "Theme changed for now; this device could not save it.");
    // Persist the resolved legacy mode too, so changing a legacy theme cannot
    // silently switch its appearance the next time preferences are loaded.
    persist(
      appearanceKey,
      appearanceMode,
      "Theme changed for now; this device could not save it.",
    );
  };
  const setAppearanceMode = (value: AppearanceMode) => {
    setAppearanceModeValue(value);
    setError("");
    persist(
      appearanceKey,
      value,
      "Appearance changed for now; this device could not save it.",
    );
  };
  const resolvedAppearance = resolveAppearanceMode(
    appearanceMode,
    deviceAppearance,
  );
  return (
    <Preferences.Provider
      value={{
        theme,
        setTheme,
        appearanceMode,
        resolvedAppearance,
        setAppearanceMode,
        showAvatars,
        ready,
        error,
        setShowAvatars,
      }}
    >
      {children}
    </Preferences.Provider>
  );
}
export const usePreferences = () => useContext(Preferences);
