import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { setEntryIntentStorage } from "./entryIntent";

const key = "sb.public-entry.v1";
setEntryIntentStorage({
  read: () =>
    Platform.OS === "web"
      ? localStorage.getItem(key)
      : SecureStore.getItem(key),
  write: (value) => {
    if (Platform.OS === "web") localStorage.setItem(key, value);
    else SecureStore.setItem(key, value);
  },
});
