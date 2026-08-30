/**
 * admin Supabase client — used for direct DB calls from the admin app.
 *
 * Architecture:
 *   The admin app talks to the Railway backend via axios (lib/api.ts) for
 *   most operations. For the marketing tool and coupon management we need
 *   direct Supabase access (RPCs, Edge Function invocations) so a Supabase
 *   client is added here.
 *
 *   Auth: the admin panel uses its own JWT (stored in admin.store), NOT the
 *   Supabase anon session. We create the client with the anon key and inject
 *   the admin Bearer token on each call via the Authorization header option.
 *   This means the Supabase RLS/SECURITY DEFINER functions see the caller's
 *   JWT and can enforce is_manager() correctly.
 *
 *   Usage:
 *     import { getAdminSupabase } from '@/lib/supabase';
 *     const sb = getAdminSupabase();        // uses current token from store
 *     const { data } = await sb.rpc('get_marketing_targets', { ... });
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useAdminStore } from '@/stores/admin.store';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error(
    '[admin/supabase] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env',
  );
}

/**
 * Returns a Supabase client with the current admin JWT injected.
 * Called per-request (not a singleton) so the token is always fresh.
 */
export function getAdminSupabase(): SupabaseClient {
  const token = useAdminStore.getState().token;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // The Authorization header above only covers REST calls -- Realtime
  // authenticates its websocket separately and falls back to the anon key
  // unless told otherwise, which makes RLS reject every subscription for
  // tables that require the admin/manager role (orders, delivery_assignments,
  // driver_locations). Without this, those subscriptions connect and report
  // "SUBSCRIBED" but silently never deliver events.
  if (token) client.realtime.setAuth(token);
  return client;
}
