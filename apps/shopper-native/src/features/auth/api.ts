import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";
import type { Role } from "./role";

/** Deep link Supabase should send the user back to after they tap the
 *  email-confirmation link. In dev this resolves to an Expo Go / dev-client
 *  URL (`exp://192.168...:8081/--/auth-callback`); in production it becomes
 *  `shopper://auth-callback`. Either way, AuthProvider's deep-link listener
 *  picks it up and exchanges the `?code=` param for a real session.
 *
 *  IMPORTANT (one-time Supabase dashboard config):
 *    Auth → URL Configuration → Redirect URLs must include both:
 *      - shopper://auth-callback
 *      - exp://*  (or the specific dev URL while testing)
 *    Otherwise Supabase falls back to the project's Site URL (localhost),
 *    which is what produced the "opens browser to localhost" bug. */
export const EMAIL_REDIRECT_URL = Linking.createURL("auth-callback");

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

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: EMAIL_REDIRECT_URL,
      data: {
        name,
        phone: phoneClean,
      },
    },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Account was not created, please try again.");

  // Profile row creation is handled server-side by the `handle_new_user`
  // trigger on auth.users. We used to also upsert client-side here as a
  // safety net, but that fired BEFORE a session existed (Supabase doesn't
  // issue a session when email confirmation is enabled), tripping a
  // visible RLS 401. The trigger is the canonical path now — if it's
  // missing, run the backfill SQL in supabase/migrations/.

  return {
    id:         data.user.id,
    email:      data.user.email ?? "",
    name,
    hasSession: data.session !== null,
  };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Deep link Supabase sends the user to after tapping "Reset Password". */
export const RESET_PASSWORD_REDIRECT_URL = Linking.createURL("reset-password");

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
  name?:  string;
  phone?: string;
}): Promise<void> {
  const { data: { user }, error: getError } = await supabase.auth.getUser();
  if (getError) throw getError;
  if (!user) throw new Error("Not authenticated");

  const meta: Record<string, string> = {};
  if (params.name  !== undefined) meta.name  = params.name.trim();
  if (params.phone !== undefined) meta.phone = params.phone.replace(/\D/g, "").slice(0, 11);

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
