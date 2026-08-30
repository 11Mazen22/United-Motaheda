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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
    const actorRole = profile?.role || "customer";

    const { requestId, action, payload } = await req.json();
    if (!requestId || !action) {
      return new Response(JSON.stringify({ error: "Missing requestId or action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Determine next state based on action
    let nextStatus = "";
    let reason = payload?.reason || null;
    let actorType = actorRole === "customer" ? "customer" : (actorRole === "driver" ? "driver" : "pharmacist");
    
    // Quick authorization checks
    const isStaff = ["admin", "pharmacist", "manager"].includes(actorRole);

    switch (action) {
      case "approve_request":
        if (!isStaff) throw new Error("Forbidden");
        nextStatus = "APPROVED";
        break;
      case "reject_request":
        if (!isStaff) throw new Error("Forbidden");
        nextStatus = "REJECTED";
        break;
      case "assign_driver":
        if (!isStaff) throw new Error("Forbidden");
        nextStatus = "DRIVER_ASSIGNED";
        break;
      case "driver_pickup_success":
        if (actorType !== "driver" && !isStaff) throw new Error("Forbidden");
        nextStatus = "PICKED_UP";
        break;
      case "driver_pickup_fail":
        if (actorType !== "driver" && !isStaff) throw new Error("Forbidden");
        nextStatus = "PICKUP_FAILED";
        break;
      case "receive_pharmacy":
        if (!isStaff) throw new Error("Forbidden");
        nextStatus = "RECEIVED";
        break;
      case "start_inspection":
        if (!isStaff) throw new Error("Forbidden");
        nextStatus = "INSPECTION";
        break;
      case "complete_inspection":
        // Pharmacist passes payload.items: { id: return_item_id, disposition: 'RESTOCK', approved_quantity: 1 }
        if (!isStaff) throw new Error("Forbidden");
        
        // Before transitioning, update the return_items records
        if (payload?.items && Array.isArray(payload.items)) {
          for (const item of payload.items) {
            await supabaseAdmin.from("return_items").update({
              disposition: item.disposition,
              approved_quantity: item.approved_quantity
            }).eq("id", item.id);
          }
        }
        nextStatus = "APPROVED_FOR_REFUND";
        break;
      case "approve_refund":
        if (!isStaff) throw new Error("Forbidden");
        nextStatus = "REFUND_PENDING";
        break;
      case "complete_refund":
        if (!isStaff) throw new Error("Forbidden");
        nextStatus = "COMPLETED";
        
        // Also update refunds table
        await supabaseAdmin.from("refunds").update({ status: "COMPLETED" }).eq("idempotency_key", `return-${requestId}`);
        break;
      default:
        throw new Error("Invalid action");
    }

    // 2. Call the RPC to securely transition
    const { data: transitionData, error: transitionError } = await supabaseAdmin.rpc("transition_return_status", {
      p_request_id: requestId,
      p_new_status: nextStatus,
      p_actor_type: actorType,
      p_actor_id: user.id,
      p_reason: reason
    });

    if (transitionError) throw transitionError;

    // 3. Side effects (Delivery Assignment)
    if (action === "assign_driver") {
      const { data: reqData } = await supabaseAdmin.from("return_requests").select("order_id").eq("id", requestId).single();
      if (reqData && payload?.driver_id) {
        await supabaseAdmin.from("delivery_assignments").insert({
          order_id: reqData.order_id,
          driver_id: payload.driver_id,
          assigned_by: user.id,
          assignment_kind: "return_pickup"
        });
      }
    }

    return new Response(JSON.stringify({ success: true, status: nextStatus, transition: transitionData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Error processing return:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
