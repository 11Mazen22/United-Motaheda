-- driver_decline_assignment clears orders.assigned_driver_id when a driver
-- declines an offer, but never touches orders.status — so a declined order
-- is left sitting at 'driver_assigned' with no driver attached. Nothing else
-- automatically re-queues it: assignDriver()/logisticsApi.ts's own
-- re-offer path only advances status to 'driver_assigned' when the order is
-- currently 'ready' (it silently skips the transition otherwise), and any
-- screen filtering on status = 'ready' for "needs a driver" won't surface
-- this order again until a human notices assigned_driver_id IS NULL some
-- other way. Confirmed via pg_get_functiondef that the previous version's
-- UPDATE never sets status at all.
--
-- Fixed by resetting status back to 'ready' in the same guarded UPDATE —
-- still scoped to `assigned_driver_id = auth.uid()` (this declining
-- driver), so the existing "if staff already reassigned it in the
-- meantime, leave it alone" race protection is unchanged; added
-- `AND status = 'driver_assigned'` as an explicit extra guard so this can
-- never downgrade an order that has somehow already moved past that state.
CREATE OR REPLACE FUNCTION public.driver_decline_assignment(p_assignment_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS delivery_assignments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.delivery_assignments;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  UPDATE public.delivery_assignments
  SET response_status = 'declined',
      responded_at = now(),
      decline_reason = NULLIF(trim(coalesce(p_reason, '')), '')
  WHERE id = p_assignment_id
    AND driver_id = auth.uid()
    AND response_status = 'offered'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'assignment_not_found_or_already_resolved' USING ERRCODE = '22023';
  END IF;

  -- Best-effort by design, same as before: if the order was already
  -- reassigned/changed by staff in the meantime, leave it alone — the
  -- decline itself is already durably recorded above regardless. Now also
  -- resets status back to 'ready' so the order re-enters the assignable
  -- pool instead of being stranded at 'driver_assigned' with no driver.
  UPDATE public.orders
  SET assigned_driver_id = NULL,
      status = 'ready',
      last_status_at = now(),
      updated_at = now()
  WHERE id = v_row.order_id
    AND assigned_driver_id = auth.uid()
    AND status = 'driver_assigned';

  RETURN v_row;
END;
$function$;
