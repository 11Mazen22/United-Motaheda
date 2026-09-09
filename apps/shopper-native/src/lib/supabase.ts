import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

/**
 * Supabase client configuration.
 *
 * Credentials are read from Expo public env vars (EXPO_PUBLIC_SUPABASE_URL
 * and EXPO_PUBLIC_SUPABASE_ANON_KEY) so different environments (dev /
 * staging / prod) can point at different projects without a code change.
 *
 * The anon key is intentionally public â€” Supabase Row Level Security
 * enforces data access; the key itself carries no elevated privilege.
 * Do NOT use the service_role key on the client.
 *
 * Local fallbacks are provided so `npm test` and builds that do not set
 * the env vars continue to work against the development project.
 */

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

const SUPABASE_URL =
  (process.env["EXPO_PUBLIC_SUPABASE_URL"] as string | undefined) ??
  extra["supabaseUrl"] ??
  "https://gntpxffonjvnvadjclpl.supabase.co";

const SUPABASE_ANON =
  (process.env["EXPO_PUBLIC_SUPABASE_ANON_KEY"] as string | undefined) ??
  extra["supabaseAnonKey"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdudHB4ZmZvbmp2bnZhZGpjbHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MzA4NzEsImV4cCI6MjA5MDQwNjg3MX0.hLDucOsGEci6iWq7eHS6RsQIZEpipBxjuqlep5f9Pcs";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage:          AsyncStorage,
    autoRefreshToken: true,
    persistSession:   true,
    // RN has no window.location for supabase-js to inspect; we handle the
    // incoming deep link manually in AuthProvider via exchangeCodeForSession.
    detectSessionInUrl: false,
    // PKCE issues a `?code=` redirect we can exchange for a session â€” the
    // implicit/token-hash flow doesn't survive an app deep link cleanly on
    // mobile because there's no fragment parser. Stick to PKCE.
    flowType: "pkce",
  },
});
