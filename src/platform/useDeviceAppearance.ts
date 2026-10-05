import { useColorScheme } from "react-native";

export default function useDeviceAppearance():
  "light" | "dark" | "unspecified" {
  const appearance = useColorScheme();
  return appearance === "light" || appearance === "dark"
    ? appearance
    : "unspecified";
}
