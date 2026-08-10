-- Notify pharmacy staff when a customer submits a prescription for review.
-- The caller may only notify for a prescription they own; recipients are
-- resolved server-side from staff profiles and writes use the existing
-- notifications/outbox tables.

CREATE OR REPLACE FUNCTION public.notify_staff_prescription_submitted(
  p_prescription_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_owner_id uuid;
  v_name text;
  v_staff record;
  v_count integer := 0;
  v_event_key text;
  v_notification_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  SELECT user_id, coalesce(nullif(trim(name), ''), 'وصفة طبية')
    INTO v_owner_id, v_name
    FROM public.prescriptions
   WHERE id = p_prescription_id
     AND review_status = 'pending_review';

  IF NOT FOUND OR v_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'prescription_not_owned' USING ERRCODE = '42501';
  END IF;

  FOR v_staff IN
    SELECT id
      FROM public.profiles
     WHERE role IN ('admin', 'manager', 'pharmacist')
  LOOP
    v_event_key := format('prescription:%s:submitted:%s', p_prescription_id, v_staff.id);

    SELECT notification_id INTO v_notification_id
      FROM public.notification_outbox
     WHERE idempotency_key = v_event_key;

    IF v_notification_id IS NULL THEN
      INSERT INTO public.notifications (
        user_id, type, category, title, body, data, action_url, is_read, event_key
      ) VALUES (
        v_staff.id,
        'health',
        'health_reminders',
        'وصفة طبية جديدة للمراجعة',
        format('تم إرسال %s وتحتاج إلى مراجعة.', v_name),
        jsonb_build_object('kind', 'prescription_submitted', 'prescriptionId', p_prescription_id),
        '/(pharmacist)/prescriptions',
        false,
        v_event_key
      ) RETURNING id INTO v_notification_id;

      INSERT INTO public.notification_outbox (
        notification_id, recipient_id, event_type, category, title, body,
        payload, idempotency_key
      ) VALUES (
        v_notification_id,
        v_staff.id,
        'health',
        'health_reminders',
        'وصفة طبية جديدة للمراجعة',
        format('تم إرسال %s وتحتاج إلى مراجعة.', v_name),
        jsonb_build_object(
          'data', jsonb_build_object('kind', 'prescription_submitted', 'prescriptionId', p_prescription_id),
          'action_url', '/(pharmacist)/prescriptions',
          'notification_id', v_notification_id
        ),
        v_event_key
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_staff_prescription_submitted(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_staff_prescription_submitted(uuid) TO authenticated;