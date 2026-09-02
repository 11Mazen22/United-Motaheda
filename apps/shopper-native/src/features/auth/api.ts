import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";
import type { Role } from "./role";

/** Real Android/iOS App Link domain (see assets/web/.well-known/assetlinks.json
 *  and app.json's android.intentFilters). This — not the bare `shopper://`
 *  scheme — is what production email links must point at.
 *
 *  Root cause this fixes: a bare custom-scheme link inside an email is only
 *  as reliable as whatever app opened it. Confirmed live: tapping the
 *  reset-password button from inside Gmail's own embedded browser does not
 *  hand `shopper://...` off to the app the way a real browser does — it
 *  silently stays on the web origin instead. A verified HTTPS App Link is
 *  what every production app (banking apps, Uber, etc.) uses for exactly
 *  this reason: the OS intercepts it before ANY browser — embedded or not —
 *  gets a chance to mishandle it. Falls back to `shopper://` in dev, where
 *  the app isn't installed with a build carrying the verified intent filter
 *  anyway (Expo Go / a plain dev client uses the exp:// tunnel instead). */
const APP_LINK_BASE = "https://united-motaheda-production.up.railway.app";

/** Deep link Supabase should send the user back to after they tap the
 *  email-confirmation link. In dev this resolves to an Expo Go / dev-client
 *  URL (`exp://192.168...:8081/--/auth-callback`); in production it's the
 *  verified App Link above. Either way, AuthProvider's deep-link listener
 *  picks it up and exchanges the `?code=` param for a real session.
 *
 *  IMPORTANT (one-time Supabase dashboard config):
 *    Auth → URL Configuration → Redirect URLs (GOTRUE_URI_ALLOW_LIST) must
 *    include APP_LINK_BASE + "/**", shopper://**, and exp://* (dev). */
export const EMAIL_REDIRECT_URL = __DEV__ ? Linking.createURL("auth-callback") : `${APP_LINK_BASE}/auth-callback`;

export interface AuthUser {
  id:        string;
  email:     string;
  name?:     string;
  avatarUrl?: string;
  /** From public.profiles.role — fetched separately after auth resolves
   *  (see AuthProvider in ./context.tsx), since Supabase Auth's session
   *  object itself has no notion of app-level role. Undefined until that
   *  fetch completes or if it fails; never assume a customer default here,
   *  since callers gating on 'driver' must wait for a real value. */
  role?: Role;
}

export interface SignUpResult extends AuthUser {
  /** True when signUp returned an active session (email confirmation is
   *  disabled in the Supabase dashboard, OR the user was already confirmed).
   *  False when the user must click an email confirmation link before they
   *  can do anything that requires authorization (phone OTP, checkout, etc.). */
  hasSession: boolean;
}

// Known Supabase auth error codes/messages that mean "the request was
// understood and genuinely rejected" (wrong password, duplicate email, weak
// password, etc.) — retrying these changes nothing and would only delay
// showing the user the real, actionable error.
const TERMINAL_AUTH_PATTERNS = [
  "invalid_credentials", "invalid login credentials",
  "user_already_exists", "already registered", "already exists",
  "weak_password", "email_address_invalid", "invalid email",
  "email_not_confirmed", "email not confirmed",
  "over_email_send_rate_limit", "over_request_rate_limit", "rate limit",
  "signup_disabled", "signups not allowed",
  // 504 server-side timeout — retrying immediately won't help, the server
  // needs a moment to recover. Surface a friendly message immediately.
  "request_timeout", "timed out, please retry",
] as const;

function isTerminalAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  const haystack = `${e.code ?? ""} ${e.message ?? ""}`.toLowerCase();
  return TERMINAL_AUTH_PATTERNS.some((p) => haystack.includes(p));
}

/**
 * Retries an auth call once after a short delay for anything that is NOT a
 * recognized "genuinely rejected" error (see isTerminalAuthError). Supabase
 * has had an ongoing platform-side incident (status.supabase.com: "401
 * errors due to JWT rejections") where a valid request gets a bare,
 * unexplained 401/network error and simply succeeds on retry — their own
 * incident notes say as much ("in most cases, waiting and refreshing is
 * successful"). This can't fix Supabase being down, but it means a single
 * transient blip on their end no longer surfaces as a failure here.
 */
async function withAuthRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isTerminalAuthError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    return fn();
  }
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const { data, error } = await withAuthRetry(() => supabase.auth.signInWithPassword({ email, password }));
  if (error) throw error;
  const user = data.user;
  return {
    id:    user.id,
    email: user.email ?? "",
    name:  user.user_metadata?.name as string | undefined,
  };
}

export async function signUp(
  email: string,
  password: string,
  name: string,
  phone?: string,
): Promise<SignUpResult> {
  const phoneClean = phone?.replace(/\D/g, "").slice(0, 11) || undefined;

  let signUpData: Awaited<ReturnType<typeof supabase.auth.signUp>>["data"] | null = null;
  let signUpError: Awaited<ReturnType<typeof supabase.auth.signUp>>["error"] = null;

  try {
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: EMAIL_REDIRECT_URL,
        data: { name, phone: phoneClean },
      },
    });
    signUpData = result.data;
    signUpError = result.error;
  } catch (rawErr) {
    // GoTrue on Railway sometimes returns a 504 timeout even though the
    // account was successfully created (the SMTP send blocks the response).
    // In that case, a sign-in immediately after will succeed — we try that
    // as a recovery path before surfacing the timeout to the user.
    const errMsg = (rawErr instanceof Error ? rawErr.message : String(rawErr ?? "")).toLowerCase();
    if (errMsg.includes("request_timeout") || errMsg.includes("timed out")) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const recovery = await supabase.auth.signInWithPassword({ email, password });
        if (!recovery.error && recovery.data.user) {
          return {
            id:         recovery.data.user.id,
            email:      recovery.data.user.email ?? "",
            name,
            hasSession: recovery.data.session !== null,
          };
        }
      } catch {
        // Recovery sign-in also failed — account wasn't created.
      }
    }
    throw rawErr;
  }

  if (signUpError) throw signUpError;
  if (!signUpData?.user) throw new Error("Account was not created, please try again.");

  // Profile row creation is handled server-side by the `handle_new_user`
  // trigger on auth.users. We used to also upsert client-side here as a
  // safety net, but that fired BEFORE a session existed (Supabase doesn't
  // issue a session when email confirmation is enabled), tripping a
  // visible RLS 401. The trigger is the canonical path now — if it's
  // missing, run the backfill SQL in supabase/migrations/.

  return {
    id:         signUpData.user.id,
    email:      signUpData.user.email ?? "",
    name,
    hasSession: signUpData.session !== null,
  };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Re-sends the signup confirmation email for an address that registered but
 * never confirmed. Supabase enforces its own per-address rate limit here
 * (`over_email_send_rate_limit`), which is why the calling screen also runs a
 * local cooldown — so a user who taps twice sees a friendly countdown rather
 * than a raw provider error.
 */
export async function resendConfirmationEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type:  "signup",
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: EMAIL_REDIRECT_URL },
  });
  if (error) throw error;
}

/** Deep link Supabase sends the user to after tapping "Reset Password" --
 *  the verified App Link in production, see EMAIL_REDIRECT_URL above for why. */
export const RESET_PASSWORD_REDIRECT_URL = __DEV__ ? Linking.createURL("reset-password") : `${APP_LINK_BASE}/reset-password`;

/**
 * Sends a password-reset email to the given address.
 * On success the user receives an email containing a PKCE link that
 * opens the app at `shopper://reset-password?code=<code>`.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: RESET_PASSWORD_REDIRECT_URL,
  });
  if (error) throw error;
}

/**
 * Sets a new password for the currently-authenticated recovery session.
 * Must be called after `exchangeCodeForSession` has succeeded.
 * Also callable from the in-app Change Password screen for an authenticated user.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/**
 * Updates the authenticated user's display name and/or phone number.
 *
 * Writes to two places:
 *   1. `auth.users.user_metadata` — picked up by `onAuthStateChange` so the
 *      auth context (and profile hero) refresh automatically with no extra call.
 *   2. `public.profiles` — keeps the profiles table in sync for checkout
 *      and other server-side reads.
 */
export async function updateProfile(params: {
  name?:      string;
  phone?:     string;
  /** No public.profiles column exists for this (checked live) -- avatars
   *  only ever lived in auth.users.user_metadata.avatar_url, the same field
   *  Google OAuth itself populates, which is what applyAuthUser already
   *  reads for AuthUser.avatarUrl. So this only ever writes to auth metadata,
   *  never to the profiles table update below. */
  avatarUrl?: string;
}): Promise<void> {
  const { data: { user }, error: getError } = await supabase.auth.getUser();
  if (getError) throw getError;
  if (!user) throw new Error("Not authenticated");

  const meta: Record<string, string> = {};
  if (params.name      !== undefined) meta.name       = params.name.trim();
  if (params.phone     !== undefined) meta.phone      = params.phone.replace(/\D/g, "").slice(0, 11);
  if (params.avatarUrl !== undefined) meta.avatar_url = params.avatarUrl;

  if (Object.keys(meta).length > 0) {
    const { error: authError } = await supabase.auth.updateUser({ data: meta });
    if (authError) throw authError;
  }

  const cols: Record<string, string | null> = {};
  if (params.name  !== undefined) cols.full_name = params.name.trim();
  if (params.phone !== undefined) cols.phone     = params.phone.replace(/\D/g, "").slice(0, 11) || null;

  if (Object.keys(cols).length > 0) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update(cols)
      .eq("id", user.id);
    if (profileError) throw profileError;
  }
}

/**
 * Uploads a new profile photo to the "avatars" bucket (public — same
 * directly-displayable-without-a-signed-URL reasoning as Google's own
 * avatar_url) and returns its public URL. Path convention
 * {userId}/{timestamp}.{ext} mirrors uploadDriverDocument, each upload is a
 * new object — the caller still needs to persist the returned URL via
 * updateProfile({ avatarUrl }) for it to actually take effect.
 */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const mime = localUri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const ext = mime === "image/png" ? "png" : "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const response = await fetch(localUri);
  if (!response.ok) throw new Error("read_failed");
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: mime, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Permanently deletes the CALLING user's own account, via the
 * delete-own-account Edge Function (service-role-key-backed — the client
 * never gets that key). Cascades through every user-owned table
 * server-side (addresses, orders, cart, favorites, etc. all reference
 * profiles.id ON DELETE CASCADE). Does not sign the local session out —
 * callers should do that themselves once this resolves.
 */
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ success?: boolean; error?: string }>(
    "delete-own-account",
  );
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error ?? "Account deletion failed");
}

export async function getSession(): Promise<AuthUser | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  return {
    id:    user.id,
    email: user.email ?? "",
    name:  user.user_metadata?.name as string | undefined,
  };
}
