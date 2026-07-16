-- Durable server-owned OS notification delivery pipeline.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS event_key text;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_event_key_idx ON public.notifications (user_id, event_key) WHERE event_key IS NOT NULL;

ALTER TABLE public.notification_tokens
  ADD COLUMN IF NOT EXISTS invalidated_at timestamptz,
  ADD COLUMN IF NOT EXISTS invalid_reason text,
  ADD COLUMN IF NOT EXISTS last_push_at timestamptz;
CREATE INDEX IF NOT EXISTS notification_tokens_active_user_idx ON public.notification_tokens (user_id) WHERE invalidated_at IS NULL;

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL UNIQUE REFERENCES public.notifications(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  category text,
  title text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','sent','retrying','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_outbox_claim_idx ON public.notification_outbox (next_attempt_at, created_at) WHERE status IN ('queued','retrying');

CREATE TABLE IF NOT EXISTS public.notification_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id uuid NOT NULL REFERENCES public.notification_outbox(id) ON DELETE CASCADE,
  token_id uuid REFERENCES public.notification_tokens(id) ON DELETE SET NULL,
  expo_ticket_id text,
  status text NOT NULL CHECK (status IN ('accepted','delivered','failed','retrying','skipped')),
  provider_response jsonb,
  error_code text,
  error_message text,
  receipt_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS notification_delivery_attempts_ticket_idx ON public.notification_delivery_attempts (expo_ticket_id) WHERE expo_ticket_id IS NOT NULL;

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_delivery_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_recipient_id uuid, p_event_type text, p_category text, p_title text, p_body text,
  p_data jsonb DEFAULT '{}'::jsonb, p_action_url text DEFAULT NULL, p_idempotency_key text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_notification_id uuid; v_key text; v_is_driver boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000'; END IF;
  IF p_recipient_id IS NULL OR coalesce(trim(p_event_type),'') = '' OR coalesce(trim(p_title),'') = '' OR coalesce(trim(p_body),'') = '' THEN RAISE EXCEPTION 'invalid_notification_payload' USING ERRCODE = '22023'; END IF;
  v_is_driver := EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'driver');
  IF NOT public.is_manager() AND NOT (v_is_driver AND EXISTS (SELECT 1 FROM public.orders WHERE assigned_driver_id = auth.uid() AND user_id = p_recipient_id)) THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501'; END IF;
  v_key := coalesce(nullif(trim(p_idempotency_key), ''), format('%s:%s:%s',p_event_type,p_recipient_id,md5(coalesce(p_data,'{}'::jsonb)::text)));
  SELECT notification_id INTO v_notification_id FROM public.notification_outbox WHERE idempotency_key = v_key;
  IF v_notification_id IS NOT NULL THEN RETURN v_notification_id; END IF;
  INSERT INTO public.notifications (user_id,type,category,title,body,data,action_url,is_read,event_key) VALUES (p_recipient_id,p_event_type,p_category,p_title,p_body,coalesce(p_data,'{}'::jsonb),p_action_url,false,v_key) RETURNING id INTO v_notification_id;
  INSERT INTO public.notification_outbox (notification_id,recipient_id,event_type,category,title,body,payload,idempotency_key) VALUES (v_notification_id,p_recipient_id,p_event_type,p_category,p_title,p_body,jsonb_build_object('data',coalesce(p_data,'{}'::jsonb),'action_url',p_action_url,'notification_id',v_notification_id),v_key);
  RETURN v_notification_id;
EXCEPTION WHEN unique_violation THEN
  SELECT notification_id INTO v_notification_id FROM public.notification_outbox WHERE idempotency_key = v_key;
  IF v_notification_id IS NOT NULL THEN RETURN v_notification_id; END IF; RAISE;
END; $$;
GRANT EXECUTE ON FUNCTION public.enqueue_notification(uuid,text,text,text,text,jsonb,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_notification_outbox(p_limit integer DEFAULT 100)
RETURNS SETOF public.notification_outbox LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH claimed AS (SELECT id FROM public.notification_outbox WHERE (status IN ('queued','retrying') AND next_attempt_at <= now()) OR (status='processing' AND locked_until < now()) ORDER BY next_attempt_at,created_at FOR UPDATE SKIP LOCKED LIMIT least(greatest(coalesce(p_limit,100),1),500))
  UPDATE public.notification_outbox o SET status='processing',locked_until=now()+interval '5 minutes',attempts=attempts+1,updated_at=now() FROM claimed WHERE o.id=claimed.id RETURNING o.*;
$$;
REVOKE ALL ON FUNCTION public.claim_notification_outbox(integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_notification_batch(
  p_recipient_ids uuid[], p_event_type text, p_category text, p_title text, p_body text,
  p_data jsonb DEFAULT '{}'::jsonb, p_action_url text DEFAULT NULL, p_idempotency_namespace text DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_recipient uuid; v_count integer := 0; v_namespace text;
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501'; END IF;
  v_namespace := coalesce(nullif(trim(p_idempotency_namespace), ''), gen_random_uuid()::text);
  FOREACH v_recipient IN ARRAY p_recipient_ids LOOP
    PERFORM public.enqueue_notification(v_recipient, p_event_type, p_category, p_title, p_body, p_data, p_action_url, v_namespace || ':' || v_recipient::text);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;
GRANT EXECUTE ON FUNCTION public.enqueue_notification_batch(uuid[],text,text,text,text,jsonb,text,text) TO authenticated;
