import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Alert, AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, SUPABASE_AUTH_STORAGE_KEY } from "@/lib/supabase";
import { identify, resetAnalytics, track } from "@/lib/analytics";
import { setCrashUser } from "@/lib/crashReporter";
import { pushNotificationService } from "@/services/pushNotificationManager";
import { wipeUserData } from "./userDataWipe";
import type { AuthUser } from "./api";
import { normalizeRole } from "./role";
import { AUTH_ROUTING_ENTRY } from "./roleNavigation";
import { rearmPostSignOutNavigation } from "./postSignOutNav";

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
      // Confirmed live: on Android, this listener AND socialAuth.ts's own
      // manual re-navigation (see that file's comment on why it exists) can
      // both fire for the same OAuth redirect -- contrary to that comment's
      // assumption that Custom Tabs never surface a system intent here. The
      // second one to land wins (router.replace on the same route just
      // updates its params), and this one used to forward only `code`,
      // dropping `via` — so a driver who briefly saw the correct
      // complete-profile redirect got silently bounced to the app a moment
      // later once this handler's param-less replace overwrote it. Forward
      // `via`/`redirect` too so whichever handler wins carries the same
      // information either way.
      const via      = (parsed.queryParams?.via as string | undefined) ?? undefined;
      const redirect = (parsed.queryParams?.redirect as string | undefined) ?? undefined;
      try {
        router.replace({
          pathname: "/auth-callback",
          params: {
            code,
            ...(via ? { via } : {}),
            ...(redirect ? { redirect } : {}),
          },
        });
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
  // Realtime role changes are applied to context first, then navigated in a
  // post-commit effect below. Navigating from the socket callback itself can
  // mount the destination layout before React commits the new role, causing
  // that layout's guard to reject the user and strand them on customer home.
  const pendingRoleNavigationRef = useRef<{
    userId: string;
    role: NonNullable<AuthUser["role"]>;
  } | null>(null);
  const userRef = useRef<AuthUser | null>(user);
  const authRevisionRef = useRef(0);
  useEffect(() => { userRef.current = user; }, [user]);

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

      // Reproduced live on a real device (not just in theory): this query can
      // genuinely time out at app startup even on a healthy, low-latency
      // connection (many features -- push registration, notification sync,
      // analytics, realtime channels -- all fire their own requests in the
      // same startup window). A single slow/dropped request used to fall
      // straight through to the hardcoded "customer" default below, which
      // index.tsx's redirect decision then locks in for the rest of the
      // session -- silently and permanently misrouting a driver/pharmacist
      // into the customer app with no way to recover short of a fresh
      // sign-in. One immediate retry costs nothing on the (common) fast path
      // and fixes the (confirmed real) slow one.
      const queryRole = async (): Promise<AuthUser["role"] | "timeout" | "error"> => {
        try {
          const timeout = new Promise<"timeout">((resolve) =>
            setTimeout(() => {
              if (__DEV__) console.warn("[auth] attachRole query timed out.");
              resolve("timeout");
            }, 5000),
          );
          const query = supabase.from("profiles").select("role").eq("id", u.id).maybeSingle();
          const result = await Promise.race([query, timeout]);
          if (result === "timeout") return "timeout";
          return normalizeRole(result?.data?.role as string | undefined);
        } catch {
          return "error";
        }
      };

      let role = await queryRole();
      if (role === "timeout" || role === "error") {
        role = await queryRole();
      }

      if (role === "timeout" || role === "error") {
        const fallbackRole = lastKnownRoleRef.current ?? "customer";
        // Still unresolved after a retry. Don't block sign-in on it -- but
        // don't let this uncertain fallback stand unchallenged forever
        // either. Re-check once more in the background; if the real role
        // turns out to differ from the fallback we just used, correct the
        // session the same way a genuine live role change already does
        // (see the profile-realtime subscription below, which this mirrors).
        setTimeout(() => {
          void (async () => {
            const retryRole = await queryRole();
            if (
              userRef.current?.id === u.id &&
              retryRole !== "timeout" &&
              retryRole !== "error" &&
              retryRole !== fallbackRole
            ) {
              lastKnownRoleRef.current = retryRole;
              lastKnownRoleUserIdRef.current = u.id;
              setUserIfChanged({ ...u, role: retryRole });
              router.replace("/");
            }
          })();
        }, 4000);
        return { ...u, role: fallbackRole };
      }

      lastKnownRoleRef.current = role;
      lastKnownRoleUserIdRef.current = u.id;
      return { ...u, role };
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

    const initialRevision = authRevisionRef.current;

    Promise.race([supabase.auth.getSession(), sessionTimeout])
      .then(async ({ data }) => {
        const u = data.session?.user;
        const base = applyAuthUser(u);
        await reconcile(base?.id ?? null);
        const next = await attachRole(base);
        if (initialRevision !== authRevisionRef.current) return;
        userRef.current = next;
        setUserIfChanged(next);
        if (next) { identify(next.id); setCrashUser(next.id); rearmPostSignOutNavigation(); }
        else      { resetAnalytics(); setCrashUser(null); }
        track("app_opened", { authed: next !== null });
      })
      .catch(() => {})
      .finally(() => {
        if (initialRevision === authRevisionRef.current) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const revision = ++authRevisionRef.current;

      // Commit SIGNED_OUT synchronously. Supabase warns that awaiting async
      // work inside this callback can deadlock subsequent client calls.
      if (!session?.user) {
        pendingRoleNavigationRef.current = null;
        lastKnownRoleRef.current = null;
        lastKnownRoleUserIdRef.current = null;
        userRef.current = null;
        setUserIfChanged(null);
        setLoading(false);
        resetAnalytics();
        setCrashUser(null);
        setTimeout(() => { void reconcile(null).catch(() => {}); }, 0);
        return;
      }

      // Run profile/database work only after GoTrue releases its auth lock.
      setTimeout(() => {
        void (async () => {
          try {
            const base = applyAuthUser(session.user);
            await reconcile(base?.id ?? null);
            const next = await attachRole(base);
            if (revision !== authRevisionRef.current) return;
            userRef.current = next;
            setUserIfChanged(next);
            if (next) {
              identify(next.id);
              setCrashUser(next.id);
              rearmPostSignOutNavigation();
            }
          } catch (e) {
            if (__DEV__) console.error("[auth] deferred auth-state handler threw:", e);
          } finally {
            if (revision === authRevisionRef.current) setLoading(false);
          }
        })();
      }, 0);
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
  useEffect(() => {
    const pending = pendingRoleNavigationRef.current;
    if (!pending || pending.userId !== user?.id || pending.role !== user.role) return;

    pendingRoleNavigationRef.current = null;
    // Route through index.tsx so one place owns the decision and nested role
    // stacks (driver/pharmacist) are torn down before the new home mounts.
    const timer = setTimeout(() => router.replace(AUTH_ROUTING_ENTRY as never), 0);
    return () => clearTimeout(timer);
  }, [user?.id, user?.role]);

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
            // A channel's removeChannel() request is async over the socket —
            // an event already in flight when sign-out tears this channel
            // down can still land here once after `stopped` was set and
            // after `user` has already moved on (to null, or to whichever
            // account signed in next on this device). Reproduced live: this
            // stale callback firing on a routine profile UPDATE (e.g. a
            // presence/last-seen heartbeat on the OLD account) kept calling
            // router.replace("/") below every time that heartbeat landed,
            // well after this effect's own `stopped`/cleanup should have
            // silenced it -- the repeated forced navigation is what left the
            // post-sign-out screen stuck reprocessing its navigation stack
            // instead of settling. Comparing against the id THIS channel was
            // actually opened for (not just truthiness) makes a leaked
            // straggler inert instead of acting on data for an account this
            // channel no longer corresponds to.
            if (stopped || userRef.current?.id !== userId) return;

            const next = payload.new as { role?: string; status?: string };
            const nextStatus = String(next.status ?? "Active");
            if (nextStatus === "Suspended") { handleForcedSignOut("suspended"); return; }
            if (nextStatus === "Inactive")  { handleForcedSignOut("inactive");  return; }

            const nextRole = normalizeRole(next.role);
            if (userRef.current && nextRole !== userRef.current.role) {
              const nextUser = { ...userRef.current, role: nextRole };

              // Keep every role cache coherent. Without this, the next auth
              // token refresh re-applies the pre-change cached role and can
              // bounce the user back to the old interface.
              lastKnownRoleRef.current = nextRole;
              lastKnownRoleUserIdRef.current = userId;
              userRef.current = nextUser;
              pendingRoleNavigationRef.current = { userId, role: nextRole };
              setUserIfChanged(nextUser);
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

  // Revalidate role when the app returns to foreground. Realtime covers the
  // online case, but backgrounded sessions can miss an admin role change if
  // the profile channel was torn down or the device was offline.
  useEffect(() => {
    const revalidateRoleFromServer = async () => {
      const current = userRef.current;
      if (!current?.id) return;

      try {
        const timeout = new Promise<"timeout">((resolve) =>
          setTimeout(() => resolve("timeout"), 5000),
        );
        const query = supabase.from("profiles").select("role").eq("id", current.id).maybeSingle();
        const result = await Promise.race([query, timeout]);
        if (result === "timeout") return;

        const serverRole = normalizeRole(result?.data?.role as string | undefined);
        if (userRef.current?.id !== current.id || serverRole === userRef.current.role) return;

        lastKnownRoleRef.current = serverRole;
        lastKnownRoleUserIdRef.current = current.id;
        const nextUser = { ...current, role: serverRole };
        userRef.current = nextUser;
        pendingRoleNavigationRef.current = { userId: current.id, role: serverRole };
        setUserIfChanged(nextUser);
      } catch (e) {
        if (__DEV__) console.warn("[auth] foreground role revalidation failed:", e);
      }
    };

    const onAppState = (status: AppStateStatus) => {
      if (status === "active") void revalidateRoleFromServer();
    };

    const sub = AppState.addEventListener("change", onAppState);
    return () => sub.remove();
  }, []);

  const signOut = async () => {
    const signedOutUserId = userRef.current?.id ?? user?.id;

    // Leave protected navigation immediately. Remote cleanup must never
    // strand the user on a driver/pharmacist route guard.
    pendingRoleNavigationRef.current = null;
    authRevisionRef.current += 1;
    lastKnownRoleRef.current = null;
    lastKnownRoleUserIdRef.current = null;
    userRef.current = null;
    setLoading(false);
    setUserIfChanged(null);
    resetAnalytics();
    setCrashUser(null);
    router.replace(AUTH_ROUTING_ENTRY as never);
    if (signedOutUserId) {
      // Owner-scoped token deactivation must run before auth.signOut clears
      // auth.uid(); doing it afterward silently fails under correct RLS.
      await pushNotificationService.deactivateToken(signedOutUserId).catch(() => {});
    }
    try {
      const outcome = await Promise.race([
        supabase.auth.signOut({ scope: "local" }).then(() => "completed" as const),
        new Promise<"timed_out">((resolve) => setTimeout(() => resolve("timed_out"), 5_000)),
      ]);
      if (outcome === "timed_out") {
        // Ensure an offline/slow logout cannot resurrect the old session on
        // the next cold start. The in-flight request may still finish later.
        await AsyncStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
      }
    } catch {
      // network failure — clear local state regardless
    }
    // Deactivate this device's own push-token row -- without this, a
    // signed-out account can keep receiving push notifications on a device
    // it no longer controls. Scoped to this one device's token (not every
    // device on the account: an earlier version called
    // unregisterAllPushTokensForUser, which deleted ALL of this user's
    // device rows on any single sign-out, silently killing push on their
    // other, still-signed-in devices too). Pass the userId captured above
    // rather than letting deactivateToken() read it from the session itself
    // -- signOut() just cleared that session, so the internal lookup would
    // find no user and silently no-op. Best-effort; a failure here
    // shouldn't block sign-out itself.
    // Wipe all account-scoped data BEFORE clearing the user, so any UI still
    // mounted during the transition sees empty stores (not stale data from
    // the previous account).
    await wipeUserData().catch(() => {});
    // Without this, a role resolved for THIS account survives in the ref
    // (refs aren't reset by unmounting AuthProvider — it never unmounts) and
    // becomes the *fallback* role attachRole hands the next signed-in user on
    // this device if their own profile query happens to time out — silently
    // handing e.g. a driver's stale role to a customer who signs in next on
    // the same device/tab.
    lastKnownRoleRef.current = null;
    lastKnownRoleUserIdRef.current = null;
    track("logout");
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
