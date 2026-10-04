import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "@/src/shared/supabase";
import {
  MAX_MEMORY_IMAGE_BYTES,
  MAX_MEMORY_VIDEO_BYTES,
  MAX_MEMORY_VIDEO_SECONDS,
  type BeaconMemoryMediaType,
} from "./models";

export type PickedBeaconMedia = {
  id: string;
  uri: string;
  mediaType: BeaconMemoryMediaType;
  contentType: string;
  durationSeconds: number | null;
  size: number | null;
};

function fileExtension(contentType: string) {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "video/quicktime":
      return "mov";
    default:
      return "mp4";
  }
}

export async function pickBeaconMedia(): Promise<PickedBeaconMedia | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    allowsEditing: false,
    quality: 0.82,
    videoMaxDuration: MAX_MEMORY_VIDEO_SECONDS,
    exif: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const video = asset.type === "video";
  if (video) {
    const contentType = asset.mimeType?.toLowerCase();
    if (contentType !== "video/mp4" && contentType !== "video/quicktime")
      throw new Error("Choose an MP4 or QuickTime video.");
    const durationSeconds =
      asset.duration == null ? null : Math.ceil(asset.duration / 1000);
    if (
      durationSeconds == null ||
      durationSeconds < 1 ||
      durationSeconds > MAX_MEMORY_VIDEO_SECONDS
    )
      throw new Error(
        `Videos must be ${MAX_MEMORY_VIDEO_SECONDS} seconds or shorter.`,
      );
    if (asset.fileSize != null && asset.fileSize > MAX_MEMORY_VIDEO_BYTES)
      throw new Error("Choose a video under 24 MB.");
    return {
      id: Crypto.randomUUID(),
      uri: asset.uri,
      mediaType: "video",
      contentType,
      durationSeconds,
      size: asset.fileSize ?? null,
    };
  }

  const context = ImageManipulator.manipulate(asset.uri);
  context.resize({ width: Math.min(asset.width, 1920) });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.78,
  });
  const response = await fetch(saved.uri);
  if (!response.ok) throw new Error("Could not prepare the selected photo.");
  const size = (await response.clone().arrayBuffer()).byteLength;
  if (size > MAX_MEMORY_IMAGE_BYTES)
    throw new Error("Choose a photo that can be compressed under 8 MB.");
  return {
    id: Crypto.randomUUID(),
    uri: saved.uri,
    mediaType: "image",
    contentType: "image/jpeg",
    durationSeconds: null,
    size,
  };
}

export function memoryObjectPath(
  activityId: string,
  userId: string,
  media: PickedBeaconMedia,
) {
  return `${activityId}/${userId}/${media.id}.${fileExtension(media.contentType)}`;
}

export async function uploadBeaconMedia(
  path: string,
  media: PickedBeaconMedia,
) {
  if (!supabase) throw new Error("Connect an account to add Beacon Memories.");
  const response = await fetch(media.uri);
  if (!response.ok) throw new Error("Could not read the selected media.");
  const bytes = await response.arrayBuffer();
  const maximum =
    media.mediaType === "image"
      ? MAX_MEMORY_IMAGE_BYTES
      : MAX_MEMORY_VIDEO_BYTES;
  if (bytes.byteLength > maximum)
    throw new Error(
      media.mediaType === "image"
        ? "Choose a photo under 8 MB."
        : "Choose a video under 24 MB.",
    );
  const { error } = await supabase.storage
    .from("beacon-memories")
    .upload(path, bytes, {
      contentType: media.contentType,
      upsert: false,
      cacheControl: "0",
    });
  if (error) {
    const duplicate =
      error.message.toLowerCase().includes("already exists") ||
      ("statusCode" in error && error.statusCode === "409");
    if (!duplicate) throw error;
  }
}

export async function removeBeaconMedia(path: string) {
  if (!supabase) return;
  const { error } = await supabase.storage
    .from("beacon-memories")
    .remove([path]);
  if (error) throw error;
}

export async function signedBeaconMediaUrl(path: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from("beacon-memories")
    .createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}
