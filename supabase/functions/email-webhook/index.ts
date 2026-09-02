import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Webhook } from "npm:standardwebhooks@1.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "United Communication <noreply@unitedmotaheda.com>";
const LOGO_URL = Deno.env.get("EMAIL_LOGO_URL") || "https://i.ibb.co/yFrcCtW9/hero-icon-B-NP1-9r.png";
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

  // ---------------------------------------------------------------------------
  // Shared premium email shell
  // ---------------------------------------------------------------------------
  // Brand tokens pulled from the United Pharmacy mark: teal "U" + charcoal "P".
  // Built with a table-based layout (with MSO conditionals for the CTA button)
  // so it renders correctly across Outlook, Gmail, Apple Mail and mobile mail
  // clients, not just modern WebKit-based ones.
  const brand = {
    teal: "#0F9C8E",
    tealDark: "#0B7A6F",
    tealTint: "#E6F5F3",
    charcoal: "#1C1E21",
    ink: "#111827",
    body: "#4B5563",
    bodySoft: "#6B7280",
    border: "#E7EAEE",
    canvas: "#EEF1F4",
    card: "#FFFFFF",
    amber: "#B45309",
    amberTint: "#FFFBEB",
    amberBorder: "#FDE7B8",
  };

  const generateEmailTemplate = (
    title: string,
    preheader: string,
    eyebrowEn: string,
    eyebrowAr: string,
    headlineEn: string,
    headlineAr: string,
    bodyEn: string,
    bodyAr: string,
    buttonTextEn: string,
    buttonTextAr: string,
    noteEn: string,
    noteAr: string,
    ignoreEn: string,
    ignoreAr: string,
    link: string,
  ) => {
    return `<!DOCTYPE html>
<html lang="en" dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<style>
  table { border-collapse: collapse; }
  .fallback-font { font-family: Arial, sans-serif !important; }
</style>
<![endif]-->
<style>
  body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: ${brand.canvas}; }
  img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
  a { text-decoration: none; }
  .preheader { display: none !important; visibility: hidden; mso-hide: all; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; }

  .en { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  .ar { font-family: 'Segoe UI', Tahoma, Geneva, Arial, sans-serif; direction: rtl; }

  @media only screen and (max-width: 600px) {
    .email-wrapper { width: 100% !important; }
    .stack-padding { padding-left: 24px !important; padding-right: 24px !important; }
    .header-padding { padding: 28px 24px !important; }
    .content-padding { padding: 32px 24px !important; }
    .cta-button { display: block !important; width: auto !important; box-sizing: border-box !important; padding-left: 20px !important; padding-right: 20px !important; text-align: center !important; }
    .cta-cell { padding-left: 24px !important; padding-right: 24px !important; }
    .h1-en { font-size: 21px !important; }
    .h1-ar { font-size: 22px !important; }
  }
</style>
</head>
<body class="fallback-font" style="margin:0; padding:0; background-color:${brand.canvas};">
<div class="preheader">${preheader}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${brand.canvas};">
  <tr>
    <td align="center" style="padding: 32px 16px;">

      <table role="presentation" class="email-wrapper" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:${brand.card}; border-radius:20px; overflow:hidden; box-shadow:0 1px 3px rgba(17,24,39,0.06);">

        <!-- Header / brand mark -->
        <tr>
          <td class="header-padding" align="center" style="background-color:${brand.charcoal}; padding: 34px 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" valign="middle" style="padding-right: 14px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="48" height="48" style="width:48px; height:48px; background-color:#FFFFFF; border-radius:13px;">
                    <tr>
                      <td align="center" valign="middle" style="width:48px; height:48px; padding:7px; font-size:0; line-height:0;">
                        <img src="${LOGO_URL}" width="34" height="34" alt="United Pharmacy" style="display:block; width:34px; height:34px; object-fit:contain; border:0; outline:none;">
                      </td>
                    </tr>
                  </table>
                </td>
                <td align="left" valign="middle">
                  <span class="en" style="display:block; color:#FFFFFF; font-size:17px; font-weight:700; letter-spacing:0.2px; line-height:1.2;">United Pharmacy</span>
                  <span class="ar" style="display:block; color:rgba(255,255,255,0.72); font-size:14px; font-weight:600; line-height:1.4;">صيدلية المتحدة</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Accent rule -->
        <tr>
          <td style="height:4px; line-height:4px; font-size:0; background-color:${brand.teal};">&nbsp;</td>
        </tr>

        <!-- Content -->
        <tr>
          <td class="content-padding" style="padding: 44px 40px 8px 40px;">

            <!-- English block -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="left">
              <tr>
                <td align="left" style="text-align:left;">
                  <span class="en" style="display:inline-block; color:${brand.teal}; font-size:12px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; margin-bottom:14px;">${eyebrowEn}</span>
                  <h1 class="en h1-en" style="margin:0 0 14px 0; color:${brand.ink}; font-size:23px; line-height:1.3; font-weight:800; text-align:left;">${headlineEn}</h1>
                  <p class="en" style="margin:0; color:${brand.body}; font-size:15.5px; line-height:1.7; text-align:left;">${bodyEn}</p>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
              <tr><td style="border-top:1px solid ${brand.border}; font-size:0; line-height:0;">&nbsp;</td></tr>
            </table>

            <!-- Arabic block -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl">
              <tr>
                <td align="right" style="text-align:right;">
                  <span class="ar" style="display:inline-block; color:${brand.teal}; font-size:12.5px; font-weight:700; margin-bottom:14px;">${eyebrowAr}</span>
                  <h1 class="ar h1-ar" style="margin:0 0 14px 0; color:${brand.ink}; font-size:24px; line-height:1.5; font-weight:800; text-align:right;">${headlineAr}</h1>
                  <p class="ar" style="margin:0; color:${brand.body}; font-size:16.5px; line-height:1.9; text-align:right;">${bodyAr}</p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td align="center" class="cta-cell" style="padding: 34px 40px 8px 40px;">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${link}" style="height:52px;v-text-anchor:middle;width:340px;" arcsize="50%" strokecolor="${brand.tealDark}" fillcolor="${brand.teal}">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${buttonTextEn} | ${buttonTextAr}</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <a href="${link}" class="cta-button en" style="background-color:${brand.teal}; color:#FFFFFF; display:inline-block; font-size:16px; font-weight:700; padding:16px 40px; border-radius:999px; box-shadow:0 6px 14px rgba(15,156,142,0.28);">
              <span style="color:#FFFFFF;">${buttonTextEn}</span><span style="color:rgba(255,255,255,0.55); margin:0 10px;">|</span><span class="ar" style="color:#FFFFFF;">${buttonTextAr}</span>
            </a>
            <!--<![endif]-->
          </td>
        </tr>

        <!-- Security note -->
        <tr>
          <td class="stack-padding" style="padding: 26px 40px 0 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${brand.amberTint}; border:1px solid ${brand.amberBorder}; border-radius:12px;">
              <tr>
                <td style="padding: 16px 18px;">
                  <p class="en" style="margin:0 0 6px 0; color:${brand.amber}; font-size:13.5px; line-height:1.6; text-align:left;">${noteEn}</p>
                  <p class="ar" style="margin:0; color:${brand.amber}; font-size:14px; line-height:1.8; text-align:right;">${noteAr}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Alt link -->
        <tr>
          <td class="stack-padding" style="padding: 26px 40px 40px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="border-top:1px solid ${brand.border}; font-size:0; line-height:0;">&nbsp;</td></tr>
            </table>
            <p class="en" style="margin: 22px 0 4px 0; color:${brand.bodySoft}; font-size:12.5px; text-align:center;">Button not working? Paste this link into your browser:</p>
            <p class="ar" style="margin: 0 0 10px 0; color:${brand.bodySoft}; font-size:13px; text-align:center;">إذا لم يعمل الزر، الصق هذا الرابط في متصفحك:</p>
            <p style="margin:0; text-align:center; word-break:break-all;">
              <a href="${link}" class="en" style="color:${brand.tealDark}; font-size:12.5px; word-break:break-all;">${link}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td class="stack-padding" style="background-color:#FAFBFC; border-top:1px solid ${brand.border}; padding: 28px 40px;">
            <p class="en" style="margin:0 0 6px 0; color:${brand.bodySoft}; font-size:12.5px; line-height:1.6; text-align:center;">${ignoreEn}</p>
            <p class="ar" style="margin:0 0 14px 0; color:${brand.bodySoft}; font-size:13px; line-height:1.8; text-align:center;">${ignoreAr}</p>
            <p class="en" style="margin:0; color:#B5BCC6; font-size:11.5px; text-align:center;">&copy; United Pharmacy · صيدلية المتحدة</p>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
  };

  if (actionType === "signup") {
    subject = "Verify your United Pharmacy account | تفعيل حساب صيدلية المتحدة";
    text = `Welcome to United Pharmacy!\n\nPlease confirm your email address by clicking the link below:\n\n${actionLink}\n\nIf you did not request this, you can safely ignore this email.`;
    html = generateEmailTemplate(
      "Verify your email",
      "Welcome to United Pharmacy! Please verify your email to get started.",
      "Account activation",
      "تفعيل الحساب",
      "Welcome to United Pharmacy",
      "مرحباً بك في صيدلية المتحدة",
      "Thank you for choosing us for your healthcare needs. To activate your account and start exploring our premium pharmacy experience, please verify your email address.",
      "شكراً لاختيارك صيدليتنا لتلبية احتياجاتك الصحية. لتفعيل حسابك والبدء في استكشاف تجربة الصيدلية المتميزة لدينا، يرجى تأكيد عنوان بريدك الإلكتروني.",
      "Verify Email Address",
      "تأكيد البريد",
      "For your security, this verification link is unique to your account and should not be shared with anyone.",
      "لأمانك، هذا الرابط خاص بحسابك ولا يجب مشاركته مع أي شخص آخر.",
      "This is an automated message from United Pharmacy. If you did not create this account, you can safely ignore this email.",
      "هذه رسالة تلقائية من صيدلية المتحدة. إذا لم تقم بإنشاء هذا الحساب، يمكنك تجاهل هذه الرسالة بأمان.",
      actionLink,
    );
  } else if (actionType === "recovery") {
    subject = "Reset your United Pharmacy password | إعادة تعيين كلمة المرور";
    text = `You requested a password reset for your United Pharmacy account.\n\nPlease reset your password by clicking the link below:\n\n${actionLink}\n\nIf you did not request this, you can safely ignore this email.`;
    html = generateEmailTemplate(
      "Reset your password",
      "Instructions to reset your United Pharmacy account password.",
      "Password reset",
      "إعادة تعيين كلمة المرور",
      "Reset Your Password",
      "إعادة تعيين كلمة المرور",
      "We received a request to reset the password for your United Pharmacy account. Click the button below to choose a new password.",
      "لقد تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك في صيدلية المتحدة. انقر على الزر أدناه لاختيار كلمة مرور جديدة.",
      "Reset Password",
      "إعادة تعيين",
      "This link will expire in 24 hours. If you didn't request a password reset, no action is needed — your password will remain unchanged.",
      "ستنتهي صلاحية هذا الرابط خلال ٢٤ ساعة. إذا لم تطلب إعادة تعيين كلمة المرور، لا حاجة لاتخاذ أي إجراء وستبقى كلمة مرورك دون تغيير.",
      "This is an automated message from United Pharmacy. If you did not request this, you can safely ignore this email.",
      "هذه رسالة تلقائية من صيدلية المتحدة. إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة بأمان.",
      actionLink,
    );
  } else if (actionType === "email_change") {
    subject = "Confirm your new email address | تأكيد البريد الإلكتروني الجديد";
    text = `You requested to change your email address.\n\nPlease confirm by clicking the link below:\n\n${actionLink}\n\nIf you did not request this, you can safely ignore this email.`;
    html = generateEmailTemplate(
      "Confirm new email",
      "Confirm the new email address for your United Pharmacy account.",
      "Email change",
      "تغيير البريد الإلكتروني",
      "Confirm Your New Email",
      "تأكيد البريد الإلكتروني الجديد",
      "We received a request to update the email address associated with your United Pharmacy account. Please click the button below to confirm this change.",
      "لقد تلقينا طلباً لتحديث عنوان البريد الإلكتروني المرتبط بحسابك. يرجى النقر على الزر أدناه لتأكيد هذا التغيير.",
      "Confirm Email",
      "تأكيد البريد",
      "If you didn't request this change, please secure your account or contact support immediately.",
      "إذا لم تطلب هذا التغيير، يرجى تأمين حسابك أو التواصل مع الدعم فوراً.",
      "This is an automated message from United Pharmacy. If you did not request this, you can safely ignore this email.",
      "هذه رسالة تلقائية من صيدلية المتحدة. إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة بأمان.",
      actionLink,
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