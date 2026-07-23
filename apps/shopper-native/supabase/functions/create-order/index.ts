/**
 * create-order — Supabase Edge Function
 *
 * Expects CheckoutSubmitCommand JSON in the request body (shopper-native /
 * shopper-web). When payment.method is vodafone or instapay and proof fields
 * are present, sets status pending_payment for back-office verification.
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

interface CheckoutCommand {
  idempotencyKey: string;
  customer: { userId?: string; email?: string; fullName: string; phone: string };
  address: { formatted: string; city: string; streetLine: string };
  payment: CheckoutPayment;
  note?: string;
  expectedPricing: {
    subtotal: number;
    discount: number;
    tax: number;
    shipping: number;
    total: number;
  };
  cartLines: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    name: string;
    code?: string;
  }>;
}

function isManualWallet(method: string): boolean {
  return method === "vodafone" || method === "instapay";
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

    // Idempotent replay — return existing order if key already used.
    if (body.idempotencyKey) {
      const { data: existing } = await admin
        .from("orders")
        .select("id, created_at, status, payment_status")
        .eq("idempotency_key", body.idempotencyKey)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing?.id) {
        return new Response(
          JSON.stringify({
            order: {
              id: existing.id,
              created_at: existing.created_at,
              status: existing.status,
              payment_status: existing.payment_status,
              idempotent_replay: true,
            },
            conflicts: [],
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

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
    const lat = typeof body.address?.lat === "number" && Number.isFinite(body.address.lat)
      ? body.address.lat
      : null;
    const lng = typeof body.address?.lng === "number" && Number.isFinite(body.address.lng)
      ? body.address.lng
      : null;

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
      subtotal:          body.expectedPricing?.subtotal ?? 0,
      shipping_fee:      body.expectedPricing?.shipping ?? 0,
      total:             body.expectedPricing?.total ?? 0,
      discount_total:    body.expectedPricing?.discount ?? 0,
      tax_total:         body.expectedPricing?.tax ?? 0,
      idempotency_key:   body.idempotencyKey,
    };

    if (manual && body.payment.transferNumber) {
      row.transfer_number = body.payment.transferNumber;
    }
    if (manual && body.payment.paymentProofUrl) {
      row.payment_proof_url = body.payment.paymentProofUrl;
    }

    const { error: insertError } = await admin.from("orders").insert(row);
    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Write order line items so the client can display product names/images.
    if (body.cartLines?.length) {
      const itemRows = body.cartLines.map((line) => ({
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
    }

    return new Response(
      JSON.stringify({
        order: {
          id: orderId,
          created_at: now,
          status: orderStatus,
          payment_status: paymentStatus,
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
