import { Linking, Platform } from "react-native";
export async function inviteContact(username: string) {
  const { Contact, requestPermissionsAsync } =
    await import("expo-contacts").catch(() => {
      throw new Error(
        "Update your installed app to invite contacts. You can still share your invitation link.",
      );
    });
  const permission = await requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Contacts access is off. You can still share your invitation link or add a friend by username.",
    );
  const contact = await Contact.presentPicker();
  if (!contact) return;
  const phones = await contact.getPhones();
  const phone = phones.find((p) => p.number)?.number?.replace(/[^+0-9]/g, "");
  if (!phone)
    throw new Error(
      "This contact has no phone number. Use Share my invitation link instead.",
    );
  const message = `Let's make a little plan on Squad Beacon! Add @${username}: squadbeacon://invite?username=${encodeURIComponent(username)}`;
  const url = `sms:${phone}${Platform.OS === "ios" ? "&" : "?"}body=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(url);
  } catch {
    throw new Error(
      "Messaging is unavailable on this device. Share your invitation link instead.",
    );
  }
}
