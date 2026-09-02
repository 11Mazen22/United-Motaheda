/**

 * socialAuth.ts — OAuth sign-in via Supabase (Google / Apple / Facebook).

 *

 * Flow:

 *   1. Call signInWithProvider("google")

 *   2. Supabase returns a URL → open it in expo-web-browser

 *   3. User completes OAuth on Google's page

 *   4. Google redirects → Supabase → deep link shopper://auth-callback?code=xxx

 *   5. The existing auth-callback.tsx screen handles exchangeCodeForSession()

 *

 * Prerequisites (one-time setup):

 *   Google → console.cloud.google.com → OAuth 2.0 credentials (Web type)

 *            Redirect URI: https://<project>.supabase.co/auth/v1/callback

 *            Supabase Dashboard → Auth → Providers → Google → Client ID + Secret

 *

 * No extra packages needed beyond what Expo SDK already ships:

 *   expo-web-browser  (already in Expo SDK)

 *   expo-linking      (already in Expo SDK)

 */



import { Platform }      from "react-native";

import * as Linking      from "expo-linking";

import * as WebBrowser   from "expo-web-browser";

import { router }        from "expo-router";

import { supabase }      from "@/lib/supabase";

import type { Provider } from "@supabase/supabase-js";



// Allows the in-app browser to hand the result back to the app on Android.

WebBrowser.maybeCompleteAuthSession();



export type SocialAuthProvider = "google";



/**

 * Opens the OAuth consent page in an in-app browser, then returns once

 * the user completes (or cancels) the flow.

 *

 * The deep-link redirect lands on auth-callback.tsx which already calls

 * exchangeCodeForSession() and redirects to /(tabs) on success.

 *

 * @returns "success" | "cancelled" | "error"

 */

export async function signInWithProvider(

  provider: SocialAuthProvider,

  /** Where to land after a successful sign-in, e.g. "/(customer)/checkout".
   *  Threaded through the OAuth round-trip as a query param so auth-callback
   *  can route the user back to what they were doing instead of always
   *  dropping them on Home. */
  destination?: string,

): Promise<"success" | "cancelled" | "error"> {

  // Build the redirect URL that Supabase will send the user back to.

  // On dev it resolves to exp://... ; in production to shopper://auth-callback

  // `via` rides through the whole OAuth round-trip (Supabase preserves
  // arbitrary redirectTo query params, same as `redirect` already does) so
  // auth-callback.tsx can trust "this session just came from the Google
  // button" directly, instead of inferring it from
  // session.user.app_metadata.provider — which, confirmed against real rows
  // in auth.users, stays pinned to whichever identity was linked *first* on
  // the account (often "email") and does not update to reflect the provider
  // actually used for the current sign-in. Relying on that silently skipped
  // the complete-profile gate for any Google sign-in on an account that also
  // had an email identity linked.
  const redirectTo = Linking.createURL("/auth-callback", {
    queryParams: {
      via: provider,
      ...(destination ? { redirect: destination } : {}),
    },
  });



  const { data, error } = await supabase.auth.signInWithOAuth({

    provider: provider as Provider,

    options: {

      redirectTo,

      // skipBrowserRedirect: true tells Supabase not to open the URL itself —

      // we open it manually via WebBrowser.openAuthSessionAsync so we can

      // intercept the redirect back into the app.

      skipBrowserRedirect: true,

    },

  });



  if (error || !data?.url) {

    return "error";

  }



  // Open the OAuth URL in a secure in-app browser.

  // Pass the redirect URL as the second arg so the browser closes automatically

  // when Supabase redirects back to shopper://auth-callback.

  const result = await WebBrowser.openAuthSessionAsync(data.url!, redirectTo);



  if (result.type === "cancel" || result.type === "dismiss") return "cancelled";

  if (result.type !== "success") return "error";



  // result.url = shopper://auth-callback?code=xxx&...

  // On iOS, ASWebAuthenticationSession fires the URL through the OS URL-scheme

  // handler, which Expo Router picks up automatically via Linking.addEventListener.

  // On Android, Chrome Custom Tabs intercept the redirect internally and return it

  // as result.url without firing a system intent — so Linking.addEventListener

  // never fires. We must navigate to /auth-callback manually on Android.

  if (Platform.OS === "android" && result.url) {

    const parsed = Linking.parse(result.url);

    const code = typeof parsed.queryParams?.code === "string" ? parsed.queryParams.code : undefined;
    const redirectParam = typeof parsed.queryParams?.redirect === "string" ? parsed.queryParams.redirect : undefined;
    const viaParam = typeof parsed.queryParams?.via === "string" ? parsed.queryParams.via : undefined;

    if (code) {

      router.replace({
        pathname: "/auth-callback",
        params: {
          code,
          ...(redirectParam ? { redirect: redirectParam } : {}),
          ...(viaParam ? { via: viaParam } : {}),
        },
      });

    }

  }



  return "success";

}

