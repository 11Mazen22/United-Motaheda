import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { identify, resetAnalytics, track } from "@/lib/analytics";
import { setCrashUser } from "@/lib/crashReporter";
import { wipeUserData } from "./userDataWipe";
import type { AuthUser } from "./api";

/** When the OS hands us a deep link shaped like
 *  `shopper://auth-callback?code=<authCode>` (or the dev-mode equivalent),
 *  we route the user to the in-app /auth-callback screen with the same
 *  query params. That screen does the `exchangeCodeForSession` handshake
 *  AND decides whether to send the user to the phone-verify step or
 *  straight to the tabs. Routing through it (instead of exchanging inline
 *  here) keeps the post-confirmation flow identical on web + native.
 *
 *  Also tolerates the legacy hash-fragment form
 *  (`#access_token=...&refresh_token=...`) by seeding the session directly,
 *  in case the project's email template is still on the implicit flow. */
async function handleAuthDeepLink(url: string): Promise<void> {
  try {
    const parsed = Linking.parse(url);

    // ── Password-reset recovery link ─────────────────────────────────────
    const isResetPassword =
      parsed.path === "reset-password" ||
      parsed.path?.endsWith("/reset-password") ||
      url.includes("reset-password");
    if (isResetPassword) {
      const code = (parsed.queryParams?.code as string | undefined) ?? undefined;
      if (code) {
        router.replace({ pathname: "/reset-password", params: { code } });
      }
      return;
    }

    // ── Email confirmation / sign-in callback ─────────────────────────────
    const isCallback =
      parsed.path === "auth-callback" ||
      parsed.path?.endsWith("/auth-callback") ||
      url.includes("auth-callback");
    if (!isCallback) return;

    // PKCE: ?code=... — defer to the /auth-callback screen so post-exchange
    // routing (verify-phone vs tabs) stays in one place.
    const code = (parsed.queryParams?.code as string | undefined) ?? undefined;
    if (code) {
      router.replace({ pathname: "/auth-callback", params: { code } });
      return;
    }

    // Legacy implicit flow: #access_token=...&refresh_token=...
    const hashIdx = url.indexOf("#");
    if (hashIdx >= 0) {
      const frag = new URLSearchParams(url.slice(hashIdx + 1));
      const access_token  = frag.get("access_token")  ?? undefined;
      const refresh_token = frag.get("refresh_token") ?? undefined;
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error && __DEV__) console.warn("[auth] setSession from fragment:", error.message);
        else router.replace("/(tabs)");
      }
    }
  } catch (e) {
    if (__DEV__) console.warn("[auth] handleAuthDeepLink threw:", e);
  }
}

/** AsyncStorage key tracking which userId most recently held a session on
 *  this device. Compared on every auth-state change so a wipe fires on any
 *  account-subject change, not just explicit sign-outs.
 *
 *  Kept out of wipeUserData's `USER_STORAGE_KEYS` list (we WANT this to
 *  survive sign-outs so the next session can detect "different user"). */
const LAST_USER_ID_KEY = "um_last_user_id_v1";

interface AuthContextValue {
  user:     AuthUser | null;
  loading:  boolean;
  signOut:  () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user:    null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /**
     * Reconcile incoming auth state with the userId we last saw on this
     * device. If the userId has changed (sign-out, sign-in to a different
     * account, switched session), wipe all account-scoped data BEFORE we
     * propagate the new user to React state — so screens never see a frame
     * of mixed data.
     *
     * If the userId is the same (token refresh, app reopen with same user),
     * the wipe is skipped and data persists across the reload.
     */
    const reconcile = async (nextId: string | null): Promise<void> => {
      const prevId = await AsyncStorage.getItem(LAST_USER_ID_KEY);
      if (prevId !== nextId) {
        if (__DEV__) console.log(`[auth] user changed ${prevId ?? "null"} → ${nextId ?? "null"}, wiping`);
        await wipeUserData();
        if (nextId) await AsyncStorage.setItem(LAST_USER_ID_KEY, nextId);
        else        await AsyncStorage.removeItem(LAST_USER_ID_KEY);
      }
    };

    const applyAuthUser = (u: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | undefined): AuthUser | null => {
      // Google (and most OAuth providers, via Supabase) populate user_metadata
      // with either avatar_url or picture depending on provider — check both.
      const meta = u?.user_metadata;
      return u
        ? {
            id:        u.id,
            email:     u.email ?? "",
            name:      meta?.name as string | undefined,
            avatarUrl: (meta?.avatar_url ?? meta?.picture) as string | undefined,
          }
        : null;
    };

    supabase.auth.getSession()
      .then(async ({ data }) => {
        const u = data.session?.user;
        const next = applyAuthUser(u);
        await reconcile(next?.id ?? null);
        setUser(next);
        if (next) { identify(next.id); setCrashUser(next.id); }
        else      { resetAnalytics(); setCrashUser(null); }
        track("app_opened", { authed: next !== null });
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Wrapped in try/finally so setLoading(false) is guaranteed even if
      // reconcile() or wipeUserData() throws (e.g. AsyncStorage failure on
      // a device with full storage). Without this, an async throw here would
      // leave loading=true and freeze the app on the auth-gate forever.
      try {
        const u = session?.user;
        const next = applyAuthUser(u);
        await reconcile(next?.id ?? null);
        setUser(next);
        if (next) { identify(next.id); setCrashUser(next.id); }
        else      { resetAnalytics(); setCrashUser(null); }
      } catch (e) {
        if (__DEV__) console.error("[auth] onAuthStateChange handler threw:", e);
      } finally {
        setLoading(false);
      }
    });

    // Deep-link handler: catches the URL when the user taps the email
    // confirmation link (cold start AND warm — both cases handled). The
    // resulting `exchangeCodeForSession` fires onAuthStateChange above,
    // which is what actually flips `user` from null → authed.
    Linking.getInitialURL().then((url) => { if (url) void handleAuthDeepLink(url); });
    const linkSub = Linking.addEventListener("url", ({ url }) => { void handleAuthDeepLink(url); });

    return () => {
      sub.subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // network failure — clear local state regardless
    }
    // Wipe all account-scoped data BEFORE clearing the user, so any UI still
    // mounted during the transition sees empty stores (not stale data from
    // the previous account).
    await wipeUserData();
    setUser(null);
    track("logout");
    resetAnalytics();
    setCrashUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
