/**
 * Inventory API — typed RPC + view wrappers.
 *
 * All mutations go through the SECURITY DEFINER RPCs (advisory-locked,
 * idempotency-keyed). Reads use the available_inventory view, which exposes
 * the same fields under stable snake_case names.
 */

import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/supabaseRequest";
import { captureError } from "@/lib/crashReporter";
import { traced } from "@/features/observability";
import {
  AvailableInventorySchema,
  CommitResponseSchema,
  ExtendResponseSchema,
  ReleaseResponseSchema,
  ReserveResponseSchema,
  ValidateInventoryResultSchema,
  type AvailableInventory,
  type CommitResponse,
  type ExtendResponse,
  type ReleaseResponse,
  type ReservationKind,
  type ReserveResponse,
  type ValidateInventoryResult,
} from "../types";

export type {
  CommitResponse,
  ExtendResponse,
  ReleaseResponse,
  ReserveResponse,
} from "../types";

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function fetchInventoryState(productId: string, signal?: AbortSignal): Promise<AvailableInventory | null> {
  if (!productId) return null;
  try {
    const data = await withTimeout(
      (timeoutSignal) =>
        supabase
          .from("available_inventory")
          .select("product_id,total,reserved,committed,available,availability,updated_at,name_ar,name_en,category_name")
          .eq("product_id", productId)
          .abortSignal(linkSignals(signal, timeoutSignal))
          .single(),
      { signal, timeoutMs: 8000 },
    );
    const parsed = AvailableInventorySchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch (e) {
    captureError(e, { surface: "inventory", op: "fetchInventoryState", productId });
    return null;
  }
}

export async function validateInventory(productId: string, requested: number, signal?: AbortSignal): Promise<ValidateInventoryResult> {
  const data = await withTimeout(
    (timeoutSignal) =>
      supabase
        .rpc("validate_inventory", { p_product_id: productId, p_requested: requested })
        .abortSignal(linkSignals(signal, timeoutSignal)),
    { signal },
  );
  return ValidateInventoryResultSchema.parse(data);
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export interface ReserveArgs {
  productId:        string;
  quantity:         number;
  reservationKind:  ReservationKind;
  reservationRef?:  string;
  idempotencyKey:   string;
  expiresInSecs?:   number;
}
export async function reserveInventory(args: ReserveArgs): Promise<ReserveResponse> {
  return traced("inventory.reserve", { productId: args.productId, qty: args.quantity }, async () => {
    const data = await withTimeout(
      (signal) =>
        supabase
          .rpc("reserve_inventory", {
            p_product_id:       args.productId,
            p_quantity:         args.quantity,
            p_reservation_kind: args.reservationKind,
            p_reservation_ref:  args.reservationRef ?? null,
            p_idempotency_key:  args.idempotencyKey,
            p_expires_in_secs:  args.expiresInSecs ?? 900,
          })
          .abortSignal(signal),
      { timeoutMs: 12_000 },
    );
    return ReserveResponseSchema.parse(data);
  });
}

export interface ReleaseArgs {
  reservationId:  string;
  reason:         string;
  idempotencyKey: string;
}
export async function releaseInventory(args: ReleaseArgs): Promise<ReleaseResponse> {
  return traced("inventory.release", { reservationId: args.reservationId }, async () => {
    const data = await withTimeout(
      (signal) =>
        supabase
          .rpc("release_inventory", {
            p_reservation_id:  args.reservationId,
            p_reason:          args.reason,
            p_idempotency_key: args.idempotencyKey,
          })
          .abortSignal(signal),
    );
    return ReleaseResponseSchema.parse(data);
  });
}

export interface CommitArgs {
  reservationId:  string;
  orderId:        string;
  idempotencyKey: string;
}
export async function commitInventory(args: CommitArgs): Promise<CommitResponse> {
  return traced("inventory.commit", { reservationId: args.reservationId, orderId: args.orderId }, async () => {
    const data = await withTimeout(
      (signal) =>
        supabase
          .rpc("commit_inventory", {
            p_reservation_id:  args.reservationId,
            p_order_id:        args.orderId,
            p_idempotency_key: args.idempotencyKey,
          })
          .abortSignal(signal),
    );
    return CommitResponseSchema.parse(data);
  });
}

export interface ExtendArgs {
  reservationId:  string;
  extendBySecs?:  number;
}
export async function extendReservation(args: ExtendArgs): Promise<ExtendResponse> {
  const data = await withTimeout(
    (signal) =>
      supabase
        .rpc("extend_reservation", {
          p_reservation_id:  args.reservationId,
          p_extend_by_secs:  args.extendBySecs ?? 600,
        })
        .abortSignal(signal),
  );
  return ExtendResponseSchema.parse(data);
}

export interface AdjustArgs {
  productId: string;
  delta: number;
  reason?: string;
  idempotencyKey: string;
}

export interface AdjustResponse {
  product_id: string;
  delta: number;
  total: number;
  reserved: number;
  committed: number;
  available: number;
  replay: boolean;
}

export async function adjustInventory(args: AdjustArgs): Promise<AdjustResponse> {
  const data = await withTimeout(
    (signal) =>
      supabase
        .rpc("adjust_inventory", {
          p_product_id: args.productId,
          p_delta: args.delta,
          p_reason: args.reason ?? null,
          p_idempotency_key: args.idempotencyKey,
        })
        .abortSignal(signal),
  );
  return data as AdjustResponse;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function linkSignals(external: AbortSignal | undefined, timeout: AbortSignal): AbortSignal {
  if (!external) return timeout;
  if (external.aborted) return external;
  if (timeout.aborted)  return timeout;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  external.addEventListener("abort", onAbort, { once: true });
  timeout.addEventListener("abort",  onAbort, { once: true });
  return controller.signal;
}
