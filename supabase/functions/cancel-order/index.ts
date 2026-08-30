import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const { orderId, reason, note, idempotencyKey } = await req.json();
    if (!orderId || !reason) {
      return new Response(JSON.stringify({ error: "Missing orderId or reason" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const idemKey = idempotencyKey || `cancel-${orderId}-${user.id}-${Date.now()}`;

    // Note: We MUST use the authenticated client to execute the RPC so that auth.uid() resolves correctly!
    const { data: cancelData, error: cancelError } = await supabaseClient.rpc("execute_order_cancellation", {
      p_order_id: orderId,
      p_reason_code: reason,
      p_note: note || "",
      p_idempotency_key: idemKey
    });

    if (cancelError) {
      console.error("Cancellation failed:", cancelError);
      return new Response(JSON.stringify({ error: cancelError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true, data: cancelData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("Unhandled error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
