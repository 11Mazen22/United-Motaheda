import { z } from "zod";
import { getSupabaseClient } from "../lib/supabaseClient";

const Uuid = z.string().uuid();

export const ReservationState = z.enum(["reserved", "committed", "released", "expired"]);
export type ReservationState = z.infer<typeof ReservationState>;

export const ReservationKind = z.enum(["cart", "order", "gift_redemption", "manual"]);
export type ReservationKind = z.infer<typeof ReservationKind>;

export const ReserveResponseSchema = z.object({
  reservation_id:  Uuid,
  product_id:      z.string(),
  quantity:        z.coerce.number().int().positive(),
  state:           ReservationState,
  expires_at:      z.string(),
  available_after: z.coerce.number().int().optional(),
  replay:          z.boolean(),
});
export type ReserveResponse = z.infer<typeof ReserveResponseSchema>;

export const ReleaseResponseSchema = z.object({
  reservation_id: Uuid,
  state:          ReservationState,
  product_id:     z.string().optional(),
  released:       z.coerce.number().int().optional(),
  replay:         z.boolean().optional(),
});
export type ReleaseResponse = z.infer<typeof ReleaseResponseSchema>;

export const CommitResponseSchema = z.object({
  reservation_id: Uuid,
  state:          ReservationState,
  order_id:       z.string(),
  committed:      z.coerce.number().int().optional(),
  replay:         z.boolean().optional(),
});
export type CommitResponse = z.infer<typeof CommitResponseSchema>;

const ReservationRowSchema = z.object({
  id:           Uuid,
  product_id:   z.string(),
  quantity:     z.coerce.number().int().positive(),
  state:        ReservationState,
  expires_at:   z.string().optional(),
  user_id:      z.string().uuid().optional(),
});

export type ReservationDetails = {
  reservationId: string;
  productId: string;
  quantity: number;
  state: ReservationState;
  expiresAt?: string;
  userId?: string;
};

export async function fetchReservations(
  reservationIds: string[],
): Promise<ReservationDetails[]> {
  if (reservationIds.length === 0) return [];

  const { data, error } = await getSupabaseClient()
    .from("inventory_reservations")
    .select("id, product_id, quantity, state, expires_at, user_id")
    .in("id", reservationIds);

  if (error) throw error;

  return (Array.isArray(data) ? data : []).map((item) => {
    const parsed = ReservationRowSchema.parse(item);
    return {
      reservationId: parsed.id,
      productId: parsed.product_id,
      quantity: parsed.quantity,
      state: parsed.state,
      expiresAt: parsed.expires_at,
      userId: parsed.user_id,
    };
  });
}

export interface ReserveArgs {
  productId:        string;
  quantity:         number;
  reservationKind:  ReservationKind;
  reservationRef?:  string;
  idempotencyKey:   string;
  expiresInSecs?:   number;
}

export async function reserveInventory(args: ReserveArgs): Promise<ReserveResponse> {
  const { data, error } = await getSupabaseClient().rpc("reserve_inventory", {
    p_product_id:       args.productId,
    p_quantity:         args.quantity,
    p_reservation_kind: args.reservationKind,
    p_reservation_ref:  args.reservationRef ?? null,
    p_idempotency_key:  args.idempotencyKey,
    p_expires_in_secs:  args.expiresInSecs ?? 900,
  });

  if (error) throw error;
  return ReserveResponseSchema.parse(data);
}

export interface ReleaseArgs {
  reservationId:  string;
  reason:         string;
  idempotencyKey: string;
}

export async function releaseInventory(args: ReleaseArgs): Promise<ReleaseResponse> {
  const { data, error } = await getSupabaseClient().rpc("release_inventory", {
    p_reservation_id:  args.reservationId,
    p_reason:          args.reason,
    p_idempotency_key: args.idempotencyKey,
  });

  if (error) throw error;
  return ReleaseResponseSchema.parse(data);
}

export interface CommitArgs {
  reservationId:  string;
  orderId:        string;
  idempotencyKey: string;
}

export async function commitInventory(args: CommitArgs): Promise<CommitResponse> {
  const { data, error } = await getSupabaseClient().rpc("commit_inventory", {
    p_reservation_id:  args.reservationId,
    p_order_id:        args.orderId,
    p_idempotency_key: args.idempotencyKey,
  });

  if (error) throw error;
  return CommitResponseSchema.parse(data);
}

export function parseReserveError(e: unknown): { reason: string; available?: number } {
  if (e instanceof Error) {
    const message = e.message;
    if (message.startsWith("insufficient_stock")) {
      const match = /available=(\d+)/.exec(message);
      return { reason: "insufficient_stock", available: match ? Number(match[1]) : undefined };
    }
    if (message.includes("product_not_found")) return { reason: "product_not_found" };
    if (message.includes("invalid_quantity")) return { reason: "invalid_quantity" };
    if (message.includes("not_authenticated")) return { reason: "not_authenticated" };
  }
  return { reason: "unknown" };
}
