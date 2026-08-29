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
 * The anon key is intentionally public — Supabase Row Level Security
 * enforces data access; the key itself carries no elevated privilege.
 * Do NOT use the service_role key on the client.
 *
 * Local fallbacks are provided so `npm test` and builds that do not set
 * the env vars continue to work against the development project.
 */

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

// Cutover (2026-08-29): fallback now points at the self-hosted Supabase
// stack (Railway project "efficient-communication") -- migrated off
// Supabase Cloud after their platform had multiple concurrent incidents
// (increased response times, 401s from JWT rejections) that were directly
// blocking signups. Full data migration verified: all 76 public tables +
// auth.users/identities row-count-matched against the source, plus a real
// signup -> browse -> create-order end-to-end pass before this cutover.
const SUPABASE_URL =
  (process.env["EXPO_PUBLIC_SUPABASE_URL"] as string | undefined) ??
  extra["supabaseUrl"] ??
  "https://envoy-production-1cbe.up.railway.app";

const SUPABASE_ANON =
  (process.env["EXPO_PUBLIC_SUPABASE_ANON_KEY"] as string | undefined) ??
  extra["supabaseAnonKey"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4MDA2ODUzLCJleHAiOjIxMDMzNjY4NTN9.cGHr99POxNCCxKSXmYK1ySwsTiRsNMvnrDUV0UBrnoI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage:          AsyncStorage,
    autoRefreshToken: true,
    persistSession:   true,
    // RN has no window.location for supabase-js to inspect; we handle the
    // incoming deep link manually in AuthProvider via exchangeCodeForSession.
    detectSessionInUrl: false,
    // PKCE issues a `?code=` redirect we can exchange for a session — the
    // implicit/token-hash flow doesn't survive an app deep link cleanly on
    // mobile because there's no fragment parser. Stick to PKCE.
    flowType: "pkce",
  },
});
