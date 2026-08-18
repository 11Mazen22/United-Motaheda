import AsyncStorage from "@react-native-async-storage/async-storage";

export async function storageGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    if (__DEV__) console.warn("[storage] read failed:", key, err);
    return null;
  }
}

export async function storageSet<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    if (__DEV__) console.warn("[storage] write failed:", key, err);
  }
}

export async function storageRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (err) {
    if (__DEV__) console.warn("[storage] remove failed:", key, err);
  }
}

export const STORAGE_KEYS = {
  cart:      "united-cart-v1",
  auth:      "united-auth-v1",
  lang:      "united-lang-v1",
  wishlist:  "united-wishlist-v1",
  addresses: "united-addresses-v1",
} as const;
