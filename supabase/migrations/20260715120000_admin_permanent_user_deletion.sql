-- Atomic permanent account deletion for the Users Manager.
--
-- Account-owned records keep their existing ON DELETE CASCADE behavior. Rows
-- that form operational, financial, or audit history retain their business data
-- while their user references are anonymized with ON DELETE SET NULL.

DO $$
DECLARE
  v_ref record;
  v_constraint record;
BEGIN
  FOR v_ref IN
    SELECT * FROM (VALUES
      ('public', 'orders',                  'user_id'),
      ('public', 'orders',                  'assigned_driver_id'),
      ('public', 'loyalty_point_awards',    'user_id'),
      ('public', 'loyalty_ledger',          'user_id'),
      ('public', 'loyalty_ledger',          'created_by'),
      ('public', 'gift_redemptions',        'user_id'),
      ('public', 'referral_rewards',        'referrer_id'),
      ('public', 'referral_rewards',        'referee_id'),
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
      ('public', 'order_notes',             'author_id')
    ) AS refs(schema_name, table_name, column_name)
  LOOP
    IF to_regclass(format('%I.%I', v_ref.schema_name, v_ref.table_name)) IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = v_ref.schema_name
           AND table_name = v_ref.table_name
           AND column_name = v_ref.column_name
       ) THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I DROP NOT NULL',
      v_ref.schema_name,
      v_ref.table_name,
      v_ref.column_name
    );

    FOR v_constraint IN
      SELECT
        c.conname,
        referenced_namespace.nspname AS referenced_schema,
        referenced_table.relname AS referenced_table
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = c.conkey[1]
      JOIN pg_class referenced_table ON referenced_table.oid = c.confrelid
      JOIN pg_namespace referenced_namespace ON referenced_namespace.oid = referenced_table.relnamespace
      WHERE c.contype = 'f'
        AND array_length(c.conkey, 1) = 1
        AND c.conrelid = to_regclass(format('%I.%I', v_ref.schema_name, v_ref.table_name))
        AND c.confrelid IN ('auth.users'::regclass, 'public.profiles'::regclass)
        AND a.attname = v_ref.column_name
    LOOP
      EXECUTE format(
        'ALTER TABLE %I.%I DROP CONSTRAINT %I',
        v_ref.schema_name,
        v_ref.table_name,
        v_constraint.conname
      );
      EXECUTE format(
        'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I(id) ON DELETE SET NULL',
        v_ref.schema_name,
        v_ref.table_name,
        v_constraint.conname,
        v_ref.column_name,
        v_constraint.referenced_schema,
        v_constraint.referenced_table
      );
    END LOOP;
  END LOOP;
END
$$;

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
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  SELECT p.role::text
    INTO v_actor_role
  FROM public.profiles p
  WHERE p.id = v_actor_id;

  IF v_actor_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'administrator_required' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_required' USING ERRCODE = '22023';
  END IF;

  IF p_target_user_id = v_actor_id THEN
    RAISE EXCEPTION 'self_deletion_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'deletion_reason_required' USING ERRCODE = '22023';
  END IF;

  IF btrim(p_reason) NOT IN (
    'policy_violation',
    'fraud',
    'duplicate',
    'spam',
    'user_request',
    'other'
  ) THEN
    RAISE EXCEPTION 'invalid_deletion_reason' USING ERRCODE = '22023';
  END IF;

  IF char_length(COALESCE(p_admin_notes, '')) > 2000 THEN
    RAISE EXCEPTION 'admin_notes_too_long' USING ERRCODE = '22023';
  END IF;

  SELECT p.role::text
    INTO v_target_role
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = p_target_user_id
  FOR UPDATE OF p, u;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- The immutable deletion record intentionally retains only the target's
  -- pseudonymous UUID, the reason, and the acting administrator. Direct
  -- identifiers such as email and name are not copied into historical logs.
  INSERT INTO public.user_deletion_log (
    deleted_user_id,
    deleted_user_email,
    deleted_user_name,
    deleted_by,
    deletion_type,
    reason,
    admin_notes
  ) VALUES (
    p_target_user_id,
    NULL,
    NULL,
    v_actor_id,
    'admin',
    btrim(p_reason),
    NULLIF(btrim(p_admin_notes), '')
  );

  INSERT INTO public.admin_audit_log (
    admin_id,
    action,
    target_user_id,
    target_user_email,
    details
  ) VALUES (
    v_actor_id,
    'delete_user_permanently',
    p_target_user_id,
    NULL,
    jsonb_strip_nulls(jsonb_build_object(
      'targetRole', v_target_role,
      'reason', btrim(p_reason),
      'adminNotes', NULLIF(btrim(p_admin_notes), '')
    ))
  );

  -- Remove identifiers copied by older audit writers while retaining the
  -- pseudonymous UUID, action, reason, timestamps, and operational facts.
  UPDATE public.user_deletion_log
  SET deleted_user_email = NULL,
      deleted_user_name = NULL
  WHERE deleted_user_id = p_target_user_id;

  UPDATE public.admin_audit_log
  SET target_user_email = NULL,
      details = COALESCE(details, '{}'::jsonb)
        - 'email' - 'targetEmail' - 'targetName' - 'actorEmail'
  WHERE target_user_id = p_target_user_id
     OR admin_id = p_target_user_id;

  -- Explicit updates also cover old deployments where a UUID column had no
  -- enforced foreign key. Existing FKs were changed to SET NULL above.
  FOR v_ref IN
    SELECT * FROM (VALUES
      ('public', 'orders',                  'user_id'),
      ('public', 'orders',                  'assigned_driver_id'),
      ('public', 'loyalty_point_awards',    'user_id'),
      ('public', 'loyalty_ledger',          'user_id'),
      ('public', 'loyalty_ledger',          'created_by'),
      ('public', 'gift_redemptions',        'user_id'),
      ('public', 'referral_rewards',        'referrer_id'),
      ('public', 'referral_rewards',        'referee_id'),
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
      ('public', 'order_notes',             'author_id')
    ) AS refs(schema_name, table_name, column_name)
  LOOP
    IF to_regclass(format('%I.%I', v_ref.schema_name, v_ref.table_name)) IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = v_ref.schema_name
           AND table_name = v_ref.table_name
           AND column_name = v_ref.column_name
       ) THEN
      EXECUTE format(
        'UPDATE %I.%I SET %I = NULL WHERE %I = $1',
        v_ref.schema_name,
        v_ref.table_name,
        v_ref.column_name,
        v_ref.column_name
      ) USING p_target_user_id;
    END IF;
  END LOOP;

  -- Both deletes and both log writes share the RPC transaction. Any FK,
  -- trigger, or Auth failure rolls the profile, auth row, anonymization, and
  -- audit writes back together.
  DELETE FROM public.profiles WHERE id = p_target_user_id;
  DELETE FROM auth.users WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'auth_user_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'deleted', true,
    'userId', p_target_user_id
  );
END;
$$;

COMMENT ON FUNCTION public.admin_delete_user_permanently(uuid, text, text) IS
  'Atomically deletes an Auth user and profile, anonymizes retained history, and writes deletion audit records. Admin-only; self-deletion is forbidden.';

REVOKE ALL ON FUNCTION public.admin_delete_user_permanently(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_user_permanently(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_delete_user_permanently(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_permanently(uuid, text, text) TO authenticated;

-- Supabase normally reloads PostgREST on DDL, but notify explicitly so the new
-- RPC and its exact named-argument signature are immediately visible.
NOTIFY pgrst, 'reload schema';
