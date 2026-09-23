/**

 * Notifications API service.

 *

 * Wraps Supabase calls with:

 *  - Cursor pagination on `created_at` for infinite scroll

 *  - camelCase ↔ snake_case row mapping

 *  - Preferences read/write against profiles.notification_preferences (JSONB)

 *  - Push token registration (upsert keyed by user_id + token)

 */



import { supabase } from "@/lib/supabase";

import {

  DEFAULT_PREFERENCES,

  type AppNotification,

  type NotificationPage,

  type NotificationPreferences,

} from "./types";



const PAGE_SIZE = 20;



// ─── Row mapping ────────────────────────────────────────────────────────────



interface NotificationRow {

  id:         string;

  user_id:    string;

  type:       string;

  category:   string | null;

  title:      string;

  body:       string;

  data:       unknown;

  action_url: string | null;

  is_read:    boolean;

  created_at: string;

}



function mapRow(row: NotificationRow): AppNotification {

  return {

    id:        row.id,

    userId:    row.user_id,

    type:      (row.type as AppNotification["type"]) ?? "system",

    category:  (row.category as AppNotification["category"]) ?? null,

    title:     row.title,

    body:      row.body,

    data:      (row.data as Record<string, unknown>) ?? {},

    actionUrl: row.action_url,

    isRead:    row.is_read,

    createdAt: row.created_at,

  };

}



// ─── Notifications ──────────────────────────────────────────────────────────



export async function fetchNotificationsPage(

  userId: string,

  cursor: string | null = null,

  pageSize: number = PAGE_SIZE,

): Promise<NotificationPage> {

  let query = supabase

    .from("notifications")

    .select("*")

    .eq("user_id", userId)

    .order("created_at", { ascending: false })

    .limit(pageSize + 1); // +1 to know if there's a next page



  if (cursor) {

    query = query.lt("created_at", cursor);

  }



  const { data, error } = await query;

  if (error) throw error;



  const rows = (data ?? []) as NotificationRow[];

  const hasNext = rows.length > pageSize;

  const trimmed = hasNext ? rows.slice(0, pageSize) : rows;

  const items = trimmed.map(mapRow);



  return {

    items,

    nextCursor: hasNext ? trimmed[trimmed.length - 1].created_at : null,

  };

}



export async function fetchUnreadCount(userId: string): Promise<number> {

  const { count, error } = await supabase

    .from("notifications")

    .select("*", { count: "exact", head: true })

    .eq("user_id", userId)

    .eq("is_read", false);

  if (error) throw error;

  return count ?? 0;

}



export async function markNotificationRead(id: string, userId: string): Promise<void> {

  const { error } = await supabase

    .from("notifications")

    .update({ is_read: true })

    .eq("id", id)

    .eq("user_id", userId);



  if (error) throw error;

}



export async function markAllNotificationsRead(userId: string): Promise<void> {

  const { error } = await supabase

    .from("notifications")

    .update({ is_read: true })

    .eq("user_id", userId)

    .eq("is_read", false);

  if (error) throw error;

}



export async function deleteNotification(id: string, userId: string): Promise<void> {

  const { error } = await supabase

    .from("notifications")

    .delete()

    .eq("id", id)

    .eq("user_id", userId);

  if (error) throw error;

}



// ─── Preferences ────────────────────────────────────────────────────────────



export async function fetchNotificationPreferences(

  userId: string,

): Promise<NotificationPreferences> {

  const { data, error } = await supabase

    .from("profiles")

    .select("notification_preferences")

    .eq("id", userId)

    .maybeSingle();



  if (error || !data?.notification_preferences) {

    return DEFAULT_PREFERENCES;

  }



  const stored = data.notification_preferences as Partial<NotificationPreferences>;

  return {

    channels:   { ...DEFAULT_PREFERENCES.channels,   ...(stored.channels   ?? {}) },

    categories: { ...DEFAULT_PREFERENCES.categories, ...(stored.categories ?? {}) },

  };

}



export async function updateNotificationPreferences(

  userId: string,

  patch: Partial<NotificationPreferences>,

): Promise<NotificationPreferences> {

  const current = await fetchNotificationPreferences(userId);

  const next: NotificationPreferences = {

    channels:   { ...current.channels,   ...(patch.channels   ?? {}) },

    categories: { ...current.categories, ...(patch.categories ?? {}) },

  };



  const { error } = await supabase

    .from("profiles")

    .update({ notification_preferences: next })

    .eq("id", userId);

  if (error) throw error;
  return next;
}

// ─── Push tokens ────────────────────────────────────────────────────────────

// notification_tokens (not user_devices) is canonical for Expo push tokens
// -- both delivery workers (the Supabase Edge Function and apps/api's
// NotificationWorker) read from here. See services/pushNotificationManager.ts,
// which is the actual registration path this app uses; these are kept as
// the public unregister surface for a future "sign out everywhere"-style
// feature.

export async function unregisterAllPushTokensForUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notification_tokens")
    .delete()
    .eq("user_id", userId);
  if (error) console.error("[notifications] unregisterAllPushTokensForUser failed:", error.message);
}

export async function registerPushToken(input: {
  userId: string;
  expoPushToken: string;
  platform: "ios" | "android" | "web";
  deviceId?: string;
  appVersion?: string;
}): Promise<void> {
  // Goes through register_push_token rather than a raw upsert -- a token
  // re-registering under a different account needs to reassign the
  // existing row, and a raw client update on a row owned by someone else
  // is correctly blocked by RLS. The RPC derives the owner from auth.uid()
  // itself; input.userId is not sent (there is no way to make the RPC
  // trust a client-supplied user_id without reopening the same hijack risk
  // this exists to close).
  const { error } = await supabase.rpc("register_push_token", {
    p_expo_push_token: input.expoPushToken,
    p_platform: input.platform,
    p_device_id: input.deviceId ?? null,
    p_app_version: input.appVersion,
  });
  if (error) throw error;
}

export async function unregisterPushToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from("notification_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("expo_push_token", token);
  if (error) console.error("[notifications] unregisterPushToken failed:", error.message);
}

/**
 * Register a native device for push notifications (FCM).
 *
 * This endpoint upserts a row in `user_devices` with the provided token and metadata.
 */
export async function registerDevice(params: {
  userId: string;
  deviceToken: string;
  platform: 'ios' | 'android' | 'web';
  appVersion?: string;
  deviceModel?: string;
  osVersion?: string;
}): Promise<void> {
  const { deviceToken, platform, appVersion } = params;
  const deviceId = params.deviceModel
    ? `${platform}:${params.deviceModel}:${params.osVersion ?? "unknown"}`
    : `${platform}:${deviceToken}`;
  const { error } = await supabase.rpc("register_device_push_token", {
    p_device_id: deviceId,
    p_push_token: deviceToken,
    p_platform: platform,
    p_app_version: appVersion ?? null,
  });
  if (error) throw error;
}
