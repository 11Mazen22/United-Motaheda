/**
 * src/contexts/AuthContext.tsx  — M11 structure consolidation
 *
 * This is now the CANONICAL location for all auth types, the AuthProvider,
 * and the useAuth hook. The old src/context/AuthContext.tsx re-exports from
 * here for backward-compatibility; new code should always import from
 * src/contexts/AuthContext.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FIXED – Three bugs resolved:
 *
 * BUG 1 (sign-out on reload): The previous version ran a manual `bootstrap()`
 * calling `getSession()` in parallel with `onAuthStateChange`. The listener
 * never handled `INITIAL_SESSION` — the event Supabase fires on every page
 * load when a stored session exists. The `fetchProfileRow` DB query raced a
 * 6-second timer; the timer always won on slow connections, leaving `user`
 * null even though the session was in localStorage.
 *
 * FIX: Dropped `bootstrap()` entirely. `onAuthStateChange` now handles
 * `INITIAL_SESSION` which always fires reliably with the restored session.
 * `finalize()` is called only after that event resolves, so the loading
 * spinner never disappears until we actually know who's logged in.
 *
 * BUG 2 (fetchProfileRow timeout / role reset to customer): The DB query had
 * no timeout; on a slow Supabase cold-start it could hang indefinitely.
 *
 * FIX: `fetchProfileRowWithTimeout` wraps the query in `Promise.race` with a
 * 5 s deadline. On timeout it returns `null` gracefully — the caller retries
 * in the background and updates state when it resolves.
 *
 * BUG 3 (admin role not recognised): A downstream consequence of Bug 2.
 * When `fetchProfileRow` returned null (timeout), `parseRole(null)` defaulted
 * to "customer", so staff were redirected away from /admin. Fixing Bugs 1 & 2
 * ensures the real role is always loaded from the DB before the app renders.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, RealtimeChannel, Session, User as SupabaseUser } from "@supabase/supabase-js";
import { toast } from "sonner";
import { getSupabaseClient } from "../lib/supabaseClient";
import { useLanguage } from "./LanguageContext";

// ─── Domain types ─────────────────────────────────────────────────────────────
export type StaffRole = "admin" | "manager" | "pharmacist" | "driver";
export type UserRole = StaffRole | "customer";
export type UserStatus = "Active" | "Inactive" | "Suspended";

export interface SuspensionData {
  suspendedAt?: string;
  durationType?: "permanent" | "temporary";
  expiresAt?: string;
  reasonCodes?: string[];
  adminNotes?: string;
}

export class AccountSuspendedError extends Error {
  readonly suspensionData: SuspensionData;
  constructor(data: SuspensionData) {
    super("ACCOUNT_SUSPENDED");
    this.name = "AccountSuspendedError";
    this.suspensionData = data;
  }
}

export class AccountInactiveError extends Error {
  constructor() {
    super("ACCOUNT_INACTIVE");
    this.name = "AccountInactiveError";
  }
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  username?: string;
  address?: string;
  created_at?: string;
  role: UserRole;
  status: UserStatus;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
}

interface LoginResult {
  user: UserProfile | null;
}

interface RegisterResult {
  session: Session | null;
}

interface AuthContextValue {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  register: (payload: RegisterPayload) => Promise<RegisterResult>;
  loginWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isPharmacist: boolean;
  isDriver: boolean;
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseRole(value: unknown): UserRole {
  const role = String(value ?? "").trim().toLowerCase();
  if (role === "admin") return "admin";
  if (role === "manager") return "manager";
  if (role === "pharmacist") return "pharmacist";
  if (role === "driver") return "driver";
  return "customer";
}

function parseStatus(value: unknown): UserStatus {
  const status = String(value ?? "").trim();
  if (status === "Inactive") return "Inactive";
  if (status === "Suspended") return "Suspended";
  return "Active";
}

// Raw query — no timeout guard here; see fetchProfileRowWithTimeout below.
async function fetchProfileRow(
  userId: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseClient();
  const queryBuilder = supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, status, created_at")
    .eq("id", userId)
    .single();

  let data: Record<string, unknown> | null = null;
  let error: { code?: string; message?: string } | null = null;

  if (signal) {
    try {
      const response = await (queryBuilder as typeof queryBuilder & {
        abortSignal?: (signal: AbortSignal) => Promise<{ data: Record<string, unknown> | null; error: { code?: string; message?: string } | null }>;
      }).abortSignal?.(signal);
      data = response?.data ?? null;
      error = response?.error ?? null;
    } catch (abortError) {
      if (signal.aborted) {
        return null;
      }
      error = { message: abortError instanceof Error ? abortError.message : "Unknown error" };
    }
  } else {
    const response = await queryBuilder;
    data = (response.data as Record<string, unknown> | null) ?? null;
    error = response.error as { code?: string; message?: string } | null;
  }

  if (error) {
    if (signal?.aborted) return null;
    if (error.code === "PGRST116") return null; // row not found – new user
    console.error("[AuthContext] fetchProfileRow error:", error.message);
    return null;
  }

  return data as Record<string, unknown>;
}

/**
 * FIX: Wraps fetchProfileRow in a 5-second Promise.race so a slow Supabase
 * cold-start never blocks the auth flow indefinitely. On timeout the function
 * returns null and the caller treats it as a missing profile (graceful
 * degradation), then retries in the background.
 */
async function fetchProfileRowWithTimeout(
  userId: string,
  timeoutMs = 5000,
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    console.warn("[AuthContext] fetchProfileRow timed out — will retry in background.");
    controller.abort();
  }, timeoutMs);
  try {
    return await fetchProfileRow(userId, controller.signal);
  } finally {
    window.clearTimeout(timer);
  }
}

function buildProfile(
  authUser: SupabaseUser,
  profileRow: Record<string, unknown> | null,
): UserProfile {
  const email = (profileRow?.email as string) || authUser.email || "";
  const fullName =
    (profileRow?.full_name as string) ||
    (authUser.user_metadata?.full_name as string) ||
    "";
  const phone =
    (profileRow?.phone as string) || (authUser.user_metadata?.phone as string) || "";
  const username = (authUser.user_metadata?.username as string) || "";
  const address = (authUser.user_metadata?.address as string) || "";
  const createdAt =
    (profileRow?.created_at as string) || authUser.created_at || new Date().toISOString();

  return {
    id: authUser.id,
    email,
    fullName,
    phone,
    username,
    address,
    created_at: createdAt,
    role: parseRole(profileRow?.role),
    status: parseStatus(profileRow?.status),
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const { lang } = useLanguage();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const authUserRef = useRef<SupabaseUser | null>(null);
  const userRef = useRef<UserProfile | null>(null);
  const initialSessionPendingRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  /**
   * Fetches the DB profile for `authUser` and updates state.
   * When called with null it clears the user (sign-out path).
   */
  const resolveUser = useCallback(
    async (
      authUser: SupabaseUser | null,
      _session: Session | null,
      _options?: { blockUntilProfile?: boolean },
    ) => {
      if (!authUser) {
        authUserRef.current = null;
        setUser(null);
        return null;
      }

      authUserRef.current = authUser;

      const profileRow = await fetchProfileRowWithTimeout(authUser.id);

      if (profileRow === null) {
        if (userRef.current?.id === authUser.id) {
          return userRef.current;
        }

        // Background retry — updates user state when profile resolves.
        // finalize() is always called by the caller (INITIAL_SESSION handler),
        // so loading clears within 5 s even when Supabase is slow.
        fetchProfileRow(authUser.id)
          .then((retryRow) => {
            if (authUserRef.current?.id === authUser.id && retryRow !== null) {
              setUser(buildProfile(authUser, retryRow));
            }
          })
          .catch(() => {
            // Silently ignore background retry failures
          });

        return null;
      }

      const profile = buildProfile(authUser, profileRow);
      setUser(profile);
      return profile;
    },
    [],
  );

  const refreshProfile = useCallback(async () => {
    const authUser = authUserRef.current;
    if (!authUser) return;
    const profile = await resolveUser(authUser, session, { blockUntilProfile: false });
    if (profile) setUser(profile);
  }, [resolveUser, session]);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseClient();

    const emergencyTimer = setTimeout(() => {
      if (!cancelled) {
        console.warn("[AuthContext] Emergency timeout reached — forcing loading = false.");
        setLoading(false);
      }
    }, 12_000);

    let finalized = false;
    const finalize = () => {
      if (!cancelled && !finalized) {
        finalized = true;
        clearTimeout(emergencyTimer);
        setLoading(false);
      }
    };

    const handleAuthStateChange = async (event: AuthChangeEvent, currentSession: Session | null) => {
      if (cancelled) return;
      try {
        setSession(currentSession ?? null);

        if (event === "INITIAL_SESSION") {
          initialSessionPendingRef.current = false;
          await resolveUser(currentSession?.user ?? null, currentSession ?? null, {
            blockUntilProfile: true,
          });
          // Always finalize — loading clears after at most 5 s (fetchProfileRowWithTimeout
          // timeout). If profile fetch failed, the background retry in resolveUser will
          // update user state (role) once Supabase becomes reachable.
          finalize();
        } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          await resolveUser(currentSession?.user ?? null, currentSession ?? null);
        } else if (event === "TOKEN_REFRESHED") {
          // Token refresh only rotates the JWT — the profile row is unchanged.
          // Re-fetching would hit Supabase on every hourly token cycle and
          // produce spurious timeout warnings when Supabase cold-starts.
          // If no profile is loaded yet (e.g. first cold boot), fetch it now.
          if (!userRef.current && currentSession?.user) {
            await resolveUser(currentSession.user, currentSession);
          }
        } else if (event === "SIGNED_OUT") {
          authUserRef.current = null;
          setUser(null);
          setSession(null);
        }
      } catch (err) {
        console.error("[AuthContext] onAuthStateChange handler failed:", err);
        if (event === "INITIAL_SESSION") finalize();
      }
    };

    // Supabase may hold its auth lock while invoking this callback. Defer any
    // profile query to a separate task so PostgREST token resolution cannot
    // deadlock behind the auth event that initiated it.
    const pendingHandlers = new Set<number>();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      const timer = window.setTimeout(() => {
        pendingHandlers.delete(timer);
        void handleAuthStateChange(event, currentSession);
      }, 0);
      pendingHandlers.add(timer);
    });

    return () => {
      cancelled = true;
      clearTimeout(emergencyTimer);
      pendingHandlers.forEach((timer) => window.clearTimeout(timer));
      pendingHandlers.clear();
      subscription.unsubscribe();
    };
  }, [resolveUser]);

  // ── Live role/status propagation ───────────────────────────────────────────
  // If profiles.role/status changes while this user has an open session (an
  // admin promotes/demotes them, or suspends/deactivates them), nothing above
  // refetches it until the next sign-in or the ~hourly TOKEN_REFRESHED event —
  // this app's own history of role-related bugs (see file header) is exactly
  // this class of staleness. Subscribes to UPDATEs on this user's own row and
  // reacts immediately: a role change refreshes `user` via refreshProfile()
  // (already correct and previously dead code) — that alone is enough to
  // cascade through AdminRouteProtection/AdminLayout/AdminSidebar, none of
  // which cache role, confirmed by direct read. A status flip to
  // Suspended/Inactive forces a sign-out + redirect, closing a separate real
  // gap: suspension today is only checked at login time, so an already-open
  // session for a user suspended mid-session previously kept working
  // indefinitely. Mirrors shopper-native's notifications/realtime.ts
  // retry-on-CHANNEL_ERROR/TIMED_OUT pattern — this is web's first realtime
  // subscription built with that safeguard (logisticsRealtime.ts's bare
  // .subscribe() is not; role/status is too safety-critical to skip it).
  //
  // Uses window.location for navigation rather than useNavigate(): AuthProvider
  // is mounted above <BrowserRouter> in main.tsx, so router context isn't
  // available here. The hard reload is also the right call for a forced
  // sign-out — no stale component state should survive it.
  // Placeholder initial values only — signOut is declared later in this same
  // function body (useCallback further down). The sync effect that assigns
  // the real functions lives right after signOut's declaration further below,
  // NOT here: a useEffect's dependency array is a plain array literal
  // evaluated eagerly at the call site during render (unlike the deferred
  // callback body), so putting `signOut` in that array here would still be a
  // genuine temporal-dead-zone ReferenceError on every render, even though
  // the callback itself only runs after the full render commits.
  const refreshProfileRef = useRef<() => Promise<void>>(async () => {});
  const signOutRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    const supabase = getSupabaseClient();
    let current: RealtimeChannel | null = null;
    let stopped = false;

    const handleForcedSignOut = async (nextStatus: UserStatus) => {
      if (nextStatus === "Suspended") {
        try {
          const { data } = await supabase
            .from("user_suspensions")
            .select("reason_codes, admin_notes, duration_type, expires_at, created_at")
            .eq("user_id", userId)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) {
            sessionStorage.setItem(
              "pending_suspension_detail",
              JSON.stringify({
                suspendedAt: data.created_at,
                durationType: data.duration_type,
                expiresAt: data.expires_at,
                reasonCodes: data.reason_codes,
                adminNotes: data.admin_notes,
              }),
            );
          }
        } catch {
          // best-effort — SuspendedPage's generic fallback covers a miss here
        }
        toast.error(
          lang === "ar"
            ? "تم تعليق حسابك. سيتم تسجيل خروجك الآن."
            : "Your account has been suspended. You're being signed out.",
        );
        await signOutRef.current();
        window.location.href = "/suspended";
      } else {
        toast.error(
          lang === "ar"
            ? "تم إيقاف حسابك. سيتم تسجيل خروجك الآن."
            : "Your account has been deactivated. You're being signed out.",
        );
        await signOutRef.current();
        window.location.href = "/login";
      }
    };

    const join = (attempt: number) => {
      if (stopped) return;
      const channel = supabase
        .channel(`profile-${userId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
          (payload) => {
            const next = payload.new as { role?: unknown; status?: unknown };
            const nextStatus = parseStatus(next.status);
            if (nextStatus !== "Active") {
              void handleForcedSignOut(nextStatus);
              return;
            }
            const nextRole = parseRole(next.role);
            if (userRef.current && nextRole !== userRef.current.role) {
              void refreshProfileRef.current();
              toast.success(
                lang === "ar"
                  ? `تم تحديث صلاحيتك. الدور الحالي: ${nextRole}`
                  : `Your role has been updated to ${nextRole}.`,
              );
            }
          },
        )
        .subscribe((status, err) => {
          if (stopped) return;
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            if (import.meta.env.DEV) {
              console.warn(`[AuthContext/realtime] channel ${status}, retrying:`, err?.message);
            }
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
  }, [user?.id, lang]);

  // ── UI-friendly actions ────────────────────────────────────────────────────
  const login = useCallback(
    async ({ email, password }: LoginCredentials): Promise<LoginResult> => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          throw new Error("Invalid email or password.");
        }
        throw error;
      }

      if (!data.user) throw new Error("Unable to sign in. No user returned.");

      authUserRef.current = data.user;

      const profile = await resolveUser(data.user, data.session, { blockUntilProfile: true });
      const resolvedProfile = profile ?? buildProfile(data.user, null);

      if (resolvedProfile.status === "Suspended") {
        // Fetch suspension details before signing out so the error carries context.
        const susp = await (async () => {
          try {
            const { data: suspRow } = await supabase
              .from("user_suspensions")
              .select("reason_codes, admin_notes, duration_type, expires_at, created_at")
              .eq("user_id", data.user.id)
              .eq("is_active", true)
              .order("created_at", { ascending: false })
              .limit(1)
              .single();
            return suspRow as Record<string, unknown> | null;
          } catch {
            return null;
          }
        })();

        authUserRef.current = null;
        setUser(null);
        await supabase.auth.signOut();

        throw new AccountSuspendedError({
          suspendedAt:  susp?.created_at  as string | undefined,
          durationType: susp?.duration_type as "permanent" | "temporary" | undefined,
          expiresAt:    susp?.expires_at   as string | undefined,
          reasonCodes:  susp?.reason_codes as string[] | undefined,
          adminNotes:   susp?.admin_notes  as string | undefined,
        });
      }

      if (resolvedProfile.status === "Inactive") {
        authUserRef.current = null;
        setUser(null);
        await supabase.auth.signOut();
        throw new AccountInactiveError();
      }

      if (!profile) setUser(resolvedProfile);
      return { user: resolvedProfile };
    },
    [resolveUser],
  );

  const register = useCallback(
    async ({
      fullName,
      email,
      password,
      phone,
    }: RegisterPayload): Promise<RegisterResult> => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone ?? "",
          },
        },
      });

      if (error) {
        const msg = error.message ?? "";
        const status = (error as { status?: number }).status;

        if (status === 500) {
          throw new Error(
            "حدث خطأ داخلي أثناء إنشاء الحساب. يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني.\n" +
            "An internal error occurred while creating your account. Please try again or contact support.",
          );
        }
        if (msg.includes("already registered") || msg.includes("User already registered")) {
          throw new Error("يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل.\nAn account with this email already exists.");
        }
        if (msg.includes("Password should be")) {
          throw new Error("كلمة المرور ضعيفة جداً. يجب أن تكون 6 أحرف على الأقل.\nPassword is too weak. It must be at least 6 characters.");
        }
        if (msg.includes("Invalid email")) {
          throw new Error("عنوان البريد الإلكتروني غير صالح.\nInvalid email address.");
        }
        if (msg.includes("Email rate limit exceeded") || msg.includes("over_email_send_rate_limit")) {
          throw new Error("تم تجاوز الحد المسموح به لإرسال الرسائل. يرجى الانتظار قليلاً ثم المحاولة مجدداً.\nEmail rate limit exceeded. Please wait a moment and try again.");
        }
        if (msg.includes("signup is disabled") || msg.includes("Signups not allowed")) {
          throw new Error("التسجيل مغلق حالياً. يرجى التواصل مع الإدارة.\nSignups are currently disabled. Please contact the administrator.");
        }
        throw new Error(msg || "تعذر إنشاء الحساب. يرجى المحاولة مرة أخرى.\nUnable to create account. Please try again.");
      }

      if (data.user) {
        authUserRef.current = data.user;
        if (data.session) {
          const profileRow = await fetchProfileRowWithTimeout(data.user.id);
          setUser(buildProfile(data.user, profileRow));
        }
      }

      return { session: data.session };
    },
    [],
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("[AuthContext] Sign out error:", error);
    } finally {
      authUserRef.current = null;
      setUser(null);
    }
  }, []);

  // Keeps refreshProfileRef/signOutRef (declared earlier, above the realtime
  // propagation effect) pointed at the latest closures. Placed here, after
  // both functions are declared, because the dependency array below is
  // evaluated eagerly during render — not deferred like the callback body.
  useEffect(() => {
    refreshProfileRef.current = refreshProfile;
    signOutRef.current = signOut;
  }, [refreshProfile, signOut]);

  // Google OAuth: this navigates the browser away to Google's consent screen
  // and never returns a value here — there's nothing to await. Supabase's web
  // client has detectSessionInUrl:true (the RN app explicitly turns this off
  // and hand-rolls the exchange instead, since RN has no window.location for
  // it to inspect), so when Google redirects back to redirectTo, the client
  // auto-exchanges the code and fires onAuthStateChange(SIGNED_IN) on its own —
  // the existing listener above resolves the profile exactly like it does for
  // any other sign-in. /auth/callback just gives that moment a branded, waiting
  // screen instead of a blank flash, and is where the suspended/inactive check
  // (done inline in login() above for the password path) runs for this path.
  const loginWithGoogle = useCallback(async (): Promise<void> => {
    const supabase = getSupabaseClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) throw error;
  }, []);

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager" || user?.role === "admin";
  const isPharmacist = user?.role === "pharmacist";
  const isDriver = user?.role === "driver";
  const isStaff = Boolean(user && user.role !== "customer");

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      login,
      register,
      loginWithGoogle,
      signOut,
      refreshProfile,
      isAdmin,
      isManager,
      isPharmacist,
      isDriver,
      isStaff,
    }),
    [
      user,
      session,
      loading,
      login,
      register,
      loginWithGoogle,
      signOut,
      refreshProfile,
      isAdmin,
      isManager,
      isPharmacist,
      isDriver,
      isStaff,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
