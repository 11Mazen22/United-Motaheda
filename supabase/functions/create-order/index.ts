/**
 * create-order — Supabase Edge Function
 *
 * Expects CheckoutSubmitCommand JSON in the request body (shopper-native /
 * shopper-web). When payment.method is vodafone or instapay and proof fields
 * are present, sets status pending_payment for back-office verification.
 *
 * Reconstruction pass (2026-08-26) — this function used to trust the client
 * for pricing and delivery fee entirely (whatever `expectedPricing` was sent
 * got written verbatim) and had no delivery-zone concept at all. It now:
 *   - Recomputes subtotal/line totals from product_effective_prices (the
 *     same canonical pricing view search already uses) — the client's
 *     numbers are only used as its own genuine-mismatch report, never as the
 *     source of truth.
 *   - Resolves branch/zone/delivery-fee via resolve_delivery_zone() —
 *     replaces the client-trusted flat `expectedPricing.shipping`.
 *   - Blocks the order if any line requires a prescription and none was
 *     supplied/approved.
 *   - Relies on the DB-level unique index on (user_id, idempotency_key)
 *     (added in 20260826953000) for the actual duplicate-order guarantee —
 *     the pre-check below is a fast path, not the safety mechanism; a
 *     23505 on insert is now caught and treated as a replay too, closing
 *     the race the pre-check-only version had.
 *
 * Deploy: supabase functions deploy create-order
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckoutPayment {
  method: string;
  label: string;
  requestPosMachine?: boolean;
  transferNumber?: string;
  paymentProofUrl?: string;
}

interface CheckoutCartLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  name: string;
  code?: string;
  reservationId?: string;
}

interface CheckoutCommand {
  idempotencyKey: string;
  customer: { userId?: string; email?: string; fullName: string; phone: string };
  address: {
    formatted: string; city: string; streetLine: string;
    lat?: number; lng?: number;
    buildingNumber?: string; floor?: string; apartmentNumber?: string;
    landmark?: string; deliveryInstructions?: string;
    locationSource?: "gps" | "manual" | "gps_corrected";
    locationAccuracyM?: number;
  };
  payment: CheckoutPayment;
  note?: string;
  /** Coupon code applied at checkout, if any — validated and priced
   *  authoritatively server-side below; never trusted from
   *  expectedPricing.discount alone. See the discount computation for why. */
  promoCode?: string;
  expectedPricing: {
    subtotal: number;
    discount: number;
    tax: number;
    shipping: number;
    total: number;
  };
  cartLines: CheckoutCartLine[];
  /** Prescription rows (already reviewed/approved for this user) covering
   *  any requires_prescription cart lines. Optional — omitted entirely when
   *  the cart has no prescription items. */
  prescriptionIds?: string[];
}

// Matches apps/shopper-native/src/features/checkout/types.ts's
// CheckoutConflict exactly — the client already has UI built around this
// shape (shouldRefreshCatalog, per-conflict messaging), so this reuses it
// rather than inventing an incompatible one.
interface PriceConflict {
  productId: string;
  code: "out_of_stock" | "price_changed" | "unavailable" | "invalid_line";
  message: string;
  availableQuantity?: number;
  currentUnitPrice?: number;
}

function isManualWallet(method: string): boolean {
  return method === "vodafone" || method === "instapay";
}

function extractReservationIds(lines: CheckoutCartLine[]) {
  return lines
    .map((line) => line.reservationId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

async function commitOrderReservations(
  caller: ReturnType<typeof createClient>,
  cartLines: CheckoutCartLine[],
  orderId: string,
): Promise<void> {
  const reservationIds = extractReservationIds(cartLines);
  if (reservationIds.length === 0) return;

  for (const reservationId of reservationIds) {
    const { error: commitError } = await caller.rpc("commit_inventory", {
      p_reservation_id:  reservationId,
      p_order_id:        orderId,
      p_idempotency_key: `order:${orderId}:commit:${reservationId}`,
    });
    if (commitError) {
      throw commitError;
    }
  }
}

async function enqueueOrderCreatedNotification(
  admin: ReturnType<typeof createClient>,
  userId: string,
  orderId: string,
): Promise<void> {
  const eventKey = `order:${orderId}:created`;
  const { data: notification, error: notificationError } = await admin
    .from("notifications")
    .insert({
      user_id: userId,
      type: "order",
      category: "order_updates",
      title: "تم استلام طلبك",
      body: "تم استلام طلبك بنجاح وسنبدأ مراجعته قريبًا.",
      data: { kind: "order_created", orderId },
      action_url: `/order/${orderId}`,
      is_read: false,
      event_key: eventKey,
    })
    .select("id")
    .single();

  if (notificationError || !notification?.id) {
    throw notificationError ?? new Error("order_notification_insert_failed");
  }

  const { error: outboxError } = await admin.from("notification_outbox").insert({
    notification_id: notification.id,
    recipient_id: userId,
    event_type: "order",
    category: "order_updates",
    title: "تم استلام طلبك",
    body: "تم استلام طلبك بنجاح وسنبدأ مراجعته قريبًا.",
    payload: {
      data: { kind: "order_created", orderId },
      action_url: `/order/${orderId}`,
      notification_id: notification.id,
    },
    idempotency_key: eventKey,
  });

  if (outboxError) throw outboxError;
}

async function enqueueStaffOrderNotification(
  admin: ReturnType<typeof createClient>,
  orderId: string,
): Promise<void> {
  const { data: staff, error: staffError } = await admin
    .from("profiles")
    .select("id")
    .in("role", ["admin", "manager", "pharmacist"]);
  if (staffError) throw staffError;

  for (const recipient of staff ?? []) {
    const eventKey = `order:${orderId}:staff:new:${recipient.id}`;
    const title = "طلب جديد بانتظار المراجعة";
    const body = "تم استلام طلب جديد ويحتاج إلى مراجعة الصيدلية.";
    const { data: notification, error: notificationError } = await admin
      .from("notifications")
      .insert({
        user_id: recipient.id,
        type: "order",
        category: "order_updates",
        title,
        body,
        data: { kind: "new_order", orderId },
        action_url: "/(pharmacist)/orders",
        is_read: false,
        event_key: eventKey,
      })
      .select("id")
      .single();

    if (notificationError) {
      if (notificationError.code === "23505") continue;
      throw notificationError;
    }
    if (!notification?.id) continue;

    const { error: outboxError } = await admin.from("notification_outbox").insert({
      notification_id: notification.id,
      recipient_id: recipient.id,
      event_type: "order",
      category: "order_updates",
      title,
      body,
      payload: {
        data: { kind: "new_order", orderId },
        action_url: "/(pharmacist)/orders",
        notification_id: notification.id,
      },
      idempotency_key: eventKey,
    });
    if (outboxError && outboxError.code !== "23505") throw outboxError;
  }
}

/** Re-fetch and return an existing order as a "replay" response — shared by
 *  the pre-check fast path and the post-insert unique-violation fallback. */
async function replayResponse(
  admin: ReturnType<typeof createClient>,
  userClient: ReturnType<typeof createClient>,
  cartLines: CheckoutCartLine[],
  existingId: string,
): Promise<Response> {
  const { data: existing } = await admin
    .from("orders")
    .select("id, created_at, status, payment_status")
    .eq("id", existingId)
    .single();
  await commitOrderReservations(userClient, cartLines, existingId).catch((err) => {
    console.error("commit_inventory replay failed:", err);
  });
  return new Response(
    JSON.stringify({
      order: { ...existing, idempotent_replay: true },
      conflicts: [],
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as CheckoutCommand;
    const admin = createClient(supabaseUrl, serviceKey);

    if (!body.cartLines?.length) {
      return new Response(JSON.stringify({ error: "Cart is empty" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotent replay fast path — return existing order if key already used.
    if (body.idempotencyKey) {
      const { data: existing } = await admin
        .from("orders")
        .select("id")
        .eq("idempotency_key", body.idempotencyKey)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing?.id) {
        return await replayResponse(admin, userClient, body.cartLines, existing.id);
      }
    }

    // ── Authoritative pricing — never trust the client's numbers ───────────
    const productIds = body.cartLines.map((l) => l.productId);
    const { data: liveProducts, error: priceError } = await admin
      .from("product_effective_prices")
      .select("id, effective_price, stock, is_active, name_ar")
      .in("id", productIds);
    if (priceError) {
      return new Response(JSON.stringify({ error: "Failed to validate cart: " + priceError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const liveById = new Map((liveProducts ?? []).map((p) => [p.id as string, p]));

    // product_effective_prices.stock mirrors inventory_state (total -
    // reserved - committed) — i.e. it already has THIS customer's own
    // cart-line reservation subtracted out, since reserve_inventory
    // incremented `reserved` the moment they reserved it. Checking
    // `live.stock < line.quantity` directly therefore double-counts their
    // own hold: reserving the very last unit(s) of a product succeeds
    // (correctly — availability was checked before the reservation moved
    // it into `reserved`), but the mirrored stock the checkout stock-check
    // reads is now net of that same reservation, so it always looks
    // unavailable at checkout — confirmed by tracing reserve_inventory /
    // fn_sync_product_stock directly. Fixed by trusting a verified
    // reservation (owned by this user, right product, right quantity,
    // still 'reserved' and unexpired) instead of re-deriving availability
    // from the already-adjusted stock column for that line. Lines with no
    // reservationId (or an invalid/expired/insufficient one) fall back to
    // the original stock check unchanged.
    const reservationIds = body.cartLines
      .map((l) => l.reservationId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const { data: reservationRows } = reservationIds.length
      ? await admin
          .from("inventory_reservations")
          .select("id, product_id, user_id, quantity, state, expires_at")
          .in("id", reservationIds)
      : { data: [] as Array<{ id: string; product_id: string; user_id: string; quantity: number; state: string; expires_at: string }> };
    const reservationById = new Map((reservationRows ?? []).map((r) => [r.id, r]));

    const conflicts: PriceConflict[] = [];
    let serverSubtotal = 0;
    const verifiedLines = body.cartLines.map((line) => {
      const live = liveById.get(line.productId);
      if (!live || !live.is_active) {
        conflicts.push({
          productId: line.productId, code: "unavailable",
          message: `${line.name} is no longer available.`,
        });
        return null;
      }

      const reservation = line.reservationId ? reservationById.get(line.reservationId) : undefined;
      const hasValidOwnReservation =
        !!reservation
        && reservation.user_id === user.id
        && reservation.product_id === line.productId
        && reservation.state === "reserved"
        && reservation.quantity >= line.quantity
        && new Date(reservation.expires_at).getTime() > Date.now();

      if (!hasValidOwnReservation && live.stock < line.quantity) {
        conflicts.push({
          productId: line.productId, code: "out_of_stock",
          message: `Only ${live.stock} of ${line.name} left in stock.`,
          availableQuantity: live.stock,
        });
        return null;
      }
      const realPrice = Number(live.effective_price);
      if (Math.abs(realPrice - line.unitPrice) > 0.01) {
        conflicts.push({
          productId: line.productId, code: "price_changed",
          message: `${line.name}'s price changed to ${realPrice}.`,
          currentUnitPrice: realPrice,
        });
      }
      serverSubtotal += realPrice * line.quantity;
      return { ...line, unitPrice: realPrice };
    });

    if (conflicts.length > 0) {
      return new Response(
        JSON.stringify({ error: "cart_changed", conflicts }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const cartLines = verifiedLines.filter((l): l is CheckoutCartLine => l !== null);

    // ── Prescription gate ───────────────────────────────────────────────────
    // linkedPrescriptionIds carries the validated ids through to the
    // order_prescriptions insert below, once the order actually exists — a
    // prescription and the order it unblocks used to have zero connection
    // in the database once this request finished; the ids were validated
    // here and then simply discarded.
    let linkedPrescriptionIds: string[] = [];
    const { data: rxRequiredProducts } = await admin
      .from("products")
      .select("id")
      .in("id", productIds)
      .eq("requires_prescription", true);
    if (rxRequiredProducts?.length) {
      const providedRx = new Set(body.prescriptionIds ?? []);
      if (providedRx.size === 0) {
        return new Response(
          JSON.stringify({ error: "prescription_required", productIds: rxRequiredProducts.map((p) => p.id) }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { data: validRx } = await admin
        .from("prescriptions")
        .select("id")
        .in("id", [...providedRx])
        .eq("user_id", user.id)
        .eq("review_status", "approved");
      if (!validRx?.length) {
        return new Response(
          JSON.stringify({ error: "prescription_not_approved" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      linkedPrescriptionIds = validRx.map((r) => r.id as string);
    }

    // ── Authoritative delivery zone / fee ───────────────────────────────────
    const lat = typeof body.address?.lat === "number" && Number.isFinite(body.address.lat) ? body.address.lat : null;
    const lng = typeof body.address?.lng === "number" && Number.isFinite(body.address.lng) ? body.address.lng : null;

    let shippingFee = 0;
    let zoneRow: {
      branch_id: string; branch_name_ar: string; zone_id: string;
      zone_name: string; base_fee: number; effective_fee: number; surge_applied: boolean;
      distance_km: number;
    } | null = null;

    if (lat !== null && lng !== null) {
      const { data: zoneData, error: zoneError } = await admin
        .rpc("resolve_delivery_zone", { p_lat: lat, p_lng: lng, p_subtotal: serverSubtotal })
        .maybeSingle();
      if (zoneError) {
        console.error("resolve_delivery_zone failed:", zoneError.message);
      }
      if (!zoneData) {
        return new Response(
          JSON.stringify({ error: "address_not_deliverable" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      zoneRow = zoneData as typeof zoneRow;
      shippingFee = zoneRow!.effective_fee;
    } else {
      // No coordinates at all — cannot resolve a zone. Reject rather than
      // silently defaulting to a guessed flat fee (the previous behavior).
      return new Response(
        JSON.stringify({ error: "location_required" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Authoritative coupon discount — never trust the client's number ────
    // validate-coupon's own header comment already documents the intended
    // design ("The redemption is recorded atomically by the create-order
    // Edge Function after the order is committed"), but that half was never
    // built: body.expectedPricing.discount was accepted verbatim from the
    // client with no server-side coupon check at all, and coupon_redemptions
    // was never written to anywhere — confirmed live (0 rows in
    // coupon_redemptions despite coupons being actively offered and applied
    // at checkout in both apps), so per-user/global redemption limits could
    // never actually be enforced, and any caller could set
    // expectedPricing.discount to an arbitrary amount up to the full
    // subtotal with no coupon at all. Both shopper-native and shopper-web
    // already send the applied code as `promoCode` on this exact command
    // (features/checkout/payload.ts, hooks/usePremiumCheckout.ts,
    // app/pages/Checkout.tsx) — it was simply never read here.
    let discount = 0;
    let appliedCouponCode: string | null = null;
    if (typeof body.promoCode === "string" && body.promoCode.trim()) {
      const code = body.promoCode.trim().toUpperCase();
      const { data: couponResult, error: couponError } = await userClient.rpc(
        "validate_coupon",
        { p_code: code, p_order_subtotal: serverSubtotal },
      );
      if (couponError) {
        return new Response(JSON.stringify({ error: "Failed to validate coupon: " + couponError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = couponResult as { valid: boolean; discount_amount?: number; reason?: string } | null;
      if (!result?.valid) {
        return new Response(
          JSON.stringify({ error: "coupon_invalid", reason: result?.reason ?? "not_found" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      discount = Math.max(0, Math.min(result.discount_amount ?? 0, serverSubtotal));
      appliedCouponCode = code;
    }
    const tax = Math.max(0, body.expectedPricing?.tax ?? 0);
    const total = Math.round((serverSubtotal - discount + tax + shippingFee) * 100) / 100;

    const manual = isManualWallet(body.payment?.method ?? "");
    if (manual) {
      if (!body.payment?.transferNumber?.trim() || !body.payment?.paymentProofUrl?.trim()) {
        return new Response(
          JSON.stringify({ error: "transferNumber and paymentProofUrl are required for manual payment" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }
    const orderStatus = manual ? "pending_payment" : "pending";
    const paymentStatus = manual ? "pending_verification" : "pending";

    const orderId = crypto.randomUUID();
    const now = new Date().toISOString();

    const row: Record<string, unknown> = {
      id:                orderId,
      user_id:           user.id,
      created_at:        now,
      status:            orderStatus,
      payment_status:    paymentStatus,
      payment_method:    body.payment?.method ?? "cod",
      customer_name:     body.customer?.fullName ?? "",
      customer_phone:    body.customer?.phone ?? "",
      customer_address:  body.address ?? {},
      customer_lat:      lat,
      customer_lng:      lng,
      note:              body.note ?? "",
      subtotal:          Math.round(serverSubtotal * 100) / 100,
      shipping_fee:      shippingFee,
      total,
      discount_total:    discount,
      tax_total:         tax,
      idempotency_key:   body.idempotencyKey,
      branch_id:         zoneRow!.branch_id,
      zone_id:           zoneRow!.zone_id,
      zone_name:         zoneRow!.zone_name,
      zone_base_fee:     zoneRow!.base_fee,
      zone_surge_applied: zoneRow!.surge_applied,
      delivery_distance_km: zoneRow!.distance_km,
      location_source:      body.address?.locationSource ?? null,
      location_accuracy_m:  body.address?.locationAccuracyM ?? null,
      address_building:     body.address?.buildingNumber ?? null,
      address_floor:        body.address?.floor ?? null,
      address_apartment:    body.address?.apartmentNumber ?? null,
      address_landmark:     body.address?.landmark ?? null,
      delivery_instructions: body.address?.deliveryInstructions ?? null,
      location_confirmed_at: now,
    };

    if (manual && body.payment.transferNumber) {
      row.transfer_number = body.payment.transferNumber;
    }
    if (manual && body.payment.paymentProofUrl) {
      row.payment_proof_url = body.payment.paymentProofUrl;
    }

    const { error: insertError } = await admin.from("orders").insert(row);
    if (insertError) {
      // 23505 on the (user_id, idempotency_key) unique index means a
      // concurrent request already created this exact order — the race the
      // old SELECT-then-INSERT pre-check alone couldn't close. Replay
      // instead of surfacing a spurious failure.
      if (insertError.code === "23505" && body.idempotencyKey) {
        const { data: winner } = await admin
          .from("orders").select("id")
          .eq("idempotency_key", body.idempotencyKey).eq("user_id", user.id)
          .maybeSingle();
        if (winner?.id) return await replayResponse(admin, userClient, cartLines, winner.id);
      }
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Write order line items so the client can display product names/images.
    const itemRows = cartLines.map((line) => ({
      order_id:         orderId,
      product_id:       line.productId,
      quantity:         line.quantity,
      unit_price:       line.unitPrice,
      line_total:       line.quantity * line.unitPrice,
      product_snapshot: { name: line.name, code: line.code ?? null },
    }));

    const { error: itemsError } = await admin.from("order_items").insert(itemRows);
    if (itemsError) {
      // Non-fatal: order already committed. Log and continue so the
      // client receives the order ID (items will fall back to hydration).
      console.error("order_items insert failed:", itemsError.message);
    }

    if (linkedPrescriptionIds.length > 0) {
      const { error: rxLinkError } = await admin.from("order_prescriptions").insert(
        linkedPrescriptionIds.map((prescriptionId) => ({ order_id: orderId, prescription_id: prescriptionId })),
      );
      if (rxLinkError) {
        // Non-fatal: order already committed and the gate above already
        // confirmed these prescriptions are approved and owned by this
        // user. Losing the link would only mean the pharmacist app can't
        // show which prescription unblocked this order, not a
        // correctness/security issue.
        console.error("order_prescriptions insert failed:", rxLinkError.message);
      }
    }

    try {
      await commitOrderReservations(userClient, cartLines, orderId);
    } catch (commitError) {
      console.error("order reservation commit failed:", commitError);
      return new Response(
        JSON.stringify({ error: "order_commit_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (appliedCouponCode) {
      try {
        await admin.rpc("record_coupon_redemption", {
          p_code: appliedCouponCode,
          p_user_id: user.id,
          p_order_id: orderId,
          p_subtotal: serverSubtotal,
        });
      } catch (redemptionError) {
        // Non-fatal: the order is already correctly priced and committed —
        // the discount actually charged was validated and capped
        // server-side above regardless of whether this insert lands.
        // Losing it would only mean this order doesn't count against the
        // coupon's redemption limits, not a pricing/security issue.
        console.error("record_coupon_redemption failed:", redemptionError);
      }
    }

    try {
      await enqueueOrderCreatedNotification(admin, user.id, orderId);
    } catch (notificationError) {
      // Order creation remains authoritative; delivery can be retried by the
      // caller or operational tooling without rolling back a paid order.
      console.error("order_created notification failed:", notificationError);
    }
    try {
      await enqueueStaffOrderNotification(admin, orderId);
    } catch (notificationError) {
      console.error("new_order staff notification failed:", notificationError);
    }

    return new Response(
      JSON.stringify({
        order: {
          id: orderId,
          created_at: now,
          status: orderStatus,
          payment_status: paymentStatus,
          subtotal: row.subtotal,
          shipping_fee: shippingFee,
          total,
          branch_id: zoneRow!.branch_id,
          zone_name: zoneRow!.zone_name,
        },
        conflicts: [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
