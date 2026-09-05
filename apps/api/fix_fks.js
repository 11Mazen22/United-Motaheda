require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

const sql = `
CREATE OR REPLACE FUNCTION public.admin_delete_user_permanently(
  p_target_user_id uuid,
  p_reason text,
  p_admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
  v_ref record;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000'; END IF;
  SELECT p.role::text INTO v_actor_role FROM public.profiles p WHERE p.id = v_actor_id;
  IF v_actor_role IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'administrator_required' USING ERRCODE = '42501'; END IF;
  IF p_target_user_id IS NULL THEN RAISE EXCEPTION 'target_user_required' USING ERRCODE = '22023'; END IF;
  IF p_target_user_id = v_actor_id THEN RAISE EXCEPTION 'self_deletion_not_allowed' USING ERRCODE = '42501'; END IF;
  SELECT p.role::text INTO v_target_role FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE p.id = p_target_user_id FOR UPDATE OF p, u;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002'; END IF;

  INSERT INTO public.user_deletion_log (deleted_user_id, deleted_by, deletion_type, reason, admin_notes)
  VALUES (p_target_user_id, v_actor_id, 'admin', btrim(p_reason), NULLIF(btrim(p_admin_notes), ''));

  FOR v_ref IN SELECT * FROM (VALUES
      ('public', 'orders',                  'user_id'),
      ('public', 'orders',                  'assigned_driver_id'),
      ('public', 'loyalty_point_awards',    'user_id'),
      ('public', 'loyalty_ledger',          'user_id'),
      ('public', 'loyalty_ledger',          'created_by'),
      ('public', 'reward_campaigns',        'created_by'),
      ('public', 'coupon_batches',          'created_by'),
      ('public', 'user_suspensions',        'suspended_by'),
      ('public', 'user_suspensions',        'unsuspended_by'),
      ('public', 'user_deletion_log',       'deleted_by'),
      ('public', 'admin_audit_log',         'admin_id'),
      ('public', 'prescriptions',           'reviewed_by'),
      ('public', 'refill_requests',         'reviewed_by'),
      ('public', 'delivery_assignments',    'driver_id'),
      ('public', 'delivery_assignments',    'assigned_by'),
      ('public', 'delivery_issues',         'driver_id'),
      ('public', 'delivery_issues',         'resolved_by'),
      ('public', 'promotions',              'created_by'),
      ('public', 'order_notes',             'author_id'),
      ('public', 'order_status_history',    'actor_id'),
      ('public', 'cancellations',           'actor_id'),
      ('public', 'stock_movements',         'actor_id'),
      ('public', 'reward_audit_logs',       'actor_id'),
      ('public', 'sms_audit_log',           'actor_id')
    ) AS refs(schema_name, table_name, column_name)
  LOOP
    IF to_regclass(format('%I.%I', v_ref.schema_name, v_ref.table_name)) IS NOT NULL THEN
      EXECUTE format('UPDATE %I.%I SET %I = NULL WHERE %I = $1', v_ref.schema_name, v_ref.table_name, v_ref.column_name, v_ref.column_name) USING p_target_user_id;
    END IF;
  END LOOP;
  
  DELETE FROM public.prescriptions WHERE user_id = p_target_user_id;

  DELETE FROM public.profiles WHERE id = p_target_user_id;
  DELETE FROM auth.users WHERE id = p_target_user_id;
  RETURN jsonb_build_object('deleted', true, 'userId', p_target_user_id);
END;
$$;
`;

client.connect().then(() => client.query(sql)).then(() => console.log('Fixed FKs!')).catch(e => console.error(e)).finally(() => client.end());
