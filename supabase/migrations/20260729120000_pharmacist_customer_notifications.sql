-- Pharmacist customer notification helpers.
--
-- Allows pharmacists to send customer-facing order and prescription
-- notifications for events that originate in the pharmacist native app.
-- The implementation is intentionally narrow: it only permits staff to
-- notify a customer about an order in a pharmacist-handled state or a
-- prescription review result, and the write is routed through a server-
-- owned SECURITY DEFINER function rather than relying on the raw
-- notifications INSERT policy.

CREATE OR REPLACE FUNCTION public.notify_pharmacist_customer_order_update(
  p_order_id uuid,
  p_event_type text,
  p_category text,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'::jsonb,
  p_action_url text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id uuid;
  v_order_status text;
  v_notification_id uuid;
  v_event_key text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  SELECT user_id, status::text
    INTO v_recipient_id, v_order_status
    FROM public.orders
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.profiles
     WHERE id = auth.uid()
       AND role IN ('admin', 'manager', 'pharmacist')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF v_order_status NOT IN (
    'pending', 'confirmed', 'verification', 'payment_pending',
    'payment_approved', 'preparing', 'ready'
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  v_event_key := coalesce(nullif(trim(p_idempotency_key), ''),
    format('%s:%s:%s', coalesce(p_event_type, 'order'), p_order_id::text, md5(coalesce(p_data, '{}'::jsonb)::text))
  );

  SELECT notification_id
    INTO v_notification_id
    FROM public.notification_outbox
   WHERE idempotency_key = v_event_key;

  IF v_notification_id IS NOT NULL THEN
    RETURN v_notification_id;
  END IF;

  INSERT INTO public.notifications (
    user_id, type, category, title, body, data, action_url, is_read, event_key
  ) VALUES (
    v_recipient_id, p_event_type, p_category, p_title, p_body,
    coalesce(p_data, '{}'::jsonb), p_action_url, false, v_event_key
  ) RETURNING id INTO v_notification_id;

  INSERT INTO public.notification_outbox (
    notification_id, recipient_id, event_type, category, title, body,
    payload, idempotency_key
  ) VALUES (
    v_notification_id, v_recipient_id, p_event_type, p_category, p_title, p_body,
    jsonb_build_object(
      'data', coalesce(p_data, '{}'::jsonb),
      'action_url', p_action_url,
      'notification_id', v_notification_id
    ), v_event_key
  );

  RETURN v_notification_id;
EXCEPTION WHEN unique_violation THEN
  SELECT notification_id
    INTO v_notification_id
    FROM public.notification_outbox
   WHERE idempotency_key = v_event_key;

  IF v_notification_id IS NOT NULL THEN
    RETURN v_notification_id;
  END IF;
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_pharmacist_customer_order_update(
  uuid, text, text, text, text, jsonb, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_pharmacist_customer_prescription_review(
  p_prescription_id uuid,
  p_decision text,
  p_event_type text,
  p_category text,
  p_title text,
  p_body text,
  p_action_url text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id uuid;
  v_notification_id uuid;
  v_event_key text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  SELECT user_id
    INTO v_recipient_id
    FROM public.prescriptions
   WHERE id = p_prescription_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'prescription_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.profiles
     WHERE id = auth.uid()
       AND role IN ('admin', 'manager', 'pharmacist')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  v_event_key := coalesce(nullif(trim(p_idempotency_key), ''),
    format('%s:%s:%s', coalesce(p_event_type, 'health'), p_prescription_id::text, p_decision)
  );

  SELECT notification_id
    INTO v_notification_id
    FROM public.notification_outbox
   WHERE idempotency_key = v_event_key;

  IF v_notification_id IS NOT NULL THEN
    RETURN v_notification_id;
  END IF;

  INSERT INTO public.notifications (
    user_id, type, category, title, body, data, action_url, is_read, event_key
  ) VALUES (
    v_recipient_id, p_event_type, p_category, p_title, p_body,
    jsonb_build_object('decision', p_decision), p_action_url, false, v_event_key
  ) RETURNING id INTO v_notification_id;

  INSERT INTO public.notification_outbox (
    notification_id, recipient_id, event_type, category, title, body,
    payload, idempotency_key
  ) VALUES (
    v_notification_id, v_recipient_id, p_event_type, p_category, p_title, p_body,
    jsonb_build_object(
      'decision', p_decision,
      'action_url', p_action_url,
      'notification_id', v_notification_id
    ), v_event_key
  );

  RETURN v_notification_id;
EXCEPTION WHEN unique_violation THEN
  SELECT notification_id
    INTO v_notification_id
    FROM public.notification_outbox
   WHERE idempotency_key = v_event_key;

  IF v_notification_id IS NOT NULL THEN
    RETURN v_notification_id;
  END IF;
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_pharmacist_customer_prescription_review(
  uuid, text, text, text, text, text, text, text
) TO authenticated;
