-- Internal staff notes on orders + a read-only timeline RPC.
--
-- This is the backend half of the "Order Detail Drawer" shared by
-- OrdersManager and OperationsHub (see admin/OrderDetailDrawer.tsx): rather
-- than merging the two screens (a broad, paginated, search/audit-oriented
-- ledger vs. a low-latency live dispatch board — genuinely different
-- interaction models that both already share the same AdminOrder data), the
-- two screens now open the SAME per-order detail surface, built from real
-- data already in the schema (orders, delivery_assignments, delivery_issues)
-- plus this new lightweight notes table.

-- ─── order_notes ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.order_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES auth.users(id),
  body       text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_notes_order_idx ON public.order_notes (order_id, created_at DESC);

ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_notes: staff select all" ON public.order_notes;
CREATE POLICY "order_notes: staff select all"
  ON public.order_notes FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'pharmacist'));

DROP POLICY IF EXISTS "order_notes: staff insert own" ON public.order_notes;
CREATE POLICY "order_notes: staff insert own"
  ON public.order_notes FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'pharmacist')
  );

-- Notes are an append-only log — no update/delete policy, intentionally
-- (matches public.admin_audit_log's immutability pattern).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_notes;
  END IF;
END $$;

-- ─── admin_order_timeline ───────────────────────────────────────────────────
-- One aggregated, chronologically-sorted read of everything that happened to
-- an order: creation, each assignment lifecycle event, each delivery issue
-- lifecycle event, and staff notes. SECURITY DEFINER so pharmacists/managers
-- can read assignment/issue rows for a single order without needing broad
-- table-level SELECT grants beyond what their own RLS already allows.

CREATE OR REPLACE FUNCTION public.admin_order_timeline(p_order_id uuid)
RETURNS TABLE (
  event_at    timestamptz,
  event_type  text,
  actor_id    uuid,
  detail      jsonb
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('admin', 'manager', 'pharmacist') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT o.created_at, 'order_created'::text, NULL::uuid,
         jsonb_build_object('status', o.status, 'total', o.total)
  FROM public.orders o WHERE o.id = p_order_id

  UNION ALL
  SELECT a.offered_at, 'assignment_offered'::text, a.assigned_by,
         jsonb_build_object('driverId', a.driver_id, 'kind', a.assignment_kind)
  FROM public.delivery_assignments a WHERE a.order_id = p_order_id

  UNION ALL
  SELECT a.responded_at, CASE WHEN a.response_status = 'declined' THEN 'assignment_declined' ELSE 'assignment_accepted' END, a.driver_id,
         jsonb_build_object('driverId', a.driver_id, 'declineReason', a.decline_reason)
  FROM public.delivery_assignments a WHERE a.order_id = p_order_id AND a.responded_at IS NOT NULL

  UNION ALL
  SELECT a.picked_up_at, 'picked_up'::text, a.driver_id, jsonb_build_object('driverId', a.driver_id)
  FROM public.delivery_assignments a WHERE a.order_id = p_order_id AND a.picked_up_at IS NOT NULL

  UNION ALL
  SELECT a.delivered_at, 'delivered'::text, a.driver_id, jsonb_build_object('driverId', a.driver_id)
  FROM public.delivery_assignments a WHERE a.order_id = p_order_id AND a.delivered_at IS NOT NULL

  UNION ALL
  SELECT a.superseded_at, 'assignment_superseded'::text, a.driver_id, jsonb_build_object('driverId', a.driver_id)
  FROM public.delivery_assignments a WHERE a.order_id = p_order_id AND a.superseded_at IS NOT NULL

  UNION ALL
  SELECT i.created_at, 'issue_reported'::text, i.driver_id,
         jsonb_build_object('reasonCode', i.reason_code, 'note', i.note, 'issueId', i.id)
  FROM public.delivery_issues i WHERE i.order_id = p_order_id

  UNION ALL
  SELECT i.resolved_at, 'issue_resolved'::text, i.resolved_by,
         jsonb_build_object('reasonCode', i.reason_code, 'resolutionNote', i.resolution_note, 'issueId', i.id)
  FROM public.delivery_issues i WHERE i.order_id = p_order_id AND i.resolved_at IS NOT NULL

  UNION ALL
  SELECT n.created_at, 'note_added'::text, n.author_id, jsonb_build_object('body', n.body, 'noteId', n.id)
  FROM public.order_notes n WHERE n.order_id = p_order_id

  ORDER BY 1 DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_order_timeline(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_order_timeline(uuid) TO authenticated;
