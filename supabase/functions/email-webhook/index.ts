import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "United Communication <noreply@unitedmotaheda.com>";
const WEBHOOK_SECRET = Deno.env.get("EMAIL_WEBHOOK_SECRET");

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const authHeader = req.headers.get("x-supabase-webhook-secret");
  if (WEBHOOK_SECRET && authHeader !== WEBHOOK_SECRET) {
    console.error(JSON.stringify({ event: "email.send.failed", error: "Unauthorized webhook access" }));
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { user, email_data } = payload;
  if (!user || !user.email || !email_data) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 422 });
  }

  const actionType = email_data.email_action_type;
  const tokenHash = email_data.token_hash;
  const redirectTo = email_data.redirect_to;
  const siteUrl = Deno.env.get("SUPABASE_URL") || email_data.site_url || "https://envoy-production-1cbe.up.railway.app";
  
  // Construct the verification URL following Supabase's standard structure
  const actionLink = `${siteUrl}/auth/v1/verify?token=${tokenHash}&type=${actionType}&redirect_to=${encodeURIComponent(redirectTo)}`;

  let subject = "";
  let html = "";
  let text = "";

  if (actionType === "signup") {
    subject = "Confirm your email address";
    text = `Welcome to United Pharmacy!\n\nPlease confirm your email address by clicking the link below:\n\n${actionLink}\n\nIf you did not request this, you can safely ignore this email.`;
    html = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Welcome to United Pharmacy!</h2>
        <p>Please confirm your email address to activate your account.</p>
        <a href="${actionLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Confirm Email</a>
        <br><br>
        <p>Or paste this link into your browser:</p>
        <p><a href="${actionLink}">${actionLink}</a></p>
        <br>
        <p>If you did not request this, you can safely ignore this email.</p>
      </div>
    `;
  } else if (actionType === "recovery") {
    subject = "Reset your password";
    text = `You requested a password reset for your United Pharmacy account.\n\nPlease reset your password by clicking the link below:\n\n${actionLink}\n\nIf you did not request this, you can safely ignore this email.`;
    html = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Reset your password</h2>
        <p>You requested a password reset for your United Pharmacy account.</p>
        <a href="${actionLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <br><br>
        <p>Or paste this link into your browser:</p>
        <p><a href="${actionLink}">${actionLink}</a></p>
        <br>
        <p>If you did not request this, you can safely ignore this email.</p>
      </div>
    `;
  } else if (actionType === "email_change") {
    subject = "Confirm your new email address";
    text = `You requested to change your email address.\n\nPlease confirm by clicking the link below:\n\n${actionLink}\n\nIf you did not request this, you can safely ignore this email.`;
    html = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Confirm your new email address</h2>
        <p>You requested to change your email address for your United Pharmacy account.</p>
        <a href="${actionLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Confirm New Email</a>
        <br><br>
        <p>Or paste this link into your browser:</p>
        <p><a href="${actionLink}">${actionLink}</a></p>
        <br>
        <p>If you did not request this, you can safely ignore this email.</p>
      </div>
    `;
  } else {
    console.log(JSON.stringify({ event: "email.send.ignored", reason: `Unsupported action type: ${actionType}` }));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  if (!RESEND_API_KEY) {
    console.error(JSON.stringify({ event: "email.send.failed", error: "Missing RESEND_API_KEY" }));
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    console.log(JSON.stringify({ event: "email.send.started", provider: "resend", action: actionType }));
    const resendStart = Date.now();
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: user.email,
        subject,
        html,
        text
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const durationMs = Date.now() - resendStart;
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(JSON.stringify({ event: "email.send.failed", provider: "resend", status: res.status, duration_ms: durationMs, error: errorText }));
      
      // Retry transient errors to allow GoTrue to handle backoff
      if ([429, 502, 503, 504].includes(res.status)) {
        return new Response(JSON.stringify({ error: "Transient provider error" }), { status: 500 });
      }
      // Return 200 for terminal errors so GoTrue doesn't pointlessly retry forever
      return new Response(JSON.stringify({ error: "Terminal provider error" }), { status: 200 });
    }
    
    const responseData = await res.json();
    console.log(JSON.stringify({ event: "email.send.succeeded", provider: "resend", duration_ms: durationMs, provider_request_id: responseData.id }));
    
    return new Response(JSON.stringify({ ok: true }), { status: 200 });

  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    console.error(JSON.stringify({ event: isTimeout ? "email.send.timeout" : "email.send.failed", provider: "resend", error: String(error) }));
    
    // Timeouts and network errors should be retried by GoTrue
    return new Response(JSON.stringify({ error: isTimeout ? "Timeout" : "Network error" }), { status: 500 });
  }
});
