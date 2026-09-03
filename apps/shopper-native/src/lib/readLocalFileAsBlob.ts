import { Platform } from "react-native";

/**
 * Reads a local file URI (from expo-image-picker/expo-document-picker) into
 * a Blob suitable for supabase-js's `.storage.upload()`.
 *
 * On native, uses expo-file-system's `File` class (which implements the
 * Blob interface via native code) instead of `fetch(uri).blob()`. The
 * fetch-based read is a well-documented source of intermittent "Network
 * request failed" errors on Android for local `file://`/content-provider
 * URIs — confirmed live: profile-photo upload failed with exactly that
 * error while the same request, made directly against the storage API with
 * a real user's token, succeeded cleanly (ruling out the backend). Native
 * file access avoids the RN fetch polyfill's handling of local URIs
 * entirely, which is the actual problem class this class of bug falls
 * into.
 *
 * On web there is no native filesystem to read from — the picked URI is
 * already a `blob:`/`data:` URL the browser itself created, which `fetch`
 * handles natively and reliably, so this keeps the original approach there.
 */
export async function readLocalFileAsBlob(localUri: string): Promise<Blob> {
  if (Platform.OS === "web") {
    const response = await fetch(localUri);
    if (!response.ok) throw new Error("read_failed");
    return response.blob();
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports -- native-only import, must not be evaluated on web
  const { File } = require("expo-file-system") as typeof import("expo-file-system");
  const file = new File(localUri);
  if (!file.exists) throw new Error("read_failed");
  return file as unknown as Blob;
}
