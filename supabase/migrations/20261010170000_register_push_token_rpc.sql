-- A raw client upsert into notification_tokens can register a NEW token
-- fine, but fails RLS the moment the same token already belongs to a
-- DIFFERENT user_id (device reused, signed in as a different account):
-- the upsert's conflict path is an UPDATE under the hood, and the owner-
-- scoped UPDATE policy (USING auth.uid() = user_id) correctly sees "user B
-- updating user A's row" and blocks it -- confirmed live. Loosening that
-- policy to let it through would let any authenticated user hijack any
-- other user's push-token row by registering a known/guessed token string
-- under their own account -- the same class of gap already fixed once
-- this session for manual-payment-proof submission (RLS's WITH CHECK/
-- USING can restrict column VALUES on a row a caller already owns, but
-- can't safely express "reassign a row you don't own, but only via this
-- one specific operation").
--
-- The fix is the same shape as submit_manual_payment_proof: a
-- SECURITY DEFINER RPC that derives the owner from auth.uid() (never a
-- client-supplied value), so "whoever is currently authenticated on this
-- device gets to claim this token" is enforced by the function itself,
-- not by a broadened, generally-exploitable RLS policy.
CREATE OR REPLACE FUNCTION public.register_push_token(
  p_expo_push_token text,
  p_platform        text,
  p_device_id       text DEFAULT NULL,
  p_app_version     text DEFAULT NULL
)
RETURNS public.notification_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.notification_tokens;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.notification_tokens (user_id, expo_push_token, platform, device_id, app_version, invalidated_at, invalid_reason)
  VALUES (auth.uid(), p_expo_push_token, p_platform, p_device_id, p_app_version, NULL, NULL)
  ON CONFLICT (expo_push_token) DO UPDATE SET
    user_id        = auth.uid(),
    platform       = p_platform,
    device_id      = p_device_id,
    app_version    = p_app_version,
    invalidated_at = NULL,
    invalid_reason = NULL,
    last_seen_at   = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.register_push_token(text, text, text, text) TO authenticated;
