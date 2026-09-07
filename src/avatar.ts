import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "./supabase";
export async function uploadAvatar(userId: string) {
  if (!supabase)
    throw new Error("Connect an account to upload a profile photo.");
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
    exif: false,
  });
  if (picked.canceled) return;
  const asset = picked.assets[0],
    side = Math.min(asset.width, asset.height);
  const context = ImageManipulator.manipulate(asset.uri);
  context
    .crop({
      originX: Math.floor((asset.width - side) / 2),
      originY: Math.floor((asset.height - side) / 2),
      width: side,
      height: side,
    })
    .resize({ width: 320, height: 320 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.7,
    base64: true,
  });
  if (!saved.base64) throw new Error("Could not prepare the photo.");
  const bytes = Uint8Array.from(atob(saved.base64), (char) =>
    char.charCodeAt(0),
  );
  if (bytes.length > 262144) throw new Error("Choose a smaller photo.");
  const { error } = await supabase.storage
    .from("avatars")
    .upload(userId + "/avatar.jpg", bytes.buffer, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "0",
    });
  if (error) throw error;
}
