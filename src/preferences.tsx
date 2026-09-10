import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const key = "beacon.show-avatars";
const Preferences = createContext({
  showAvatars: true,
  ready: false,
  error: "",
  setShowAvatars: (_value: boolean) => {},
});
export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showAvatars, setValue] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    const read = async () => {
      try {
        const saved =
          Platform.OS === "web"
            ? localStorage.getItem(key)
            : await SecureStore.getItemAsync(key);
        if (active) setValue(saved !== "false");
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
  const setShowAvatars = (value: boolean) => {
    setValue(value);
    setError("");
    writes.current = writes.current.then(async () => {
      try {
        if (Platform.OS === "web") localStorage.setItem(key, String(value));
        else await SecureStore.setItemAsync(key, String(value));
      } catch {
        setError(
          "Changed for now. This device could not save your preference.",
        );
      }
    });
  };
  return (
    <Preferences.Provider value={{ showAvatars, ready, error, setShowAvatars }}>
      {children}
    </Preferences.Provider>
  );
}
export const usePreferences = () => useContext(Preferences);
