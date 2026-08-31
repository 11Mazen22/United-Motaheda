import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Webhook } from "npm:standardwebhooks@1.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "United Communication <noreply@unitedmotaheda.com>";
const WEBHOOK_SECRET = Deno.env.get("EMAIL_WEBHOOK_SECRET"); // e.g. whsec_...

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  // 1. Authenticate the request using Standard Webhooks
  let payloadString: string;
  try {
    payloadString = await req.text();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  if (WEBHOOK_SECRET) {
    try {
      const wh = new Webhook(WEBHOOK_SECRET);
      // Verify throws if the signature is invalid or expired (default tolerance is 5 minutes)
      wh.verify(payloadString, {
        "webhook-id": req.headers.get("webhook-id") || "",
        "webhook-timestamp": req.headers.get("webhook-timestamp") || "",
        "webhook-signature": req.headers.get("webhook-signature") || "",
      });
    } catch (err) {
      console.error(JSON.stringify({ event: "email.send.failed", error: "Webhook signature verification failed" }));
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
  } else {
    console.warn("EMAIL_WEBHOOK_SECRET is not set. Skipping signature verification.");
  }

  // 2. Parse the payload
  let payload;
  try {
    payload = JSON.parse(payloadString);
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const { user, email_data } = payload;
  if (!user || !user.email || !email_data) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 422, headers: { "Content-Type": "application/json" } });
  }

  const actionType = email_data.email_action_type;
  const tokenHash = email_data.token_hash;
  const redirectTo = email_data.redirect_to;
  
  // Use SUPABASE_URL if set, otherwise fallback to the public Envoy gateway URL
  const siteUrl = Deno.env.get("SUPABASE_URL") || email_data.site_url || "https://envoy-production-1cbe.up.railway.app";
  
  // 3. Construct the exact GoTrue verify URL
  // In GoTrue v2.195.0, the GET /verify endpoint checks the 'token' query parameter and maps it to TokenHash.
  const actionLink = `${siteUrl}/auth/v1/verify?token=${tokenHash}&type=${actionType}&redirect_to=${encodeURIComponent(redirectTo)}`;

  let subject = "";
  let html = "";
  let text = "";

  const generateEmailTemplate = (title: string, preheader: string, headlineEn: string, headlineAr: string, bodyEn: string, bodyAr: string, buttonTextEn: string, buttonTextAr: string, link: string) => {
  const themeColor = "#0D9488"; // United Pharmacy Teal
  const buttonColor = "#0F766E";

  return `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background-color: ${themeColor}; padding: 32px 40px; text-align: center; }
    .header-logo { color: #ffffff; font-size: 26px; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 12px; }
    .header-icon { font-size: 32px; background: white; padding: 8px; border-radius: 50%; color: ${themeColor}; width: 32px; height: 32px; line-height: 32px; }
    .content { padding: 48px 40px; }
    .text-en { text-align: left; margin-bottom: 24px; }
    .text-ar { text-align: right; margin-bottom: 24px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; }
    .headline-en { color: #111827; font-size: 22px; font-weight: 700; margin: 0 0 12px 0; }
    .headline-ar { color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 12px 0; }
    .body-text-en { color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0; }
    .body-text-ar { color: #4b5563; font-size: 18px; line-height: 1.6; margin: 0; }
    .button-container { text-align: center; margin: 40px 0; }
    .button { display: inline-block; background-color: ${buttonColor}; color: #ffffff !important; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 36px; border-radius: 9999px; box-shadow: 0 4px 6px -1px rgba(13, 148, 136, 0.2); }
    .button-ar { font-size: 18px; margin-left: 8px; }
    .divider { height: 1px; background-color: #e5e7eb; margin: 32px 0; }
    .alt-link-text { color: #6b7280; font-size: 14px; margin: 0 0 8px 0; text-align: center; }
    .alt-link { color: ${themeColor}; font-size: 14px; word-break: break-all; display: block; text-align: center; }
    .footer { background-color: #f8fafc; padding: 32px 40px; text-align: center; border-top: 1px solid #e5e7eb; }
    .footer-text { color: #94a3b8; font-size: 14px; margin: 0 0 8px 0; line-height: 1.5; }
    .preheader { display: none; max-height: 0px; overflow: hidden; }
  </style>
</head>
<body>
  <div class="preheader">${preheader}</div>
  <div class="container">
    <div class="header">
      <div class="header-logo">
        <div class="header-icon">⚕️</div>
        <span>United Pharmacy</span>
        <span style="font-weight: 400; opacity: 0.9;">|</span>
        <span style="font-size: 28px;">صيدلية المتحدة</span>
      </div>
    </div>
    <div class="content">
      <div class="text-en">
        <h1 class="headline-en">${headlineEn}</h1>
        <p class="body-text-en">${bodyEn}</p>
      </div>
      
      <div class="divider" style="background-color: #f3f4f6; margin: 24px 0;"></div>
      
      <div class="text-ar">
        <h1 class="headline-ar">${headlineAr}</h1>
        <p class="body-text-ar">${bodyAr}</p>
      </div>
      
      <div class="button-container">
        <a href="${link}" class="button">
          <span>${buttonTextEn}</span>
          <span style="opacity: 0.5; margin: 0 12px;">|</span>
          <span class="button-ar">${buttonTextAr}</span>
        </a>
      </div>

      <div class="divider"></div>
      
      <p class="alt-link-text">If the button doesn't work, copy and paste this link:</p>
      <p class="alt-link-text" style="direction: rtl; font-size: 16px;">إذا لم يعمل الزر، انسخ هذا الرابط والصقه:</p>
      <a href="${link}" class="alt-link">${link}</a>
    </div>
    <div class="footer">
      <p class="footer-text">This is an automated message from United Pharmacy. If you did not request this, you can safely ignore this email.</p>
      <p class="footer-text" style="direction: rtl; font-size: 15px;">هذه رسالة تلقائية من صيدلية المتحدة. إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.</p>
    </div>
  </div>
</body>
</html>
  `;
};

  if (actionType === "signup") {
    subject = "Verify your United Pharmacy account | تفعيل حساب صيدلية المتحدة";
    text = `Welcome to United Pharmacy!\n\nPlease confirm your email address by clicking the link below:\n\n${actionLink}\n\nIf you did not request this, you can safely ignore this email.`;
    html = generateEmailTemplate(
      "Verify your email",
      "Welcome to United Pharmacy! Please verify your email to get started.",
      "Welcome to United Pharmacy!",
      "مرحباً بك في صيدلية المتحدة!",
      "Thank you for choosing us for your healthcare needs. To activate your account and start exploring our premium pharmacy experience, please verify your email address.",
      "شكراً لاختيارك صيدليتنا لتلبية احتياجاتك الصحية. لتفعيل حسابك والبدء في استكشاف تجربة الصيدلية المتميزة لدينا، يرجى تأكيد عنوان بريدك الإلكتروني.",
      "Verify Email Address",
      "تأكيد البريد",
      actionLink
    );
  } else if (actionType === "recovery") {
    subject = "Reset your United Pharmacy password | إعادة تعيين كلمة المرور";
    text = `You requested a password reset for your United Pharmacy account.\n\nPlease reset your password by clicking the link below:\n\n${actionLink}\n\nIf you did not request this, you can safely ignore this email.`;
    html = generateEmailTemplate(
      "Reset your password",
      "Instructions to reset your United Pharmacy account password.",
      "Reset Your Password",
      "إعادة تعيين كلمة المرور",
      "We received a request to reset the password for your United Pharmacy account. Click the button below to choose a new password. This link will expire in 24 hours.",
      "لقد تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك في صيدلية المتحدة. انقر على الزر أدناه لاختيار كلمة مرور جديدة. ستنتهي صلاحية هذا الرابط خلال ٢٤ ساعة.",
      "Reset Password",
      "إعادة تعيين",
      actionLink
    );
  } else if (actionType === "email_change") {
    subject = "Confirm your new email address | تأكيد البريد الإلكتروني الجديد";
    text = `You requested to change your email address.\n\nPlease confirm by clicking the link below:\n\n${actionLink}\n\nIf you did not request this, you can safely ignore this email.`;
    html = generateEmailTemplate(
      "Confirm new email",
      "Confirm the new email address for your United Pharmacy account.",
      "Confirm New Email Address",
      "تأكيد البريد الجديد",
      "We received a request to update the email address associated with your United Pharmacy account. Please click the button below to confirm this change.",
      "لقد تلقينا طلباً لتحديث عنوان البريد الإلكتروني المرتبط بحسابك. يرجى النقر على الزر أدناه لتأكيد هذا التغيير.",
      "Confirm Email",
      "تأكيد البريد",
      actionLink
    );
  } else {
    console.log(JSON.stringify({ event: "email.send.ignored", reason: `Unsupported action type: ${actionType}` }));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  if (!RESEND_API_KEY) {
    console.error(JSON.stringify({ event: "email.send.failed", error: "Missing RESEND_API_KEY" }));
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  // 4. Send the email via Resend API
  try {
    const controller = new AbortController();
    // GoTrue's default HTTP webhook timeout is 5 seconds. We use 4s so we can respond cleanly before GoTrue hangs up.
    const timeoutId = setTimeout(() => controller.abort(), 4000);

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
      
      // Retry transient errors to allow GoTrue to handle backoff (GoTrue retries up to 3 times)
      if ([429, 502, 503, 504].includes(res.status)) {
        return new Response(JSON.stringify({ error: "Transient provider error" }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
      
      // If it's a 4xx error (e.g. invalid email format), return 500 to rollback the transaction.
      // Returning 200 would cause GoTrue to commit the user without an email being sent!
      // Since GoTrue will retry 500s 3 times, it's safer to fail loudly than silently succeed.
      return new Response(JSON.stringify({ error: "Terminal provider error" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
    
    const responseData = await res.json();
    console.log(JSON.stringify({ event: "email.send.succeeded", provider: "resend", duration_ms: durationMs, provider_request_id: responseData?.id }));
    
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    console.error(JSON.stringify({ event: isTimeout ? "email.send.timeout" : "email.send.failed", provider: "resend", error: String(error) }));
    
    return new Response(JSON.stringify({ error: isTimeout ? "Timeout" : "Network error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
