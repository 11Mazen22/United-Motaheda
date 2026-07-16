/**
 * orderTimelineApi.ts
 *
 * Cross-cutting per-order history for the unified order workspace via
 * <OrderDetailDrawer>. It is assembled
 * from `public.orders`, `public.delivery_assignments`, `public.delivery_issues`,
 * and the new `public.order_notes` table (see
 * supabase/migrations/20260715090000_order_notes_and_timeline.sql) through
 * one read-only RPC, plus a simple insert for adding a note.
 */
import { getSupabaseClient } from "../lib/supabaseClient";

export type OrderTimelineEventType =
  | "order_created"
  | "assignment_offered"
  | "assignment_accepted"
  | "assignment_declined"
  | "picked_up"
  | "delivered"
  | "assignment_superseded"
  | "issue_reported"
  | "issue_resolved"
  | "note_added";

export interface OrderTimelineEvent {
  at: string;
  type: OrderTimelineEventType;
  actorId: string | null;
  detail: Record<string, unknown>;
}

type RawTimelineRow = {
  event_at: string | null;
  event_type: OrderTimelineEventType;
  actor_id: string | null;
  detail: Record<string, unknown> | null;
};

export async function fetchOrderTimeline(orderId: string): Promise<OrderTimelineEvent[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("admin_order_timeline", { p_order_id: orderId });
  if (error) throw new Error(`Could not load order timeline: ${error.message}`);
  return ((data ?? []) as RawTimelineRow[])
    .filter((row) => row.event_at)
    .map((row) => ({
      at: row.event_at as string,
      type: row.event_type,
      actorId: row.actor_id,
      detail: row.detail ?? {},
    }));
}

export async function addOrderNote(orderId: string, authorId: string, body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Note cannot be empty.");
  if (trimmed.length > 2000) throw new Error("Note is too long (max 2000 characters).");

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("order_notes")
    .insert({ order_id: orderId, author_id: authorId, body: trimmed });
  if (error) throw new Error(`Could not add note: ${error.message}`);
}
