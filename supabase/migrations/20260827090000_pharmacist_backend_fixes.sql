-- Pharmacist backend reconstruction fixes — 2026-08-27
--
-- Closes gaps confirmed live by a full backend audit of the pharmacist-facing
-- app: no RLS grant lets a pharmacist read orders at all, transition_order has
-- no pharmacist-specific restriction (a pharmacist could legally drive any
-- transition including driver/logistics-only ones), no branch-assignment data
-- model exists anywhere, no "new order" notification path exists for staff,
-- and the two drifted copies of the prescriptions submission_source check
-- constraint disagree about whether 'scan' is a valid value.

-- ─── 1. Pharmacist branch assignment ────────────────────────────────────────
-- orders.branch_id already exists (20260826953000); nothing on the staff side
-- can be scoped to it because profiles has no branch dimension at all.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS branch_id text REFERENCES public."Branch"(id);

COMMENT ON COLUMN public.profiles.branch_id IS
  'Which branch a pharmacist is staffed at. NULL means unassigned -- such a '
  'pharmacist sees every branch''s queue (safe default until admin tooling '
  'assigns branches), matching this app''s pre-existing single-shared-queue '
  'behavior. Meaningless for other roles.';

CREATE OR REPLACE FUNCTION public.set_pharmacist_branch(p_pharmacist_id uuid, p_branch_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_pharmacist_id AND role = 'pharmacist') THEN
    RAISE EXCEPTION 'not_a_pharmacist' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles SET branch_id = p_branch_id WHERE id = p_pharmacist_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_pharmacist_branch(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_pharmacist_branch(uuid, text) TO authenticated;

-- ─── 2. Pharmacist SELECT access to orders / order_items ────────────────────
-- Confirmed live: orders_select_admin only covers admin/manager. There is no
-- policy letting a pharmacist read orders at all -- branch-scoped when the
-- pharmacist has one assigned, unscoped (sees everything, current behavior)
-- when they don't.

DROP POLICY IF EXISTS orders_select_pharmacist ON public.orders;
CREATE POLICY orders_select_pharmacist
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'pharmacist'
        AND (p.branch_id IS NULL OR p.branch_id = orders.branch_id)
    )
  );

DROP POLICY IF EXISTS order_items_select_pharmacist ON public.order_items;
CREATE POLICY order_items_select_pharmacist
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE o.id = order_items.order_id
        AND p.role = 'pharmacist'
        AND (p.branch_id IS NULL OR p.branch_id = o.branch_id)
    )
  );

-- ─── 3. transition_order: pharmacist restriction branch ─────────────────────
-- Confirmed live: a pharmacist role can legally drive ANY transition in the
-- full state graph, including driver/logistics-only ones (ready onward) --
-- only a driver-ownership branch exists. The pharmacist UI itself never
-- offers anything past "ready" (OrderDetailScreen.getPharmacistActions'
-- default case returns []), so this only closes the enforcement gap -- it
-- does not change any behavior the app actually uses today.

CREATE OR REPLACE FUNCTION public.transition_order(p_order_id uuid, p_next_status text)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders;
  v_role text;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'manager', 'pharmacist', 'driver') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    (v_order.status::text = 'pending' AND p_next_status IN ('verification', 'cancelled')) OR
    (v_order.status::text = 'verification' AND p_next_status IN ('payment_pending', 'payment_approved', 'cancelled')) OR
    (v_order.status::text = 'payment_pending' AND p_next_status IN ('payment_approved', 'cancelled')) OR
    (v_order.status::text = 'payment_approved' AND p_next_status IN ('preparing', 'cancelled')) OR
    (v_order.status::text = 'preparing' AND p_next_status IN ('ready', 'cancelled')) OR
    (v_order.status::text = 'ready' AND p_next_status IN ('driver_assigned', 'cancelled')) OR
    (v_order.status::text = 'driver_assigned' AND p_next_status IN ('driver_accepted', 'cancelled')) OR
    (v_order.status::text = 'driver_accepted' AND p_next_status IN ('out_for_delivery', 'cancelled')) OR
    (v_order.status::text = 'out_for_delivery' AND p_next_status IN ('delivered', 'cancelled')) OR
    (v_order.status::text IN ('delivered', 'cancelled') AND p_next_status = 'archived')
  ) THEN
    RAISE EXCEPTION 'invalid_order_transition' USING ERRCODE = '22023';
  END IF;

  IF v_role = 'driver' THEN
    IF p_next_status NOT IN ('driver_accepted', 'out_for_delivery', 'delivered')
       OR v_order.assigned_driver_id IS DISTINCT FROM auth.uid()
       OR NOT EXISTS (
         SELECT 1
         FROM public.delivery_assignments AS assignment
         WHERE assignment.order_id = p_order_id
           AND assignment.driver_id = auth.uid()
           AND (
             (p_next_status = 'driver_accepted' AND assignment.response_status = 'offered')
             OR (p_next_status IN ('out_for_delivery', 'delivered') AND assignment.response_status = 'accepted')
           )
       ) THEN
      RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_role = 'pharmacist' THEN
    IF p_next_status NOT IN ('verification', 'payment_pending', 'payment_approved', 'preparing', 'ready', 'cancelled') THEN
      RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.orders
  SET status = p_next_status::public.order_status,
      last_status_at = now(),
      updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;
REVOKE ALL ON FUNCTION public.transition_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_order(uuid, text) TO authenticated;

-- ─── 4. New-order notification for staff (reliable, trigger-based) ──────────
-- Confirmed live: nothing pushes a "new order" notification to pharmacists --
-- the only staff notification path is prescription submission, which is a
-- plain client-called RPC (fire-and-forget, can silently never fire). A
-- trigger can't be forgotten the way a client call can, so new orders use one.

CREATE OR REPLACE FUNCTION public.notify_staff_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_staff record;
  v_event_key text;
  v_notification_id uuid;
BEGIN
  FOR v_staff IN
    SELECT id
      FROM public.profiles
     WHERE role IN ('admin', 'manager', 'pharmacist')
       AND (branch_id IS NULL OR NEW.branch_id IS NULL OR branch_id = NEW.branch_id)
  LOOP
    v_event_key := format('order:%s:placed:%s', NEW.id, v_staff.id);

    SELECT notification_id INTO v_notification_id
      FROM public.notification_outbox
     WHERE idempotency_key = v_event_key;

    IF v_notification_id IS NULL THEN
      INSERT INTO public.notifications (
        user_id, type, category, title, body, data, action_url, is_read, event_key
      ) VALUES (
        v_staff.id,
        'order',
        'orders',
        'طلب جديد',
        format('طلب جديد رقم %s بحاجة إلى المراجعة.', left(NEW.id::text, 8)),
        jsonb_build_object('kind', 'order_placed', 'orderId', NEW.id),
        format('/(pharmacist)/order/%s', NEW.id),
        false,
        v_event_key
      ) RETURNING id INTO v_notification_id;

      INSERT INTO public.notification_outbox (
        notification_id, recipient_id, event_type, category, title, body,
        payload, idempotency_key
      ) VALUES (
        v_notification_id,
        v_staff.id,
        'order',
        'orders',
        'طلب جديد',
        format('طلب جديد رقم %s بحاجة إلى المراجعة.', left(NEW.id::text, 8)),
        jsonb_build_object(
          'data', jsonb_build_object('kind', 'order_placed', 'orderId', NEW.id),
          'action_url', format('/(pharmacist)/order/%s', NEW.id),
          'notification_id', v_notification_id
        ),
        v_event_key
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_staff_new_order ON public.orders;
CREATE TRIGGER trg_notify_staff_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_staff_new_order();

-- ─── 5. Reconcile drifted prescriptions.submission_source constraint ────────
-- Two copies of 20260705120000_prescriptions_admin_review.sql disagree: this
-- tree's constraint never allowed 'scan', but the pharmacist frontend's
-- SubmissionSource type (and the customer scan-submission flow) assume it is.

ALTER TABLE public.prescriptions DROP CONSTRAINT IF EXISTS prescriptions_submission_source_check;
ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_submission_source_check
  CHECK (submission_source IN ('manual', 'whatsapp', 'scan'));
