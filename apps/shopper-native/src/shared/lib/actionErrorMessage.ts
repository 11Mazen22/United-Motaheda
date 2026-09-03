/**
 * actionErrorMessage — shared foundation for turning a thrown Supabase/RPC
 * error into something a human should actually read, reused by every role
 * (driver, pharmacist, and any future one) that calls Postgres RPCs written
 * in this backend's `RAISE EXCEPTION 'snake_case_code'` convention.
 *
 * Split out from the driver-only version of this file once the pharmacist
 * app turned out to hit several of the *same* codes (insufficient_privilege,
 * issue_not_found, resolution_note_required, ...) via the same underlying
 * RPCs (transition_order, resolve_delivery_issue) — duplicating the whole
 * table per-role would have meant two copies drifting out of sync the first
 * time either one got a new code. Each role now supplies only the codes
 * that are actually its own (prescription/refill review codes for
 * pharmacist, assignment/arrival codes for driver) via `extraCodes`.
 */

/** `errorMessage` — extract a human-readable string from anything thrown.
 *
 * Supabase does not throw `Error` subclasses for API failures — a
 * PostgrestError / FunctionsHttpError is a plain object like
 * `{ message, code, details, hint }`. `String({...})` on that yields the
 * literal text "[object Object]" — confirmed live, that's exactly what a
 * driver saw in a failure sheet before this existed. The field order below
 * is deliberate: the most useful field first, then progressively weaker
 * fallbacks, and finally the caller-supplied fallback rather than ever
 * surfacing a stringified object. */
export function errorMessage(e: unknown, fallback: string): string {
  if (!e) return fallback;

  if (typeof e === "string") return e.trim() || fallback;
  if (e instanceof Error) return e.message.trim() || fallback;

  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    for (const key of ["message", "error_description", "error", "details", "hint"]) {
      const v = o[key];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (key === "error" && v && typeof v === "object") {
        const nested = (v as Record<string, unknown>).message;
        if (typeof nested === "string" && nested.trim()) return nested.trim();
      }
    }
  }

  return fallback;
}

export interface ActionErrorEntry {
  key: string;
  fallback: string;
}

/** Codes raised by RPCs more than one role calls (transition_order,
 *  resolve_delivery_issue) — kept in one place so driver and pharmacist
 *  can't silently drift into two different messages for the same code. */
const SHARED_CODES: Record<string, ActionErrorEntry> = {
  insufficient_privilege: {
    key: "errors.insufficientPrivilege",
    fallback: "You don't have permission to do that.",
  },
  authentication_required: {
    key: "errors.authRequired",
    fallback: "Your session has expired. Please sign in again.",
  },
  order_not_found: {
    key: "errors.orderNotFound",
    fallback: "This order could not be found — it may have been cancelled.",
  },
  invalid_order_transition: {
    key: "errors.invalidOrderTransition",
    fallback: "This order has already moved past this step. Pull to refresh and try again.",
  },
  issue_not_found: {
    key: "errors.issueNotFound",
    fallback: "This issue report could not be found.",
  },
  issue_already_resolved: {
    key: "errors.issueAlreadyResolved",
    fallback: "This issue has already been resolved.",
  },
  resolution_note_required: {
    key: "errors.resolutionNoteRequired",
    fallback: "Please add a note describing how this was resolved.",
  },
  Unauthorized: {
    key: "errors.unauthorized",
    fallback: "You're not authorized to do that.",
  },
};

/** Bare-code shape: all lowercase/underscore, no spaces — matches how every
 *  RAISE EXCEPTION in this backend is written. A real sentence never matches,
 *  so it's safe to use as "hide anything that looks like an internal code
 *  we haven't explicitly mapped yet" rather than ever showing it raw. */
const LOOKS_LIKE_A_CODE = /^[a-zA-Z][a-zA-Z0-9_]*$/;

/**
 * Builds a role-specific `getActionErrorMessage(e, t, fallback)` — call
 * once per role module with that role's own codes; SHARED_CODES is merged
 * in automatically (role-specific entries win on overlap, though today
 * none overlap by design).
 */
export function createActionErrorMessage(
  extraCodes: Record<string, ActionErrorEntry>,
  i18nNamespace: string,
) {
  const codes: Record<string, ActionErrorEntry> = { ...SHARED_CODES, ...extraCodes };

  return function getActionErrorMessage(
    e: unknown,
    t: (key: string, opts?: Record<string, unknown>) => string,
    fallback: string,
  ): string {
    const raw = errorMessage(e, "").trim();
    if (!raw) return fallback;

    const known = codes[raw];
    if (known) return t(`${i18nNamespace}.${known.key}`, { defaultValue: known.fallback });

    if (LOOKS_LIKE_A_CODE.test(raw)) return fallback;
    return raw;
  };
}
