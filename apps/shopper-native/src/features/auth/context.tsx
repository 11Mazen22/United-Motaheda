import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { identify, resetAnalytics, track } from "@/lib/analytics";
import { setCrashUser } from "@/lib/crashReporter";
import { unregisterAllPushTokensForUser } from "@/features/notifications";
import { wipeUserData } from "./userDataWipe";
import type { AuthUser } from "./api";
import { normalizeRole } from "./role";

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
 *  in case the project's email template is still on the implicit flow.
 *
 *  Errors are logged but not shown to user at this stage — the deep link
 *  handler runs before the UI is ready. Navigation errors are caught and
 *  logged so we don't crash.
 */
async function handleAuthDeepLink(url: string): Promise<void> {
  if (!url) return;

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
        try {
          router.replace({ pathname: "/reset-password", params: { code } });
        } catch (navErr) {
          if (__DEV__) console.error("[auth] reset-password router.replace failed:", navErr);
        }
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
      try {
        router.replace({ pathname: "/auth-callback", params: { code } });
      } catch (navErr) {
        if (__DEV__) console.error("[auth] auth-callback router.replace failed:", navErr);
      }
      return;
    }

    // Legacy implicit flow: #access_token=...&refresh_token=...
    // Only attempt if both tokens are present and non-empty
    const hashIdx = url.indexOf("#");
    if (hashIdx >= 0) {
      try {
        const frag = new URLSearchParams(url.slice(hashIdx + 1));
        const access_token  = frag.get("access_token") ?? "";
        const refresh_token = frag.get("refresh_token") ?? "";
        
        if (access_token.trim() && refresh_token.trim()) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            if (__DEV__) console.warn("[auth] setSession from fragment failed:", error.message);
            return; // Don't navigate on session error
          }
          try {
            router.replace("/(tabs)" as never);
          } catch (navErr) {
            if (__DEV__) console.error("[auth] router.replace to tabs failed after legacy setSession:", navErr);
          }
        } else if (__DEV__) {
          console.warn("[auth] Legacy fragment tokens present but empty");
        }
      } catch (fragErr) {
        if (__DEV__) console.warn("[auth] Failed to parse legacy hash fragment:", fragErr);
      }
    }
  } catch (e) {
    if (__DEV__) console.error("[auth] handleAuthDeepLink fatal error:", e);
    // Don't rethrow — this runs at app startup and we don't want to crash
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
  // The role attachRole fell back to the last time its profile query
  // actually succeeded, this session. Used so a *timeout* (not a real
  // profile change) never overwrites a driver/pharmacist's role with the
  // generic "customer" default — on a flaky connection a role query can
  // time out on some auth events and succeed on others, and defaulting to
  // "customer" every time it does made (driver)/_layout.tsx's own
  // legitimate per-render role check bounce the user in and out of the
  // driver section as the two kept disagreeing about the current role.
  const lastKnownRoleRef = useRef<AuthUser["role"] | null>(null);
  const lastKnownRoleUserIdRef = useRef<string | null>(null);

  // Supabase fires onAuthStateChange for its own INITIAL_SESSION event *in
  // addition to* the explicit getSession() call above, and again for every
  // TOKEN_REFRESHED/reconnect — on a flaky connection those can arrive
  // several times in a row for what is, to the app, the exact same signed-in
  // user. setUser(next) with a freshly-constructed object on every one of
  // those still changes the context value's reference, so every screen
  // reading useAuth() re-renders each time — and enough of those in a tight
  // burst is what was tripping the browser's own rapid-navigation throttle
  // (any navigator resyncing its URL on each re-render adds up fast).
  // Comparing by value first keeps the state (and therefore every consumer)
  // stable across redundant events.
  const setUserIfChanged = (next: AuthUser | null) => {
    setUser((prev) => {
      const unchanged =
        prev?.id === next?.id &&
        prev?.role === next?.role &&
        prev?.name === next?.name &&
        prev?.email === next?.email &&
        prev?.avatarUrl === next?.avatarUrl;
      return unchanged ? prev : next;
    });
  };

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

    // Supabase Auth's session object has no notion of app-level role — it
    // lives in public.profiles. Fetched once per sign-in/session-resolve and
    // attached before setUser() so nothing (routing included) ever sees an
    // authed user with an unknown role for longer than this one query.
    //
    // Bounded with Promise.race (mirrors shopper-web's fetchProfileRowWithTimeout —
    // see that file's BUG 2 for the incident this pattern was born from): this
    // runs inside the onAuthStateChange listener below, and GoTrue does not
    // resolve exchangeCodeForSession()/signIn*() until every listener's callback
    // has settled. An unbounded query here — on a cold-starting Supabase project,
    // exactly like web hit — doesn't just delay the role; it deadlocks the
    // in-flight sign-in itself, which is what left auth-callback.tsx's spinner
    // spinning forever and left checkout working against a half-settled session.
    const attachRole = async (u: AuthUser | null): Promise<AuthUser | null> => {
      if (!u) return null;

      // Same user we already resolved a role for this session — skip the
      // network round-trip entirely. onAuthStateChange fires again for
      // every TOKEN_REFRESHED/reconnect, not just real sign-ins, and on a
      // flaky connection those can arrive several times a minute; re-running
      // a 5s-bounded query on every single one is what was stacking up into
      // the multi-second (sometimes 20s+) blank-screen delays reported for
      // driver accounts. The role can't have silently changed mid-session
      // without a fresh sign-in producing a new auth event with it already
      // reflected server-side, so this is safe, not just fast.
      if (lastKnownRoleUserIdRef.current === u.id && lastKnownRoleRef.current) {
        return { ...u, role: lastKnownRoleRef.current };
      }

      try {
        const timeout = new Promise<"timeout">((resolve) =>
          setTimeout(() => {
            if (__DEV__) console.warn("[auth] attachRole timed out — reusing last known role, will retry on next auth event.");
            resolve("timeout");
          }, 5000),
        );
        const query = supabase.from("profiles").select("role").eq("id", u.id).maybeSingle();
        const result = await Promise.race([query, timeout]);
        if (result === "timeout") {
          return { ...u, role: lastKnownRoleRef.current ?? "customer" };
        }
        const role = normalizeRole(result?.data?.role as string | undefined);
        lastKnownRoleRef.current = role;
        lastKnownRoleUserIdRef.current = u.id;
        return { ...u, role };
      } catch {
        return { ...u, role: lastKnownRoleRef.current ?? "customer" };
      }
    };

    // getSession() reads from local storage but falls back to a network
    // refresh call when the cached token is near/past expiry — on a flaky
    // connection that call can hang with no internal timeout of its own,
    // which (since setLoading(false) below never runs) leaves index.tsx's
    // `if (authLoading) return <blank view>` gate stuck forever and the
    // whole app permanently blank. Same bounded-race pattern as attachRole
    // above, for the same reason: an unbounded await here doesn't just
    // delay auth, it deadlocks the entire app shell.
    const sessionTimeout = new Promise<{ data: { session: null } }>((resolve) =>
      setTimeout(() => {
        if (__DEV__) console.warn("[auth] getSession timed out — proceeding as signed-out.");
        resolve({ data: { session: null } });
      }, 8000),
    );

    Promise.race([supabase.auth.getSession(), sessionTimeout])
      .then(async ({ data }) => {
        const u = data.session?.user;
        const base = applyAuthUser(u);
        await reconcile(base?.id ?? null);
        const next = await attachRole(base);
        setUserIfChanged(next);
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
        const base = applyAuthUser(u);
        await reconcile(base?.id ?? null);
        const next = await attachRole(base);
        setUserIfChanged(next);
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

  // ── Live role/status propagation ───────────────────────────────────────────
  // Mirrors shopper-web's AuthContext.tsx addition of the same mechanism, and
  // reuses features/notifications/realtime.ts's exact retry-on-CHANNEL_ERROR/
  // TIMED_OUT template. Before this, attachRole only ever ran on a real GoTrue
  // event (sign-in/out) or an incidental ~hourly TOKEN_REFRESHED — a role or
  // status change made elsewhere (e.g. an admin promoting/suspending someone)
  // was invisible until the app was force-closed and reopened. This closes
  // that gap: (driver)/_layout.tsx and (tabs)/_layout.tsx already re-check
  // user.role on every render (their own comments already anticipated "role
  // change mid-session"), so feeding a live update into `user` here is enough
  // to make both route-guard directions actually work, with no changes needed
  // to either layout.
  const userRef = useRef<AuthUser | null>(user);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    let current: RealtimeChannel | null = null;
    let stopped = false;

    const handleForcedSignOut = (reason: "suspended" | "inactive") => {
      Alert.alert(
        reason === "suspended" ? "تم تعليق حسابك" : "تم إيقاف حسابك",
        reason === "suspended"
          ? "تم تعليق حسابك من قبل الإدارة. سيتم تسجيل خروجك الآن."
          : "تم إيقاف حسابك. سيتم تسجيل خروجك الآن.",
        [{ text: "حسنًا", onPress: () => { void signOut(); } }],
        { cancelable: false },
      );
    };

    const join = (attempt: number) => {
      if (stopped) return;
      const channel = supabase
        .channel(`profile-${userId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
          (payload) => {
            const next = payload.new as { role?: string; status?: string };
            const nextStatus = String(next.status ?? "Active");
            if (nextStatus === "Suspended") { handleForcedSignOut("suspended"); return; }
            if (nextStatus === "Inactive")  { handleForcedSignOut("inactive");  return; }

            const nextRole = normalizeRole(next.role);
            if (userRef.current && nextRole !== userRef.current.role) {
              setUser((cur) => (cur ? { ...cur, role: nextRole } : cur));
            }
          },
        )
        .subscribe((status, err) => {
          if (stopped) return;
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            if (__DEV__) console.warn(`[auth/realtime] channel ${status}, retrying:`, err?.message);
            supabase.removeChannel(channel);
            const delay = Math.min(30_000, 1_000 * 2 ** attempt);
            setTimeout(() => join(attempt + 1), delay);
          }
        });
      current = channel;
    };

    join(0);

    return () => {
      stopped = true;
      if (current) supabase.removeChannel(current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const signOut = async () => {
    const signedOutUserId = user?.id;
    try {
      await supabase.auth.signOut();
    } catch {
      // network failure — clear local state regardless
    }
    // Detach this device's push token(s) from the account before anything
    // else — see unregisterAllPushTokensForUser's own comment for why: without
    // this, a signed-out account can keep receiving push notifications on a
    // device it no longer controls. Best-effort; a failure here shouldn't
    // block sign-out itself.
    if (signedOutUserId) {
      unregisterAllPushTokensForUser(signedOutUserId).catch(() => {});
    }
    // Wipe all account-scoped data BEFORE clearing the user, so any UI still
    // mounted during the transition sees empty stores (not stale data from
    // the previous account).
    await wipeUserData();
    setUser(null);
    // Without this, a role resolved for THIS account survives in the ref
    // (refs aren't reset by unmounting AuthProvider — it never unmounts) and
    // becomes the *fallback* role attachRole hands the next signed-in user on
    // this device if their own profile query happens to time out — silently
    // handing e.g. a driver's stale role to a customer who signs in next on
    // the same device/tab.
    lastKnownRoleRef.current = null;
    lastKnownRoleUserIdRef.current = null;
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
