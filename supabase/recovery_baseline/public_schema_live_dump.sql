--
-- PostgreSQL database dump
--

\restrict e2L2yFoAax8NW7eYlb5caDL6MpnDbB0HwowWo6hfhmUK0miNctdqaGHKdvvP4ua

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: DeliveryStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."DeliveryStatus" AS ENUM (
    'ASSIGNED',
    'ACCEPTED',
    'REJECTED',
    'EN_ROUTE_TO_PICKUP',
    'ARRIVED_AT_PHARMACY',
    'PICKED_UP',
    'EN_ROUTE_TO_CUSTOMER',
    'ARRIVED_AT_CUSTOMER',
    'DELIVERED',
    'CANCELLED',
    'FAILED'
);


ALTER TYPE public."DeliveryStatus" OWNER TO postgres;

--
-- Name: DriverStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."DriverStatus" AS ENUM (
    'PENDING_APPROVAL',
    'APPROVED',
    'ACTIVE',
    'SUSPENDED',
    'REJECTED',
    'INACTIVE'
);


ALTER TYPE public."DriverStatus" OWNER TO postgres;

--
-- Name: allergy_severity; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.allergy_severity AS ENUM (
    'mild',
    'moderate',
    'severe'
);


ALTER TYPE public.allergy_severity OWNER TO postgres;

--
-- Name: app_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.app_role AS ENUM (
    'manager',
    'pharmacist',
    'driver',
    'admin',
    'customer'
);


ALTER TYPE public.app_role OWNER TO postgres;

--
-- Name: dependent_rel; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.dependent_rel AS ENUM (
    'Spouse',
    'Child',
    'Parent',
    'Sibling',
    'Other'
);


ALTER TYPE public.dependent_rel OWNER TO postgres;

--
-- Name: interaction_severity; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.interaction_severity AS ENUM (
    'mild',
    'moderate',
    'severe'
);


ALTER TYPE public.interaction_severity OWNER TO postgres;

--
-- Name: inventory_disposition; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.inventory_disposition AS ENUM (
    'PENDING_INSPECTION',
    'RESTOCK',
    'QUARANTINE',
    'DAMAGED',
    'EXPIRED',
    'NON_RESELLABLE',
    'DISPOSED'
);


ALTER TYPE public.inventory_disposition OWNER TO postgres;

--
-- Name: order_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'picked_up',
    'delivered',
    'cancelled',
    'processing',
    'shipped',
    'pending_payment',
    'verification',
    'payment_pending',
    'payment_approved',
    'driver_assigned',
    'driver_accepted',
    'out_for_delivery',
    'archived'
);


ALTER TYPE public.order_status OWNER TO postgres;

--
-- Name: refill_delivery; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.refill_delivery AS ENUM (
    'same_day',
    'standard',
    'pickup'
);


ALTER TYPE public.refill_delivery OWNER TO postgres;

--
-- Name: refill_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.refill_status AS ENUM (
    'pending',
    'preparing',
    'ready',
    'on_the_way',
    'delivered',
    'cancelled'
);


ALTER TYPE public.refill_status OWNER TO postgres;

--
-- Name: reminder_freq; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.reminder_freq AS ENUM (
    'daily',
    'weekly',
    'custom'
);


ALTER TYPE public.reminder_freq OWNER TO postgres;

--
-- Name: return_resolution; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.return_resolution AS ENUM (
    'PHYSICAL_RETURN',
    'REFUND_ONLY',
    'REPLACEMENT',
    'PARTIAL_REFUND'
);


ALTER TYPE public.return_resolution OWNER TO postgres;

--
-- Name: return_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.return_status AS ENUM (
    'REQUESTED',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'AWAITING_PICKUP',
    'DRIVER_ASSIGNED',
    'PICKUP_IN_PROGRESS',
    'PICKUP_FAILED',
    'PICKED_UP',
    'RETURN_IN_TRANSIT',
    'RECEIVED',
    'INSPECTION',
    'RETURN_REJECTED',
    'APPROVED_FOR_REFUND',
    'REFUND_PENDING',
    'COMPLETED'
);


ALTER TYPE public.return_status OWNER TO postgres;

--
-- Name: rx_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.rx_status AS ENUM (
    'ready',
    'active',
    'expiring',
    'expired'
);


ALTER TYPE public.rx_status OWNER TO postgres;

SET default_table_access_method = heap;

--
-- Name: inventory_state; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_state (
    product_id text NOT NULL,
    total integer NOT NULL,
    reserved integer DEFAULT 0 NOT NULL,
    committed integer DEFAULT 0 NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_state_committed_check CHECK ((committed >= 0)),
    CONSTRAINT inventory_state_no_oversell CHECK (((reserved + committed) <= total)),
    CONSTRAINT inventory_state_reserved_check CHECK ((reserved >= 0)),
    CONSTRAINT inventory_state_total_check CHECK ((total >= 0))
);


ALTER TABLE public.inventory_state OWNER TO postgres;

--
-- Name: _inventory_ensure_state(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._inventory_ensure_state(p_product_id text) RETURNS public.inventory_state
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_row    public.inventory_state%rowtype;
  v_stock  integer;
begin
  select * into v_row from public.inventory_state
    where product_id = p_product_id for update;
  if found then return v_row; end if;

  -- Lazy init from products."Stock". If the product doesn't exist, refuse.
  select greatest(coalesce("Stock", 0)::integer, 0) into v_stock
    from public.products where id::text = p_product_id;
  if v_stock is null then
    raise exception using errcode = '23503', message = 'product_not_found';
  end if;

  insert into public.inventory_state (product_id, total)
    values (p_product_id, v_stock)
    on conflict (product_id) do nothing;

  select * into v_row from public.inventory_state
    where product_id = p_product_id for update;
  return v_row;
end;
$$;


ALTER FUNCTION public._inventory_ensure_state(p_product_id text) OWNER TO postgres;

--
-- Name: _inventory_lock(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._inventory_lock(p_product_id text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select pg_advisory_xact_lock(hashtext('inv-product:' || p_product_id));
$$;


ALTER FUNCTION public._inventory_lock(p_product_id text) OWNER TO postgres;

--
-- Name: _loyalty_audit(uuid, text, text, boolean, jsonb, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._loyalty_audit(p_subject uuid, p_event_kind text, p_rpc_name text, p_success boolean, p_payload jsonb, p_error_code text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  insert into public.reward_audit_logs (
    actor_id, subject_user_id, event_kind, rpc_name, success, error_code, payload
  ) values (
    auth.uid(), p_subject, p_event_kind, p_rpc_name, p_success, p_error_code, p_payload
  );
exception when others then
  -- swallow — audit must not be the reason a happy mutation rolls back.
  null;
end;
$$;


ALTER FUNCTION public._loyalty_audit(p_subject uuid, p_event_kind text, p_rpc_name text, p_success boolean, p_payload jsonb, p_error_code text) OWNER TO postgres;

--
-- Name: loyalty_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.loyalty_accounts (
    user_id uuid NOT NULL,
    balance bigint DEFAULT 0 NOT NULL,
    lifetime_earned bigint DEFAULT 0 NOT NULL,
    lifetime_redeemed bigint DEFAULT 0 NOT NULL,
    tier_id uuid,
    version integer DEFAULT 0 NOT NULL,
    frozen_at timestamp with time zone,
    frozen_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loyalty_accounts_balance_check CHECK ((balance >= 0)),
    CONSTRAINT loyalty_accounts_lifetime_earned_check CHECK ((lifetime_earned >= 0)),
    CONSTRAINT loyalty_accounts_lifetime_redeemed_check CHECK ((lifetime_redeemed >= 0))
);


ALTER TABLE public.loyalty_accounts OWNER TO postgres;

--
-- Name: _loyalty_ensure_account(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._loyalty_ensure_account(p_user_id uuid) RETURNS public.loyalty_accounts
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_row public.loyalty_accounts%rowtype;
begin
  select * into v_row from public.loyalty_accounts
    where user_id = p_user_id
    for update;
  if not found then
    insert into public.loyalty_accounts (user_id) values (p_user_id)
      on conflict (user_id) do nothing;
    select * into v_row from public.loyalty_accounts
      where user_id = p_user_id
      for update;
  end if;
  return v_row;
end;
$$;


ALTER FUNCTION public._loyalty_ensure_account(p_user_id uuid) OWNER TO postgres;

--
-- Name: _loyalty_idempotency_begin(text, text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._loyalty_idempotency_begin(p_key text, p_endpoint text, p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_cached jsonb;
begin
  if p_key is null or length(p_key) < 16 then
    raise exception using
      errcode = '22023',
      message = 'idempotency_key_required';
  end if;

  perform public._loyalty_lock_idem(p_key);

  select response into v_cached
    from public.reward_idempotency_keys
   where key = p_key;

  if found and v_cached is not null then
    return v_cached;
  end if;

  -- Reserve the key. Concurrent same-key callers blocked on the advisory
  -- lock above will see this row (response still NULL) on next iteration —
  -- but they only get here if the holder rolled back, in which case the
  -- INSERT was rolled back too and the on-conflict no-op is harmless.
  insert into public.reward_idempotency_keys (key, user_id, endpoint, request_hash)
    values (p_key, p_user_id, p_endpoint, '')
    on conflict (key) do nothing;

  return null;
end;
$$;


ALTER FUNCTION public._loyalty_idempotency_begin(p_key text, p_endpoint text, p_user_id uuid) OWNER TO postgres;

--
-- Name: _loyalty_idempotency_end(text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._loyalty_idempotency_end(p_key text, p_response jsonb) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  update public.reward_idempotency_keys
     set response = p_response
   where key = p_key
     and response is null;
$$;


ALTER FUNCTION public._loyalty_idempotency_end(p_key text, p_response jsonb) OWNER TO postgres;

--
-- Name: _loyalty_lock(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._loyalty_lock(p_user_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select pg_advisory_xact_lock(hashtext('loyalty-user:' || p_user_id::text));
$$;


ALTER FUNCTION public._loyalty_lock(p_user_id uuid) OWNER TO postgres;

--
-- Name: _loyalty_lock_idem(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._loyalty_lock_idem(p_key text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select pg_advisory_xact_lock(hashtext('loyalty-idem:' || p_key));
$$;


ALTER FUNCTION public._loyalty_lock_idem(p_key text) OWNER TO postgres;

--
-- Name: _loyalty_recompute_tier(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._loyalty_recompute_tier(p_lifetime bigint) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select id from public.reward_tiers
   where min_lifetime_points <= p_lifetime
   order by min_lifetime_points desc
   limit 1;
$$;


ALTER FUNCTION public._loyalty_recompute_tier(p_lifetime bigint) OWNER TO postgres;

--
-- Name: _order_status_path(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._order_status_path(p_from text, p_to text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  v_chain text[] := array['pending','verification','payment_approved','preparing','ready','driver_assigned','driver_accepted','out_for_delivery','delivered'];
  v_from_idx int;
  v_to_idx int;
begin
  v_from_idx := array_position(v_chain, p_from);
  v_to_idx := array_position(v_chain, p_to);
  if v_from_idx is null or v_to_idx is null or v_to_idx <= v_from_idx then
    return null;
  end if;
  return v_chain[v_from_idx + 1 : v_to_idx];
end;
$$;


ALTER FUNCTION public._order_status_path(p_from text, p_to text) OWNER TO postgres;

--
-- Name: addresses_set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.addresses_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.addresses_set_updated_at() OWNER TO postgres;

--
-- Name: adjust_inventory(text, integer, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.adjust_inventory(p_product_id text, p_delta integer, p_reason text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
  v_state public.inventory_state%rowtype;
  v_total integer;
  v_key text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager', 'pharmacist')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'invalid_delta' USING ERRCODE = '22023';
  END IF;

  v_key := NULLIF(trim(p_idempotency_key), '');
  IF v_key IS NULL OR length(v_key) < 16 THEN
    RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE = '22023';
  END IF;

  PERFORM public._inventory_lock(p_product_id);
  v_state := public._inventory_ensure_state(p_product_id);

  IF EXISTS (
    SELECT 1 FROM public.stock_movements
    WHERE product_id = p_product_id AND idempotency_key = v_key
  ) THEN
    SELECT * INTO v_state FROM public.inventory_state WHERE product_id = p_product_id;
    RETURN jsonb_build_object(
      'product_id', p_product_id, 'delta', p_delta, 'total', v_state.total,
      'reserved', v_state.reserved, 'committed', v_state.committed,
      'available', v_state.total - v_state.reserved - v_state.committed,
      'replay', true
    );
  END IF;

  v_total := v_state.total + p_delta;
  IF v_total < v_state.reserved + v_state.committed THEN
    RAISE EXCEPTION 'adjustment_below_committed_stock' USING ERRCODE = '22023';
  END IF;

  UPDATE public.inventory_state SET total = v_total WHERE product_id = p_product_id;

  INSERT INTO public.stock_movements (
    product_id, delta_total, total_after, reserved_after, committed_after,
    kind, actor_id, idempotency_key, metadata
  ) VALUES (
    p_product_id, p_delta, v_total, v_state.reserved, v_state.committed,
    'adjust', auth.uid(), v_key,
    jsonb_build_object('reason', NULLIF(trim(coalesce(p_reason, '')), ''))
  );

  RETURN jsonb_build_object(
    'product_id', p_product_id, 'delta', p_delta, 'total', v_total,
    'reserved', v_state.reserved, 'committed', v_state.committed,
    'available', v_total - v_state.reserved - v_state.committed,
    'replay', false
  );
END;
$$;


ALTER FUNCTION public.adjust_inventory(p_product_id text, p_delta integer, p_reason text, p_idempotency_key text) OWNER TO postgres;

--
-- Name: admin_bulk_delete_promotions(uuid[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_bulk_delete_promotions(promotion_ids uuid[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.promotions WHERE id = ANY(promotion_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION public.admin_bulk_delete_promotions(promotion_ids uuid[]) OWNER TO postgres;

--
-- Name: admin_bulk_disable_promotions(uuid[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_bulk_disable_promotions(promotion_ids uuid[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501'; END IF;
  UPDATE public.promotions SET status = 'paused', is_enabled = false, updated_at = now() WHERE id = ANY(promotion_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION public.admin_bulk_disable_promotions(promotion_ids uuid[]) OWNER TO postgres;

--
-- Name: admin_bulk_enable_promotions(uuid[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_bulk_enable_promotions(promotion_ids uuid[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501'; END IF;
  UPDATE public.promotions
  SET status = CASE WHEN ends_at <= now() THEN 'expired' WHEN starts_at > now() THEN 'scheduled' ELSE 'active' END,
      is_enabled = ends_at > now(), updated_at = now()
  WHERE id = ANY(promotion_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION public.admin_bulk_enable_promotions(promotion_ids uuid[]) OWNER TO postgres;

--
-- Name: admin_delete_promotion(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_delete_promotion(promotion_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.promotions WHERE id = promotion_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'promotion_not_found' USING ERRCODE = 'P0002'; END IF;
END;
$$;


ALTER FUNCTION public.admin_delete_promotion(promotion_id uuid) OWNER TO postgres;

--
-- Name: admin_delete_user_permanently(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_delete_user_permanently(p_target_user_id uuid, p_reason text, p_admin_notes text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $_$
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
$_$;


ALTER FUNCTION public.admin_delete_user_permanently(p_target_user_id uuid, p_reason text, p_admin_notes text) OWNER TO postgres;

--
-- Name: FUNCTION admin_delete_user_permanently(p_target_user_id uuid, p_reason text, p_admin_notes text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.admin_delete_user_permanently(p_target_user_id uuid, p_reason text, p_admin_notes text) IS 'Atomically deletes an Auth user and profile, anonymizes retained history, and writes deletion audit records. Admin-only; self-deletion is forbidden.';


--
-- Name: admin_detect_promotion_conflicts(uuid[], timestamp with time zone, timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_detect_promotion_conflicts(p_product_ids uuid[], p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_exclude_promotion_id uuid DEFAULT NULL::uuid) RETURNS TABLE(product_id uuid, promotion_id uuid, promotion_name text, starts_at timestamp with time zone, ends_at timestamp with time zone, status text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    assignment.product_id,
    promotion.id,
    promotion.name,
    promotion.starts_at,
    promotion.ends_at,
    promotion.status
  FROM public.promotion_products AS assignment
  JOIN public.promotions AS promotion ON promotion.id = assignment.promotion_id
  WHERE public.is_manager()
    AND assignment.product_id = ANY(coalesce(p_product_ids, '{}'::uuid[]))
    AND promotion.is_enabled = true
    AND promotion.status IN ('scheduled', 'active')
    AND promotion.starts_at < p_ends_at
    AND promotion.ends_at > p_starts_at
    AND (p_exclude_promotion_id IS NULL OR promotion.id <> p_exclude_promotion_id)
  ORDER BY promotion.starts_at ASC, promotion.id ASC, assignment.product_id ASC;
$$;


ALTER FUNCTION public.admin_detect_promotion_conflicts(p_product_ids uuid[], p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_exclude_promotion_id uuid) OWNER TO postgres;

--
-- Name: admin_directory_summary(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_directory_summary(p_scope text DEFAULT 'all'::text) RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with scoped_profiles as (
    select p.id, p.role, p.status
    from public.profiles p
    where case lower(coalesce(p_scope, 'all'))
      when 'staff' then p.role <> 'customer'
      when 'customers' then p.role = 'customer'
      else true
    end
  ),
  auth_meta as (
    select u.id, u.last_sign_in_at, u.email_confirmed_at
    from auth.users u
    join scoped_profiles sp on sp.id = u.id
  )
  select
    case
      when public.is_manager() then json_build_object(
        'total', count(*),
        'active', count(*) filter (where sp.status = 'Active'),
        'suspended', count(*) filter (where sp.status = 'Suspended'),
        'inactive', count(*) filter (where sp.status = 'Inactive'),
        'staff', count(*) filter (where sp.role <> 'customer'),
        'customers', count(*) filter (where sp.role = 'customer'),
        'admins', count(*) filter (where sp.role = 'admin'),
        'managers', count(*) filter (where sp.role = 'manager'),
        'pharmacists', count(*) filter (where sp.role = 'pharmacist'),
        'drivers', count(*) filter (where sp.role = 'driver'),
        'verified', count(*) filter (where am.email_confirmed_at is not null),
        'recentlyActive7d', count(*) filter (where am.last_sign_in_at >= now() - interval '7 days')
      )
      else json_build_object(
        'total', 0,
        'active', 0,
        'suspended', 0,
        'inactive', 0,
        'staff', 0,
        'customers', 0,
        'admins', 0,
        'managers', 0,
        'pharmacists', 0,
        'drivers', 0,
        'verified', 0,
        'recentlyActive7d', 0
      )
    end
  from scoped_profiles sp
  left join auth_meta am on am.id = sp.id;
$$;


ALTER FUNCTION public.admin_directory_summary(p_scope text) OWNER TO postgres;

--
-- Name: admin_get_last_sign_in(uuid[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_get_last_sign_in(user_ids uuid[]) RETURNS TABLE(id uuid, last_sign_in_at timestamp with time zone, email_confirmed_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
     select u.id, u.last_sign_in_at, u.email_confirmed_at
     from auth.users u
     where u.id = any(user_ids) and public.is_manager();
   $$;


ALTER FUNCTION public.admin_get_last_sign_in(user_ids uuid[]) OWNER TO postgres;

--
-- Name: admin_order_timeline(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_order_timeline(p_order_id uuid) RETURNS TABLE(event_at timestamp with time zone, event_type text, actor_id uuid, detail jsonb)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


ALTER FUNCTION public.admin_order_timeline(p_order_id uuid) OWNER TO postgres;

--
-- Name: admin_profile_status_counts(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_profile_status_counts() RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
     select case when public.is_manager() then
       json_build_object(
         'total',     count(*),
         'active',    count(*) filter (where status = 'Active'),
         'suspended', count(*) filter (where status = 'Suspended'),
         'inactive',  count(*) filter (where status = 'Inactive')
       )
     else
       json_build_object('total', 0, 'active', 0, 'suspended', 0, 'inactive', 0)
     end
     from public.profiles;
   $$;


ALTER FUNCTION public.admin_profile_status_counts() OWNER TO postgres;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    external_ref text,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    customer_address jsonb NOT NULL,
    customer_lat numeric(9,6),
    customer_lng numeric(9,6),
    status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    assigned_driver_id uuid,
    qr_token text DEFAULT encode(extensions.gen_random_bytes(16), 'hex'::text) NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    shipping_fee numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    source text DEFAULT 'supabase'::text NOT NULL,
    last_status_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    note text DEFAULT ''::text NOT NULL,
    discount_total numeric(12,2) DEFAULT 0 NOT NULL,
    tax_total numeric(12,2) DEFAULT 0 NOT NULL,
    payment_method text,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    payment_reference text,
    idempotency_key text,
    failure_reason text,
    items jsonb,
    address jsonb,
    subtotal_cents integer,
    delivery_cents integer,
    total_cents integer,
    payment_proof_url text,
    transfer_number text,
    branch_id text,
    zone_id text,
    zone_name text,
    zone_base_fee numeric(12,2),
    zone_surge_applied boolean DEFAULT false NOT NULL,
    location_source text,
    location_accuracy_m real,
    address_building text,
    address_floor text,
    address_apartment text,
    address_landmark text,
    delivery_instructions text,
    location_confirmed_at timestamp with time zone,
    delivery_distance_km numeric,
    cancellation_reason text,
    cancelled_by uuid,
    cancelled_at timestamp with time zone,
    dispatch_status text DEFAULT 'idle'::text NOT NULL,
    claimed_by_pharmacist_id uuid,
    claimed_at timestamp with time zone,
    CONSTRAINT orders_dispatch_status_check CHECK ((dispatch_status = ANY (ARRAY['idle'::text, 'searching'::text, 'assigned'::text, 'escalated'::text]))),
    CONSTRAINT orders_dispatch_status_driver_invariant CHECK ((((dispatch_status = ANY (ARRAY['searching'::text, 'assigned'::text])) AND (assigned_driver_id IS NOT NULL)) OR ((dispatch_status = ANY (ARRAY['idle'::text, 'escalated'::text])) AND (assigned_driver_id IS NULL)))),
    CONSTRAINT orders_location_source_check CHECK ((location_source = ANY (ARRAY['gps'::text, 'manual'::text, 'gps_corrected'::text])))
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: COLUMN orders.branch_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.branch_id IS 'Which Branch fulfills this order — resolved once at checkout via resolve_delivery_zone(), stable for the order''s lifetime regardless of later Branch/DeliveryZone data changes.';


--
-- Name: COLUMN orders.zone_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.zone_id IS 'Which DeliveryZone (polygon) the delivery coordinate matched — the authoritative source for delivery fee and zone name across checkout, pharmacist, and driver views.';


--
-- Name: COLUMN orders.delivery_distance_km; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.delivery_distance_km IS 'Straight-line (haversine) distance in km from the customer''s delivery coordinates to the fulfilling branch, as resolved by resolve_delivery_zone() at order-creation time. Part of the order''s immutable fulfillment snapshot -- never recalculated after creation.';


--
-- Name: COLUMN orders.dispatch_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.dispatch_status IS 'Automatic-dispatch state machine, layered on top of (not replacing) the
   orders.status delivery lifecycle. assigned_driver_id is the current offer
   OR acceptance target (manual or automatic) -- this column disambiguates
   which. searching->escalated is IMPOSSIBLE (invariant above requires
   assigned_driver_id set while searching); the real no-candidates
   transition is idle->escalated. Every writer of this column must lock the
   order row (SELECT ... FOR UPDATE) before touching delivery_assignments
   for it -- see manual_assign_driver / driver_accept_assignment /
   driver_decline_assignment / auto_dispatch_tick.';


--
-- Name: admin_review_payment(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_review_payment(p_order_id uuid, p_decision text, p_failure_reason text DEFAULT NULL::text) RETURNS public.orders
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_order public.orders;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.is_manager()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'pharmacist')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('verified', 'failed') THEN
    RAISE EXCEPTION 'invalid_decision' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
  SET payment_status = p_decision,
      failure_reason = CASE WHEN p_decision = 'failed'
        THEN COALESCE(NULLIF(trim(p_failure_reason), ''), 'تم رفض الإيصال من قِبَل الإدارة')
        ELSE failure_reason
      END,
      updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_order;
END;
$$;


ALTER FUNCTION public.admin_review_payment(p_order_id uuid, p_decision text, p_failure_reason text) OWNER TO postgres;

--
-- Name: admin_save_promotion(uuid, text, text, text, numeric, timestamp with time zone, timestamp with time zone, boolean, text[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_save_promotion(p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_is_enabled boolean, p_product_ids text[]) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501'; END IF;
  IF cardinality(p_product_ids) IS NULL OR cardinality(p_product_ids) = 0 THEN RAISE EXCEPTION 'promotion_requires_products' USING ERRCODE = '22023'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.promotions (name, description, discount_type, discount_value, starts_at, ends_at, is_enabled, created_by)
    VALUES (p_name, nullif(trim(p_description), ''), p_discount_type, p_discount_value, p_starts_at, p_ends_at, p_is_enabled, auth.uid()) RETURNING id INTO v_id;
  ELSE
    UPDATE public.promotions SET name = p_name, description = nullif(trim(p_description), ''), discount_type = p_discount_type,
      discount_value = p_discount_value, starts_at = p_starts_at, ends_at = p_ends_at, is_enabled = p_is_enabled, updated_at = now()
    WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'promotion_not_found' USING ERRCODE = 'P0002'; END IF;
  END IF;
  DELETE FROM public.promotion_products WHERE promotion_id = v_id;
  INSERT INTO public.promotion_products (promotion_id, product_id)
  SELECT v_id, product_id FROM unnest(p_product_ids) AS product_id GROUP BY product_id;
  RETURN v_id;
END;
$$;


ALTER FUNCTION public.admin_save_promotion(p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_is_enabled boolean, p_product_ids text[]) OWNER TO postgres;

--
-- Name: admin_save_promotion(uuid, text, text, text, numeric, timestamp with time zone, timestamp with time zone, boolean, uuid[], text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_save_promotion(p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_is_enabled boolean, p_product_ids uuid[], p_status text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_id uuid; v_status text;
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501'; END IF;
  IF cardinality(p_product_ids) IS NULL OR cardinality(p_product_ids) = 0 THEN RAISE EXCEPTION 'promotion_requires_products' USING ERRCODE = '22023'; END IF;
  IF p_ends_at <= p_starts_at THEN RAISE EXCEPTION 'invalid_promotion_window' USING ERRCODE = '22023'; END IF;
  IF p_discount_type NOT IN ('percentage', 'fixed_amount') OR p_discount_value <= 0 OR (p_discount_type = 'percentage' AND p_discount_value > 100) THEN RAISE EXCEPTION 'invalid_promotion_discount' USING ERRCODE = '22023'; END IF;
  IF p_status NOT IN ('draft', 'scheduled', 'active', 'paused', 'expired', 'archived') THEN RAISE EXCEPTION 'invalid_promotion_status' USING ERRCODE = '22023'; END IF;
  IF p_status = 'expired' AND p_ends_at > now() THEN RAISE EXCEPTION 'expired_promotion_requires_past_end' USING ERRCODE = '22023'; END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_product_ids) AS assigned(product_id)
    LEFT JOIN public.products product ON product.id = assigned.product_id
    WHERE product.id IS NULL OR product.is_active IS NOT TRUE
  ) THEN RAISE EXCEPTION 'promotion_products_must_be_active' USING ERRCODE = '22023'; END IF;

  v_status := CASE
    WHEN p_status IN ('draft', 'paused', 'archived') THEN p_status
    WHEN p_ends_at <= now() THEN 'expired'
    WHEN p_starts_at > now() THEN 'scheduled'
    ELSE 'active'
  END;

  IF p_id IS NULL THEN
    INSERT INTO public.promotions (name, description, discount_type, discount_value, starts_at, ends_at, is_enabled, status, created_by)
    VALUES (trim(p_name), nullif(trim(p_description), ''), p_discount_type, p_discount_value, p_starts_at, p_ends_at,
      v_status IN ('scheduled', 'active'), v_status, auth.uid()) RETURNING id INTO v_id;
  ELSE
    UPDATE public.promotions SET name = trim(p_name), description = nullif(trim(p_description), ''), discount_type = p_discount_type,
      discount_value = p_discount_value, starts_at = p_starts_at, ends_at = p_ends_at,
      is_enabled = v_status IN ('scheduled', 'active'), status = v_status, updated_at = now()
    WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'promotion_not_found' USING ERRCODE = 'P0002'; END IF;
  END IF;

  DELETE FROM public.promotion_products WHERE promotion_id = v_id;
  INSERT INTO public.promotion_products (promotion_id, product_id)
  SELECT v_id, product_id FROM unnest(p_product_ids) AS product_id GROUP BY product_id;
  RETURN v_id;
END;
$$;


ALTER FUNCTION public.admin_save_promotion(p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_is_enabled boolean, p_product_ids uuid[], p_status text) OWNER TO postgres;

--
-- Name: admin_search_promotion_products(text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_search_promotion_products(p_query text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 24) RETURNS TABLE(id uuid, code text, barcode text, name text, name_ar text, name_en text, price numeric, stock numeric, category text, category_name text, category_name_en text, image_url text, total_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH eligible AS (
    SELECT
      product.id,
      product."Code" AS code,
      product."Barcode" AS barcode,
      coalesce(nullif(product."Name_En", ''), product."Name_Ar", product."Name") AS name,
      product."Name_Ar" AS name_ar,
      product."Name_En" AS name_en,
      product."Price"::numeric AS price,
      product."Stock"::numeric AS stock,
      product."Category" AS category,
      product."Category_Name" AS category_name,
      product."Category_Name_En" AS category_name_en,
      product.image_url
    FROM public.products AS product
    WHERE public.is_manager()
      AND product.is_active = true
      AND (
        coalesce(btrim(p_query), '') = ''
        OR coalesce(product."Name", '') ILIKE '%' || btrim(p_query) || '%'
        OR coalesce(product."Name_Ar", '') ILIKE '%' || btrim(p_query) || '%'
        OR coalesce(product."Name_En", '') ILIKE '%' || btrim(p_query) || '%'
        OR coalesce(product."Code", '') ILIKE '%' || btrim(p_query) || '%'
        OR coalesce(product."Barcode", '') ILIKE '%' || btrim(p_query) || '%'
      )
      AND (
        coalesce(btrim(p_category), '') = ''
        OR product."Category" = p_category
      )
  )
  SELECT eligible.*, count(*) over () AS total_count
  FROM eligible
  ORDER BY lower(coalesce(name_en, name_ar, name)), id
  LIMIT greatest(1, least(p_page_size, 100))
  OFFSET greatest(0, p_page - 1) * greatest(1, least(p_page_size, 100));
$$;


ALTER FUNCTION public.admin_search_promotion_products(p_query text, p_category text, p_page integer, p_page_size integer) OWNER TO postgres;

--
-- Name: admin_search_promotion_products_v2(text, text, text, text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_search_promotion_products_v2(p_query text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_stock_status text DEFAULT 'all'::text, p_sort text DEFAULT 'name_asc'::text, p_locale text DEFAULT 'en'::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 24) RETURNS TABLE(id uuid, code text, barcode text, name text, name_ar text, name_en text, price numeric, effective_price numeric, stock numeric, category text, category_name text, category_name_en text, image_url text, promotion_id uuid, promotion_name text, total_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH eligible AS (
    SELECT
      product.id,
      product."Code" AS code,
      product."Barcode" AS barcode,
      coalesce(nullif(product."Name_En", ''), product."Name_Ar", product."Name") AS name,
      product."Name_Ar" AS name_ar,
      product."Name_En" AS name_en,
      product."Price"::numeric AS price,
      coalesce(active_promotion.effective_price, product."Price"::numeric) AS effective_price,
      product."Stock"::numeric AS stock,
      product."Category" AS category,
      product."Category_Name" AS category_name,
      product."Category_Name_En" AS category_name_en,
      product.image_url,
      active_promotion.id AS promotion_id,
      active_promotion.name AS promotion_name
    FROM public.products AS product
    LEFT JOIN LATERAL (
      SELECT
        promotion.id,
        promotion.name,
        public.promotion_effective_price(
          product."Price"::numeric,
          promotion.discount_type,
          promotion.discount_value
        ) AS effective_price
      FROM public.promotion_products AS assignment
      JOIN public.promotions AS promotion ON promotion.id = assignment.promotion_id
      WHERE assignment.product_id = product.id
        AND promotion.is_enabled
        AND promotion.status IN ('scheduled', 'active')
        AND promotion.starts_at <= now()
        AND promotion.ends_at > now()
      ORDER BY
        public.promotion_effective_price(
          product."Price"::numeric,
          promotion.discount_type,
          promotion.discount_value
        ) ASC,
        promotion.starts_at DESC,
        promotion.id ASC
      LIMIT 1
    ) AS active_promotion ON true
    WHERE public.is_manager()
      AND product.is_active = true
      AND (
        coalesce(btrim(p_query), '') = ''
        OR coalesce(product."Name", '') ILIKE '%' || btrim(p_query) || '%'
        OR coalesce(product."Name_Ar", '') ILIKE '%' || btrim(p_query) || '%'
        OR coalesce(product."Name_En", '') ILIKE '%' || btrim(p_query) || '%'
        OR coalesce(product."Code", '') ILIKE '%' || btrim(p_query) || '%'
        OR coalesce(product."Barcode", '') ILIKE '%' || btrim(p_query) || '%'
      )
      AND (coalesce(btrim(p_category), '') = '' OR product."Category" = p_category)
      AND CASE p_stock_status
        WHEN 'in_stock' THEN product."Stock" > 0
        WHEN 'low_stock' THEN product."Stock" > 0 AND product."Stock" < 10
        WHEN 'out_of_stock' THEN product."Stock" <= 0
        ELSE true
      END
  )
  SELECT eligible.*, count(*) over () AS total_count
  FROM eligible
  ORDER BY
    CASE WHEN p_sort = 'name_asc' AND p_locale = 'ar' THEN lower(coalesce(nullif(name_ar, ''), nullif(name_en, ''), name)) END ASC NULLS LAST,
    CASE WHEN p_sort = 'name_desc' AND p_locale = 'ar' THEN lower(coalesce(nullif(name_ar, ''), nullif(name_en, ''), name)) END DESC NULLS LAST,
    CASE WHEN p_sort = 'name_asc' AND p_locale <> 'ar' THEN lower(coalesce(nullif(name_en, ''), nullif(name_ar, ''), name)) END ASC NULLS LAST,
    CASE WHEN p_sort = 'name_desc' AND p_locale <> 'ar' THEN lower(coalesce(nullif(name_en, ''), nullif(name_ar, ''), name)) END DESC NULLS LAST,
    CASE WHEN p_sort = 'price_asc' THEN price END ASC NULLS LAST,
    CASE WHEN p_sort = 'price_desc' THEN price END DESC NULLS LAST,
    CASE WHEN p_sort = 'stock_asc' THEN stock END ASC NULLS LAST,
    CASE WHEN p_sort = 'stock_desc' THEN stock END DESC NULLS LAST,
    id ASC
  LIMIT greatest(1, least(p_page_size, 100))
  OFFSET greatest(0, p_page - 1) * greatest(1, least(p_page_size, 100));
$$;


ALTER FUNCTION public.admin_search_promotion_products_v2(p_query text, p_category text, p_stock_status text, p_sort text, p_locale text, p_page integer, p_page_size integer) OWNER TO postgres;

--
-- Name: admin_set_promotion_status(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_set_promotion_status(p_promotion_id uuid, p_status text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE promotion public.promotions%ROWTYPE; v_status text;
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501'; END IF;
  SELECT * INTO promotion FROM public.promotions WHERE id = p_promotion_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'promotion_not_found' USING ERRCODE = 'P0002'; END IF;
  IF p_status NOT IN ('draft', 'scheduled', 'active', 'paused', 'expired', 'archived') THEN RAISE EXCEPTION 'invalid_promotion_status' USING ERRCODE = '22023'; END IF;
  v_status := CASE
    WHEN p_status IN ('draft', 'paused', 'archived') THEN p_status
    WHEN promotion.ends_at <= now() THEN 'expired'
    WHEN promotion.starts_at > now() THEN 'scheduled'
    ELSE 'active'
  END;
  UPDATE public.promotions
  SET status = v_status, is_enabled = v_status IN ('scheduled', 'active'), updated_at = now()
  WHERE id = p_promotion_id;
END;
$$;


ALTER FUNCTION public.admin_set_promotion_status(p_promotion_id uuid, p_status text) OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text DEFAULT ''::text NOT NULL,
    phone text,
    email text,
    username text,
    address text,
    role public.app_role DEFAULT 'customer'::public.app_role NOT NULL,
    status text DEFAULT 'Active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone_verified boolean DEFAULT false NOT NULL,
    notification_preferences jsonb DEFAULT jsonb_build_object('channels', jsonb_build_object('push', true, 'email', true, 'sms', false), 'categories', jsonb_build_object('order_updates', true, 'promotions', true, 'security_alerts', true, 'health_reminders', true, 'new_arrivals', true, 'account_updates', true)) NOT NULL,
    preferred_payment_method text DEFAULT 'cod'::text,
    is_active boolean,
    marketing_consent boolean DEFAULT false NOT NULL,
    branch_id text,
    CONSTRAINT profiles_preferred_payment_method_check CHECK ((preferred_payment_method = ANY (ARRAY['cod'::text, 'instapay'::text, 'vodafone_cash'::text]))),
    CONSTRAINT profiles_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text, 'Suspended'::text])))
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: COLUMN profiles.marketing_consent; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.marketing_consent IS 'User has opted-in to receive marketing SMS. Set via profile settings or
   import. Required = true for SMS campaigns (enforced by get_marketing_targets
   RPC filter when consent_only = true).';


--
-- Name: COLUMN profiles.branch_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.branch_id IS 'Which branch a pharmacist is staffed at. NULL means unassigned -- such a pharmacist sees every branch''s queue (safe default until admin tooling assigns branches), matching this app''s pre-existing single-shared-queue behavior. Meaningless for other roles.';


--
-- Name: admin_set_staff_role(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_set_staff_role(p_user_id uuid, p_role text, p_branch_id text DEFAULT NULL::text) RETURNS public.profiles
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF p_role NOT IN ('pharmacist', 'customer') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = '22023';
  END IF;

  IF p_role = 'pharmacist' AND (p_branch_id IS NULL OR btrim(p_branch_id) = '') THEN
    RAISE EXCEPTION 'branch_required_for_pharmacist' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
  SET role       = p_role::public.app_role,
      branch_id  = CASE WHEN p_role = 'pharmacist' THEN p_branch_id ELSE NULL END,
      status     = 'Active',
      updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;


ALTER FUNCTION public.admin_set_staff_role(p_user_id uuid, p_role text, p_branch_id text) OWNER TO postgres;

--
-- Name: admin_transition_order(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_transition_order(p_order_id uuid, p_next_status text) RETURNS public.orders
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_order public.orders;
  v_current text;
  v_path text[];
  v_step text;
begin
  if auth.uid() is null then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  if p_next_status = 'cancelled' then
    perform public.execute_order_cancellation(
      p_order_id,
      'OTHER',
      'Cancelled by staff via admin dashboard status control',
      'admin-status-' || p_order_id::text || '-' || extract(epoch from clock_timestamp())::text
    );
    select * into v_order from public.orders where id = p_order_id;
    return v_order;
  end if;

  select status::text into v_current from public.orders where id = p_order_id;
  if v_current is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  -- Already at the target (a no-op double-click) or a single valid hop:
  -- try the direct transition first so this stays a plain passthrough for
  -- the common case, matching prior behavior exactly.
  if v_current = p_next_status then
    select * into v_order from public.orders where id = p_order_id;
    return v_order;
  end if;

  begin
    perform public.transition_order(p_order_id, p_next_status);
    select * into v_order from public.orders where id = p_order_id;
    return v_order;
  exception when sqlstate '22023' then
    -- Not a valid single hop from here — fall through to the multi-hop path below.
    null;
  end;

  v_path := public._order_status_path(v_current, p_next_status);
  if v_path is null then
    raise exception 'invalid_order_transition' using errcode = '22023';
  end if;

  foreach v_step in array v_path loop
    perform public.transition_order(p_order_id, v_step);
  end loop;

  select * into v_order from public.orders where id = p_order_id;
  return v_order;
end;
$$;


ALTER FUNCTION public.admin_transition_order(p_order_id uuid, p_next_status text) OWNER TO postgres;

--
-- Name: admin_update_profile_access(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_update_profile_access(p_target_user_id uuid, p_next_role text DEFAULT NULL::text, p_next_status text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
  v_target_status text;
  v_updated_role text;
  v_updated_status text;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  SELECT role::text INTO v_actor_role
  FROM public.profiles
  WHERE id = v_actor_id;

  IF v_actor_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id = v_actor_id THEN
    RAISE EXCEPTION 'self_access_change_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_next_role IS NULL AND p_next_status IS NULL THEN
    RAISE EXCEPTION 'no_access_change_requested' USING ERRCODE = '22023';
  END IF;

  IF p_next_role IS NOT NULL AND p_next_role NOT IN ('admin', 'manager', 'pharmacist', 'driver', 'customer') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = '22023';
  END IF;

  IF p_next_status IS NOT NULL AND p_next_status NOT IN ('Active', 'Inactive', 'Suspended') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  SELECT role::text, status INTO v_target_role, v_target_status
  FROM public.profiles
  WHERE id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_actor_role = 'manager' AND (v_target_role = 'admin' OR p_next_role = 'admin') THEN
    RAISE EXCEPTION 'administrator_access_requires_admin' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET
    role = CASE WHEN p_next_role IS NULL THEN role ELSE p_next_role::public.app_role END,
    status = COALESCE(p_next_status, status),
    is_active = CASE
      WHEN p_next_status IS NULL THEN is_active
      WHEN p_next_status = 'Active' THEN true
      ELSE false
    END
  WHERE id = p_target_user_id
  RETURNING role::text, status INTO v_updated_role, v_updated_status;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, details)
  VALUES (
    v_actor_id,
    CASE
      WHEN p_next_role IS NOT NULL AND p_next_status IS NOT NULL THEN 'change_role_and_status'
      WHEN p_next_role IS NOT NULL THEN 'change_role'
      ELSE 'change_status'
    END,
    p_target_user_id,
    jsonb_strip_nulls(jsonb_build_object(
      'fromRole', v_target_role,
      'toRole', p_next_role,
      'fromStatus', v_target_status,
      'toStatus', p_next_status
    ))
  );

  RETURN jsonb_build_object(
    'id', p_target_user_id,
    'role', v_updated_role,
    'status', v_updated_status
  );
END;
$$;


ALTER FUNCTION public.admin_update_profile_access(p_target_user_id uuid, p_next_role text, p_next_status text) OWNER TO postgres;

--
-- Name: refill_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.refill_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prescription_id uuid NOT NULL,
    user_id uuid NOT NULL,
    delivery public.refill_delivery DEFAULT 'standard'::public.refill_delivery NOT NULL,
    status public.refill_status DEFAULT 'pending'::public.refill_status NOT NULL,
    pharmacy_id uuid,
    tracking_number text,
    total_cents integer DEFAULT 0 NOT NULL,
    copay_cents integer DEFAULT 0 NOT NULL,
    insurance_cents integer DEFAULT 0 NOT NULL,
    eta timestamp with time zone,
    placed_at timestamp with time zone DEFAULT now() NOT NULL,
    delivered_at timestamp with time zone,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    admin_notes text,
    rejection_reason text
);


ALTER TABLE public.refill_requests OWNER TO postgres;

--
-- Name: advance_refill_request(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.advance_refill_request(p_refill_id uuid, p_next_status text) RETURNS public.refill_requests
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_role text;
  v_row public.refill_requests;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'manager', 'pharmacist') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.refill_requests WHERE id = p_refill_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'refill_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    (v_row.status = 'preparing' AND p_next_status IN ('ready', 'cancelled')) OR
    (v_row.status = 'ready' AND p_next_status IN ('on_the_way', 'cancelled')) OR
    (v_row.status = 'on_the_way' AND p_next_status = 'delivered')
  ) THEN
    RAISE EXCEPTION 'invalid_refill_transition' USING ERRCODE = '22023';
  END IF;

  UPDATE public.refill_requests
  SET status = p_next_status,
      delivered_at = CASE WHEN p_next_status = 'delivered' THEN now() ELSE delivered_at END
  WHERE id = p_refill_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


ALTER FUNCTION public.advance_refill_request(p_refill_id uuid, p_next_status text) OWNER TO postgres;

--
-- Name: append_search_session_query(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.append_search_session_query(p_user_id uuid, p_device_key text, p_query text) RETURNS text[]
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_queries text[];
BEGIN
  IF p_user_id IS NULL AND p_device_key IS NULL THEN
    RAISE EXCEPTION 'append_search_session_query requires user_id or device_key';
  END IF;

  INSERT INTO public.search_sessions (user_id, device_key, queries, updated_at)
  VALUES (p_user_id, p_device_key, ARRAY[p_query], now())
  ON CONFLICT DO NOTHING;

  UPDATE public.search_sessions
  SET queries = (
        -- Keep at most the last 3 entries, most recent last.
        SELECT array_agg(q ORDER BY ord)
        FROM (
          SELECT q, ord FROM unnest(queries || ARRAY[p_query]) WITH ORDINALITY AS t(q, ord)
          ORDER BY ord DESC LIMIT 3
        ) recent
      ),
      updated_at = now()
  WHERE (p_user_id IS NOT NULL AND user_id = p_user_id)
     OR (p_user_id IS NULL AND device_key = p_device_key)
  RETURNING queries INTO v_queries;

  RETURN v_queries;
END;
$$;


ALTER FUNCTION public.append_search_session_query(p_user_id uuid, p_device_key text, p_query text) OWNER TO postgres;

--
-- Name: apply_campaign_bonus(uuid, uuid, bigint, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.apply_campaign_bonus(p_user_id uuid, p_campaign_id uuid, p_amount bigint, p_idempotency_key text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_campaign  public.reward_campaigns%rowtype;
  v_prior     bigint;
  v_cached    jsonb;
  v_result    jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception using errcode = '22023', message = 'amount_must_be_positive';
  end if;

  v_cached := public._loyalty_idempotency_begin(p_idempotency_key, 'apply_campaign_bonus', p_user_id);
  if v_cached is not null then return v_cached; end if;

  select * into v_campaign from public.reward_campaigns
    where id = p_campaign_id for update;
  if not found or not v_campaign.is_active then
    raise exception using errcode = '22023', message = 'campaign_inactive';
  end if;
  if v_campaign.starts_at is not null and v_campaign.starts_at > now() then
    raise exception using errcode = '22023', message = 'campaign_not_started';
  end if;
  if v_campaign.ends_at is not null and v_campaign.ends_at < now() then
    raise exception using errcode = '22023', message = 'campaign_ended';
  end if;
  if v_campaign.total_budget is not null
     and v_campaign.points_issued + p_amount > v_campaign.total_budget then
    raise exception using errcode = '22023', message = 'budget_exhausted';
  end if;

  if v_campaign.max_redemptions_per_user is not null then
    select count(*) into v_prior
      from public.loyalty_ledger
     where user_id = p_user_id
       and source  = 'campaign_bonus'
       and source_ref = p_campaign_id::text;
    if v_prior >= v_campaign.max_redemptions_per_user then
      raise exception using errcode = '22023', message = 'per_user_cap_reached';
    end if;
  end if;

  update public.reward_campaigns
     set points_issued = points_issued + p_amount
   where id = p_campaign_id;

  v_result := public.earn_loyalty_points(
    p_user_id,
    p_amount,
    'campaign_bonus',
    p_campaign_id::text,
    p_idempotency_key || ':earn'
  );

  perform public._loyalty_idempotency_end(p_idempotency_key, v_result);
  perform public._loyalty_audit(p_user_id, 'rpc_call', 'apply_campaign_bonus', true,
    v_result || jsonb_build_object('campaign_id', p_campaign_id));

  return v_result;
end;
$$;


ALTER FUNCTION public.apply_campaign_bonus(p_user_id uuid, p_campaign_id uuid, p_amount bigint, p_idempotency_key text) OWNER TO postgres;

--
-- Name: apply_coupon_checkout(text, uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.apply_coupon_checkout(p_code text, p_order_id uuid, p_idempotency_key text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_user_id  uuid := auth.uid();
  v_coupon   public.coupons%rowtype;
  v_cached   jsonb;
  v_result   jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  v_cached := public._loyalty_idempotency_begin(p_idempotency_key, 'apply_coupon_checkout', v_user_id);
  if v_cached is not null then return v_cached; end if;

  select * into v_coupon from public.coupons
    where code = upper(trim(p_code))
    for update;
  if not found then
    raise exception using errcode = '23503', message = 'coupon_not_found';
  end if;
  if v_coupon.state <> 'issued' then
    raise exception using errcode = '22023', message = 'already_' || v_coupon.state;
  end if;
  if v_coupon.user_id is not null and v_coupon.user_id <> v_user_id then
    raise exception using errcode = '42501', message = 'wrong_owner';
  end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
    raise exception using errcode = '22023', message = 'expired';
  end if;

  update public.coupons
     set state             = 'consumed',
         consumed_at       = now(),
         consumed_order_id = p_order_id,
         user_id           = v_user_id
   where id = v_coupon.id;

  update public.coupon_batches
     set redeemed_count = redeemed_count + 1
   where id = v_coupon.batch_id;

  v_result := jsonb_build_object(
    'coupon_id', v_coupon.id,
    'batch_id',  v_coupon.batch_id,
    'order_id',  p_order_id,
    'state',     'consumed'
  );
  perform public._loyalty_idempotency_end(p_idempotency_key, v_result);
  perform public._loyalty_audit(v_user_id, 'rpc_call', 'apply_coupon_checkout', true, v_result);

  return v_result;
end;
$$;


ALTER FUNCTION public.apply_coupon_checkout(p_code text, p_order_id uuid, p_idempotency_key text) OWNER TO postgres;

--
-- Name: apply_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.apply_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.apply_updated_at() OWNER TO postgres;

--
-- Name: auto_dispatch_tick(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.auto_dispatch_tick() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_expired record;
  v_order record;
  v_candidate uuid;
  v_assignment_id uuid;
  v_transitioned uuid;
  v_admin record;
begin
  if not pg_try_advisory_xact_lock(hashtext('auto_dispatch_tick')) then
    return;  -- a previous tick is still running; skip this cycle, the next one catches up
  end if;

  -- Phase 1: expire stale offers, one at a time, order-locked.
  for v_expired in
    select id, order_id, driver_id
    from delivery_assignments
    where response_status = 'offered' and expires_at is not null and expires_at < now()
  loop
    perform id from orders where id = v_expired.order_id for update;  -- lock first

    if exists (
      select 1 from delivery_assignments
      where id = v_expired.id and response_status = 'offered' and expires_at < now()
    ) then  -- re-verify under the lock: still expired, nothing else changed it meanwhile
      update delivery_assignments set response_status = 'expired', responded_at = now()
      where id = v_expired.id;

      update orders set assigned_driver_id = null, dispatch_status = 'idle'
      where id = v_expired.order_id and assigned_driver_id = v_expired.driver_id
        and dispatch_status = 'searching';
    end if;
  end loop;

  -- Phase 2: offer to the next candidate, or escalate.
  for v_order in
    select id, branch_id from orders
    where status = 'ready' and dispatch_status = 'idle' and assigned_driver_id is null
    for update skip locked  -- this cursor IS the lock-first step for this phase;
                             -- a row a manual assignment is touching right now is
                             -- simply left for the next tick, never blocked on
  loop
    select r.driver_user_id into v_candidate
    from rank_available_drivers(v_order.id) r
    where not exists (
      select 1 from delivery_assignments da
      where da.order_id = v_order.id and da.driver_id = r.driver_user_id
        and da.response_status in ('declined', 'expired', 'superseded')
    )
    order by r.score desc
    limit 1;

    if v_candidate is not null then
      insert into delivery_assignments (order_id, driver_id, assignment_kind, response_status, expires_at)
      values (v_order.id, v_candidate, 'assigned', 'offered', now() + interval '25 seconds')
      returning id into v_assignment_id;

      update orders set assigned_driver_id = v_candidate, dispatch_status = 'searching'
      where id = v_order.id;

      -- First offer on this order also advances the lifecycle status,
      -- exactly matching manual_assign_driver's first-time-assignment case.
      if (select status from orders where id = v_order.id) = 'ready' then
        perform transition_order(v_order.id, 'driver_assigned');
      end if;

      perform enqueue_notification(
        v_candidate, 'order', 'order_updates',
        'تم تعيين طلب جديد لك', 'تم تعيينك لتوصيل طلب جديد. راجع قائمة المهام الخاصة بك.',
        jsonb_build_object('kind', 'driver_assignment', 'orderId', v_order.id, 'assignmentId', v_assignment_id),
        '/(driver)/offer/' || v_assignment_id,
        'order:' || v_order.id || ':driver:' || v_candidate || ':offer:' || v_assignment_id
      );
    else
      update orders set dispatch_status = 'escalated'
      where id = v_order.id and dispatch_status = 'idle' and assigned_driver_id is null  -- the
      returning id into v_transitioned;                                                    -- ONLY
                                                                                              -- reachable
      if v_transitioned is not null then                          -- state here, per the invariant
        for v_admin in select id from profiles where role in ('admin', 'manager') loop
          perform enqueue_notification(
            v_admin.id, 'order', 'order_updates',
            'تعذر إيجاد سائق للطلب', 'لم يتم العثور على سائق متاح لهذا الطلب. يرجى المراجعة والتعيين يدوياً.',
            jsonb_build_object('kind', 'dispatch_escalated', 'orderId', v_order.id),
            '/admin/orders?order=' || v_order.id,
            'order:' || v_order.id || ':escalated:' || v_admin.id || ':' || now()::text
          );
          -- Per-recipient key: without v_admin.id here, all 4 admins in this
          -- loop shared the exact same key (same order, same transaction
          -- now()) -- enqueue_notification's own idempotency dedup then
          -- collapsed calls 2-4 into no-ops, so only the first admin in the
          -- loop actually got notified. Confirmed live via the verification
          -- suite before this fix (1 notification instead of 4).
        end loop;
      end if;
    end if;
  end loop;
end;
$$;


ALTER FUNCTION public.auto_dispatch_tick() OWNER TO postgres;

--
-- Name: broadcast_notification(text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.broadcast_notification(p_type text, p_category text, p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  -- Caller must be admin/manager
  IF NOT (auth.jwt()->'user_metadata'->>'role' IN ('admin','manager')) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  INSERT INTO public.notifications (user_id, type, category, title, body, data)
  SELECT id, p_type, p_category, p_title, p_body, p_data FROM auth.users;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;


ALTER FUNCTION public.broadcast_notification(p_type text, p_category text, p_title text, p_body text, p_data jsonb) OWNER TO postgres;

--
-- Name: notification_outbox; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    notification_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    event_type text NOT NULL,
    category text,
    title text NOT NULL,
    body text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    idempotency_key text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_until timestamp with time zone,
    last_error text,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_outbox_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT notification_outbox_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'sent'::text, 'retrying'::text, 'failed'::text, 'skipped'::text])))
);


ALTER TABLE public.notification_outbox OWNER TO postgres;

--
-- Name: claim_notification_outbox(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.claim_notification_outbox(p_limit integer DEFAULT 100) RETURNS SETOF public.notification_outbox
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH claimed AS (SELECT id FROM public.notification_outbox WHERE (status IN ('queued','retrying') AND next_attempt_at <= now()) OR (status='processing' AND locked_until < now()) ORDER BY next_attempt_at,created_at FOR UPDATE SKIP LOCKED LIMIT least(greatest(coalesce(p_limit,100),1),500))
  UPDATE public.notification_outbox o SET status='processing',locked_until=now()+interval '5 minutes',attempts=attempts+1,updated_at=now() FROM claimed WHERE o.id=claimed.id RETURNING o.*;
$$;


ALTER FUNCTION public.claim_notification_outbox(p_limit integer) OWNER TO postgres;

--
-- Name: commit_inventory(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.commit_inventory(p_reservation_id uuid, p_order_id uuid, p_idempotency_key text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_user_id    uuid := auth.uid();
  v_res        public.inventory_reservations%rowtype;
  v_state      public.inventory_state%rowtype;
  v_order_user uuid;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 16 then
    raise exception using errcode = '22023', message = 'idempotency_key_required';
  end if;

  select * into v_res from public.inventory_reservations
    where id = p_reservation_id for update;
  if not found then
    raise exception using errcode = '23503', message = 'reservation_not_found';
  end if;

  if v_res.user_id <> v_user_id and not public.is_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  if v_res.state = 'committed' and v_res.order_id = p_order_id then
    return jsonb_build_object(
      'reservation_id', v_res.id,
      'state',          'committed',
      'order_id',       p_order_id,
      'replay',         true
    );
  end if;
  if v_res.state <> 'reserved' then
    raise exception using errcode = '22023', message = 'state_' || v_res.state || '_not_committable';
  end if;

  select user_id into v_order_user from public.orders where id = p_order_id;
  if not found then
    raise exception using errcode = '23503', message = 'order_not_found';
  end if;
  if v_order_user <> v_res.user_id then
    raise exception using errcode = '22023', message = 'order_user_mismatch';
  end if;

  perform public._inventory_lock(v_res.product_id);
  v_state := public._inventory_ensure_state(v_res.product_id);

  update public.inventory_reservations
     set state        = 'committed',
         committed_at = now(),
         order_id     = p_order_id
   where id = v_res.id;

  update public.inventory_state
     set reserved  = greatest(reserved  - v_res.quantity, 0),
         committed = committed + v_res.quantity
   where product_id = v_res.product_id;

  insert into public.stock_movements (
    product_id, delta_reserved, delta_committed,
    total_after, reserved_after, committed_after,
    kind, reservation_id, actor_id, idempotency_key,
    metadata
  ) values (
    v_res.product_id, -v_res.quantity, v_res.quantity,
    v_state.total,
    greatest(v_state.reserved - v_res.quantity, 0),
    v_state.committed + v_res.quantity,
    'commit', v_res.id, v_user_id, p_idempotency_key,
    jsonb_build_object('order_id', p_order_id)
  );

  return jsonb_build_object(
    'reservation_id', v_res.id,
    'state',          'committed',
    'order_id',       p_order_id,
    'committed',      v_res.quantity,
    'replay',         false
  );
end;
$$;


ALTER FUNCTION public.commit_inventory(p_reservation_id uuid, p_order_id uuid, p_idempotency_key text) OWNER TO postgres;

--
-- Name: create_checkout_order(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_checkout_order(p_user_id uuid, p_customer jsonb, p_address jsonb, p_payment jsonb, p_cart_lines jsonb, p_expected_pricing jsonb, p_note text DEFAULT ''::text, p_promo_code text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_order_id uuid;
  v_subtotal numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
BEGIN
  -- Basic validation
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.';
  END IF;

  -- Check for existing order
  SELECT id INTO v_order_id
  FROM public.orders
  WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'order_id', v_order_id,
      'created_at', now(),
      'status', 'pending',
      'payment_status', 'pending',
      'idempotent_replay', true
    );
  END IF;

  -- Calculate basic total from cart lines
  SELECT COALESCE(sum((value->>'quantity')::numeric * (value->>'unit_price')::numeric), 0)
  INTO v_subtotal
  FROM jsonb_array_elements(p_cart_lines) as value;

  v_total := v_subtotal;

  -- Create the order
  INSERT INTO public.orders (
    user_id,
    customer_name,
    customer_phone,
    customer_address,
    status,
    subtotal,
    total,
    note,
    payment_method,
    payment_status,
    idempotency_key,
    source
  )
  VALUES (
    p_user_id,
    coalesce(p_customer ->> 'fullName', ''),
    coalesce(p_customer ->> 'phone', ''),
    coalesce(p_address, '{}'::jsonb),
    'pending',
    v_subtotal,
    v_total,
    coalesce(p_note, ''),
    nullif(p_payment ->> 'method', ''),
    'pending',
    p_idempotency_key,
    'shopper_web'
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'created_at', now(),
    'status', 'pending',
    'payment_status', 'pending',
    'idempotent_replay', false
  );
END;
$$;


ALTER FUNCTION public.create_checkout_order(p_user_id uuid, p_customer jsonb, p_address jsonb, p_payment jsonb, p_cart_lines jsonb, p_expected_pricing jsonb, p_note text, p_promo_code text, p_idempotency_key text) OWNER TO postgres;

--
-- Name: create_referral_reward(uuid, uuid, uuid, bigint, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_referral_reward(p_referrer_id uuid, p_referee_id uuid, p_referee_first_order_id uuid, p_points bigint, p_idempotency_key text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_ledger_id   uuid;
  v_referral_id uuid;
  v_existing    uuid;
  v_earn        jsonb;
  v_cached      jsonb;
  v_result      jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_referrer_id = p_referee_id then
    raise exception using errcode = '22023', message = 'self_referral';
  end if;
  if p_points is null or p_points <= 0 then
    raise exception using errcode = '22023', message = 'points_must_be_positive';
  end if;

  v_cached := public._loyalty_idempotency_begin(p_idempotency_key, 'create_referral_reward', p_referrer_id);
  if v_cached is not null then return v_cached; end if;

  perform pg_advisory_xact_lock(hashtext('referral-referee:' || p_referee_id::text));

  select id into v_existing from public.referral_rewards where referee_id = p_referee_id;
  if v_existing is not null then
    raise exception using errcode = '23505', message = 'referee_already_rewarded';
  end if;

  v_earn := public.earn_loyalty_points(
    p_referrer_id,
    p_points,
    'referral',
    p_referee_id::text,
    p_idempotency_key || ':earn'
  );
  v_ledger_id := (v_earn ->> 'ledger_id')::uuid;

  insert into public.referral_rewards (
    referrer_id, referee_id, referee_first_order_id, points_granted, ledger_id
  ) values (
    p_referrer_id, p_referee_id, p_referee_first_order_id, p_points, v_ledger_id
  ) returning id into v_referral_id;

  v_result := jsonb_build_object(
    'referral_id', v_referral_id,
    'ledger_id',   v_ledger_id,
    'points',      p_points
  );
  perform public._loyalty_idempotency_end(p_idempotency_key, v_result);
  perform public._loyalty_audit(p_referrer_id, 'rpc_call', 'create_referral_reward', true, v_result);

  return v_result;
end;
$$;


ALTER FUNCTION public.create_referral_reward(p_referrer_id uuid, p_referee_id uuid, p_referee_first_order_id uuid, p_points bigint, p_idempotency_key text) OWNER TO postgres;

--
-- Name: current_app_role(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_app_role(p_user_id uuid DEFAULT auth.uid()) RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(
    (select role from public.profiles where id = p_user_id),
    'customer'::public.app_role
  );
$$;


ALTER FUNCTION public.current_app_role(p_user_id uuid) OWNER TO postgres;

--
-- Name: debug_search_relevance(text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.debug_search_relevance(p_query text, p_product_id uuid) RETURNS TABLE(expanded_query text, normalized_query text, tier1_exact_code_barcode double precision, tier2_name_exact_prefix double precision, tier3_fts_rank double precision, tier4_trigram_similarity double precision, tier5_word_similarity double precision, tier6_category_signal double precision, tier7_synonym_signal double precision, total_score double precision, passes_cutoff boolean)
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uq        text;
  v_tsq       tsquery;
  v_syn       text;
  v_syn_words text[];
  v_syn_tsq   tsquery;
  v_tsq_combined tsquery;
  product     record;
  v_t1 double precision;
  v_t2 double precision;
  v_t3 double precision;
  v_t4 double precision;
  v_t5 double precision;
  v_t6 double precision;
  v_t7 double precision;
BEGIN
  SELECT p.*, epp.effective_price INTO product
  FROM public.products p
  JOIN public.product_effective_prices epp ON epp.id = p.id
  WHERE p.id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No product with id %', p_product_id;
  END IF;

  v_uq := public.normalize_arabic(public.immutable_unaccent(p_query));

  BEGIN
    v_tsq := websearch_to_tsquery('simple', v_uq);
  EXCEPTION WHEN OTHERS THEN
    v_tsq := NULL;
  END;

  v_syn := public.find_synonym_terms(p_query);
  IF v_syn IS NOT NULL THEN
    v_syn_words := (
      SELECT array_agg(DISTINCT w) FROM unnest(
        regexp_split_to_array(trim(public.normalize_arabic(public.immutable_unaccent(v_syn))), '\s+')
      ) AS w WHERE length(w) > 0
    );
    IF v_syn_words IS NOT NULL AND array_length(v_syn_words, 1) > 0 THEN
      BEGIN
        v_syn_tsq := to_tsquery('simple', array_to_string(v_syn_words, ' | '));
      EXCEPTION WHEN OTHERS THEN
        v_syn_tsq := NULL;
      END;
    END IF;
  END IF;

  v_tsq_combined := CASE
    WHEN v_tsq IS NOT NULL AND v_syn_tsq IS NOT NULL THEN v_tsq || v_syn_tsq
    WHEN v_syn_tsq IS NOT NULL THEN v_syn_tsq
    ELSE v_tsq
  END;

  v_t1 := (CASE WHEN lower(product."Code") = lower(p_query) THEN 1000.0 WHEN lower(product."Barcode") = lower(p_query) THEN 1000.0 ELSE 0.0 END)::double precision;
  v_t2 := (CASE
      WHEN public.normalize_arabic(coalesce(product."Name_Ar", '')) = v_uq THEN 80.0
      WHEN coalesce(product."Name_En", '') ILIKE v_uq THEN 80.0
      WHEN public.normalize_arabic(coalesce(product."Name_Ar", '')) ILIKE v_uq || ' %' THEN 40.0
      WHEN coalesce(product."Name_En", '') ILIKE v_uq || ' %' THEN 40.0
      WHEN public.normalize_arabic(coalesce(product."Name_Ar", '')) ILIKE v_uq || '%' THEN 20.0
      WHEN coalesce(product."Name_En", '') ILIKE v_uq || '%' THEN 20.0
      ELSE 0.0
    END)::double precision;
  v_t3 := (CASE WHEN v_tsq_combined IS NOT NULL THEN COALESCE(ts_rank_cd(product.search_vector, v_tsq_combined) * 2.5, 0.0) ELSE 0.0 END)::double precision;
  v_t4 := (1.2 * GREATEST(
      COALESCE(similarity(public.normalize_arabic(coalesce(product."Name_Ar", '')), v_uq), 0),
      COALESCE(similarity(coalesce(product."Name_En", ''), v_uq), 0)
    ))::double precision;
  v_t5 := (0.9 * GREATEST(
      COALESCE(word_similarity(v_uq, public.normalize_arabic(coalesce(product."Name_Ar", ''))), 0),
      COALESCE(word_similarity(v_uq, coalesce(product."Name_En", '')), 0)
    ))::double precision;
  v_t6 := (0.08 * GREATEST(
      COALESCE(similarity(public.normalize_arabic(coalesce(product."Category_Name", '')), v_uq), 0),
      COALESCE(similarity(coalesce(product."Category_Name_En", ''), v_uq), 0)
    ))::double precision;
  v_t7 := (CASE WHEN v_syn_words IS NOT NULL THEN
      15.0 * (
        SELECT count(*)::numeric FROM unnest(v_syn_words) w
        WHERE length(w) >= 3 AND (
          coalesce(product."Name_En", '') ILIKE '%' || w || '%'
          OR public.normalize_arabic(coalesce(product."Name_Ar", '')) ILIKE '%' || w || '%'
          OR coalesce(product."Category_Name_En", '') ILIKE '%' || w || '%'
          OR public.normalize_arabic(coalesce(product."Category_Name", '')) ILIKE '%' || w || '%'
        )
      ) / greatest(1, array_length(v_syn_words, 1))
    ELSE 0.0 END)::double precision;

  RETURN QUERY SELECT
    public.expand_search_query(p_query),
    v_uq,
    v_t1, v_t2, v_t3, v_t4, v_t5, v_t6, v_t7,
    (v_t1 + v_t2 + v_t3 + v_t4 + v_t5 + v_t6 + v_t7),
    (v_t1 + v_t2 + v_t3 + v_t4 + v_t7) > 0.05;
END;
$$;


ALTER FUNCTION public.debug_search_relevance(p_query text, p_product_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION debug_search_relevance(p_query text, p_product_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.debug_search_relevance(p_query text, p_product_id uuid) IS 'Diagnostics only — shows the per-tier score breakdown search_effective_products would compute for one (query, product) pair, including the OR-based synonym signal (tier7). Not called by the app; for QA/tuning via SQL editor.';


--
-- Name: delivery_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.delivery_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    driver_id uuid,
    assigned_by uuid,
    assignment_kind text DEFAULT 'assigned'::text NOT NULL,
    response_status text DEFAULT 'offered'::text NOT NULL,
    decline_reason text,
    offered_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    picked_up_at timestamp with time zone,
    delivered_at timestamp with time zone,
    superseded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    arrived_at_pharmacy timestamp with time zone,
    arrived_at_customer timestamp with time zone,
    expires_at timestamp with time zone,
    CONSTRAINT delivery_assignments_assignment_kind_check CHECK ((assignment_kind = ANY (ARRAY['assigned'::text, 'reassigned'::text]))),
    CONSTRAINT delivery_assignments_response_status_check CHECK ((response_status = ANY (ARRAY['offered'::text, 'accepted'::text, 'declined'::text, 'superseded'::text, 'completed'::text, 'expired'::text])))
);


ALTER TABLE public.delivery_assignments OWNER TO postgres;

--
-- Name: TABLE delivery_assignments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.delivery_assignments IS 'Append-only assignment/accept/decline/reassignment ledger. orders.assigned_driver_id remains the fast "current driver" pointer; this table is the audit trail behind it. The current assignment for an order is its most recent row by created_at.';


--
-- Name: COLUMN delivery_assignments.response_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.delivery_assignments.response_status IS 'offered = staff assigned, awaiting driver response. accepted/declined = driver acted. superseded = staff reassigned before/after driver response. completed = delivery finished under this assignment.';


--
-- Name: COLUMN delivery_assignments.expires_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.delivery_assignments.expires_at IS 'Only set on auto-dispatch-created offers (25s waterfall window). Null for
   manually-assigned rows, which have no automatic timeout.';


--
-- Name: driver_accept_assignment(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.driver_accept_assignment(p_assignment_id uuid) RETURNS public.delivery_assignments
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_order_id uuid;
  v_row public.delivery_assignments;
begin
  if auth.uid() is null then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select order_id into v_order_id from public.delivery_assignments where id = p_assignment_id;
  if v_order_id is null then
    raise exception 'assignment_not_found_or_already_resolved' using errcode = '22023';
  end if;

  perform id from public.orders where id = v_order_id for update;  -- lock first, per convention

  -- Re-verify under the lock: this assignment must still be the order's
  -- CURRENT target -- reached via the waterfall (searching) or a manual
  -- assignment not yet responded to (assigned + kind assigned/reassigned).
  -- An old, superseded offer fails this even if its own row still looks
  -- superficially valid -- this is what makes the override invariant hold.
  if not exists (
    select 1 from public.orders o
    where o.id = v_order_id and o.assigned_driver_id = auth.uid()
      and (
        o.dispatch_status = 'searching'
        or (
          o.dispatch_status = 'assigned'
          and exists (
            select 1 from public.delivery_assignments da
            where da.id = p_assignment_id and da.assignment_kind in ('assigned', 'reassigned')
          )
        )
      )
  ) then
    raise exception 'assignment_not_found_or_already_resolved' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.delivery_assignments
    where id = p_assignment_id and driver_id = auth.uid()
      and response_status = 'offered' and (expires_at is null or expires_at > now())
  ) then
    raise exception 'assignment_not_found_or_already_resolved' using errcode = '22023';
  end if;

  -- Reuses the existing, already-validated lifecycle transition. Requires
  -- orders.status = 'driver_assigned' currently -- guaranteed by
  -- manual_assign_driver (first-time case) and auto_dispatch_tick, both of
  -- which set it before ever creating an 'offered' row.
  perform public.transition_order(v_order_id, 'driver_accepted');

  update public.delivery_assignments
  set response_status = 'accepted', responded_at = now()
  where id = p_assignment_id
  returning * into v_row;

  update public.orders set dispatch_status = 'assigned' where id = v_order_id;  -- no-op if already so

  return v_row;
end;
$$;


ALTER FUNCTION public.driver_accept_assignment(p_assignment_id uuid) OWNER TO postgres;

--
-- Name: driver_decline_assignment(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.driver_decline_assignment(p_assignment_id uuid, p_reason text DEFAULT NULL::text) RETURNS public.delivery_assignments
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_order_id uuid;
  v_status text;
  v_driver_id uuid;
  v_row public.delivery_assignments;
begin
  if auth.uid() is null then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select order_id into v_order_id from public.delivery_assignments where id = p_assignment_id;
  if v_order_id is null then
    raise exception 'assignment_not_found_or_already_resolved' using errcode = '22023';
  end if;

  perform id from public.orders where id = v_order_id for update;  -- lock first

  select response_status, driver_id into v_status, v_driver_id
  from public.delivery_assignments where id = p_assignment_id;  -- current state, under the lock

  if v_status = 'superseded' then
    -- Already overridden by a manual assignment before this decline
    -- arrived. Not an error -- the core invariant means it correctly has
    -- nothing left to do.
    select * into v_row from public.delivery_assignments where id = p_assignment_id;
    return v_row;
  end if;

  if v_status <> 'offered' or v_driver_id <> auth.uid() then
    raise exception 'assignment_not_found_or_already_resolved' using errcode = '22023';
  end if;

  update public.delivery_assignments
  set response_status = 'declined', responded_at = now(),
      decline_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = p_assignment_id
  returning * into v_row;

  -- Only reset the order if this decline is for its currently-active
  -- assignment. dispatch_status covers both the automatic (searching) and
  -- manual-unaccepted (assigned) cases; the existing status='driver_assigned'
  -- guard is preserved unchanged from before this migration (a driver can
  -- only ever be declining an 'offered' row, which by construction can't
  -- coexist with status already having moved to driver_accepted).
  update public.orders
  set assigned_driver_id = null, dispatch_status = 'idle',
      status = 'ready', last_status_at = now(), updated_at = now()
  where id = v_order_id and assigned_driver_id = auth.uid()
    and dispatch_status in ('searching', 'assigned')
    and status = 'driver_assigned';

  return v_row;
end;
$$;


ALTER FUNCTION public.driver_decline_assignment(p_assignment_id uuid, p_reason text) OWNER TO postgres;

--
-- Name: FUNCTION driver_decline_assignment(p_assignment_id uuid, p_reason text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.driver_decline_assignment(p_assignment_id uuid, p_reason text) IS 'Atomically declines an offered assignment and clears orders.assigned_driver_id, as one SECURITY DEFINER call — replaces two separate client-side writes, the second of which had no confirmed RLS grant to succeed on.';


--
-- Name: earn_loyalty_points(uuid, bigint, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.earn_loyalty_points(p_user_id uuid, p_amount bigint, p_source text, p_source_ref text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_account public.loyalty_accounts%rowtype;
  v_ledger  public.loyalty_ledger%rowtype;
  v_kind    text;
  v_cached  jsonb;
  v_result  jsonb;
  v_new_balance bigint;
  v_new_lifetime bigint;
  v_new_tier uuid;
begin
  -- Only admins (or service_role, which sees is_admin = true via direct
  -- inserts in profiles) can directly grant points. RPC consumers running
  -- as authenticated users are blocked here.
  if not public.is_admin() then
    perform public._loyalty_audit(p_user_id, 'rpc_reject', 'earn_loyalty_points',
      false, jsonb_build_object('amount', p_amount, 'source', p_source), 'forbidden');
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception using errcode = '22023', message = 'amount_must_be_positive';
  end if;
  if p_source is null or length(trim(p_source)) = 0 then
    raise exception using errcode = '22023', message = 'source_required';
  end if;

  v_kind := case p_source
              when 'order_cashback' then 'cashback'
              when 'referral'       then 'referral'
              when 'campaign_bonus' then 'bonus'
              else                       'earn'
            end;

  v_cached := public._loyalty_idempotency_begin(p_idempotency_key, 'earn_loyalty_points', p_user_id);
  if v_cached is not null then return v_cached; end if;

  perform public._loyalty_lock(p_user_id);
  v_account := public._loyalty_ensure_account(p_user_id);

  v_new_balance  := v_account.balance + p_amount;
  v_new_lifetime := v_account.lifetime_earned + p_amount;
  v_new_tier     := public._loyalty_recompute_tier(v_new_lifetime);

  insert into public.loyalty_ledger (
    user_id, delta, balance_after, kind, source, source_ref,
    idempotency_key, created_by
  ) values (
    p_user_id, p_amount, v_new_balance, v_kind, p_source, p_source_ref,
    p_idempotency_key, auth.uid()
  ) returning * into v_ledger;

  update public.loyalty_accounts
     set balance         = v_new_balance,
         lifetime_earned = v_new_lifetime,
         tier_id         = coalesce(v_new_tier, tier_id)
   where user_id = p_user_id;

  v_result := jsonb_build_object(
    'ledger_id',     v_ledger.id,
    'balance',       v_new_balance,
    'amount',        p_amount,
    'tier_id',       v_new_tier,
    'kind',          v_kind
  );
  perform public._loyalty_idempotency_end(p_idempotency_key, v_result);
  perform public._loyalty_audit(p_user_id, 'rpc_call', 'earn_loyalty_points', true, v_result);

  return v_result;
end;
$$;


ALTER FUNCTION public.earn_loyalty_points(p_user_id uuid, p_amount bigint, p_source text, p_source_ref text, p_idempotency_key text) OWNER TO postgres;

--
-- Name: enqueue_notification(uuid, text, text, text, text, jsonb, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.enqueue_notification(p_recipient_id uuid, p_event_type text, p_category text, p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb, p_action_url text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


ALTER FUNCTION public.enqueue_notification(p_recipient_id uuid, p_event_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text, p_idempotency_key text) OWNER TO postgres;

--
-- Name: enqueue_notification_batch(uuid[], text, text, text, text, jsonb, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.enqueue_notification_batch(p_recipient_ids uuid[], p_event_type text, p_category text, p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb, p_action_url text DEFAULT NULL::text, p_idempotency_namespace text DEFAULT NULL::text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


ALTER FUNCTION public.enqueue_notification_batch(p_recipient_ids uuid[], p_event_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text, p_idempotency_namespace text) OWNER TO postgres;

--
-- Name: ensure_driver_profile(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ensure_driver_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.role = 'driver' AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM 'driver') THEN
    INSERT INTO public."DriverProfile" (id, "userId", "vehicleType", status, "approvedAt", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), NEW.id, 'motorcycle', 'APPROVED', now(), now(), now())
    ON CONFLICT ("userId") DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.ensure_driver_profile() OWNER TO postgres;

--
-- Name: execute_order_cancellation(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.execute_order_cancellation(p_order_id uuid, p_reason_code text, p_note text, p_idempotency_key text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role TEXT := 'customer';
    v_actor_type TEXT;
    v_order RECORD;
    v_cancel_id UUID;
    v_res RECORD;
    v_actions JSON;
    v_can_cancel BOOLEAN;
    v_refund_status TEXT := 'NOT_REQUIRED';
    v_refund_amount NUMERIC := 0;
    v_financial_action TEXT := 'NONE';
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
    END IF;

    -- 1. Idempotency Check
    SELECT id INTO v_cancel_id FROM public.cancellations WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
        RETURN json_build_object('success', true, 'cancellation_id', v_cancel_id, 'note', 'Idempotency recovery');
    END IF;

    -- 2. Lock Order for Concurrency
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- 3. Auth & Role Derivation
    SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
    IF v_role IS NULL THEN v_role := 'customer'; END IF;

    IF v_role = 'customer' THEN
        v_actor_type := 'customer';
        IF v_order.user_id != v_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    ELSIF v_role IN ('admin', 'pharmacist', 'manager') THEN
        v_actor_type := v_role;
    ELSE
        v_actor_type := 'driver';
        IF v_order.assigned_driver_id != v_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    END IF;

    -- 4. Policy Validation via internal call (v_user_id is already auth.uid())
    v_actions := public.get_order_actions(p_order_id);
    v_can_cancel := (v_actions->'cancel'->>'allowed')::BOOLEAN;

    IF NOT v_can_cancel THEN
        RAISE EXCEPTION 'Order cannot be cancelled: %', v_actions->'cancel'->>'reason';
    END IF;

    -- Ensure order is not past pickup (Driver assignment validation)
    IF v_order.status IN ('picked_up', 'out_for_delivery', 'delivered') THEN
        RAISE EXCEPTION 'Cancellation rejected: Order is already in physical transit.';
    END IF;

    -- 5. Driver Assignment Cleanup
    UPDATE public.delivery_assignments
    SET response_status = 'cancelled', superseded_at = NOW(), decline_reason = 'Order Cancelled'
    WHERE order_id = p_order_id AND response_status IN ('offered', 'accepted');

    -- 6. Financials (Refund state machine integration)
    IF v_order.payment_status IN ('captured', 'verified', 'pending_verification') THEN
        v_refund_status := 'PENDING';
        v_refund_amount := v_order.total;
        v_financial_action := 'REFUND';
    ELSIF v_order.payment_status = 'authorized' THEN
        v_refund_status := 'NOT_REQUIRED';
        v_refund_amount := 0;
        v_financial_action := 'VOID';
    ELSIF v_order.payment_status IN ('refunded', 'failed', 'unpaid', 'pending') THEN
        v_refund_status := 'NOT_REQUIRED';
        v_financial_action := 'NONE';
    ELSIF v_order.payment_status = 'partially_refunded' THEN
        v_refund_status := 'PENDING';
        v_refund_amount := v_order.total; -- Should subtract already refunded but keeping it simple as requested
        v_financial_action := 'REFUND';
    END IF;

    -- 7. Insert Cancellation Record
    INSERT INTO public.cancellations (
        order_id, actor_type, actor_id, reason_code, note,
        previous_status, refund_status, refund_amount, idempotency_key, financial_action
    ) VALUES (
        p_order_id, v_actor_type, v_user_id, p_reason_code, p_note,
        v_order.status, v_refund_status, v_refund_amount, p_idempotency_key, v_financial_action
    ) RETURNING id INTO v_cancel_id;

    -- 8. Update Order Status
    UPDATE public.orders SET
        status = 'cancelled',
        cancellation_reason = p_reason_code,
        cancelled_by = v_user_id,
        cancelled_at = NOW()
    WHERE id = p_order_id;

    -- 9. Inventory Cleanup
    -- (fixed: order_id is uuid, p_order_id is uuid — the previous version's
    -- `order_id = p_order_id::text` had no matching operator and raised on
    -- every call)
    FOR v_res IN
        SELECT id FROM public.inventory_reservations
        WHERE order_id = p_order_id AND state IN ('reserved', 'committed')
    LOOP
        PERFORM public.release_inventory(
            v_res.id,
            'ORDER_CANCELLED',
            p_idempotency_key || '-inv-' || v_res.id::text
        );
    END LOOP;

    -- 10. Trigger Refund If Needed
    IF v_financial_action = 'REFUND' THEN
        INSERT INTO public.refunds (
            order_id, amount, status, reason, created_by, idempotency_key, gateway_reference
        ) VALUES (
            p_order_id, v_refund_amount, 'pending', p_reason_code, v_user_id, p_idempotency_key || '-refund', v_order.payment_reference
        );
    END IF;

    -- 11. Enqueue Notification (to the customer, if this order has one —
    -- see header comment for why user_id can be null and why no ON CONFLICT)
    IF v_order.user_id IS NOT NULL THEN
        DECLARE
            v_notification_id UUID;
        BEGIN
            INSERT INTO public.notifications (
                user_id, type, category, title, body, data, action_url, is_read, event_key
            ) VALUES (
                v_order.user_id, 'order', 'order_updates',
                'تم إلغاء طلبك', 'تم إلغاء طلبك بنجاح. سيتم رد أي مبلغ مدفوع خلال 3-5 أيام عمل إن وجد.',
                jsonb_build_object('kind', 'order_cancelled', 'orderId', p_order_id, 'reason', p_reason_code),
                '/order/' || p_order_id::text,
                false,
                'order:' || p_order_id::text || ':cancelled'
            )
            RETURNING id INTO v_notification_id;

            INSERT INTO public.notification_outbox (
                notification_id, recipient_id, event_type, category, title, body, payload, idempotency_key
            ) VALUES (
                v_notification_id, v_order.user_id, 'order', 'order_updates',
                'تم إلغاء طلبك', 'تم إلغاء طلبك بنجاح. سيتم رد أي مبلغ مدفوع خلال 3-5 أيام عمل إن وجد.',
                jsonb_build_object(
                    'data', jsonb_build_object('kind', 'order_cancelled', 'orderId', p_order_id, 'reason', p_reason_code),
                    'action_url', '/order/' || p_order_id::text,
                    'notification_id', v_notification_id
                ),
                p_idempotency_key || '-notify'
            );
        END;
    END IF;

    RETURN json_build_object(
        'success', true,
        'cancellation_id', v_cancel_id,
        'refund_status', v_refund_status,
        'financial_action', v_financial_action
    );
END;
$$;


ALTER FUNCTION public.execute_order_cancellation(p_order_id uuid, p_reason_code text, p_note text, p_idempotency_key text) OWNER TO postgres;

--
-- Name: expand_search_query(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.expand_search_query(p_query text) RETURNS text
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$
  SELECT trim(p_query || ' ' || COALESCE(public.find_synonym_terms(p_query), ''));
$$;


ALTER FUNCTION public.expand_search_query(p_query text) OWNER TO postgres;

--
-- Name: expire_stale_reservations(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.expire_stale_reservations(p_batch_size integer DEFAULT 200) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_count    int := 0;
  v_row      public.inventory_reservations%rowtype;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  for v_row in
    select * from public.inventory_reservations
    where state = 'reserved' and expires_at < now()
    order by expires_at asc
    limit greatest(coalesce(p_batch_size, 200), 1)
    for update skip locked
  loop
    perform public._inventory_lock(v_row.product_id);

    update public.inventory_reservations
       set state       = 'expired',
           released_at = now()
     where id = v_row.id;

    update public.inventory_state
       set reserved = greatest(reserved - v_row.quantity, 0)
     where product_id = v_row.product_id;

    insert into public.stock_movements (
      product_id, delta_reserved,
      total_after, reserved_after, committed_after,
      kind, reservation_id, metadata
    )
    select
      i.product_id, -v_row.quantity,
      i.total, i.reserved, i.committed,
      'expire', v_row.id,
      jsonb_build_object('expired_at', now(), 'reservation_kind', v_row.reservation_kind)
    from public.inventory_state i where i.product_id = v_row.product_id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


ALTER FUNCTION public.expire_stale_reservations(p_batch_size integer) OWNER TO postgres;

--
-- Name: extend_reservation(uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.extend_reservation(p_reservation_id uuid, p_extend_by_secs integer DEFAULT 600) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_user_id    uuid := auth.uid();
  v_res        public.inventory_reservations%rowtype;
  v_new_exp    timestamptz;
begin
  if p_extend_by_secs is null or p_extend_by_secs <= 0 or p_extend_by_secs > 3600 then
    raise exception using errcode = '22023', message = 'invalid_extension_window';
  end if;

  select * into v_res from public.inventory_reservations
    where id = p_reservation_id for update;
  if not found then
    raise exception using errcode = '23503', message = 'reservation_not_found';
  end if;
  if v_res.user_id <> v_user_id and not public.is_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if v_res.state <> 'reserved' then
    raise exception using errcode = '22023', message = 'state_' || v_res.state || '_not_extendable';
  end if;

  v_new_exp := now() + make_interval(secs => p_extend_by_secs);
  update public.inventory_reservations
     set expires_at = v_new_exp
   where id = v_res.id;

  return jsonb_build_object(
    'reservation_id', v_res.id,
    'expires_at',     v_new_exp,
    'state',          'reserved'
  );
end;
$$;


ALTER FUNCTION public.extend_reservation(p_reservation_id uuid, p_extend_by_secs integer) OWNER TO postgres;

--
-- Name: find_synonym_terms(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.find_synonym_terms(p_query text) RETURNS text
    LANGUAGE plpgsql STABLE PARALLEL SAFE
    AS $$
DECLARE
  v_norm   text := lower(public.normalize_arabic(public.immutable_unaccent(p_query)));
  v_tokens text[];
  v_exact  text;
  v_fuzzy  text;
BEGIN
  v_tokens := (
    SELECT array_agg(tok) FROM unnest(regexp_split_to_array(trim(v_norm), '\s+')) AS tok
    WHERE length(tok) >= 2
  );
  IF v_tokens IS NULL THEN v_tokens := ARRAY[]::text[]; END IF;

  SELECT string_agg(DISTINCT s.canonical, ' ') INTO v_exact
  FROM public.search_synonyms s
  CROSS JOIN LATERAL (
    SELECT
      lower(public.normalize_arabic(public.immutable_unaccent(s.alias))) AS alias_norm,
      regexp_split_to_array(trim(lower(public.normalize_arabic(public.immutable_unaccent(s.alias)))), '\s+') AS alias_words
  ) a
  WHERE s.is_active
    AND (
      -- Whole-phrase exact match (query is exactly this alias, nothing more).
      a.alias_norm = v_norm
      -- Single-word alias: exact membership among the query's own tokens.
      OR (array_length(a.alias_words, 1) = 1 AND a.alias_norm = ANY(v_tokens))
      -- Multi-word alias: ALL of its words present among the query's
      -- tokens, order-independent — not decomposed into single-word
      -- fragments that could collide with an unrelated compound alias
      -- sharing one of those words.
      OR (
        array_length(a.alias_words, 1) > 1
        AND NOT EXISTS (SELECT 1 FROM unnest(a.alias_words) w WHERE NOT (w = ANY(v_tokens)))
      )
    );

  IF v_exact IS NOT NULL THEN
    RETURN v_exact;
  END IF;

  -- Fuzzy fallback (definite article / simple plural coverage) — single-word
  -- aliases only. Multi-word aliases get no fuzzy pass: fragment-level
  -- fuzzy matching is exactly what caused this bug.
  SELECT string_agg(DISTINCT s.canonical, ' ') INTO v_fuzzy
  FROM public.search_synonyms s
  WHERE s.is_active
    AND array_length(regexp_split_to_array(trim(lower(public.normalize_arabic(public.immutable_unaccent(s.alias)))), '\s+'), 1) = 1
    AND EXISTS (
      SELECT 1 FROM unnest(v_tokens) AS tok
      WHERE length(tok) >= 3
        AND length(lower(public.normalize_arabic(public.immutable_unaccent(s.alias)))) >= 3
        AND (
          tok ILIKE '%' || lower(public.normalize_arabic(public.immutable_unaccent(s.alias))) || '%'
          OR lower(public.normalize_arabic(public.immutable_unaccent(s.alias))) ILIKE '%' || tok || '%'
        )
    );

  RETURN v_fuzzy;
END;
$$;


ALTER FUNCTION public.find_synonym_terms(p_query text) OWNER TO postgres;

--
-- Name: fn_award_loyalty_points_on_payment_verified(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_award_loyalty_points_on_payment_verified() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_config       public.loyalty_config%ROWTYPE;
  v_points       integer;
  v_already_awarded boolean;
BEGIN
  -- Only fire when payment_status transitions TO 'verified'
  IF NEW.payment_status IS DISTINCT FROM 'verified'         THEN RETURN NEW; END IF;
  IF OLD.payment_status = 'verified'                        THEN RETURN NEW; END IF;
  -- Cancelled orders never earn points
  IF NEW.status = 'cancelled'                               THEN RETURN NEW; END IF;
  -- Must have a user
  IF NEW.user_id IS NULL                                    THEN RETURN NEW; END IF;

  -- Idempotency check (race condition / retry guard)
  SELECT EXISTS(
    SELECT 1 FROM public.loyalty_point_awards WHERE order_id = NEW.id
  ) INTO v_already_awarded;

  IF v_already_awarded THEN
    RAISE NOTICE 'fn_award_loyalty_points: order % already awarded, skipping', NEW.id;
    RETURN NEW;
  END IF;

  -- Load config
  SELECT * INTO v_config FROM public.loyalty_config WHERE id = 1;

  -- Minimum spend gate
  IF NEW.total < v_config.min_order_egp THEN
    RAISE NOTICE 'fn_award_loyalty_points: order % below min spend (%.2f < %.2f)',
      NEW.id, NEW.total, v_config.min_order_egp;
    RETURN NEW;
  END IF;

  -- Calculate points: floor(total * rate)
  v_points := floor(NEW.total::numeric * v_config.points_per_egp)::integer;

  IF v_points <= 0 THEN RETURN NEW; END IF;

  -- Record the award (unique constraint prevents double-award)
  BEGIN
    INSERT INTO public.loyalty_point_awards (order_id, user_id, points)
    VALUES (NEW.id, NEW.user_id, v_points);
  EXCEPTION WHEN unique_violation THEN
    -- Another concurrent call already awarded — silently skip
    RAISE NOTICE 'fn_award_loyalty_points: unique_violation for order %, skipping', NEW.id;
    RETURN NEW;
  END;

  -- Credit the user's loyalty wallet.
  -- Assumes a loyalty_wallets table with (user_id PK, balance integer).
  -- Insert-or-update: upsert to handle first-time wallet creation.
  INSERT INTO public.loyalty_wallets (user_id, balance)
  VALUES (NEW.user_id, v_points)
  ON CONFLICT (user_id)
  DO UPDATE SET
    balance    = public.loyalty_wallets.balance + EXCLUDED.balance,
    updated_at = now();

  -- Write to the ledger for history / statement view.
  INSERT INTO public.loyalty_ledger (
    user_id, order_id, points, direction, reason, created_at
  ) VALUES (
    NEW.user_id,
    NEW.id,
    v_points,
    'credit',
    'order_payment_verified',
    now()
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'fn_award_loyalty_points: awarded % points to user % for order %',
    v_points, NEW.user_id, NEW.id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_award_loyalty_points_on_payment_verified() OWNER TO postgres;

--
-- Name: FUNCTION fn_award_loyalty_points_on_payment_verified(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.fn_award_loyalty_points_on_payment_verified() IS 'Awards loyalty points when an order payment_status transitions to verified. Idempotent via loyalty_point_awards unique constraint.';


--
-- Name: fn_sync_product_stock(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_sync_product_stock() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.products
  set    "Stock" = greatest(new.total - new.reserved - new.committed, 0)
  where  id::text = new.product_id;
  return new;
end;
$$;


ALTER FUNCTION public.fn_sync_product_stock() OWNER TO postgres;

--
-- Name: fold_search(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fold_search(t text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
  select lower(
    -- strip Arabic harakat (diacritics)
    regexp_replace(
      -- alif variants → ا, ة → ه, ى → ي, ؤ → و, ئ → ي
      translate(
        coalesce(unaccent(t), ''),
        'إأآٱةىؤئ',
        'اااااهيوي'
      ),
      '[\u064B-\u065F\u0670\u06D6-\u06ED]', '', 'g'
    )
  )
$$;


ALTER FUNCTION public.fold_search(t text) OWNER TO postgres;

--
-- Name: get_catalog_light(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_catalog_light() RETURNS TABLE(id text, code text, barcode text, name text, name_ar text, name_en text, price numeric, stock numeric, is_active boolean, in_stock boolean, category_id text, category_name_ar text, category_name_en text, image_url text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    p.id,
    p.code,
    p.barcode,
    p.name,
    p.name_ar,
    p.name_en,
    p.price,
    COALESCE(i.available, 0) as stock,
    p.is_active,
    COALESCE(i.available, 0) > 0 as in_stock,
    p.category_id,
    p.category_name_ar,
    p.category_name_en,
    p.image_url
  FROM public.products p
  LEFT JOIN public.inventory i ON i.product_id = p.id
  WHERE p.is_active = true
  ORDER BY p.category_id, p.name;
$$;


ALTER FUNCTION public.get_catalog_light() OWNER TO postgres;

--
-- Name: get_category_counts(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_category_counts() RETURNS TABLE(category_name text, category_name_en text, product_count bigint, in_stock_count bigint)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select
    p."Category_Name"    as category_name,
    p."Category_Name_En" as category_name_en,
    count(*)             as product_count,
    count(*) filter (where coalesce(p."Stock", 0) > 0) as in_stock_count
  from public.products p
  where coalesce(p.is_active, true) = true
    and p."Category_Name" is not null
    and trim(p."Category_Name") != ''
  group by p."Category_Name", p."Category_Name_En"
  order by product_count desc;
$$;


ALTER FUNCTION public.get_category_counts() OWNER TO postgres;

--
-- Name: promotion_effective_price(numeric, text, numeric); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.promotion_effective_price(p_price numeric, p_discount_type text, p_discount_value numeric) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT greatest(0, round(CASE p_discount_type
    WHEN 'percentage' THEN p_price * (1 - p_discount_value / 100)
    WHEN 'fixed_amount' THEN p_price - p_discount_value
    ELSE p_price END, 2));
$$;


ALTER FUNCTION public.promotion_effective_price(p_price numeric, p_discount_type text, p_discount_value numeric) OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "Code" text,
    "Barcode" text,
    "Name" text NOT NULL,
    "Name_Ar" text,
    "Name_En" text,
    "Category" text,
    "Category_Name" text,
    "Category_Name_En" text,
    "Price" numeric,
    is_active boolean DEFAULT true,
    source text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "Stock" numeric,
    search_doc tsvector GENERATED ALWAYS AS ((((((setweight(to_tsvector('simple'::regconfig, COALESCE(public.fold_search("Name_Ar"), ''::text)), 'A'::"char") || setweight(to_tsvector('simple'::regconfig, COALESCE(public.fold_search("Name_En"), ''::text)), 'A'::"char")) || setweight(to_tsvector('simple'::regconfig, COALESCE("Code", ''::text)), 'B'::"char")) || setweight(to_tsvector('simple'::regconfig, COALESCE("Barcode", ''::text)), 'B'::"char")) || setweight(to_tsvector('simple'::regconfig, COALESCE(public.fold_search("Category_Name"), ''::text)), 'C'::"char")) || setweight(to_tsvector('simple'::regconfig, COALESCE(public.fold_search("Category_Name_En"), ''::text)), 'C'::"char"))) STORED,
    search_blob text GENERATED ALWAYS AS (public.fold_search(((((((COALESCE("Name_Ar", ''::text) || ' '::text) || COALESCE("Name_En", ''::text)) || ' '::text) || COALESCE("Code", ''::text)) || ' '::text) || COALESCE("Barcode", ''::text)))) STORED,
    search_vector tsvector,
    image_url text,
    rating_avg numeric(3,2),
    rating_count integer,
    discount_percent numeric(5,2),
    is_new boolean DEFAULT false NOT NULL,
    is_bestseller boolean DEFAULT false NOT NULL,
    is_sale boolean DEFAULT false NOT NULL,
    original_price numeric,
    is_offer boolean DEFAULT false NOT NULL,
    embedding public.vector(384),
    embedding_model text,
    embedding_updated_at timestamp with time zone,
    embedding_failed_attempts smallint DEFAULT 0 NOT NULL,
    requires_prescription boolean DEFAULT false NOT NULL,
    CONSTRAINT products_price_non_negative CHECK ((("Price" IS NULL) OR ("Price" >= (0)::numeric))),
    CONSTRAINT products_stock_non_negative CHECK ((("Stock" IS NULL) OR ("Stock" >= (0)::numeric)))
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: COLUMN products.search_vector; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.search_vector IS 'Auto-generated tsvector from Name_En + Name_Ar + Code + Barcode. Powers the search_products RPC full-text ranking.';


--
-- Name: COLUMN products.embedding; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.embedding IS 'gte-small vector (384-dim), computed locally in the Supabase Edge Runtime (no external AI API), over product_search_document(). NULL until generate-embeddings backfills it or an update invalidates it — semantic search degrades gracefully to zero rows, never an error, when NULL.';


--
-- Name: COLUMN products.requires_prescription; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.requires_prescription IS 'True for prescription-only medications — checkout must block/require a verified prescription before this item can be ordered. Defaults false (over-the-counter) since the catalog was imported without this classification; needs a pharmacist-driven data pass to mark real prescription items, this migration only adds the capability.';


--
-- Name: promotion_products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.promotion_products (
    promotion_id uuid NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.promotion_products OWNER TO postgres;

--
-- Name: promotions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    discount_type text NOT NULL,
    discount_value numeric(12,2) NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    CONSTRAINT promotions_check CHECK ((ends_at > starts_at)),
    CONSTRAINT promotions_check1 CHECK (((discount_type <> 'percentage'::text) OR (discount_value <= (100)::numeric))),
    CONSTRAINT promotions_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed_amount'::text]))),
    CONSTRAINT promotions_discount_value_check CHECK ((discount_value > (0)::numeric)),
    CONSTRAINT promotions_name_check CHECK (((char_length(TRIM(BOTH FROM name)) >= 2) AND (char_length(TRIM(BOTH FROM name)) <= 120))),
    CONSTRAINT promotions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'active'::text, 'paused'::text, 'expired'::text, 'archived'::text])))
);


ALTER TABLE public.promotions OWNER TO postgres;

--
-- Name: product_effective_prices; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.product_effective_prices WITH (security_invoker='true') AS
 SELECT product.id,
    product."Code" AS code,
    product."Barcode" AS barcode,
    product."Name_Ar" AS name_ar,
    product."Name_En" AS name_en,
    product."Price" AS base_price,
    product."Stock" AS stock,
    product."Category_Name" AS category_name,
    product."Category_Name_En" AS category_name_en,
    product.is_active,
    product.image_url,
    product.rating_avg,
    product.rating_count,
    product.is_new,
    product.is_bestseller,
    active_promotion.id AS promotion_id,
    active_promotion.name AS promotion_name,
    active_promotion.discount_type AS promotion_discount_type,
    active_promotion.discount_value AS promotion_discount_value,
    active_promotion.ends_at AS promotion_ends_at,
    COALESCE(active_promotion.effective_price, product."Price") AS effective_price,
    (active_promotion.id IS NOT NULL) AS has_active_promotion
   FROM (public.products product
     LEFT JOIN LATERAL ( SELECT promotion.id,
            promotion.name,
            promotion.discount_type,
            promotion.discount_value,
            promotion.ends_at,
            public.promotion_effective_price(product."Price", promotion.discount_type, promotion.discount_value) AS effective_price
           FROM (public.promotion_products assignment
             JOIN public.promotions promotion ON ((promotion.id = assignment.promotion_id)))
          WHERE ((assignment.product_id = product.id) AND promotion.is_enabled AND (promotion.status = ANY (ARRAY['scheduled'::text, 'active'::text])) AND (promotion.starts_at <= now()) AND (promotion.ends_at > now()))
          ORDER BY (public.promotion_effective_price(product."Price", promotion.discount_type, promotion.discount_value)), promotion.starts_at DESC, promotion.id
         LIMIT 1) active_promotion ON (true));


ALTER VIEW public.product_effective_prices OWNER TO postgres;

--
-- Name: get_effective_product(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_effective_product(p_product_id uuid) RETURNS SETOF public.product_effective_prices
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT *
  FROM public.product_effective_prices
  WHERE id = p_product_id AND is_active = true;
$$;


ALTER FUNCTION public.get_effective_product(p_product_id uuid) OWNER TO postgres;

--
-- Name: get_featured_products(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_featured_products(p_limit integer DEFAULT 12) RETURNS TABLE(id text, code text, barcode text, name_ar text, name_en text, price numeric, stock numeric, category_name text, category_name_en text, image_url text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select
    p.id::text,
    p."Code",
    p."Barcode",
    p."Name_Ar",
    p."Name_En",
    p."Price",
    p."Stock",
    p."Category_Name",
    p."Category_Name_En",
    p.image_url
  from public.products p
  where p.is_active = true and p."Stock" > 0
  order by p.id desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;


ALTER FUNCTION public.get_featured_products(p_limit integer) OWNER TO postgres;

--
-- Name: get_loyalty_balance(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_loyalty_balance() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_user_id  uuid := auth.uid();
  v_account  public.loyalty_accounts%rowtype;
  v_sum      bigint;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  select * into v_account from public.loyalty_accounts where user_id = v_user_id;
  if not found then
    return jsonb_build_object(
      'balance', 0, 'lifetime_earned', 0, 'lifetime_redeemed', 0,
      'tier_id', null, 'frozen', false
    );
  end if;

  select coalesce(sum(delta), 0) into v_sum
    from public.loyalty_ledger where user_id = v_user_id;
  if v_sum <> v_account.balance then
    insert into public.anti_fraud_events (user_id, event_kind, severity, payload, auto_action)
      values (v_user_id, 'impossible_balance', 'critical',
              jsonb_build_object('account_balance', v_account.balance, 'ledger_sum', v_sum),
              'flagged');
  end if;

  return jsonb_build_object(
    'balance',           v_account.balance,
    'lifetime_earned',   v_account.lifetime_earned,
    'lifetime_redeemed', v_account.lifetime_redeemed,
    'tier_id',           v_account.tier_id,
    'frozen',            v_account.frozen_at is not null,
    'version',           v_account.version
  );
end;
$$;


ALTER FUNCTION public.get_loyalty_balance() OWNER TO postgres;

--
-- Name: get_marketing_targets(integer, integer, text, text, boolean, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_marketing_targets(p_page integer DEFAULT 1, p_page_size integer DEFAULT 50, p_search text DEFAULT NULL::text, p_sort text DEFAULT 'registered_desc'::text, p_consent_only boolean DEFAULT false, p_status_filter text DEFAULT 'all'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_offset     integer := greatest(0, p_page - 1) * greatest(1, least(p_page_size, 200));
  v_limit      integer := greatest(1, least(p_page_size, 200));
  v_search     text    := nullif(btrim(coalesce(p_search, '')), '');
  v_result     jsonb;
BEGIN
  -- Authorization: only managers may call this function.
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  WITH candidates AS (
    SELECT
      p.id,
      p.full_name,
      p.phone,
      p.email,
      p.created_at                                  AS registered_at,
      p.marketing_consent,
      p.status                                      AS account_status,
      -- Derive completed order count at query time — no stale cached value.
      count(o.id) FILTER (
        WHERE o.status NOT IN ('cancelled', 'archived', 'pending', 'pending_payment')
      )                                             AS completed_order_count
    FROM public.profiles p
    LEFT JOIN public.orders o ON o.user_id = p.id
    WHERE
      p.role = 'customer'
      -- Search filter: matches full_name or phone (case-insensitive prefix/contain).
      AND (
        v_search IS NULL
        OR p.full_name ILIKE '%' || v_search || '%'
        OR p.phone     ILIKE '%' || v_search || '%'
      )
      -- Consent filter.
      AND (NOT p_consent_only OR p.marketing_consent = true)
    GROUP BY p.id
  ),
  filtered AS (
    SELECT *
    FROM candidates
    WHERE
      -- Zero-order filter: the whole point of the marketing tool.
      completed_order_count = 0
      -- Optional status filter for account_status column.
      AND (p_status_filter = 'all' OR account_status = p_status_filter)
  ),
  counted AS (
    SELECT count(*) AS total FROM filtered
  ),
  paged AS (
    SELECT
      f.id,
      f.full_name,
      f.phone,
      f.email,
      f.registered_at,
      f.marketing_consent,
      f.account_status,
      f.completed_order_count
    FROM filtered f
    ORDER BY
      CASE WHEN p_sort = 'name_asc'          THEN lower(f.full_name) END ASC  NULLS LAST,
      CASE WHEN p_sort = 'name_desc'         THEN lower(f.full_name) END DESC NULLS LAST,
      CASE WHEN p_sort = 'registered_asc'    THEN f.registered_at   END ASC  NULLS LAST,
      CASE WHEN p_sort = 'registered_desc'   THEN f.registered_at   END DESC NULLS LAST,
      f.id ASC
    LIMIT  v_limit
    OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'users',       coalesce(jsonb_agg(row_to_json(paged.*)), '[]'::jsonb),
    'total_count', (SELECT total FROM counted)
  )
  INTO v_result
  FROM paged;

  RETURN coalesce(v_result, jsonb_build_object('users', '[]'::jsonb, 'total_count', 0));
END;
$$;


ALTER FUNCTION public.get_marketing_targets(p_page integer, p_page_size integer, p_search text, p_sort text, p_consent_only boolean, p_status_filter text) OWNER TO postgres;

--
-- Name: get_order_actions(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_order_actions(p_order_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_order RECORD;
    v_role TEXT := 'customer';
    v_user_id UUID := auth.uid();
    v_is_owner BOOLEAN := false;
    v_is_assigned_driver BOOLEAN := false;
    v_can_cancel BOOLEAN := false;
    v_cancel_reason TEXT := NULL;
    v_can_return BOOLEAN := false;
    v_return_reason TEXT := NULL;
    v_cancel_reasons TEXT[] := '{}';
BEGIN
    IF v_user_id IS NULL THEN
        RETURN json_build_object(
            'cancel', json_build_object('allowed', false, 'reason', 'Unauthorized', 'reasons', '[]'::json),
            'return', json_build_object('allowed', false, 'reason', 'Unauthorized')
        );
    END IF;

    -- Determine Role
    SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
    IF v_role IS NULL THEN
        v_role := 'customer';
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN json_build_object(
            'cancel', json_build_object('allowed', false, 'reason', 'Order not found', 'reasons', '[]'::json),
            'return', json_build_object('allowed', false, 'reason', 'Order not found')
        );
    END IF;

    v_is_owner := (v_order.user_id = v_user_id);
    v_is_assigned_driver := (v_order.assigned_driver_id = v_user_id);

    -- Base Authorization Check
    IF v_role = 'customer' AND NOT v_is_owner THEN
        RETURN json_build_object(
            'cancel', json_build_object('allowed', false, 'reason', 'Unauthorized', 'reasons', '[]'::json),
            'return', json_build_object('allowed', false, 'reason', 'Unauthorized')
        );
    END IF;

    -- Cancellation Logic
    IF v_order.status IN ('pending', 'confirmed', 'verification', 'payment_pending', 'payment_approved', 'preparing', 'ready') THEN
        v_can_cancel := true;
    ELSIF v_order.status IN ('driver_assigned', 'driver_accepted') THEN
        v_can_cancel := true;
    ELSIF v_order.status = 'cancelled' THEN
        v_can_cancel := false;
        v_cancel_reason := 'Order is already cancelled.';
    ELSE
        -- picked_up, out_for_delivery, delivered
        v_can_cancel := false;
        v_cancel_reason := 'Order is already out for delivery or delivered. Cancellation is no longer possible.';
    END IF;

    -- Populate Reasons Based on Role
    IF v_role = 'customer' THEN
        v_cancel_reasons := ARRAY['CHANGED_MIND', 'ORDERED_BY_MISTAKE', 'WRONG_ADDRESS', 'DUPLICATE_ORDER', 'PAYMENT_PROBLEM', 'DELIVERY_DELAY', 'FOUND_ELSEWHERE', 'OTHER'];
    ELSIF v_role = 'pharmacist' OR v_role = 'admin' OR v_role = 'manager' THEN
        v_cancel_reasons := ARRAY['PRODUCT_UNAVAILABLE', 'STOCK_MISMATCH', 'PRESCRIPTION_REJECTED', 'PRESCRIPTION_UNCLEAR', 'PHARMACY_CANNOT_FULFILL', 'PHARMACY_CLOSED', 'OTHER'];
    ELSIF v_role = 'driver' THEN
        IF NOT v_is_assigned_driver THEN
            v_can_cancel := false;
            v_cancel_reason := 'Only the assigned driver can cancel this order.';
        END IF;
        v_cancel_reasons := ARRAY['CUSTOMER_UNREACHABLE', 'ADDRESS_UNREACHABLE', 'VEHICLE_ISSUE', 'SAFETY_ISSUE', 'DELIVERY_PROBLEM', 'OTHER'];
    END IF;

    -- Return Logic
    IF v_order.status = 'delivered' THEN
        v_can_return := true;
    ELSE
        v_can_return := false;
        v_return_reason := 'ORDER_NOT_DELIVERED';
    END IF;

    RETURN json_build_object(
        'cancel', json_build_object('allowed', v_can_cancel, 'reason', v_cancel_reason, 'reasons', array_to_json(v_cancel_reasons)),
        'return', json_build_object('allowed', v_can_return, 'reason', v_return_reason)
    );
END;
$$;


ALTER FUNCTION public.get_order_actions(p_order_id uuid) OWNER TO postgres;

--
-- Name: get_orders_dashboard(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_orders_dashboard() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT (
    public.is_manager()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'pharmacist')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN (
    select json_build_object(
      'total_orders', (
        select count(*)::int from public.orders
      ),
      'total_sales', (
        select coalesce(sum(total), 0)::float from public.orders
      ),
      'orders_by_day', (
        select coalesce(json_agg(d order by d.day), '[]'::json)
        from (
          select
            (created_at at time zone 'Africa/Cairo')::date::text as day,
            count(*)::int                                         as orders,
            coalesce(sum(total), 0)::float                        as sales
          from public.orders
          where created_at >= now() - interval '30 days'
          group by (created_at at time zone 'Africa/Cairo')::date
        ) d
      )
    )
  );
END;
$$;


ALTER FUNCTION public.get_orders_dashboard() OWNER TO postgres;

--
-- Name: get_popular_searches(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_popular_searches(p_limit integer DEFAULT 10, p_days integer DEFAULT 7) RETURNS TABLE(query text, search_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    se.query,
    COUNT(*) AS search_count
  FROM public.search_events se
  WHERE
    se.created_at >= now() - (p_days || ' days')::interval
    AND char_length(se.query) >= 2
    AND se.query ~ '[^0-9]'
  GROUP BY se.query
  HAVING COUNT(*) >= 2 AND COUNT(DISTINCT COALESCE(se.user_id::text, se.id::text)) >= 2
  ORDER BY search_count DESC
  LIMIT p_limit;
$$;


ALTER FUNCTION public.get_popular_searches(p_limit integer, p_days integer) OWNER TO postgres;

--
-- Name: get_related_products(text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_related_products(p_product_id text, p_limit integer DEFAULT 12) RETURNS TABLE(id text, code text, barcode text, name_ar text, name_en text, price numeric, stock numeric, category_name text, category_name_en text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with seed as (
    select "Category_Name" as cat
    from public.products
    where id::text = p_product_id
  )
  select
    p.id::text,
    p."Code",
    p."Barcode",
    p."Name_Ar",
    p."Name_En",
    p."Price",
    p."Stock",
    p."Category_Name",
    p."Category_Name_En"
  from public.products p, seed
  where p.is_active = true
    and p."Category_Name" = seed.cat
    and p.id::text <> p_product_id
  -- in-stock items first, then newest
  order by (p."Stock" > 0) desc, p.id desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;


ALTER FUNCTION public.get_related_products(p_product_id text, p_limit integer) OWNER TO postgres;

--
-- Name: get_return_eligibility(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_return_eligibility(p_order_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_items JSON := '[]'::JSON;
    v_is_eligible BOOLEAN := true;
    v_order_reason TEXT := NULL;
    v_return_window_days INT := 14; -- Configurable policy
    v_already_returned NUMERIC;
    v_item_eligible BOOLEAN;
    v_item_reason TEXT;
BEGIN
    -- 1. Load the order
    SELECT status, delivered_at 
    INTO v_order
    FROM orders
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RETURN json_build_object('eligible', false, 'reason', 'Order not found', 'items', '[]'::JSON);
    END IF;

    -- 2. Check basic order status
    IF v_order.status != 'delivered' THEN
        v_is_eligible := false;
        v_order_reason := 'Order must be delivered to be returned';
    END IF;

    -- 3. Check return window
    IF v_order.delivered_at IS NULL THEN
        v_is_eligible := false;
        v_order_reason := 'Delivery timestamp is missing';
    ELSIF v_order.delivered_at + (v_return_window_days || ' days')::INTERVAL < NOW() THEN
        v_is_eligible := false;
        v_order_reason := 'Return window (' || v_return_window_days || ' days) has expired';
    END IF;

    -- 4. Check each item
    FOR v_item IN 
        SELECT oi.id, oi.product_id, oi.quantity, p.requires_prescription 
        FROM order_items oi
        LEFT JOIN products p ON (oi.product_id = p.id::text OR oi.product_id = p."Code" OR oi.product_id = p."Barcode")
        WHERE oi.order_id = p_order_id
    LOOP
        v_item_eligible := true;
        v_item_reason := NULL;

        -- Sum requested quantities for active returns
        SELECT COALESCE(SUM(requested_quantity), 0)
        INTO v_already_returned
        FROM return_items ri
        JOIN return_requests rr ON ri.request_id = rr.id
        WHERE ri.order_item_id = v_item.id
          AND rr.status NOT IN ('REJECTED', 'RETURN_REJECTED');

        IF v_already_returned >= v_item.quantity THEN
            v_item_eligible := false;
            v_item_reason := 'Fully returned or requested';
        END IF;

        IF v_item.requires_prescription THEN
            v_item_eligible := false;
            v_item_reason := 'Prescription items cannot be returned (requires support review)';
        END IF;

        v_items := v_items || json_build_object(
            'order_item_id', v_item.id,
            'product_id', v_item.product_id,
            'purchased_quantity', v_item.quantity,
            'already_returned', v_already_returned,
            'available_quantity', GREATEST(0, v_item.quantity - v_already_returned),
            'eligible', v_item_eligible,
            'reason', v_item_reason
        )::JSONB;
    END LOOP;

    RETURN json_build_object(
        'eligible', v_is_eligible,
        'reason', v_order_reason,
        'items', v_items
    );
END;
$$;


ALTER FUNCTION public.get_return_eligibility(p_order_id uuid) OWNER TO postgres;

--
-- Name: get_trending_products(text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_trending_products(p_category text DEFAULT NULL::text, p_limit integer DEFAULT 12) RETURNS TABLE(id text, code text, barcode text, name_ar text, name_en text, price numeric, stock numeric, category_name text, category_name_en text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select
    p.id::text,
    p."Code",
    p."Barcode",
    p."Name_Ar",
    p."Name_En",
    p."Price",
    p."Stock",
    p."Category_Name",
    p."Category_Name_En"
  from public.products p
  where p.is_active = true
    and p."Stock" > 0
    and (p_category is null or p."Category_Name" = p_category)
  order by p.id desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;


ALTER FUNCTION public.get_trending_products(p_category text, p_limit integer) OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_name  text;
  v_phone text;
begin
  -- Pull name + phone from user_metadata if present; fall back to email prefix.
  v_name  := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'مستخدم'
  );
  v_phone := nullif(trim(new.raw_user_meta_data->>'phone'), '');

  -- Upsert so a pre-existing row (from a client-side upsert that ran first,
  -- or a retry) doesn't 409. Only sets columns that exist on every profiles
  -- schema variant we've seen; extras default at the table level.
  insert into public.profiles (id, email, full_name, phone, phone_verified)
  values (
    new.id,
    coalesce(new.email, ''),
    v_name,
    v_phone,
    false
  )
  on conflict (id) do update
    set email          = excluded.email,
        full_name      = coalesce(public.profiles.full_name, excluded.full_name),
        phone          = coalesce(public.profiles.phone,     excluded.phone),
        phone_verified = public.profiles.phone_verified;

  return new;

-- Crucially: never let an unexpected exception in this trigger block signup.
-- Log it and let auth.users.insert succeed; the client-side upsert in
-- src/features/auth/api.ts is a safety net for the profile row.
exception
  when others then
    raise warning 'handle_new_user failed: % (sqlstate %)', sqlerrm, sqlstate;
    return new;
end;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: has_permission(text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.has_permission(p_permission_key text, p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  return public.is_manager(p_user_id);
end;
$$;


ALTER FUNCTION public.has_permission(p_permission_key text, p_user_id uuid) OWNER TO postgres;

--
-- Name: haversine_km(double precision, double precision, double precision, double precision); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision) RETURNS double precision
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT 6371 * 2 * asin(sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2 +
    cos(radians(lat1)) * cos(radians(lat2)) *
    sin(radians(lng2 - lng1) / 2) ^ 2
  ));
$$;


ALTER FUNCTION public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision) OWNER TO postgres;

--
-- Name: immutable_unaccent(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.immutable_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO 'public', 'extensions'
    AS $_$
  SELECT unaccent(d.oid::regdictionary, $1)
  FROM pg_ts_dict d
  WHERE d.dictname = 'unaccent'
  LIMIT 1
$_$;


ALTER FUNCTION public.immutable_unaccent(text) OWNER TO postgres;

--
-- Name: insert_staff_notification(uuid, text, text, text, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.insert_staff_notification(p_user_id uuid, p_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  declare
    v_id uuid;
  begin
    if not public.is_manager() then
      raise exception 'insufficient_privilege' using errcode = '42501';
    end if;

    insert into public.notifications (user_id, type, category, title, body, data, action_url, is_read)
    values (p_user_id, p_type, p_category, p_title, p_body, p_data, p_action_url, false)
    returning id into v_id;

    return v_id;
  end;
  $$;


ALTER FUNCTION public.insert_staff_notification(p_user_id uuid, p_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text) OWNER TO postgres;

--
-- Name: inventory_state_touch(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.inventory_state_touch() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  new.version    := old.version + 1;
  return new;
end;
$$;


ALTER FUNCTION public.inventory_state_touch() OWNER TO postgres;

--
-- Name: is_admin(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_admin(p_user_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
        select exists (
          select 1 from public.profiles
          where id = coalesce(p_user_id, auth.uid())
            and role = 'admin'
        );
      $$;


ALTER FUNCTION public.is_admin(p_user_id uuid) OWNER TO postgres;

--
-- Name: is_customers_assigned_driver(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_customers_assigned_driver(p_driver_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.orders o
    where o.assigned_driver_id = p_driver_id
      and o.user_id = auth.uid()
      and o.status in ('driver_assigned', 'driver_accepted', 'out_for_delivery', 'delivered')
  );
$$;


ALTER FUNCTION public.is_customers_assigned_driver(p_driver_id uuid) OWNER TO postgres;

--
-- Name: is_driver(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_driver(p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.current_app_role(p_user_id) = 'driver'::public.app_role;
$$;


ALTER FUNCTION public.is_driver(p_user_id uuid) OWNER TO postgres;

--
-- Name: is_manager(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_manager(p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(
    (
      select role in ('manager'::public.app_role, 'admin'::public.app_role)
      from public.profiles
      where id = p_user_id
    ),
    false
  );
$$;


ALTER FUNCTION public.is_manager(p_user_id uuid) OWNER TO postgres;

--
-- Name: is_promotion_manager(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_promotion_manager() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.is_manager();
$$;


ALTER FUNCTION public.is_promotion_manager() OWNER TO postgres;

--
-- Name: log_order_status_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_order_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.order_status_history (
            order_id, 
            previous_status, 
            new_status, 
            actor_id,
            reason
        ) VALUES (
            NEW.id, 
            OLD.status, 
            NEW.status, 
            coalesce(NEW.cancelled_by, auth.uid()), -- Use cancelled_by if set, else current user
            CASE WHEN NEW.status = 'cancelled' THEN NEW.cancellation_reason ELSE NULL END
        );
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.log_order_status_change() OWNER TO postgres;

--
-- Name: log_search_event(text, integer, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_search_event(p_query text, p_result_count integer DEFAULT 0, p_source text DEFAULT 'native'::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Silently skip trivially short queries and clearly bot-like values
  IF p_query IS NULL OR char_length(trim(p_query)) < 2 THEN
    RETURN;
  END IF;

  INSERT INTO public.search_events (user_id, query, result_count, source)
  VALUES (
    auth.uid(),                        -- NULL for anonymous, fine
    lower(trim(p_query)),
    COALESCE(p_result_count, 0),
    COALESCE(p_source, 'native')
  );
END;
$$;


ALTER FUNCTION public.log_search_event(p_query text, p_result_count integer, p_source text) OWNER TO postgres;

--
-- Name: loyalty_accounts_touch(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.loyalty_accounts_touch() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  new.version    := old.version + 1;
  return new;
end;
$$;


ALTER FUNCTION public.loyalty_accounts_touch() OWNER TO postgres;

--
-- Name: manual_assign_driver(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.manual_assign_driver(p_order_id uuid, p_driver_id uuid) RETURNS public.orders
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_order public.orders;
begin
  if auth.uid() is null then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  if (select role::text from public.profiles where id = auth.uid()) not in ('admin', 'manager') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  -- The RPC is the authorization boundary -- verify p_driver_id is a real,
  -- non-suspended driver rather than trusting the caller. Deliberately
  -- lighter than rank_available_drivers' full eligibility check (doesn't
  -- require isOnline -- an admin may reasonably hand-assign a driver who's
  -- reachable by phone but momentarily shows offline).
  if not exists (
    select 1 from public."DriverProfile" where "userId" = p_driver_id and status in ('APPROVED', 'ACTIVE')
  ) then
    raise exception 'invalid_driver' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;  -- lock first
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  -- Supersede any currently-open assignment -- mirrors reassignDriver()'s
  -- existing behavior, now atomic with everything else in this function.
  update public.delivery_assignments
  set response_status = 'superseded', superseded_at = now()
  where order_id = p_order_id and response_status in ('offered', 'accepted');

  insert into public.delivery_assignments (order_id, driver_id, assigned_by, assignment_kind, response_status)
  values (
    p_order_id, p_driver_id, auth.uid(),
    case when v_order.assigned_driver_id is null then 'assigned' else 'reassigned' end,
    'offered'
  );

  update public.orders
  set assigned_driver_id = p_driver_id, dispatch_status = 'assigned', updated_at = now()
  where id = p_order_id
  returning * into v_order;

  -- First-time assignment from 'ready' also advances the lifecycle status,
  -- exactly matching assignDriver()'s existing behavior (reuses the
  -- already-validated transition_order() rather than duplicating its
  -- logic). Reassignment (status already past 'ready') deliberately leaves
  -- status untouched, matching reassignDriver()'s existing behavior --
  -- the resulting status/acceptance drift on reassign-after-accept is a
  -- pre-existing characteristic of this system, not something this change
  -- introduces or is scoped to fix.
  if v_order.status = 'ready' then
    v_order := public.transition_order(p_order_id, 'driver_assigned');
  end if;

  return v_order;
end;
$$;


ALTER FUNCTION public.manual_assign_driver(p_order_id uuid, p_driver_id uuid) OWNER TO postgres;

--
-- Name: mark_delivery_arrival(uuid, text, numeric, numeric); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.mark_delivery_arrival(p_assignment_id uuid, p_stage text, p_lat numeric, p_lng numeric) RETURNS public.delivery_assignments
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
  v_assignment public.delivery_assignments%rowtype;
  v_order public.orders%rowtype;
  v_distance_meters double precision;
  v_radius_meters constant double precision := 200;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;
  IF p_stage NOT IN ('pharmacy', 'customer') THEN
    RAISE EXCEPTION 'invalid_arrival_stage' USING ERRCODE = '22023';
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'coordinates_required' USING ERRCODE = '22023';
  END IF;

  SELECT da.*
    INTO v_assignment
    FROM public.delivery_assignments da
   WHERE da.id = p_assignment_id
     AND da.driver_id = auth.uid()
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT o.* INTO v_order FROM public.orders o WHERE o.id = v_assignment.order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_assignment.response_status <> 'accepted' THEN
    RAISE EXCEPTION 'assignment_not_accepted' USING ERRCODE = '42501';
  END IF;
  IF p_stage = 'pharmacy' AND v_order.status::text <> 'driver_accepted' THEN
    RAISE EXCEPTION 'order_not_ready_for_pharmacy_arrival' USING ERRCODE = '22023';
  END IF;
  IF p_stage = 'customer' AND v_order.status::text <> 'out_for_delivery' THEN
    RAISE EXCEPTION 'order_not_out_for_delivery' USING ERRCODE = '22023';
  END IF;

  -- Geofence check: customer stage only (see header comment for why
  -- pharmacy stage is skipped). Haversine distance in metres.
  IF p_stage = 'customer' AND v_order.customer_lat IS NOT NULL AND v_order.customer_lng IS NOT NULL THEN
    v_distance_meters := 6371000 * 2 * asin(sqrt(
      power(sin(radians(v_order.customer_lat - p_lat) / 2), 2) +
      cos(radians(p_lat)) * cos(radians(v_order.customer_lat)) *
      power(sin(radians(v_order.customer_lng - p_lng) / 2), 2)
    ));
    IF v_distance_meters > v_radius_meters THEN
      RAISE EXCEPTION 'too_far_from_destination: %m from customer, must be within %m', round(v_distance_meters), v_radius_meters
        USING ERRCODE = '22023', HINT = 'too_far_from_destination';
    END IF;
  END IF;

  IF p_stage = 'pharmacy' THEN
    UPDATE public.delivery_assignments
       SET arrived_at_pharmacy = coalesce(arrived_at_pharmacy, now())
     WHERE id = p_assignment_id
     RETURNING * INTO v_assignment;
  ELSE
    UPDATE public.delivery_assignments
       SET arrived_at_customer = coalesce(arrived_at_customer, now())
     WHERE id = p_assignment_id
     RETURNING * INTO v_assignment;
  END IF;
  RETURN v_assignment;
END;
$$;


ALTER FUNCTION public.mark_delivery_arrival(p_assignment_id uuid, p_stage text, p_lat numeric, p_lng numeric) OWNER TO postgres;

--
-- Name: mark_product_embedding_failed(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.mark_product_embedding_failed(p_id uuid) RETURNS void
    LANGUAGE sql
    AS $$
  UPDATE public.products
  SET embedding_failed_attempts = embedding_failed_attempts + 1
  WHERE id = p_id;
$$;


ALTER FUNCTION public.mark_product_embedding_failed(p_id uuid) OWNER TO postgres;

--
-- Name: normalize_arabic(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.normalize_arabic(t text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(t,
                  '[ً-ٟـٰٴ]', '', 'g'),
                '[أإآٱ]', 'ا', 'g'),
              'ة', 'ه', 'g'),
            'ى', 'ي', 'g'),
          'ؤ', 'و', 'g'),
        'ئ', 'ي', 'g'),
      '\s+', ' ', 'g'))
$$;


ALTER FUNCTION public.normalize_arabic(t text) OWNER TO postgres;

--
-- Name: notification_unread_count(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notification_unread_count(p_user_id uuid DEFAULT auth.uid()) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.notifications
  WHERE user_id = p_user_id AND is_read = FALSE;
$$;


ALTER FUNCTION public.notification_unread_count(p_user_id uuid) OWNER TO postgres;

--
-- Name: notify_pharmacist_customer_order_update(uuid, text, text, text, text, jsonb, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_pharmacist_customer_order_update(p_order_id uuid, p_event_type text, p_category text, p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb, p_action_url text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.notify_pharmacist_customer_order_update(p_order_id uuid, p_event_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text, p_idempotency_key text) OWNER TO postgres;

--
-- Name: notify_pharmacist_customer_prescription_review(uuid, text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_pharmacist_customer_prescription_review(p_prescription_id uuid, p_decision text, p_event_type text, p_category text, p_title text, p_body text, p_action_url text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.notify_pharmacist_customer_prescription_review(p_prescription_id uuid, p_decision text, p_event_type text, p_category text, p_title text, p_body text, p_action_url text, p_idempotency_key text) OWNER TO postgres;

--
-- Name: notify_staff_prescription_submitted(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_staff_prescription_submitted(p_prescription_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
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


ALTER FUNCTION public.notify_staff_prescription_submitted(p_prescription_id uuid) OWNER TO postgres;

--
-- Name: point_in_polygon(double precision, double precision, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.point_in_polygon(p_lat double precision, p_lng double precision, p_polygon jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  pts   jsonb;
  n     integer;
  i     integer;
  j     integer;
  xi    double precision;
  yi    double precision;
  xj    double precision;
  yj    double precision;
  inside boolean := false;
BEGIN
  pts := p_polygon -> 'points';
  IF pts IS NULL THEN RETURN false; END IF;
  n := jsonb_array_length(pts);
  IF n < 3 THEN RETURN false; END IF;

  j := n - 1;
  FOR i IN 0 .. n - 1 LOOP
    xi := (pts -> i ->> 'lng')::double precision;
    yi := (pts -> i ->> 'lat')::double precision;
    xj := (pts -> j ->> 'lng')::double precision;
    yj := (pts -> j ->> 'lat')::double precision;
    IF ((yi > p_lat) <> (yj > p_lat))
       AND (p_lng < (xj - xi) * (p_lat - yi) / NULLIF(yj - yi, 0) + xi) THEN
      inside := NOT inside;
    END IF;
    j := i;
  END LOOP;

  RETURN inside;
END;
$$;


ALTER FUNCTION public.point_in_polygon(p_lat double precision, p_lng double precision, p_polygon jsonb) OWNER TO postgres;

--
-- Name: FUNCTION point_in_polygon(p_lat double precision, p_lng double precision, p_polygon jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.point_in_polygon(p_lat double precision, p_lng double precision, p_polygon jsonb) IS 'Ray-casting point-in-polygon test over a {"points":[{"lat","lng"},...]} jsonb shape — no PostGIS dependency.';


--
-- Name: post_driver_earning_on_delivery(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.post_driver_earning_on_delivery() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_driver_profile_id uuid;
  v_assignment_id      uuid;
  v_base_fee           numeric;
  v_accepted           integer;
  v_declined           integer;
BEGIN
  IF NEW.status IS DISTINCT FROM 'delivered'
     OR OLD.status IS NOT DISTINCT FROM NEW.status
     OR NEW.assigned_driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_driver_profile_id
  FROM public."DriverProfile"
  WHERE "userId" = NEW.assigned_driver_id;

  -- Defensive only — should be unreachable given the app's own access gate.
  -- An order must still complete even if this can't be resolved.
  IF v_driver_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_assignment_id
  FROM public.delivery_assignments
  WHERE order_id = NEW.id AND driver_id = NEW.assigned_driver_id
  ORDER BY offered_at DESC
  LIMIT 1;

  v_base_fee := COALESCE(NEW.zone_base_fee, 20);

  INSERT INTO public."DriverEarning" (
    "driverId", "deliveryId", "baseFee", "distanceFee", "tipAmount", "bonusAmount", "totalAmount", "earnedAt"
  ) VALUES (
    v_driver_profile_id, COALESCE(v_assignment_id, NEW.id), v_base_fee, 0, 0, 0, v_base_fee, now()
  );

  SELECT
    count(*) FILTER (WHERE response_status = 'accepted'),
    count(*) FILTER (WHERE response_status = 'declined')
  INTO v_accepted, v_declined
  FROM public.delivery_assignments
  WHERE driver_id = NEW.assigned_driver_id;

  UPDATE public."DriverProfile"
  SET "totalDeliveries" = "totalDeliveries" + 1,
      "totalEarnings" = "totalEarnings" + v_base_fee,
      "completionRate" = CASE
        WHEN (v_accepted + v_declined) > 0 THEN round((v_accepted::numeric / (v_accepted + v_declined)) * 100, 1)
        ELSE "completionRate"
      END,
      "updatedAt" = now()
  WHERE id = v_driver_profile_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.post_driver_earning_on_delivery() OWNER TO postgres;

--
-- Name: FUNCTION post_driver_earning_on_delivery(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.post_driver_earning_on_delivery() IS 'Posts a real DriverEarning row and updates DriverProfile aggregates the moment an order reaches delivered with an assigned driver. Fee formula is a documented placeholder (zone_base_fee or a flat default) — a real driver pay-rate policy is a business decision, not implemented here.';


--
-- Name: process_cashback_reward(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.process_cashback_reward(p_user_id uuid, p_order_id uuid, p_idempotency_key text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_order_total bigint;
  v_order_user  uuid;
  v_account     public.loyalty_accounts%rowtype;
  v_tier_mult   numeric(6,2) := 1.0;
  v_camp_mult   numeric(6,2) := 1.0;
  v_base_points bigint;
  v_total_points bigint;
  v_cached      jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  select total_cents, user_id into v_order_total, v_order_user
    from public.orders where id = p_order_id;
  if not found then
    raise exception using errcode = '23503', message = 'order_not_found';
  end if;
  if v_order_user <> p_user_id then
    raise exception using errcode = '22023', message = 'order_user_mismatch';
  end if;

  v_cached := public._loyalty_idempotency_begin(p_idempotency_key, 'process_cashback_reward', p_user_id);
  if v_cached is not null then return v_cached; end if;

  perform public._loyalty_lock(p_user_id);
  v_account := public._loyalty_ensure_account(p_user_id);

  if v_account.tier_id is not null then
    select earn_multiplier into v_tier_mult
      from public.reward_tiers where id = v_account.tier_id;
  end if;

  select coalesce(max(multiplier), 1.0) into v_camp_mult
    from public.reward_campaigns
   where is_active = true
     and (starts_at is null or starts_at <= now())
     and (ends_at   is null or ends_at   >= now());

  v_base_points  := floor(v_order_total / 100.0);
  v_total_points := floor(v_base_points * v_tier_mult * v_camp_mult);

  if v_total_points <= 0 then
    perform public._loyalty_idempotency_end(
      p_idempotency_key,
      jsonb_build_object('ledger_id', null, 'balance', v_account.balance, 'amount', 0)
    );
    return jsonb_build_object('ledger_id', null, 'balance', v_account.balance, 'amount', 0);
  end if;

  return public.earn_loyalty_points(
    p_user_id,
    v_total_points,
    'order_cashback',
    p_order_id::text,
    p_idempotency_key || ':earn'
  );
end;
$$;


ALTER FUNCTION public.process_cashback_reward(p_user_id uuid, p_order_id uuid, p_idempotency_key text) OWNER TO postgres;

--
-- Name: product_search_document(text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.product_search_document(p_name_ar text, p_name_en text, p_category_name text, p_category_name_en text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
  SELECT trim(both ' | ' FROM
    concat_ws(' | ',
      nullif(trim(coalesce(p_name_en, '')), ''),
      nullif(trim(coalesce(p_name_ar, '')), ''),
      nullif(trim(coalesce(p_category_name_en, '')), ''),
      nullif(trim(coalesce(p_category_name, '')), '')
    )
  )
$$;


ALTER FUNCTION public.product_search_document(p_name_ar text, p_name_en text, p_category_name text, p_category_name_en text) OWNER TO postgres;

--
-- Name: products_invalidate_embedding(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.products_invalidate_embedding() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (
    NEW."Name_Ar" IS DISTINCT FROM OLD."Name_Ar" OR
    NEW."Name_En" IS DISTINCT FROM OLD."Name_En" OR
    NEW."Category_Name" IS DISTINCT FROM OLD."Category_Name" OR
    NEW."Category_Name_En" IS DISTINCT FROM OLD."Category_Name_En"
  ) THEN
    NEW.embedding := NULL;
    NEW.embedding_model := NULL;
    NEW.embedding_updated_at := NULL;
    NEW.embedding_failed_attempts := 0;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.products_invalidate_embedding() OWNER TO postgres;

--
-- Name: products_pending_embedding(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.products_pending_embedding(p_limit integer DEFAULT 50) RETURNS TABLE(id uuid, search_document text)
    LANGUAGE sql STABLE
    AS $$
  SELECT
    p.id,
    public.product_search_document(p."Name_Ar", p."Name_En", p."Category_Name", p."Category_Name_En")
  FROM public.products p
  WHERE p.is_active = true
    AND p.embedding IS NULL
    AND p.embedding_failed_attempts < 5
    AND public.product_search_document(p."Name_Ar", p."Name_En", p."Category_Name", p."Category_Name_En") <> ''
  ORDER BY p.embedding_failed_attempts ASC, p.id ASC
  LIMIT greatest(1, least(p_limit, 200));
$$;


ALTER FUNCTION public.products_pending_embedding(p_limit integer) OWNER TO postgres;

--
-- Name: products_search_vector_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.products_search_vector_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple',
      normalize_arabic(unaccent(coalesce(new."Name",    '')))),   'A') ||
    setweight(to_tsvector('simple',
      normalize_arabic(unaccent(coalesce(new."Name_Ar", '')))),   'A') ||
    setweight(to_tsvector('simple',
      unaccent(coalesce(new."Name_En", ''))),                      'A') ||
    setweight(to_tsvector('simple',
      unaccent(coalesce(new."Code", ''))),                         'B') ||
    setweight(to_tsvector('simple',
      unaccent(coalesce(new."Barcode", ''))),                      'B') ||
    setweight(to_tsvector('simple',
      normalize_arabic(unaccent(coalesce(new."Category_Name",    '')))), 'C') ||
    setweight(to_tsvector('simple',
      unaccent(coalesce(new."Category_Name_En", ''))),             'C');
  return new;
end;
$$;


ALTER FUNCTION public.products_search_vector_update() OWNER TO postgres;

--
-- Name: profiles_guard_role_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.profiles_guard_role_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
  -- service_role is a signed JWT claim available only to trusted server-side
  -- clients. Admin/manager browser calls remain authorized through is_manager.
  IF COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
     OR public.is_manager() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'customer';
    NEW.status := 'Active';
    RETURN NEW;
  END IF;

  NEW.role := OLD.role;
  NEW.status := OLD.status;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.profiles_guard_role_status() OWNER TO postgres;

--
-- Name: rank_available_drivers(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rank_available_drivers(p_order_id uuid) RETURNS TABLE(driver_user_id uuid, driver_profile_id uuid, full_name text, phone text, vehicle_type text, rating double precision, distance_to_branch_km double precision, active_deliveries integer, score double precision, is_recommended boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_branch_lat double precision;
  v_branch_lng double precision;
BEGIN
  -- Only staff (admin/manager) may call this — same role gate the rest of
  -- the dispatch surface uses. SECURITY DEFINER is required because it
  -- reads DriverProfile rows across all drivers, which no driver-facing RLS
  -- policy grants to a caller who isn't that driver.
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Not authorized to rank drivers';
  END IF;

  SELECT b.lat, b.lng INTO v_branch_lat, v_branch_lng
  FROM public.orders o
  JOIN public."Branch" b ON b.id = o.branch_id
  WHERE o.id = p_order_id;

  IF v_branch_lat IS NULL THEN
    -- Order has no resolved branch (shouldn't happen for a real order past
    -- create-order, but a bad/legacy row must not crash the whole ranking
    -- with a null-coordinate distance calculation) -- return no candidates
    -- rather than a misleading distance-free ranking.
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      dp."userId"                                AS driver_user_id,
      dp.id                                       AS driver_profile_id,
      COALESCE(p."full_name", p.email, 'Driver')  AS full_name,
      p.phone                                     AS phone,
      dp."vehicleType"                            AS vehicle_type,
      dp.rating                                   AS rating,
      CASE
        WHEN dp."currentLat" IS NOT NULL AND dp."currentLng" IS NOT NULL
        THEN public.haversine_km(v_branch_lat, v_branch_lng, dp."currentLat", dp."currentLng")
        ELSE NULL
      END AS distance_to_branch_km,
      (
        SELECT count(*)::integer FROM public.delivery_assignments da
        WHERE da.driver_id = dp."userId" AND da.response_status IN ('offered', 'accepted')
      ) AS active_deliveries
    FROM public."DriverProfile" dp
    JOIN public.profiles p ON p.id = dp."userId"
    WHERE dp.status IN ('APPROVED', 'ACTIVE')
      AND dp."isOnline" = true
  )
  SELECT
    c.driver_user_id, c.driver_profile_id, c.full_name, c.phone, c.vehicle_type, c.rating,
    c.distance_to_branch_km, c.active_deliveries,
    -- Explainable, deterministic score: start at 100, lose points for
    -- distance (2 pts/km, capped so a far driver never goes negative) and
    -- for each active delivery already in hand (15 pts -- a driver with
    -- zero active deliveries should almost always outrank one with two,
    -- even if slightly farther). Unknown distance (no live GPS fix) is
    -- penalized like a moderate-distance driver rather than either winning
    -- by default or being excluded outright -- the driver is still online
    -- and eligible, just less precisely placed.
    round(
      (100
        - LEAST(COALESCE(c.distance_to_branch_km, 8) * 2, 60)
        - (c.active_deliveries * 15)
      )::numeric, 1
    )::double precision AS score,
    false AS is_recommended
  FROM candidates c
  ORDER BY score DESC, distance_to_branch_km ASC NULLS LAST;
END;
$$;


ALTER FUNCTION public.rank_available_drivers(p_order_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION rank_available_drivers(p_order_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.rank_available_drivers(p_order_id uuid) IS 'Ranks online, approved/active drivers for a given order by an explainable score (distance to the order''s resolved branch, current active-delivery workload). Staff-only (admin/manager). Does not assign -- purely advisory, feeding the existing manual assignDriver()/assignOrder() flow with a ranked candidate list instead of an alphabetical one.';


--
-- Name: record_coupon_redemption(text, uuid, uuid, numeric); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.record_coupon_redemption(p_code text, p_user_id uuid, p_order_id uuid, p_subtotal numeric) RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_coupon          public.coupons%ROWTYPE;
  v_discount_amount numeric(12,2);
BEGIN
  SELECT * INTO v_coupon
    FROM public.coupons
   WHERE upper(trim(code)) = upper(trim(p_code))
   LIMIT 1;

  IF NOT FOUND OR NOT v_coupon.is_active THEN
    RAISE EXCEPTION 'coupon_invalid' USING ERRCODE = '22023';
  END IF;

  v_discount_amount := CASE v_coupon.discount_type
    WHEN 'percentage'   THEN round(p_subtotal * v_coupon.discount_value / 100, 2)
    WHEN 'fixed_amount' THEN least(v_coupon.discount_value, p_subtotal)
    ELSE 0
  END;

  IF v_discount_amount <= 0 THEN
    RAISE EXCEPTION 'coupon_no_discount' USING ERRCODE = '22023';
  END IF;

  -- ON CONFLICT DO NOTHING handles the idempotent-replay case (same order
  -- submitted twice via idempotency key — the second call is a no-op).
  INSERT INTO public.coupon_redemptions
    (coupon_id, user_id, order_id, amount)
  VALUES
    (v_coupon.id, p_user_id, p_order_id, v_discount_amount)
  ON CONFLICT (coupon_id, user_id) DO NOTHING;

  RETURN v_discount_amount;
END;
$$;


ALTER FUNCTION public.record_coupon_redemption(p_code text, p_user_id uuid, p_order_id uuid, p_subtotal numeric) OWNER TO postgres;

--
-- Name: DriverEarning; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DriverEarning" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "driverId" uuid NOT NULL,
    "deliveryId" uuid NOT NULL,
    "baseFee" numeric(10,2) NOT NULL,
    "distanceFee" numeric(10,2) DEFAULT 0 NOT NULL,
    "tipAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "bonusAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "totalAmount" numeric(10,2) NOT NULL,
    "isPaid" boolean DEFAULT false NOT NULL,
    "paidAt" timestamp(6) with time zone,
    "paymentMethod" text,
    "paymentRef" text,
    "earnedAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."DriverEarning" OWNER TO postgres;

--
-- Name: record_driver_earning(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.record_driver_earning(p_assignment_id uuid) RETURNS public."DriverEarning"
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_assignment          public.delivery_assignments;
  v_order               public.orders;
  v_driver_profile_id   uuid;
  v_free_above_subtotal numeric;
  v_base_fee            numeric;
  v_distance_fee        numeric;
  v_total               numeric;
  v_row                 public."DriverEarning";
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_assignment
  FROM public.delivery_assignments
  WHERE id = p_assignment_id
    AND driver_id = auth.uid();

  IF v_assignment.id IS NULL THEN
    RAISE EXCEPTION 'assignment_not_found_or_not_yours' USING ERRCODE = '22023';
  END IF;

  IF v_assignment.delivered_at IS NULL THEN
    RAISE EXCEPTION 'assignment_not_delivered' USING ERRCODE = '22023';
  END IF;

  -- Idempotent: a retried call (dropped response, duplicate tap, etc.)
  -- must not create a second earning row for the same delivery.
  SELECT * INTO v_row FROM public."DriverEarning" WHERE "deliveryId" = p_assignment_id;
  IF v_row.id IS NOT NULL THEN
    RETURN v_row;
  END IF;

  SELECT id INTO v_driver_profile_id FROM public."DriverProfile" WHERE "userId" = auth.uid();
  IF v_driver_profile_id IS NULL THEN
    RAISE EXCEPTION 'driver_profile_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_assignment.order_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = '22023';
  END IF;

  IF v_order.zone_id IS NULL THEN
    v_base_fee := 15;
  ELSE
    SELECT "freeAboveSubtotal"::numeric INTO v_free_above_subtotal
    FROM public."DeliveryZone" WHERE id = v_order.zone_id;

    IF v_free_above_subtotal IS NOT NULL
       AND v_order.subtotal IS NOT NULL
       AND v_order.subtotal::numeric >= v_free_above_subtotal THEN
      v_base_fee := 0;
    ELSE
      v_base_fee := COALESCE(v_order.zone_base_fee::numeric, 15);
    END IF;
  END IF;

  v_distance_fee := round((COALESCE(v_order.delivery_distance_km, 0)::numeric) * 2, 2);
  v_total        := round(v_base_fee + v_distance_fee, 2);

  INSERT INTO public."DriverEarning" ("driverId", "deliveryId", "baseFee", "distanceFee", "totalAmount", "earnedAt")
  VALUES (v_driver_profile_id, p_assignment_id, v_base_fee, v_distance_fee, v_total, now())
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


ALTER FUNCTION public.record_driver_earning(p_assignment_id uuid) OWNER TO postgres;

--
-- Name: redeem_points_for_coupon(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.redeem_points_for_coupon(p_batch_id uuid, p_idempotency_key text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_user_id          uuid := auth.uid();

  -- Explicit batch row fields (no %rowtype).
  v_b_id             uuid;
  v_b_name           text;
  v_b_is_active      boolean;
  v_b_expires_at     timestamptz;
  v_b_total_supply   integer;
  v_b_issued_count   integer;
  v_b_points_cost    bigint;

  -- Explicit account fields (no %rowtype).
  v_acc_balance      bigint;
  v_acc_frozen_at    timestamptz;

  v_code             text;
  v_coupon_id        uuid;
  v_ledger_id        uuid;
  v_new_balance      bigint;
  v_cached           jsonb;
  v_result           jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  v_cached := public._loyalty_idempotency_begin(p_idempotency_key, 'redeem_points_for_coupon', v_user_id);
  if v_cached is not null then return v_cached; end if;

  perform public._loyalty_lock(v_user_id);

  -- Lock the batch row + read only the columns we need.
  select id, name, is_active, expires_at, total_supply, issued_count, points_cost
    into  v_b_id, v_b_name, v_b_is_active, v_b_expires_at, v_b_total_supply, v_b_issued_count, v_b_points_cost
    from public.coupon_batches
   where id = p_batch_id
     for update;
  if v_b_id is null then
    perform public._loyalty_audit(v_user_id, 'rpc_reject', 'redeem_points_for_coupon',
      false, jsonb_build_object('batch_id', p_batch_id), 'batch_not_found');
    raise exception using errcode = '23503', message = 'batch_not_found';
  end if;
  if not v_b_is_active then
    raise exception using errcode = '22023', message = 'batch_inactive';
  end if;
  if v_b_expires_at is not null and v_b_expires_at < now() then
    raise exception using errcode = '22023', message = 'batch_expired';
  end if;
  if v_b_total_supply is not null and v_b_issued_count >= v_b_total_supply then
    raise exception using errcode = '22023', message = 'batch_exhausted';
  end if;

  perform public._loyalty_ensure_account(v_user_id);
  select balance, frozen_at
    into  v_acc_balance, v_acc_frozen_at
    from public.loyalty_accounts
   where user_id = v_user_id
     for update;
  if v_acc_frozen_at is not null then
    raise exception using errcode = '42501', message = 'account_frozen';
  end if;
  if v_acc_balance < v_b_points_cost then
    raise exception using errcode = '22023', message = 'insufficient_balance';
  end if;

  v_new_balance := v_acc_balance - v_b_points_cost;

  insert into public.loyalty_ledger (
    user_id, delta, balance_after, kind, source, source_ref,
    idempotency_key, created_by, metadata
  ) values (
    v_user_id,
    -v_b_points_cost,
    v_new_balance,
    'redeem',
    'coupon_redeem',
    p_batch_id::text,
    p_idempotency_key,
    v_user_id,
    jsonb_build_object('batch_name', v_b_name)
  ) returning id into v_ledger_id;

  update public.loyalty_accounts
     set balance           = v_new_balance,
         lifetime_redeemed = lifetime_redeemed + v_b_points_cost
   where user_id = v_user_id;

  -- 12-char uppercase hex code from gen_random_uuid (built-in, no pgcrypto).
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into public.coupons (
    batch_id, user_id, code, state, issued_ledger_id, expires_at
  ) values (
    p_batch_id,
    v_user_id,
    v_code,
    'issued',
    v_ledger_id,
    v_b_expires_at
  ) returning id into v_coupon_id;

  update public.coupon_batches
     set issued_count = issued_count + 1
   where id = p_batch_id;

  v_result := jsonb_build_object(
    'coupon_id',  v_coupon_id,
    'code',       v_code,
    'balance',    v_new_balance,
    'expires_at', v_b_expires_at,
    'ledger_id',  v_ledger_id
  );
  perform public._loyalty_idempotency_end(p_idempotency_key, v_result);
  perform public._loyalty_audit(v_user_id, 'rpc_call', 'redeem_points_for_coupon', true, v_result);

  return v_result;
end;
$$;


ALTER FUNCTION public.redeem_points_for_coupon(p_batch_id uuid, p_idempotency_key text) OWNER TO postgres;

--
-- Name: redeem_points_for_gift(uuid, jsonb, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.redeem_points_for_gift(p_gift_id uuid, p_address jsonb, p_idempotency_key text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_user_id      uuid := auth.uid();
  v_gift         public.gift_catalog%rowtype;
  v_inv          public.gift_inventory%rowtype;
  v_account      public.loyalty_accounts%rowtype;
  v_ledger_id    uuid;
  v_redemption_id uuid;
  v_new_balance  bigint;
  v_available    integer;
  v_expires_at   timestamptz := now() + interval '14 days';
  v_cached       jsonb;
  v_result       jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  v_cached := public._loyalty_idempotency_begin(p_idempotency_key, 'redeem_points_for_gift', v_user_id);
  if v_cached is not null then return v_cached; end if;

  perform public._loyalty_lock(v_user_id);

  select * into v_gift from public.gift_catalog where id = p_gift_id;
  if not found or not v_gift.is_active then
    raise exception using errcode = '23503', message = 'gift_not_available';
  end if;

  -- Lock the inventory row; the no-oversell check constraint will reject
  -- an update that would push reserved + fulfilled past total_stock.
  select * into v_inv from public.gift_inventory
    where gift_id = p_gift_id
    for update;
  if not found then
    raise exception using errcode = '23503', message = 'gift_inventory_missing';
  end if;
  v_available := v_inv.total_stock - v_inv.reserved - v_inv.fulfilled;
  if v_available < 1 then
    perform public._loyalty_audit(v_user_id, 'rpc_reject', 'redeem_points_for_gift',
      false, jsonb_build_object('gift_id', p_gift_id, 'available', v_available), 'out_of_stock');
    raise exception using errcode = '22023', message = 'out_of_stock';
  end if;

  v_account := public._loyalty_ensure_account(v_user_id);
  if v_account.frozen_at is not null then
    raise exception using errcode = '42501', message = 'account_frozen';
  end if;
  if v_account.balance < v_gift.points_cost then
    raise exception using errcode = '22023', message = 'insufficient_balance';
  end if;

  v_new_balance := v_account.balance - v_gift.points_cost;

  insert into public.loyalty_ledger (
    user_id, delta, balance_after, kind, source, source_ref,
    idempotency_key, created_by, metadata
  ) values (
    v_user_id,
    -v_gift.points_cost,
    v_new_balance,
    'redeem',
    'gift_redeem',
    p_gift_id::text,
    p_idempotency_key,
    v_user_id,
    jsonb_build_object('gift_name', v_gift.name)
  ) returning id into v_ledger_id;

  update public.loyalty_accounts
     set balance           = v_new_balance,
         lifetime_redeemed = lifetime_redeemed + v_gift.points_cost
   where user_id = v_user_id;

  update public.gift_inventory
     set reserved   = reserved + 1,
         version    = version + 1,
         updated_at = now()
   where gift_id = p_gift_id;

  insert into public.gift_redemptions (
    user_id, gift_id, points_spent, ledger_id, state, address, expires_at
  ) values (
    v_user_id, p_gift_id, v_gift.points_cost, v_ledger_id, 'reserved', p_address, v_expires_at
  ) returning id into v_redemption_id;

  v_result := jsonb_build_object(
    'redemption_id', v_redemption_id,
    'ledger_id',     v_ledger_id,
    'balance',       v_new_balance,
    'expires_at',    v_expires_at,
    'state',         'reserved'
  );
  perform public._loyalty_idempotency_end(p_idempotency_key, v_result);
  perform public._loyalty_audit(v_user_id, 'rpc_call', 'redeem_points_for_gift', true, v_result);

  return v_result;
end;
$$;


ALTER FUNCTION public.redeem_points_for_gift(p_gift_id uuid, p_address jsonb, p_idempotency_key text) OWNER TO postgres;

--
-- Name: notification_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    expo_push_token text NOT NULL,
    platform text NOT NULL,
    device_id text,
    app_version text,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    invalidated_at timestamp with time zone,
    invalid_reason text,
    last_push_at timestamp with time zone,
    CONSTRAINT notification_tokens_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text])))
);


ALTER TABLE public.notification_tokens OWNER TO postgres;

--
-- Name: register_push_token(text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.register_push_token(p_expo_push_token text, p_platform text, p_device_id text DEFAULT NULL::text, p_app_version text DEFAULT NULL::text) RETURNS public.notification_tokens
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


ALTER FUNCTION public.register_push_token(p_expo_push_token text, p_platform text, p_device_id text, p_app_version text) OWNER TO postgres;

--
-- Name: release_gift_inventory(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.release_gift_inventory(p_redemption_id uuid, p_reason text, p_idempotency_key text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_user_id     uuid := auth.uid();
  v_redemption  public.gift_redemptions%rowtype;
  v_orig_ledger public.loyalty_ledger%rowtype;
  v_account     public.loyalty_accounts%rowtype;
  v_new_balance bigint;
  v_ledger_id   uuid;
  v_cached      jsonb;
  v_result      jsonb;
begin
  v_cached := public._loyalty_idempotency_begin(p_idempotency_key, 'release_gift_inventory', v_user_id);
  if v_cached is not null then return v_cached; end if;

  select * into v_redemption from public.gift_redemptions
    where id = p_redemption_id for update;
  if not found then
    raise exception using errcode = '23503', message = 'redemption_not_found';
  end if;

  -- Admins can release any reservation; users only their own.
  if v_redemption.user_id <> v_user_id and not public.is_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  if v_redemption.state <> 'reserved' then
    raise exception using errcode = '22023', message = 'not_reservable';
  end if;

  -- Refund: load the original ledger row, insert a reversal of equal magnitude.
  select * into v_orig_ledger from public.loyalty_ledger
    where id = v_redemption.ledger_id;
  if not found then
    raise exception using errcode = '23503', message = 'ledger_missing';
  end if;

  perform public._loyalty_lock(v_redemption.user_id);
  v_account := public._loyalty_ensure_account(v_redemption.user_id);
  v_new_balance := v_account.balance + v_redemption.points_spent;

  insert into public.loyalty_ledger (
    user_id, delta, balance_after, kind, source, source_ref,
    parent_ledger_id, idempotency_key, created_by, metadata
  ) values (
    v_redemption.user_id,
    v_redemption.points_spent,
    v_new_balance,
    'reverse',
    'gift_release',
    p_redemption_id::text,
    v_orig_ledger.id,
    p_idempotency_key,
    auth.uid(),
    jsonb_build_object('reason', p_reason)
  ) returning id into v_ledger_id;

  update public.loyalty_accounts
     set balance           = v_new_balance,
         lifetime_redeemed = greatest(lifetime_redeemed - v_redemption.points_spent, 0)
   where user_id = v_redemption.user_id;

  update public.gift_inventory
     set reserved   = greatest(reserved - 1, 0),
         version    = version + 1,
         updated_at = now()
   where gift_id = v_redemption.gift_id;

  update public.gift_redemptions
     set state               = 'cancelled',
         cancelled_at        = now(),
         cancellation_reason = p_reason
   where id = p_redemption_id;

  v_result := jsonb_build_object(
    'redemption_id', p_redemption_id,
    'ledger_id',     v_ledger_id,
    'balance',       v_new_balance,
    'refunded',      v_redemption.points_spent
  );
  perform public._loyalty_idempotency_end(p_idempotency_key, v_result);
  perform public._loyalty_audit(v_redemption.user_id, 'rpc_call', 'release_gift_inventory', true, v_result);

  return v_result;
end;
$$;


ALTER FUNCTION public.release_gift_inventory(p_redemption_id uuid, p_reason text, p_idempotency_key text) OWNER TO postgres;

--
-- Name: release_inventory(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.release_inventory(p_reservation_id uuid, p_reason text, p_idempotency_key text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_user_id   uuid := auth.uid();
  v_res       public.inventory_reservations%rowtype;
  v_state     public.inventory_state%rowtype;
  v_was_committed boolean;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 16 then
    raise exception using errcode = '22023', message = 'idempotency_key_required';
  end if;

  select * into v_res from public.inventory_reservations
    where id = p_reservation_id for update;
  if not found then
    raise exception using errcode = '23503', message = 'reservation_not_found';
  end if;

  if v_res.user_id <> v_user_id and not public.is_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  -- Idempotent: already-released returns the same shape.
  if v_res.state = 'released' then
    return jsonb_build_object(
      'reservation_id', v_res.id,
      'state',          'released',
      'replay',         true
    );
  end if;
  if v_res.state not in ('reserved', 'committed') then
    raise exception using errcode = '22023', message = 'state_' || v_res.state || '_not_releasable';
  end if;

  v_was_committed := (v_res.state = 'committed');

  perform public._inventory_lock(v_res.product_id);
  v_state := public._inventory_ensure_state(v_res.product_id);

  update public.inventory_reservations
     set state       = 'released',
         released_at = now(),
         metadata    = metadata || jsonb_build_object('release_reason', p_reason)
   where id = v_res.id;

  if v_was_committed then
    update public.inventory_state
       set committed = greatest(committed - v_res.quantity, 0)
     where product_id = v_res.product_id;
  else
    update public.inventory_state
       set reserved = greatest(reserved - v_res.quantity, 0)
     where product_id = v_res.product_id;
  end if;

  insert into public.stock_movements (
    product_id, delta_reserved, delta_committed, total_after, reserved_after, committed_after,
    kind, reservation_id, actor_id, idempotency_key, metadata
  ) values (
    v_res.product_id,
    case when v_was_committed then 0 else -v_res.quantity end,
    case when v_was_committed then -v_res.quantity else 0 end,
    v_state.total,
    case when v_was_committed then v_state.reserved else greatest(v_state.reserved - v_res.quantity, 0) end,
    case when v_was_committed then greatest(v_state.committed - v_res.quantity, 0) else v_state.committed end,
    'release', v_res.id, v_user_id, p_idempotency_key,
    jsonb_build_object('reason', p_reason, 'released_from', v_res.state)
  );

  return jsonb_build_object(
    'reservation_id', v_res.id,
    'state',          'released',
    'product_id',     v_res.product_id,
    'released',       v_res.quantity,
    'replay',         false
  );
end;
$$;


ALTER FUNCTION public.release_inventory(p_reservation_id uuid, p_reason text, p_idempotency_key text) OWNER TO postgres;

--
-- Name: request_return(uuid, text, public.return_resolution, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.request_return(p_order_id uuid, p_reason text, p_resolution_type public.return_resolution, p_idempotency_key text, p_items jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_req_id UUID;
    v_item JSONB;
    v_oi RECORD;
    v_already_returned NUMERIC;
    v_eligibility JSON;
    v_is_eligible BOOLEAN;
BEGIN
    -- 1. Check idempotency
    SELECT id INTO v_req_id FROM return_requests WHERE idempotency_key = p_idempotency_key AND user_id = auth.uid();
    IF FOUND THEN
        RETURN json_build_object('success', true, 'request_id', v_req_id, 'note', 'Recovered from idempotency key');
    END IF;

    -- 2. Validate Eligibility Atomically
    v_eligibility := get_return_eligibility(p_order_id);
    v_is_eligible := (v_eligibility->>'eligible')::BOOLEAN;

    IF NOT v_is_eligible THEN
        RAISE EXCEPTION 'Order is not eligible for return: %', v_eligibility->>'reason';
    END IF;

    -- 3. Create Request
    INSERT INTO return_requests (order_id, user_id, status, resolution_type, idempotency_key, reason)
    VALUES (p_order_id, auth.uid(), 'REQUESTED', p_resolution_type, p_idempotency_key, p_reason)
    RETURNING id INTO v_req_id;

    -- 4. Process Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Re-verify specific item -- locked so a concurrent request_return
        -- call against the same order_item can't read the same
        -- already-returned sum before this transaction's insert commits.
        SELECT oi.id, oi.quantity INTO v_oi
        FROM order_items oi WHERE oi.id = (v_item->>'order_item_id')::BIGINT AND oi.order_id = p_order_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Order item % not found', v_item->>'order_item_id';
        END IF;

        SELECT COALESCE(SUM(requested_quantity), 0)
        INTO v_already_returned
        FROM return_items ri
        JOIN return_requests rr ON ri.request_id = rr.id
        WHERE ri.order_item_id = v_oi.id
          AND rr.status NOT IN ('REJECTED', 'RETURN_REJECTED');

        IF v_already_returned + (v_item->>'quantity')::NUMERIC > v_oi.quantity THEN
            RAISE EXCEPTION 'Requested quantity exceeds available returnable quantity for item %', v_oi.id;
        END IF;

        INSERT INTO return_items (request_id, order_item_id, requested_quantity, reason_code)
        VALUES (v_req_id, v_oi.id, (v_item->>'quantity')::NUMERIC, 'CUSTOMER_REQUEST');
    END LOOP;

    -- 5. Audit
    INSERT INTO return_timeline (return_id, order_id, actor_type, actor_id, action, new_status, reason)
    VALUES (v_req_id, p_order_id, 'customer', auth.uid(), 'return_requested', 'REQUESTED', p_reason);

    RETURN json_build_object('success', true, 'request_id', v_req_id);
END;
$$;


ALTER FUNCTION public.request_return(p_order_id uuid, p_reason text, p_resolution_type public.return_resolution, p_idempotency_key text, p_items jsonb) OWNER TO postgres;

--
-- Name: reserve_inventory(text, integer, text, text, text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reserve_inventory(p_product_id text, p_quantity integer, p_reservation_kind text, p_reservation_ref text, p_idempotency_key text, p_expires_in_secs integer DEFAULT 900) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_user_id    uuid := auth.uid();
  v_state      public.inventory_state%rowtype;
  v_existing   public.inventory_reservations%rowtype;
  v_res_id     uuid;
  v_available  integer;
  v_expires    timestamptz;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception using errcode = '22023', message = 'invalid_quantity';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 16 then
    raise exception using errcode = '22023', message = 'idempotency_key_required';
  end if;
  if p_reservation_kind is null
     or p_reservation_kind not in ('cart','order','gift_redemption','manual') then
    raise exception using errcode = '22023', message = 'invalid_kind';
  end if;

  -- Idempotency: a previous successful call returns the same reservation.
  select * into v_existing from public.inventory_reservations
    where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'reservation_id', v_existing.id,
      'product_id',     v_existing.product_id,
      'quantity',       v_existing.quantity,
      'state',          v_existing.state,
      'expires_at',     v_existing.expires_at,
      'replay',         true
    );
  end if;

  perform public._inventory_lock(p_product_id);
  v_state := public._inventory_ensure_state(p_product_id);

  v_available := v_state.total - v_state.reserved - v_state.committed;
  if v_available < p_quantity then
    raise exception using
      errcode = '22023',
      message = format('insufficient_stock|available=%s|requested=%s', v_available, p_quantity);
  end if;

  v_expires := now() + make_interval(secs => greatest(coalesce(p_expires_in_secs, 900), 30));

  insert into public.inventory_reservations (
    product_id, user_id, quantity, state, reservation_kind, reservation_ref,
    idempotency_key, expires_at
  ) values (
    p_product_id, v_user_id, p_quantity, 'reserved', p_reservation_kind, p_reservation_ref,
    p_idempotency_key, v_expires
  ) returning id into v_res_id;

  update public.inventory_state
     set reserved = reserved + p_quantity
   where product_id = p_product_id;

  insert into public.stock_movements (
    product_id, delta_reserved, total_after, reserved_after, committed_after,
    kind, reservation_id, actor_id, idempotency_key
  ) values (
    p_product_id, p_quantity, v_state.total, v_state.reserved + p_quantity, v_state.committed,
    'reserve', v_res_id, v_user_id, p_idempotency_key
  );

  return jsonb_build_object(
    'reservation_id', v_res_id,
    'product_id',     p_product_id,
    'quantity',       p_quantity,
    'state',          'reserved',
    'expires_at',     v_expires,
    'available_after', v_available - p_quantity,
    'replay',         false
  );
end;
$$;


ALTER FUNCTION public.reserve_inventory(p_product_id text, p_quantity integer, p_reservation_kind text, p_reservation_ref text, p_idempotency_key text, p_expires_in_secs integer) OWNER TO postgres;

--
-- Name: delivery_issues; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.delivery_issues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    driver_id uuid,
    reason_code text NOT NULL,
    note text,
    status text DEFAULT 'open'::text NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    resolution_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    photo_url text,
    CONSTRAINT delivery_issues_reason_code_check CHECK ((reason_code = ANY (ARRAY['customer_unreachable'::text, 'wrong_address'::text, 'customer_refused'::text, 'item_damaged'::text, 'item_missing'::text, 'access_issue'::text, 'vehicle_breakdown'::text, 'other'::text]))),
    CONSTRAINT delivery_issues_status_check CHECK ((status = ANY (ARRAY['open'::text, 'acknowledged'::text, 'resolved'::text])))
);


ALTER TABLE public.delivery_issues OWNER TO postgres;

--
-- Name: COLUMN delivery_issues.reason_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.delivery_issues.reason_code IS 'Driver-facing reason taxonomy. Distinct from Returns.tsx''s customer-facing return reasons (damaged/wrong-item/expired) — these describe why a DELIVERY ATTEMPT failed, not why a product is being returned.';


--
-- Name: COLUMN delivery_issues.photo_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.delivery_issues.photo_url IS 'Optional driver-attached photo evidence (delivery-issue-photos bucket, path {driver_id}/{order_id}/{timestamp}.jpg). Null when the driver submitted text-only.';


--
-- Name: resolve_delivery_issue(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.resolve_delivery_issue(p_issue_id uuid, p_resolution_note text) RETURNS public.delivery_issues
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_role text;
  v_row public.delivery_issues;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'manager', 'pharmacist') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF coalesce(trim(p_resolution_note), '') = '' THEN
    RAISE EXCEPTION 'resolution_note_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row FROM public.delivery_issues WHERE id = p_issue_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'issue_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status = 'resolved' THEN
    RAISE EXCEPTION 'issue_already_resolved' USING ERRCODE = '22023';
  END IF;

  UPDATE public.delivery_issues
  SET status = 'resolved',
      resolved_by = auth.uid(),
      resolved_at = now(),
      resolution_note = p_resolution_note
  WHERE id = p_issue_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


ALTER FUNCTION public.resolve_delivery_issue(p_issue_id uuid, p_resolution_note text) OWNER TO postgres;

--
-- Name: resolve_delivery_zone(double precision, double precision, numeric); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.resolve_delivery_zone(p_lat double precision, p_lng double precision, p_subtotal numeric DEFAULT 0) RETURNS TABLE(branch_id text, branch_name_ar text, branch_name_en text, zone_id text, zone_name text, base_fee numeric, effective_fee numeric, surge_applied boolean, free_above_subtotal numeric, distance_km double precision)
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_branch  record;
  v_zone    record;
  v_hour    integer := extract(hour FROM now())::integer;
  v_surge   boolean;
  v_fee     numeric;
  v_overloaded_threshold constant double precision := 0.85;
  -- Explicit, correctly typed fallback slots -- matches RETURNS TABLE
  -- column-for-column, so RETURN QUERY SELECT below can't hit a
  -- structural mismatch the way an untyped record + ROW() did.
  v_fb_branch_id            text;
  v_fb_branch_name_ar       text;
  v_fb_branch_name_en       text;
  v_fb_zone_id              text;
  v_fb_zone_name            text;
  v_fb_base_fee             numeric;
  v_fb_effective_fee        numeric;
  v_fb_surge_applied        boolean;
  v_fb_free_above_subtotal  numeric;
  v_fb_distance_km          double precision;
  v_have_fallback boolean := false;
BEGIN
  FOR v_branch IN
    SELECT b.id, b."nameAr", b."nameEn", b.lat, b.lng, b."loadFactor",
           public.haversine_km(p_lat, p_lng, b.lat, b.lng) AS dist
    FROM public."Branch" b
    WHERE b."isActive" = true
    ORDER BY dist ASC
  LOOP
    FOR v_zone IN
      SELECT z.id, z.name, z."baseFee", z."freeAboveSubtotal",
             z."surgeStartHour", z."surgeEndHour", z."surgeMultiplier", z.polygon
      FROM public."DeliveryZone" z
      WHERE z."branchId" = v_branch.id
      ORDER BY z."baseFee" ASC
    LOOP
      IF public.point_in_polygon(p_lat, p_lng, v_zone.polygon) THEN
        v_surge := v_zone."surgeStartHour" IS NOT NULL AND v_zone."surgeEndHour" IS NOT NULL AND (
          CASE WHEN v_zone."surgeStartHour" <= v_zone."surgeEndHour"
            THEN v_hour >= v_zone."surgeStartHour" AND v_hour < v_zone."surgeEndHour"
            ELSE v_hour >= v_zone."surgeStartHour" OR  v_hour < v_zone."surgeEndHour"
          END
        );

        v_fee := v_zone."baseFee";
        IF v_surge THEN
          v_fee := round((v_fee * COALESCE(v_zone."surgeMultiplier", 1))::numeric, 2);
        END IF;
        IF v_zone."freeAboveSubtotal" IS NOT NULL AND p_subtotal >= v_zone."freeAboveSubtotal" THEN
          v_fee := 0;
        END IF;

        IF COALESCE(v_branch."loadFactor", 0) < v_overloaded_threshold THEN
          RETURN QUERY SELECT
            v_branch.id, v_branch."nameAr", v_branch."nameEn",
            v_zone.id, v_zone.name,
            v_zone."baseFee"::numeric, v_fee, v_surge, v_zone."freeAboveSubtotal"::numeric,
            v_branch.dist;
          RETURN;
        END IF;

        IF NOT v_have_fallback THEN
          v_fb_branch_id           := v_branch.id;
          v_fb_branch_name_ar      := v_branch."nameAr";
          v_fb_branch_name_en      := v_branch."nameEn";
          v_fb_zone_id             := v_zone.id;
          v_fb_zone_name           := v_zone.name;
          v_fb_base_fee            := v_zone."baseFee";
          v_fb_effective_fee       := v_fee;
          v_fb_surge_applied       := v_surge;
          v_fb_free_above_subtotal := v_zone."freeAboveSubtotal";
          v_fb_distance_km         := v_branch.dist;
          v_have_fallback := true;
        END IF;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;

  IF v_have_fallback THEN
    RETURN QUERY SELECT
      v_fb_branch_id, v_fb_branch_name_ar, v_fb_branch_name_en,
      v_fb_zone_id, v_fb_zone_name, v_fb_base_fee, v_fb_effective_fee,
      v_fb_surge_applied, v_fb_free_above_subtotal, v_fb_distance_km;
    RETURN;
  END IF;

  RETURN;
END;
$$;


ALTER FUNCTION public.resolve_delivery_zone(p_lat double precision, p_lng double precision, p_subtotal numeric) OWNER TO postgres;

--
-- Name: FUNCTION resolve_delivery_zone(p_lat double precision, p_lng double precision, p_subtotal numeric); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.resolve_delivery_zone(p_lat double precision, p_lng double precision, p_subtotal numeric) IS 'The single source of truth for "which branch/zone serves this coordinate, and what does delivery cost". Nearest active branch whose zone covers the point wins, UNLESS it is overloaded (Branch.loadFactor >= 0.85) and a further branch''s zone also covers the point -- in that case the further-but-lighter branch is preferred. Falls back to the overloaded branch if it is the only match. Empty result = undeliverable to that point.';


--
-- Name: reverse_reward_transaction(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reverse_reward_transaction(p_ledger_id uuid, p_reason text, p_idempotency_key text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_orig         public.loyalty_ledger%rowtype;
  v_account      public.loyalty_accounts%rowtype;
  v_new_balance  bigint;
  v_new_ledger   uuid;
  v_cached       jsonb;
  v_result       jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  v_cached := public._loyalty_idempotency_begin(p_idempotency_key, 'reverse_reward_transaction', null);
  if v_cached is not null then return v_cached; end if;

  select * into v_orig from public.loyalty_ledger where id = p_ledger_id;
  if not found then
    raise exception using errcode = '23503', message = 'ledger_not_found';
  end if;
  if v_orig.kind = 'reverse' then
    raise exception using errcode = '22023', message = 'cannot_reverse_reversal';
  end if;

  perform public._loyalty_lock(v_orig.user_id);
  v_account := public._loyalty_ensure_account(v_orig.user_id);

  v_new_balance := v_account.balance - v_orig.delta;
  if v_new_balance < 0 then
    raise exception using errcode = '22023', message = 'would_go_negative';
  end if;

  -- Unique partial index on parent_ledger_id prevents a second reversal of
  -- the same original row; this INSERT will raise 23505 in that case.
  insert into public.loyalty_ledger (
    user_id, delta, balance_after, kind, source, source_ref,
    parent_ledger_id, idempotency_key, created_by, metadata
  ) values (
    v_orig.user_id,
    -v_orig.delta,
    v_new_balance,
    'reverse',
    v_orig.source,
    v_orig.source_ref,
    v_orig.id,
    p_idempotency_key,
    auth.uid(),
    jsonb_build_object('reason', p_reason, 'reversed_kind', v_orig.kind)
  ) returning id into v_new_ledger;

  -- Adjust lifetime counters in the inverse direction so a reversal of an
  -- earn reduces lifetime_earned, etc.
  update public.loyalty_accounts
     set balance           = v_new_balance,
         lifetime_earned   = case when v_orig.delta > 0
                                  then greatest(lifetime_earned   - v_orig.delta, 0)
                                  else lifetime_earned end,
         lifetime_redeemed = case when v_orig.delta < 0
                                  then greatest(lifetime_redeemed + v_orig.delta, 0)
                                  else lifetime_redeemed end
   where user_id = v_orig.user_id;

  v_result := jsonb_build_object(
    'reversal_ledger_id', v_new_ledger,
    'original_ledger_id', v_orig.id,
    'balance',            v_new_balance,
    'amount',             -v_orig.delta
  );
  perform public._loyalty_idempotency_end(p_idempotency_key, v_result);
  perform public._loyalty_audit(v_orig.user_id, 'reversal', 'reverse_reward_transaction', true, v_result);

  return v_result;
end;
$$;


ALTER FUNCTION public.reverse_reward_transaction(p_ledger_id uuid, p_reason text, p_idempotency_key text) OWNER TO postgres;

--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prescriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    dependent_id uuid,
    name text NOT NULL,
    dose text NOT NULL,
    refills integer DEFAULT 0 NOT NULL,
    next_refill timestamp with time zone,
    doctor text,
    status public.rx_status DEFAULT 'active'::public.rx_status NOT NULL,
    is_controlled boolean DEFAULT false NOT NULL,
    dea_schedule smallint,
    rx_number text,
    original_pharmacy text,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    review_status text DEFAULT 'approved'::text NOT NULL,
    submission_source text DEFAULT 'manual'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    admin_notes text,
    rejection_reason text,
    image_path text,
    CONSTRAINT prescriptions_dea_schedule_check CHECK (((dea_schedule >= 2) AND (dea_schedule <= 5))),
    CONSTRAINT prescriptions_refills_check CHECK ((refills >= 0)),
    CONSTRAINT prescriptions_review_status_check CHECK ((review_status = ANY (ARRAY['pending_review'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT prescriptions_submission_source_check CHECK ((submission_source = ANY (ARRAY['manual'::text, 'whatsapp'::text, 'scan'::text])))
);


ALTER TABLE public.prescriptions OWNER TO postgres;

--
-- Name: COLUMN prescriptions.review_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.prescriptions.review_status IS 'Staff review workflow. App sets pending_review on new submissions; only admin/manager/pharmacist may set approved/rejected.';


--
-- Name: COLUMN prescriptions.submission_source; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.prescriptions.submission_source IS 'manual = customer typed an Rx number in-app. whatsapp = customer chose "Send via WhatsApp"; this is a lightweight tracking placeholder, not the actual photo.';


--
-- Name: COLUMN prescriptions.image_path; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.prescriptions.image_path IS 'Path in the prescriptions storage bucket where the original uploaded document is stored. Null for historical or text-only submissions.';


--
-- Name: review_prescription(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.review_prescription(p_prescription_id uuid, p_decision text, p_admin_notes text DEFAULT NULL::text, p_rejection_reason text DEFAULT NULL::text) RETURNS public.prescriptions
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
  v_row public.prescriptions%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager', 'pharmacist')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid_review_decision' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row
    FROM public.prescriptions
   WHERE id = p_prescription_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'prescription_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.review_status <> 'pending_review' THEN
    RAISE EXCEPTION 'prescription_already_reviewed' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'rejected' AND coalesce(nullif(trim(p_rejection_reason), ''), '') = '' THEN
    RAISE EXCEPTION 'rejection_reason_required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.prescriptions
     SET review_status = p_decision,
         admin_notes = p_admin_notes,
         rejection_reason = CASE WHEN p_decision = 'rejected' THEN nullif(trim(p_rejection_reason), '') ELSE NULL END,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         updated_at = now()
   WHERE id = p_prescription_id
   RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;


ALTER FUNCTION public.review_prescription(p_prescription_id uuid, p_decision text, p_admin_notes text, p_rejection_reason text) OWNER TO postgres;

--
-- Name: review_prescription(uuid, text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.review_prescription(p_prescription_id uuid, p_decision text, p_admin_notes text DEFAULT NULL::text, p_rejection_reason text DEFAULT NULL::text, p_name text DEFAULT NULL::text, p_dose text DEFAULT NULL::text, p_doctor text DEFAULT NULL::text, p_rx_number text DEFAULT NULL::text) RETURNS public.prescriptions
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_row public.prescriptions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'manager', 'pharmacist')
  ) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid_review_decision' using errcode = '22023';
  end if;

  select * into v_row
    from public.prescriptions
   where id = p_prescription_id
   for update;
  if not found then
    raise exception 'prescription_not_found' using errcode = 'P0002';
  end if;
  if v_row.review_status <> 'pending_review' then
    raise exception 'prescription_already_reviewed' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and coalesce(nullif(trim(p_rejection_reason), ''), '') = '' then
    raise exception 'rejection_reason_required' using errcode = '22023';
  end if;

  update public.prescriptions
     set review_status = p_decision,
         admin_notes = p_admin_notes,
         rejection_reason = case when p_decision = 'rejected' then nullif(trim(p_rejection_reason), '') else null end,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         updated_at = now(),
         name = coalesce(nullif(trim(p_name), ''), name),
         dose = coalesce(p_dose, dose),
         doctor = coalesce(p_doctor, doctor),
         rx_number = coalesce(nullif(trim(p_rx_number), ''), rx_number)
   where id = p_prescription_id
   returning * into v_row;
  return v_row;
end;
$$;


ALTER FUNCTION public.review_prescription(p_prescription_id uuid, p_decision text, p_admin_notes text, p_rejection_reason text, p_name text, p_dose text, p_doctor text, p_rx_number text) OWNER TO postgres;

--
-- Name: review_refill_request(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.review_refill_request(p_refill_id uuid, p_decision text, p_admin_notes text DEFAULT NULL::text, p_rejection_reason text DEFAULT NULL::text) RETURNS public.refill_requests
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_role text;
  v_row public.refill_requests;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'manager', 'pharmacist') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid_review_decision' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row FROM public.refill_requests WHERE id = p_refill_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'refill_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'refill_already_reviewed' USING ERRCODE = '22023';
  END IF;

  IF p_decision = 'rejected' AND coalesce(trim(p_rejection_reason), '') = '' THEN
    RAISE EXCEPTION 'rejection_reason_required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.refill_requests
  SET status = CASE p_decision WHEN 'approved' THEN 'preparing' ELSE 'cancelled' END,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_notes = coalesce(p_admin_notes, admin_notes),
      rejection_reason = CASE p_decision WHEN 'rejected' THEN p_rejection_reason ELSE rejection_reason END
  WHERE id = p_refill_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


ALTER FUNCTION public.review_refill_request(p_refill_id uuid, p_decision text, p_admin_notes text, p_rejection_reason text) OWNER TO postgres;

--
-- Name: rollback_committed_reservation(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rollback_committed_reservation(p_reservation_id uuid, p_reason text, p_idempotency_key text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_res    public.inventory_reservations%rowtype;
  v_state  public.inventory_state%rowtype;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 16 then
    raise exception using errcode = '22023', message = 'idempotency_key_required';
  end if;

  select * into v_res from public.inventory_reservations
    where id = p_reservation_id for update;
  if not found then
    raise exception using errcode = '23503', message = 'reservation_not_found';
  end if;
  if v_res.state <> 'committed' then
    raise exception using errcode = '22023', message = 'state_' || v_res.state || '_not_rollbackable';
  end if;

  perform public._inventory_lock(v_res.product_id);
  v_state := public._inventory_ensure_state(v_res.product_id);

  update public.inventory_reservations
     set state       = 'released',
         released_at = now(),
         metadata    = metadata || jsonb_build_object('rollback_reason', p_reason)
   where id = v_res.id;

  update public.inventory_state
     set committed = greatest(committed - v_res.quantity, 0)
   where product_id = v_res.product_id;

  insert into public.stock_movements (
    product_id, delta_committed,
    total_after, reserved_after, committed_after,
    kind, reservation_id, actor_id, idempotency_key, metadata
  ) values (
    v_res.product_id, -v_res.quantity,
    v_state.total, v_state.reserved,
    greatest(v_state.committed - v_res.quantity, 0),
    'rollback', v_res.id, auth.uid(), p_idempotency_key,
    jsonb_build_object('reason', p_reason)
  );

  return jsonb_build_object(
    'reservation_id', v_res.id,
    'state',          'released',
    'restored',       v_res.quantity
  );
end;
$$;


ALTER FUNCTION public.rollback_committed_reservation(p_reservation_id uuid, p_reason text, p_idempotency_key text) OWNER TO postgres;

--
-- Name: search_effective_products(text, text, boolean, numeric, numeric, boolean, text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.search_effective_products(p_query text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_in_stock boolean DEFAULT false, p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric, p_is_sale boolean DEFAULT false, p_sort text DEFAULT 'newest'::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0) RETURNS TABLE(id uuid, code text, barcode text, name_ar text, name_en text, base_price numeric, effective_price numeric, stock numeric, category_name text, category_name_en text, image_url text, rating_avg numeric, rating_count integer, is_new boolean, is_bestseller boolean, promotion_id uuid, promotion_name text, promotion_discount_type text, promotion_discount_value numeric, promotion_ends_at timestamp with time zone, has_active_promotion boolean, discount_amount numeric, discount_percent numeric, total_count bigint)
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_q        text := nullif(trim(coalesce(p_query, '')), '');
  v_uq       text;
  v_tsq      tsquery;
  v_syn      text;
  v_syn_words text[];
  v_syn_tsq_text text;
  v_syn_tsq  tsquery;
  v_tsq_combined tsquery;
BEGIN
  -- ── Fast path: no search term — plain filtered browse/listing (unchanged) ──
  IF v_q IS NULL THEN
    RETURN QUERY
    WITH filtered AS (
      SELECT
        product.*,
        GREATEST(0, product.base_price - product.effective_price) AS d_amount,
        CASE
          WHEN product.base_price > 0 THEN round(
            100 * GREATEST(0, product.base_price - product.effective_price) / product.base_price, 2
          )
          ELSE 0
        END AS d_percent
      FROM public.product_effective_prices AS product
      WHERE product.is_active = true
        AND (p_category IS NULL OR btrim(p_category) = '' OR product.category_name = p_category OR product.category_name_en = p_category)
        AND (NOT p_in_stock OR product.stock > 0)
        AND (p_min_price IS NULL OR product.effective_price >= p_min_price)
        AND (p_max_price IS NULL OR product.effective_price <= p_max_price)
        AND (NOT p_is_sale OR product.has_active_promotion)
    ),
    counted AS (
      SELECT filtered.*, count(*) OVER () AS row_total FROM filtered
    )
    SELECT
      counted.id, counted.code, counted.barcode, counted.name_ar, counted.name_en,
      counted.base_price, counted.effective_price, counted.stock,
      counted.category_name, counted.category_name_en, counted.image_url,
      counted.rating_avg, counted.rating_count, counted.is_new, counted.is_bestseller,
      counted.promotion_id, counted.promotion_name, counted.promotion_discount_type,
      counted.promotion_discount_value, counted.promotion_ends_at, counted.has_active_promotion,
      counted.d_amount, counted.d_percent, counted.row_total
    FROM counted
    ORDER BY
      CASE WHEN p_sort = 'price_asc' THEN counted.effective_price END ASC,
      CASE WHEN p_sort = 'price_desc' THEN counted.effective_price END DESC,
      CASE WHEN p_sort = 'name_asc' THEN counted.name_en END ASC,
      CASE WHEN p_sort = 'newest' THEN counted.id END DESC NULLS LAST,
      counted.name_en ASC NULLS LAST,
      counted.id
    LIMIT greatest(1, least(p_limit, 100))
    OFFSET greatest(0, p_offset);
    RETURN;
  END IF;

  -- ── Search path: real query — full hybrid ranking ───────────────────────────
  v_uq := public.normalize_arabic(public.immutable_unaccent(v_q));

  BEGIN
    v_tsq := websearch_to_tsquery('simple', v_uq);
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_tsq := plainto_tsquery('simple', v_uq);
    EXCEPTION WHEN OTHERS THEN
      v_tsq := NULL;
    END;
  END;

  -- Synonym terms are matched as an OR alternative to the literal query, not
  -- concatenated onto it (see header) — a symptom-derived word like
  -- "antiseptic" needs to independently satisfy the match, not be AND-locked
  -- to sentence fragments no product will ever contain.
  v_syn := public.find_synonym_terms(v_q);
  IF v_syn IS NOT NULL THEN
    v_syn_words := (
      SELECT array_agg(DISTINCT w) FROM unnest(
        regexp_split_to_array(trim(public.normalize_arabic(public.immutable_unaccent(v_syn))), '\s+')
      ) AS w WHERE length(w) > 0
    );
    IF v_syn_words IS NOT NULL AND array_length(v_syn_words, 1) > 0 THEN
      v_syn_tsq_text := array_to_string(v_syn_words, ' | ');
      BEGIN
        v_syn_tsq := to_tsquery('simple', v_syn_tsq_text);
      EXCEPTION WHEN OTHERS THEN
        v_syn_tsq := NULL;
      END;
    END IF;
  END IF;

  v_tsq_combined := CASE
    WHEN v_tsq IS NOT NULL AND v_syn_tsq IS NOT NULL THEN v_tsq || v_syn_tsq
    WHEN v_syn_tsq IS NOT NULL THEN v_syn_tsq
    ELSE v_tsq
  END;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      product.*,
      GREATEST(0, product.base_price - product.effective_price) AS d_amount,
      CASE
        WHEN product.base_price > 0 THEN round(
          100 * GREATEST(0, product.base_price - product.effective_price) / product.base_price, 2
        )
        ELSE 0
      END AS d_percent,
      (
        (CASE
          WHEN lower(product.code)    = lower(v_q) THEN 1000.0
          WHEN lower(product.barcode) = lower(v_q) THEN 1000.0
          ELSE 0.0
        END)
        + (CASE
            WHEN public.normalize_arabic(coalesce(product.name_ar, '')) = v_uq THEN 80.0
            WHEN coalesce(product.name_en, '') ILIKE v_uq THEN 80.0
            WHEN public.normalize_arabic(coalesce(product.name_ar, '')) ILIKE v_uq || ' %' THEN 40.0
            WHEN coalesce(product.name_en, '') ILIKE v_uq || ' %' THEN 40.0
            WHEN public.normalize_arabic(coalesce(product.name_ar, '')) ILIKE v_uq || '%' THEN 20.0
            WHEN coalesce(product.name_en, '') ILIKE v_uq || '%' THEN 20.0
            ELSE 0.0
          END)
        + (CASE WHEN v_tsq_combined IS NOT NULL THEN
             COALESCE(ts_rank_cd(p.search_vector, v_tsq_combined) * 2.5, 0.0)
           ELSE 0.0 END)
        + 1.2 * GREATEST(
            COALESCE(similarity(public.normalize_arabic(coalesce(product.name_ar, '')), v_uq), 0),
            COALESCE(similarity(coalesce(product.name_en, ''), v_uq), 0)
          )
        + 0.9 * GREATEST(
            COALESCE(word_similarity(v_uq, public.normalize_arabic(coalesce(product.name_ar, ''))), 0),
            COALESCE(word_similarity(v_uq, coalesce(product.name_en, '')), 0)
          )
        + 0.08 * GREATEST(
            COALESCE(similarity(public.normalize_arabic(coalesce(product.category_name, '')), v_uq), 0),
            COALESCE(similarity(coalesce(product.category_name_en, ''), v_uq), 0)
          )
        -- Synonym-word signal, independent of the phrase-level scores above —
        -- a product that only matches via a symptom synonym (not the literal
        -- phrase at all) still needs a positive score to clear the 0.05
        -- relevance floor below. Weighted lower than a direct name hit.
        + (CASE WHEN v_syn_words IS NOT NULL THEN
             15.0 * (
               SELECT count(*)::numeric FROM unnest(v_syn_words) w
               WHERE length(w) >= 3 AND (
                 coalesce(product.name_en, '') ILIKE '%' || w || '%'
                 OR public.normalize_arabic(coalesce(product.name_ar, '')) ILIKE '%' || w || '%'
                 OR coalesce(product.category_name_en, '') ILIKE '%' || w || '%'
                 OR public.normalize_arabic(coalesce(product.category_name, '')) ILIKE '%' || w || '%'
               )
             ) / greatest(1, array_length(v_syn_words, 1))
           ELSE 0.0 END)
      ) AS relevance_score
    FROM public.product_effective_prices AS product
    JOIN public.products p ON p.id = product.id
    WHERE product.is_active = true
      AND (p_category IS NULL OR btrim(p_category) = '' OR product.category_name = p_category OR product.category_name_en = p_category)
      AND (NOT p_in_stock OR product.stock > 0)
      AND (p_min_price IS NULL OR product.effective_price >= p_min_price)
      AND (p_max_price IS NULL OR product.effective_price <= p_max_price)
      AND (NOT p_is_sale OR product.has_active_promotion)
      AND (
        (v_tsq_combined IS NOT NULL AND p.search_vector @@ v_tsq_combined)
        OR public.normalize_arabic(coalesce(product.name_ar, '')) % v_uq
        OR coalesce(product.name_en, '') % v_uq
        OR v_uq <% public.normalize_arabic(coalesce(product.name_ar, ''))
        OR v_uq <% coalesce(product.name_en, '')
        OR public.normalize_arabic(coalesce(product.name_ar, '')) ILIKE '%' || v_uq || '%'
        OR coalesce(product.name_en, '') ILIKE '%' || v_uq || '%'
        OR coalesce(product.name_ar, '') ILIKE '%' || v_q || '%'
        OR coalesce(product.code, '') ILIKE v_q || '%'
        OR coalesce(product.barcode, '') ILIKE v_q || '%'
        OR (v_syn_words IS NOT NULL AND EXISTS (
          SELECT 1 FROM unnest(v_syn_words) w
          WHERE length(w) >= 3 AND (
            coalesce(product.name_en, '') ILIKE '%' || w || '%'
            OR public.normalize_arabic(coalesce(product.name_ar, '')) ILIKE '%' || w || '%'
            OR coalesce(product.category_name_en, '') ILIKE '%' || w || '%'
            OR public.normalize_arabic(coalesce(product.category_name, '')) ILIKE '%' || w || '%'
          )
        ))
      )
  ),
  relevant AS (
    SELECT * FROM filtered WHERE relevance_score > 0.05
  ),
  counted AS (
    SELECT relevant.*, count(*) OVER () AS row_total FROM relevant
  )
  SELECT
    counted.id, counted.code, counted.barcode, counted.name_ar, counted.name_en,
    counted.base_price, counted.effective_price, counted.stock,
    counted.category_name, counted.category_name_en, counted.image_url,
    counted.rating_avg, counted.rating_count, counted.is_new, counted.is_bestseller,
    counted.promotion_id, counted.promotion_name, counted.promotion_discount_type,
    counted.promotion_discount_value, counted.promotion_ends_at, counted.has_active_promotion,
    counted.d_amount, counted.d_percent, counted.row_total
  FROM counted
  ORDER BY
    CASE WHEN p_sort = 'price_asc' THEN counted.effective_price END ASC,
    CASE WHEN p_sort = 'price_desc' THEN counted.effective_price END DESC,
    CASE WHEN p_sort = 'name_asc' THEN counted.name_en END ASC,
    counted.relevance_score DESC,
    counted.name_en ASC NULLS LAST,
    counted.id
  LIMIT greatest(1, least(p_limit, 100))
  OFFSET greatest(0, p_offset);
END;
$$;


ALTER FUNCTION public.search_effective_products(p_query text, p_category text, p_in_stock boolean, p_min_price numeric, p_max_price numeric, p_is_sale boolean, p_sort text, p_limit integer, p_offset integer) OWNER TO postgres;

--
-- Name: FUNCTION search_effective_products(p_query text, p_category text, p_in_stock boolean, p_min_price numeric, p_max_price numeric, p_is_sale boolean, p_sort text, p_limit integer, p_offset integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.search_effective_products(p_query text, p_category text, p_in_stock boolean, p_min_price numeric, p_max_price numeric, p_is_sale boolean, p_sort text, p_limit integer, p_offset integer) IS 'Canonical product search + browse RPC. Ranking engine transplanted from the (previously unused) search_products RPC — weighted tsvector FTS, Arabic-normalized trigram + word-similarity fuzzy matching, exact/prefix bonuses — now running against product_effective_prices for promotion-aware pricing, plus server-side synonym expansion via search_synonyms/expand_search_query. This supersedes the ILIKE-only version from 20260716100000 and the pg_trgm-only version from 20260825120000 — both were partial fixes to the same underlying "search is dumber than it needs to be" problem.';


--
-- Name: search_products(text, text, boolean, numeric, numeric, text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.search_products(p_query text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_in_stock boolean DEFAULT false, p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric, p_sort text DEFAULT 'newest'::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0) RETURNS TABLE(id text, code text, barcode text, name_ar text, name_en text, price numeric, stock numeric, category_name text, category_name_en text, image_url text, rank double precision, total_count bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_threshold float4  := 0.12;
  v_tsquery   tsquery := NULL;
BEGIN
  -- NOTE: set_config('pg_trgm.similarity_threshold', ...) is intentionally
  -- omitted — Supabase managed roles lack permission to SET this GUC.
  -- Instead we use explicit similarity() > v_threshold comparisons below.

  IF p_query IS NOT NULL AND trim(p_query) <> '' THEN
    BEGIN
      v_tsquery := websearch_to_tsquery('english', p_query);
    EXCEPTION WHEN OTHERS THEN
      v_tsquery := NULL;
    END;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      p.id::text,
      p."Code"              AS code,
      p."Barcode"           AS barcode,
      p."Name_Ar"           AS name_ar,
      p."Name_En"           AS name_en,
      p."Price"             AS price,
      COALESCE(p."Stock", 0)::numeric AS stock,
      p."Category_Name"     AS category_name,
      p."Category_Name_En"  AS category_name_en,
      p.image_url,
      CASE WHEN p_query IS NULL OR trim(p_query) = '' THEN 0::double precision
        ELSE (
          (CASE WHEN lower(p."Code")    = lower(p_query) THEN 1000
                WHEN lower(p."Barcode") = lower(p_query) THEN 1000
                ELSE 0 END)::double precision
          + CASE WHEN v_tsquery IS NOT NULL THEN
              COALESCE(
                ts_rank_cd(
                  to_tsvector('english',
                    COALESCE(p."Name_En", '') || ' ' ||
                    COALESCE(p."Name_Ar", '') || ' ' ||
                    COALESCE(p."Code",    '') || ' ' ||
                    COALESCE(p."Barcode", '')
                  ),
                  v_tsquery
                ) * 2.5,
                0.0
              )
            ELSE 0.0 END
          + GREATEST(
              similarity(COALESCE(p."Name_Ar", ''), p_query),
              similarity(COALESCE(p."Name_En", ''), p_query)
            ) * 1.2
          + GREATEST(
              word_similarity(p_query, COALESCE(p."Name_Ar", '')),
              word_similarity(p_query, COALESCE(p."Name_En", ''))
            ) * 0.9
          + (CASE WHEN p."Name_Ar" ILIKE '%' || p_query || '%'
                    OR p."Name_En" ILIKE '%' || p_query || '%'
                    OR p."Code"    ILIKE '%' || p_query || '%'
                    OR p."Barcode" ILIKE '%' || p_query || '%'
                  THEN 0.3 ELSE 0.0 END)
          + similarity(COALESCE(p."Category_Name", ''), p_query) * 0.15
        )
      END AS relevance_score
    FROM public.products p
    WHERE
      (p_query IS NOT NULL AND trim(p_query) <> '' OR p.is_active = true)
      AND (p_in_stock IS NULL OR p_in_stock = false
           OR (p.is_active = true AND COALESCE(p."Stock", 0) > 0))
      AND (p_category IS NULL OR p."Category_Name" = p_category)
      AND (p_min_price IS NULL OR p."Price" >= p_min_price)
      AND (p_max_price IS NULL OR p."Price" <= p_max_price)
      AND (
        p_query IS NULL OR trim(p_query) = ''
        OR
        (v_tsquery IS NOT NULL AND
          to_tsvector('english',
            COALESCE(p."Name_En", '') || ' ' ||
            COALESCE(p."Name_Ar", '') || ' ' ||
            COALESCE(p."Code",    '') || ' ' ||
            COALESCE(p."Barcode", '')
          ) @@ v_tsquery
        )
        OR
        -- Explicit threshold avoids the % operator which reads the blocked GUC
        (   similarity(COALESCE(p."Name_Ar", ''), p_query) > v_threshold
         OR similarity(COALESCE(p."Name_En", ''), p_query) > v_threshold
         OR similarity(COALESCE(p."Code",    ''), p_query) > v_threshold
        )
        OR
        (word_similarity(p_query, COALESCE(p."Name_Ar", '')) > v_threshold
         OR word_similarity(p_query, COALESCE(p."Name_En", '')) > v_threshold)
        OR
        (p."Name_Ar" ILIKE '%' || p_query || '%'
         OR p."Name_En" ILIKE '%' || p_query || '%'
         OR p."Code"    ILIKE '%' || p_query || '%'
         OR p."Barcode" ILIKE '%' || p_query || '%')
      )
  ),
  counted AS (
    SELECT b.*, COUNT(*) OVER () AS total
    FROM base b
    ORDER BY
      CASE WHEN p_sort = 'relevance'
                OR (p_query IS NOT NULL AND trim(p_query) <> '' AND p_sort = 'newest')
           THEN -b.relevance_score END ASC NULLS LAST,
      CASE WHEN p_sort = 'price_asc'  THEN b.price    END ASC  NULLS LAST,
      CASE WHEN p_sort = 'price_desc' THEN b.price    END DESC NULLS LAST,
      CASE WHEN p_sort = 'name_asc'   THEN b.name_en  END ASC  NULLS LAST,
      (CASE WHEN b.stock > 0 THEN 0 ELSE 1 END) ASC,
      b.name_en ASC NULLS LAST
  )
  SELECT
    c.id,
    c.code,
    c.barcode,
    c.name_ar,
    c.name_en,
    c.price,
    c.stock,
    c.category_name,
    c.category_name_en,
    c.image_url,
    c.relevance_score AS rank,
    c.total
  FROM counted c
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;


ALTER FUNCTION public.search_products(p_query text, p_category text, p_in_stock boolean, p_min_price numeric, p_max_price numeric, p_sort text, p_limit integer, p_offset integer) OWNER TO postgres;

--
-- Name: FUNCTION search_products(p_query text, p_category text, p_in_stock boolean, p_min_price numeric, p_max_price numeric, p_sort text, p_limit integer, p_offset integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.search_products(p_query text, p_category text, p_in_stock boolean, p_min_price numeric, p_max_price numeric, p_sort text, p_limit integer, p_offset integer) IS 'Unified product search + browse RPC. Combines inline tsvector FTS, pg_trgm fuzzy, word_similarity partial, and ILIKE fallback. Self-contained: works without the search_vector generated column (added by 20260603). rank is double precision. Does not call set_config() — uses explicit similarity() comparisons to avoid Supabase GUC permission errors. Snake-case output matches SearchProductRowSchema in apps/shopper-native/src/features/products/types/index.ts and the web shopperCatalogApi.';


--
-- Name: search_products_fuzzy(text, integer, integer, text, text, boolean, text, real); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.search_products_fuzzy(search_term text, page_number integer DEFAULT 1, page_size integer DEFAULT 24, category_ar text DEFAULT NULL::text, category_en text DEFAULT NULL::text, in_stock_only boolean DEFAULT NULL::boolean, sort_order text DEFAULT 'relevant'::text, min_similarity real DEFAULT 0.15) RETURNS TABLE(id uuid, "Name_Ar" text, "Name_En" text, "Name" text, "Code" text, "Barcode" text, "Category_Name" text, "Category_Name_En" text, "Price" numeric, is_active boolean, image_url text, similarity_score real, total_count bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('pg_trgm.similarity_threshold', min_similarity::text, true);

  RETURN QUERY
  WITH filtered AS (
    SELECT
      p.id,
      p."Name_Ar",
      p."Name_En",
      p."Name",
      p."Code",
      p."Barcode",
      p."Category_Name",
      p."Category_Name_En",
      p."Price",
      p.is_active,
      p.image_url,
      GREATEST(
        similarity(COALESCE(p."Name_Ar", ''), search_term),
        similarity(COALESCE(p."Name_En", ''), search_term),
        similarity(COALESCE(p."Code",    ''), search_term)
      )::float4 AS sim
    FROM products p
    WHERE
      (
        p."Name_Ar" % search_term  OR
        p."Name_En" % search_term  OR
        p."Code"    % search_term
      )
      OR
      (
        p."Name_Ar" ILIKE '%' || search_term || '%' OR
        p."Name_En" ILIKE '%' || search_term || '%' OR
        p."Code"    ILIKE '%' || search_term || '%' OR
        p."Barcode" ILIKE '%' || search_term || '%'
      )
  ),
  category_filtered AS (
    SELECT f.*
    FROM filtered f
    WHERE
      (category_ar   IS NULL OR f."Category_Name"    ILIKE '%' || category_ar || '%')
      AND (category_en IS NULL OR f."Category_Name_En" ILIKE '%' || category_en || '%')
      AND (in_stock_only IS NULL OR f.is_active = in_stock_only)
  ),
  ranked AS (
    SELECT
      cf.*,
      COUNT(*) OVER () AS total
    FROM category_filtered cf
    ORDER BY
      CASE WHEN sort_order = 'relevant'
           THEN -cf.sim                              END ASC NULLS LAST,
      CASE WHEN sort_order = 'relevant'
           THEN (CASE WHEN cf.is_active THEN 0 ELSE 1 END) END ASC NULLS LAST,
      CASE WHEN sort_order = 'price_asc'
           THEN cf."Price"                           END ASC NULLS LAST,
      CASE WHEN sort_order = 'price_desc'
           THEN -cf."Price"                          END ASC NULLS LAST,
      CASE WHEN sort_order = 'name'
           THEN cf."Name_En"                         END ASC NULLS LAST,
      cf."Name_En" ASC NULLS LAST
  )
  SELECT
    r.id,
    r."Name_Ar",
    r."Name_En",
    r."Name",
    r."Code",
    r."Barcode",
    r."Category_Name",
    r."Category_Name_En",
    r."Price",
    r.is_active,
    r.image_url,
    r.sim                AS similarity_score,
    r.total::bigint      AS total_count
  FROM ranked r
  LIMIT  page_size
  OFFSET (page_number - 1) * page_size;
END;
$$;


ALTER FUNCTION public.search_products_fuzzy(search_term text, page_number integer, page_size integer, category_ar text, category_en text, in_stock_only boolean, sort_order text, min_similarity real) OWNER TO postgres;

--
-- Name: search_products_semantic(public.vector, integer, real); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.search_products_semantic(p_embedding public.vector, p_limit integer DEFAULT 20, p_min_similarity real DEFAULT 0.5) RETURNS TABLE(id uuid, name_ar text, name_en text, category_name text, category_name_en text, effective_price numeric, stock numeric, image_url text, similarity real)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT
    product.id,
    product.name_ar,
    product.name_en,
    product.category_name,
    product.category_name_en,
    product.effective_price,
    product.stock,
    product.image_url,
    (1 - (p.embedding <=> p_embedding))::real AS similarity
  FROM public.product_effective_prices AS product
  JOIN public.products p ON p.id = product.id
  WHERE product.is_active = true
    AND p.embedding IS NOT NULL
    AND (1 - (p.embedding <=> p_embedding)) >= p_min_similarity
  ORDER BY p.embedding <=> p_embedding ASC
  LIMIT greatest(1, least(p_limit, 100));
$$;


ALTER FUNCTION public.search_products_semantic(p_embedding public.vector, p_limit integer, p_min_similarity real) OWNER TO postgres;

--
-- Name: set_driver_availability(boolean, double precision, double precision); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_driver_availability(p_is_online boolean, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision) RETURNS TABLE("isOnline" boolean, "currentLat" double precision, "currentLng" double precision, "lastLocationAt" timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  UPDATE public."DriverProfile"
  SET "isOnline" = p_is_online,
      "currentLat" = COALESCE(p_lat, "DriverProfile"."currentLat"),
      "currentLng" = COALESCE(p_lng, "DriverProfile"."currentLng"),
      "lastLocationAt" = CASE WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL THEN now() ELSE "DriverProfile"."lastLocationAt" END,
      "updatedAt" = now()
  WHERE "userId" = auth.uid()
  RETURNING "DriverProfile"."isOnline", "DriverProfile"."currentLat", "DriverProfile"."currentLng", "DriverProfile"."lastLocationAt";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'driver_profile_not_found' USING ERRCODE = '22023';
  END IF;
END;
$$;


ALTER FUNCTION public.set_driver_availability(p_is_online boolean, p_lat double precision, p_lng double precision) OWNER TO postgres;

--
-- Name: FUNCTION set_driver_availability(p_is_online boolean, p_lat double precision, p_lng double precision); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.set_driver_availability(p_is_online boolean, p_lat double precision, p_lng double precision) IS 'Column-safe toggle for DriverProfile.isOnline (+ optional last-known position) for the caller''s own row only — DriverProfile intentionally has no general UPDATE policy so status/vehicle/document fields stay non-self-editable; this RPC is the one narrow, safe exception.';


--
-- Name: set_pharmacist_branch(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_pharmacist_branch(p_pharmacist_id uuid, p_branch_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


ALTER FUNCTION public.set_pharmacist_branch(p_pharmacist_id uuid, p_branch_id text) OWNER TO postgres;

--
-- Name: set_product_embedding(uuid, public.vector, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_product_embedding(p_id uuid, p_embedding public.vector, p_model text) RETURNS void
    LANGUAGE sql
    AS $$
  UPDATE public.products
  SET embedding = p_embedding,
      embedding_model = p_model,
      embedding_updated_at = now(),
      embedding_failed_attempts = 0
  WHERE id = p_id;
$$;


ALTER FUNCTION public.set_product_embedding(p_id uuid, p_embedding public.vector, p_model text) OWNER TO postgres;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

--
-- Name: submit_manual_payment_proof(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.submit_manual_payment_proof(p_order_id uuid, p_transfer_number text, p_payment_proof_url text, p_payment_method text) RETURNS public.orders
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_order public.orders;
BEGIN
  IF p_payment_method NOT IN ('vodafone', 'instapay') THEN
    RAISE EXCEPTION 'invalid_payment_method' USING ERRCODE = '22023';
  END IF;
  IF p_transfer_number IS NULL OR length(trim(p_transfer_number)) = 0 THEN
    RAISE EXCEPTION 'transfer_number_required' USING ERRCODE = '22023';
  END IF;
  IF p_payment_proof_url IS NULL OR length(trim(p_payment_proof_url)) = 0 THEN
    RAISE EXCEPTION 'payment_proof_url_required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
  SET
    status = 'pending_payment',
    payment_status = 'pending_verification',
    transfer_number = trim(p_transfer_number),
    payment_proof_url = p_payment_proof_url,
    payment_method = p_payment_method
  WHERE id = p_order_id
    AND user_id = auth.uid()
    AND status = 'pending_payment'
  RETURNING * INTO v_order;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'order_not_found_or_not_eligible' USING ERRCODE = '42501';
  END IF;

  RETURN v_order;
END;
$$;


ALTER FUNCTION public.submit_manual_payment_proof(p_order_id uuid, p_transfer_number text, p_payment_proof_url text, p_payment_method text) OWNER TO postgres;

--
-- Name: supersede_prior_delivery_assignments(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.supersede_prior_delivery_assignments() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.delivery_assignments
  SET response_status = 'superseded',
      superseded_at = now()
  WHERE order_id = NEW.order_id
    AND id <> NEW.id
    AND response_status IN ('offered', 'accepted');
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.supersede_prior_delivery_assignments() OWNER TO postgres;

--
-- Name: FUNCTION supersede_prior_delivery_assignments(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.supersede_prior_delivery_assignments() IS 'Guarantees at most one open (offered/accepted) delivery_assignments row per order_id, regardless of which caller inserted it. Fixes a dangling-offer bug where a first-time assignDriver() call never superseded a pre-existing row the way reassignDriver() did.';


--
-- Name: sync_profile_phone_from_auth(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_profile_phone_from_auth() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (NEW.phone is distinct from OLD.phone)
     or (NEW.phone_confirmed_at is distinct from OLD.phone_confirmed_at) then

    update public.profiles
       set phone          = nullif(NEW.phone, ''),
           phone_verified = (NEW.phone_confirmed_at is not null)
     where id = NEW.id;
  end if;
  return NEW;

exception when others then
  -- Never let a profile-sync failure break auth.users.update — that
  -- would block legitimate verification flows. Log + continue.
  raise warning 'sync_profile_phone_from_auth: % (sqlstate %)', sqlerrm, sqlstate;
  return NEW;
end $$;


ALTER FUNCTION public.sync_profile_phone_from_auth() OWNER TO postgres;

--
-- Name: sync_review_helpful_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_review_helpful_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  target_id uuid;
begin
  target_id := coalesce(new.review_id, old.review_id);
  update public.product_reviews
     set helpful_count = (
       select count(*) from public.review_helpful_votes where review_id = target_id
     )
   where id = target_id;
  return null;
end;
$$;


ALTER FUNCTION public.sync_review_helpful_count() OWNER TO postgres;

--
-- Name: sync_role_on_driver_approval(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_role_on_driver_approval() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'APPROVED' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'APPROVED') THEN
    PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

    UPDATE public.profiles
    SET role = 'driver'::public.app_role, updated_at = now()
    WHERE id = NEW."userId"
      AND role NOT IN ('driver'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_role_on_driver_approval() OWNER TO postgres;

--
-- Name: touch_review_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.touch_review_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION public.touch_review_updated_at() OWNER TO postgres;

--
-- Name: touch_search_synonyms_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.touch_search_synonyms_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;


ALTER FUNCTION public.touch_search_synonyms_updated_at() OWNER TO postgres;

--
-- Name: transition_order(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.transition_order(p_order_id uuid, p_next_status text) RETURNS public.orders
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_order public.orders;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'manager', 'pharmacist', 'driver') THEN
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
    (v_order.status::text = 'out_for_delivery' AND p_next_status = 'delivered') OR
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


ALTER FUNCTION public.transition_order(p_order_id uuid, p_next_status text) OWNER TO postgres;

--
-- Name: transition_return_status(uuid, public.return_status, text, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.transition_return_status(p_request_id uuid, p_new_status public.return_status, p_actor_type text, p_actor_id uuid, p_reason text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_req RECORD;
    v_order RECORD;
    v_total_refund NUMERIC := 0;
    v_item RECORD;
BEGIN
    -- 1. Lock the return request
    SELECT * INTO v_req FROM return_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Return request not found';
    END IF;

    -- 2. Basic validation: Do not allow transitioning to the same state
    IF v_req.status = p_new_status THEN
        RETURN json_build_object('success', true, 'status', p_new_status, 'note', 'Already in this state');
    END IF;

    -- 3. Load order
    SELECT * INTO v_order FROM orders WHERE id = v_req.order_id;

    -- 4. State Machine Guards
    -- Examples of enforcement:
    IF v_req.status = 'COMPLETED' THEN
        RAISE EXCEPTION 'Cannot transition from COMPLETED';
    END IF;

    IF p_new_status = 'APPROVED_FOR_REFUND' THEN
        -- Only transition here from INSPECTION or APPROVED (if REFUND_ONLY)
        IF v_req.status NOT IN ('INSPECTION', 'APPROVED') THEN
            RAISE EXCEPTION 'Must inspect items before approving refund';
        END IF;

        -- Calculate final refund amount based on approved_quantity
        FOR v_item IN SELECT ri.id, ri.approved_quantity, oi.unit_price, oi.line_total 
                      FROM return_items ri 
                      JOIN order_items oi ON ri.order_item_id = oi.id 
                      WHERE ri.request_id = p_request_id
        LOOP
            -- For simplicity, refund_amount = approved * unit_price 
            -- (In a real system, you'd distribute order-level discounts here)
            UPDATE return_items 
            SET refund_amount = v_item.approved_quantity * v_item.unit_price
            WHERE id = v_item.id;

            v_total_refund := v_total_refund + (v_item.approved_quantity * v_item.unit_price);
        END LOOP;

        -- If physical return, ensure all items have a disposition other than PENDING_INSPECTION
        IF v_req.resolution_type = 'PHYSICAL_RETURN' THEN
            IF EXISTS (SELECT 1 FROM return_items WHERE request_id = p_request_id AND disposition = 'PENDING_INSPECTION') THEN
                RAISE EXCEPTION 'All items must have a disposition before refund approval';
            END IF;
        END IF;
    END IF;

    IF p_new_status = 'REFUND_PENDING' THEN
        -- Insert into refunds table
        SELECT SUM(refund_amount) INTO v_total_refund FROM return_items WHERE request_id = p_request_id;
        IF v_total_refund > 0 THEN
            INSERT INTO refunds (order_id, amount, status, reason, created_by, idempotency_key)
            VALUES (v_req.order_id, v_total_refund, 'PENDING', p_reason, p_actor_id, 'return-' || p_request_id);
        END IF;
    END IF;

    IF p_new_status = 'COMPLETED' THEN
        -- Process inventory RESTOCK
        FOR v_item IN SELECT ri.product_id, ri.received_quantity, ri.disposition 
                      FROM return_items ri 
                      WHERE ri.request_id = p_request_id AND ri.disposition = 'RESTOCK'
        LOOP
            -- adjust_inventory RPC must exist, or we can just update products directly if this is a simple schema
            UPDATE products 
            SET "Stock" = "Stock" + v_item.received_quantity 
            WHERE id = v_item.product_id::uuid OR "Code" = v_item.product_id OR "Barcode" = v_item.product_id;
        END LOOP;
    END IF;

    -- 5. Update Status
    UPDATE return_requests SET status = p_new_status WHERE id = p_request_id;

    -- 6. Insert Audit Timeline
    INSERT INTO return_timeline (return_id, order_id, actor_type, actor_id, action, previous_status, new_status, reason, metadata)
    VALUES (p_request_id, v_req.order_id, p_actor_type, p_actor_id, 'status_transition', v_req.status, p_new_status, p_reason, p_metadata);

    RETURN json_build_object('success', true, 'status', p_new_status);
END;
$$;


ALTER FUNCTION public.transition_return_status(p_request_id uuid, p_new_status public.return_status, p_actor_type text, p_actor_id uuid, p_reason text, p_metadata jsonb) OWNER TO postgres;

--
-- Name: update_modified_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_modified_column() OWNER TO postgres;

--
-- Name: validate_coupon(text, numeric); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_coupon(p_code text, p_order_subtotal numeric) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_coupon     public.coupons%ROWTYPE;
  v_redemption_count integer;
  v_user_redemption_count integer;
  v_prior_order_count integer;
  v_discount_amount numeric(12,2);
BEGIN
  -- Must be authenticated — anonymous users cannot redeem coupons.
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  -- Normalise: upper-case, trim whitespace.
  SELECT * INTO v_coupon
    FROM public.coupons
   WHERE upper(trim(code)) = upper(trim(p_code))
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  -- Active check.
  IF NOT v_coupon.is_active THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'inactive');
  END IF;

  -- Expiry check.
  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at <= now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  -- Global redemption limit check.
  IF v_coupon.max_redemptions IS NOT NULL THEN
    SELECT count(*) INTO v_redemption_count
      FROM public.coupon_redemptions
     WHERE coupon_id = v_coupon.id;
    IF v_redemption_count >= v_coupon.max_redemptions THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'limit_reached');
    END IF;
  END IF;

  -- Per-user redemption limit check.
  SELECT count(*) INTO v_user_redemption_count
    FROM public.coupon_redemptions
   WHERE coupon_id = v_coupon.id
     AND user_id   = v_caller_id;

  IF v_user_redemption_count >= v_coupon.per_user_limit THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'already_redeemed');
  END IF;

  -- First-order-only check: caller must have zero prior completed orders.
  -- Cancelled and archived orders are excluded — a test order that was
  -- cancelled should not block the user's first real order discount.
  IF v_coupon.first_order_only THEN
    SELECT count(*) INTO v_prior_order_count
      FROM public.orders
     WHERE user_id = v_caller_id
       AND status NOT IN ('cancelled', 'archived', 'pending');

    IF v_prior_order_count > 0 THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'first_order_only');
    END IF;
  END IF;

  -- Minimum order amount check (applied to the subtotal before discount).
  IF v_coupon.min_order_amount IS NOT NULL
     AND p_order_subtotal < v_coupon.min_order_amount THEN
    RETURN jsonb_build_object(
      'valid',            false,
      'reason',           'min_order_not_met',
      'min_order_amount', v_coupon.min_order_amount
    );
  END IF;

  -- Compute the concrete discount amount.
  v_discount_amount := CASE v_coupon.discount_type
    WHEN 'percentage'   THEN round(p_order_subtotal * v_coupon.discount_value / 100, 2)
    WHEN 'fixed_amount' THEN least(v_coupon.discount_value, p_order_subtotal)
    ELSE 0
  END;

  -- Discount must be positive.
  IF v_discount_amount <= 0 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'valid',            true,
    'coupon_id',        v_coupon.id,
    'code',             upper(trim(v_coupon.code)),
    'discount_type',    v_coupon.discount_type,
    'discount_value',   v_coupon.discount_value,
    'discount_amount',  v_discount_amount,
    'min_order_amount', v_coupon.min_order_amount,
    'first_order_only', v_coupon.first_order_only,
    'description',      v_coupon.id::text  -- opaque; front-end uses i18n key
  );
END;
$$;


ALTER FUNCTION public.validate_coupon(p_code text, p_order_subtotal numeric) OWNER TO postgres;

--
-- Name: validate_coupon(text, integer, text[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_coupon(p_code text, p_cart_total_cents integer DEFAULT 0, p_categories text[] DEFAULT NULL::text[]) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_user_id       uuid := auth.uid();
  v_coupon        public.coupons%rowtype;
  v_batch         public.coupon_batches%rowtype;
  v_discount_cents integer;
  v_overlap       boolean;
begin
  if p_code is null or length(trim(p_code)) = 0 then
    return jsonb_build_object('valid', false, 'reason', 'code_required');
  end if;

  select * into v_coupon from public.coupons where code = upper(trim(p_code));
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;
  if v_coupon.state <> 'issued' then
    return jsonb_build_object('valid', false, 'reason', 'already_' || v_coupon.state);
  end if;
  if v_coupon.user_id is not null and v_coupon.user_id <> v_user_id then
    return jsonb_build_object('valid', false, 'reason', 'wrong_owner');
  end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;

  select * into v_batch from public.coupon_batches where id = v_coupon.batch_id;
  if not found or not v_batch.is_active then
    return jsonb_build_object('valid', false, 'reason', 'batch_inactive');
  end if;
  if v_batch.expires_at is not null and v_batch.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'batch_expired');
  end if;
  if v_batch.min_spend_cents is not null and p_cart_total_cents < v_batch.min_spend_cents then
    return jsonb_build_object(
      'valid', false,
      'reason', 'min_spend_not_met',
      'min_spend_cents', v_batch.min_spend_cents
    );
  end if;
  if v_batch.category_restrictions is not null and array_length(v_batch.category_restrictions, 1) > 0 then
    if p_categories is null or array_length(p_categories, 1) is null then
      return jsonb_build_object('valid', false, 'reason', 'category_restricted');
    end if;
    -- True iff at least one cart category is allowed by the batch.
    select exists (
      select 1 from unnest(p_categories) c
       where c = any(v_batch.category_restrictions)
    ) into v_overlap;
    if not v_overlap then
      return jsonb_build_object('valid', false, 'reason', 'category_restricted');
    end if;
  end if;

  v_discount_cents := case v_batch.discount_kind
                        when 'percent'       then floor(p_cart_total_cents * v_batch.discount_value / 100.0)
                        when 'flat'          then v_batch.discount_value
                        when 'free_shipping' then 0
                      end;
  if v_batch.max_discount_cents is not null and v_discount_cents > v_batch.max_discount_cents then
    v_discount_cents := v_batch.max_discount_cents;
  end if;

  return jsonb_build_object(
    'valid',           true,
    'coupon_id',       v_coupon.id,
    'batch_id',        v_batch.id,
    'discount_kind',   v_batch.discount_kind,
    'discount_value',  v_batch.discount_value,
    'discount_cents',  v_discount_cents,
    'free_shipping',   v_batch.discount_kind = 'free_shipping'
  );
end;
$$;


ALTER FUNCTION public.validate_coupon(p_code text, p_cart_total_cents integer, p_categories text[]) OWNER TO postgres;

--
-- Name: validate_inventory(text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_inventory(p_product_id text, p_requested integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_state public.inventory_state%rowtype;
  v_avail integer;
begin
  if p_requested is null or p_requested <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_quantity');
  end if;
  select * into v_state from public.inventory_state where product_id = p_product_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'product_not_found');
  end if;
  v_avail := v_state.total - v_state.reserved - v_state.committed;
  return jsonb_build_object(
    'ok',        v_avail >= p_requested,
    'available', greatest(v_avail, 0),
    'reserved',  v_state.reserved,
    'committed', v_state.committed,
    'total',     v_state.total
  );
end;
$$;


ALTER FUNCTION public.validate_inventory(p_product_id text, p_requested integer) OWNER TO postgres;

--
-- Name: Branch; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Branch" (
    id text NOT NULL,
    "nameAr" text NOT NULL,
    "nameEn" text NOT NULL,
    governorate text NOT NULL,
    area text NOT NULL,
    address text,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    "mapEmbedSrc" text,
    "loadFactor" double precision,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    phone text
);


ALTER TABLE public."Branch" OWNER TO postgres;

--
-- Name: DeliveryAssignment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DeliveryAssignment" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "orderId" uuid NOT NULL,
    "driverId" uuid NOT NULL,
    "pharmacyName" text NOT NULL,
    "pharmacyLat" double precision NOT NULL,
    "pharmacyLng" double precision NOT NULL,
    "pharmacyAddress" text NOT NULL,
    "assignedAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "acceptedAt" timestamp(6) with time zone,
    "rejectedAt" timestamp(6) with time zone,
    "arrivedPharmacyAt" timestamp(6) with time zone,
    "pickedUpAt" timestamp(6) with time zone,
    "arrivedCustomerAt" timestamp(6) with time zone,
    "deliveredAt" timestamp(6) with time zone,
    "cancelledAt" timestamp(6) with time zone,
    "proofPhotoUrl" text,
    "customerSignature" text,
    "deliveryNotes" text,
    "customerRating" integer,
    "customerFeedback" text,
    "baseFee" numeric(10,2) NOT NULL,
    "distanceFee" numeric(10,2) DEFAULT 0 NOT NULL,
    "tipAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "bonusAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "totalEarnings" numeric(10,2) NOT NULL,
    status public."DeliveryStatus" DEFAULT 'ASSIGNED'::public."DeliveryStatus" NOT NULL,
    "cancellationReason" text,
    "estimatedDistance" double precision,
    "estimatedDuration" integer,
    "actualDistance" double precision,
    "actualDuration" integer,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone NOT NULL
);


ALTER TABLE public."DeliveryAssignment" OWNER TO postgres;

--
-- Name: DeliveryZone; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DeliveryZone" (
    id text NOT NULL,
    "branchId" text NOT NULL,
    name text NOT NULL,
    polygon jsonb NOT NULL,
    "baseFee" integer NOT NULL,
    "freeAboveSubtotal" integer,
    "surgeStartHour" integer,
    "surgeEndHour" integer,
    "surgeMultiplier" double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."DeliveryZone" OWNER TO postgres;

--
-- Name: DriverLocation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DriverLocation" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "driverId" uuid NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    accuracy double precision NOT NULL,
    heading double precision,
    speed double precision,
    altitude double precision,
    "timestamp" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."DriverLocation" OWNER TO postgres;

--
-- Name: DriverProfile; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DriverProfile" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    "vehicleType" text NOT NULL,
    "vehiclePlate" text,
    "vehicleModel" text,
    "vehicleColor" text,
    "licenseNumber" text,
    "licenseExpiry" timestamp(6) with time zone,
    "licensePhotoUrl" text,
    "idPhotoUrl" text,
    "vehiclePhotoUrl" text,
    "insurancePhotoUrl" text,
    status public."DriverStatus" DEFAULT 'PENDING_APPROVAL'::public."DriverStatus" NOT NULL,
    "isOnline" boolean DEFAULT false NOT NULL,
    "currentLat" double precision,
    "currentLng" double precision,
    "lastLocationAt" timestamp(6) with time zone,
    rating double precision DEFAULT 5.0 NOT NULL,
    "totalDeliveries" integer DEFAULT 0 NOT NULL,
    "completionRate" double precision DEFAULT 100.0 NOT NULL,
    "totalEarnings" numeric(12,2) DEFAULT 0 NOT NULL,
    "approvedAt" timestamp(6) with time zone,
    "approvedBy" uuid,
    "rejectionReason" text,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone NOT NULL
);


ALTER TABLE public."DriverProfile" OWNER TO postgres;

--
-- Name: DriverSession; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DriverSession" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "driverId" uuid NOT NULL,
    "startedAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endedAt" timestamp(6) with time zone,
    "totalOnlineTime" integer DEFAULT 0 NOT NULL,
    "totalDeliveries" integer DEFAULT 0 NOT NULL,
    "totalEarnings" numeric(12,2) DEFAULT 0 NOT NULL,
    "totalDistance" double precision DEFAULT 0 NOT NULL
);


ALTER TABLE public."DriverSession" OWNER TO postgres;

--
-- Name: NotificationLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."NotificationLog" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid,
    "tokenId" uuid,
    title text NOT NULL,
    body text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    "imageUrl" text,
    status text NOT NULL,
    platform text NOT NULL,
    "errorMessage" text,
    "sentAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deliveredAt" timestamp(6) with time zone,
    "clickedAt" timestamp(6) with time zone
);


ALTER TABLE public."NotificationLog" OWNER TO postgres;

--
-- Name: NotificationToken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."NotificationToken" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    token text NOT NULL,
    platform text NOT NULL,
    "deviceId" text,
    "deviceName" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastUsedAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."NotificationToken" OWNER TO postgres;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    label text NOT NULL,
    recipient_name text NOT NULL,
    phone text NOT NULL,
    city text NOT NULL,
    district text NOT NULL,
    street text NOT NULL,
    building text NOT NULL,
    floor text,
    apartment text,
    landmark text,
    lat double precision,
    lng double precision,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    governorate text,
    delivery_instructions text,
    location_accuracy_m real,
    location_source text,
    CONSTRAINT addresses_location_source_check CHECK ((location_source = ANY (ARRAY['gps'::text, 'manual'::text, 'gps_corrected'::text])))
);


ALTER TABLE public.addresses OWNER TO postgres;

--
-- Name: TABLE addresses; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.addresses IS 'Customer saved delivery addresses. Was live and in active use before this migration existed — this file documents the real shape rather than introducing a new one. Orders never reference this table by FK (see orders.customer_address); it is the mutable address book, not the immutable per-order snapshot.';


--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid,
    action text NOT NULL,
    target_user_id uuid,
    target_user_email text,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admin_audit_log OWNER TO postgres;

--
-- Name: allergies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.allergies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    severity public.allergy_severity DEFAULT 'moderate'::public.allergy_severity NOT NULL,
    reaction text,
    notes text,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.allergies OWNER TO postgres;

--
-- Name: anti_fraud_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.anti_fraud_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    event_kind text NOT NULL,
    severity text NOT NULL,
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    auto_action text,
    CONSTRAINT anti_fraud_events_auto_action_check CHECK ((auto_action = ANY (ARRAY['none'::text, 'flagged'::text, 'frozen'::text, 'reversed'::text]))),
    CONSTRAINT anti_fraud_events_event_kind_check CHECK ((event_kind = ANY (ARRAY['rapid_redemption'::text, 'duplicate_request'::text, 'impossible_balance'::text, 'referral_loop'::text, 'rate_limit'::text, 'expired_balance'::text, 'manual_flag'::text]))),
    CONSTRAINT anti_fraud_events_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warn'::text, 'critical'::text])))
);


ALTER TABLE public.anti_fraud_events OWNER TO postgres;

--
-- Name: available_inventory; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.available_inventory WITH (security_invoker='true') AS
 SELECT i.product_id,
    i.total,
    i.reserved,
    i.committed,
    ((i.total - i.reserved) - i.committed) AS available,
        CASE
            WHEN (((i.total - i.reserved) - i.committed) <= 0) THEN 'out_of_stock'::text
            WHEN (((i.total - i.reserved) - i.committed) <= 3) THEN 'low'::text
            ELSE 'in_stock'::text
        END AS availability,
    i.updated_at,
    p."Name_Ar" AS name_ar,
    p."Name_En" AS name_en,
    p."Category_Name" AS category_name
   FROM (public.inventory_state i
     LEFT JOIN public.products p ON (((p.id)::text = i.product_id)));


ALTER VIEW public.available_inventory OWNER TO postgres;

--
-- Name: cancellations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cancellations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    actor_type text NOT NULL,
    actor_id uuid,
    reason_code text NOT NULL,
    note text,
    previous_status public.order_status,
    refund_status text DEFAULT 'NOT_REQUIRED'::text NOT NULL,
    refund_amount numeric(12,2) DEFAULT 0,
    idempotency_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    financial_action text DEFAULT 'NONE'::text,
    CONSTRAINT cancellations_actor_type_check CHECK ((actor_type = ANY (ARRAY['customer'::text, 'pharmacist'::text, 'driver'::text, 'admin'::text, 'system'::text]))),
    CONSTRAINT cancellations_refund_status_check CHECK ((refund_status = ANY (ARRAY['NOT_REQUIRED'::text, 'PENDING'::text, 'PROCESSING'::text, 'COMPLETED'::text, 'FAILED'::text])))
);


ALTER TABLE public.cancellations OWNER TO postgres;

--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cart_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id text NOT NULL,
    quantity integer NOT NULL,
    product_snapshot jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cart_items_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.cart_items OWNER TO postgres;

--
-- Name: conditions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conditions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    since date,
    managed boolean DEFAULT true NOT NULL,
    notes text,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.conditions OWNER TO postgres;

--
-- Name: coupon_batches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coupon_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    discount_kind text NOT NULL,
    discount_value integer NOT NULL,
    min_spend_cents integer,
    max_discount_cents integer,
    category_restrictions text[],
    points_cost bigint DEFAULT 0 NOT NULL,
    total_supply integer,
    issued_count integer DEFAULT 0 NOT NULL,
    redeemed_count integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    campaign_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coupon_batches_discount_kind_check CHECK ((discount_kind = ANY (ARRAY['percent'::text, 'flat'::text, 'free_shipping'::text]))),
    CONSTRAINT coupon_batches_discount_value_check CHECK ((discount_value >= 0)),
    CONSTRAINT coupon_batches_issued_count_check CHECK ((issued_count >= 0)),
    CONSTRAINT coupon_batches_max_discount_cents_check CHECK (((max_discount_cents IS NULL) OR (max_discount_cents >= 0))),
    CONSTRAINT coupon_batches_min_spend_cents_check CHECK (((min_spend_cents IS NULL) OR (min_spend_cents >= 0))),
    CONSTRAINT coupon_batches_percent_range CHECK (((discount_kind <> 'percent'::text) OR ((discount_value >= 0) AND (discount_value <= 100)))),
    CONSTRAINT coupon_batches_points_cost_check CHECK ((points_cost >= 0)),
    CONSTRAINT coupon_batches_redeemed_count_check CHECK ((redeemed_count >= 0)),
    CONSTRAINT coupon_batches_supply_respected CHECK (((total_supply IS NULL) OR (issued_count <= total_supply))),
    CONSTRAINT coupon_batches_total_supply_check CHECK (((total_supply IS NULL) OR (total_supply > 0)))
);


ALTER TABLE public.coupon_batches OWNER TO postgres;

--
-- Name: coupon_redemptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coupon_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coupon_id uuid NOT NULL,
    user_id uuid NOT NULL,
    order_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    redeemed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coupon_redemptions_amount_check CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.coupon_redemptions OWNER TO postgres;

--
-- Name: coupons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    batch_id uuid,
    discount_type text NOT NULL,
    discount_value numeric(12,2) NOT NULL,
    min_order_amount numeric(12,2) DEFAULT NULL::numeric,
    max_redemptions integer,
    per_user_limit integer DEFAULT 1 NOT NULL,
    first_order_only boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coupons_code_check CHECK (((char_length(TRIM(BOTH FROM code)) >= 2) AND (char_length(TRIM(BOTH FROM code)) <= 64))),
    CONSTRAINT coupons_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed_amount'::text]))),
    CONSTRAINT coupons_discount_value_check CHECK ((discount_value > (0)::numeric)),
    CONSTRAINT coupons_max_redemptions_check CHECK (((max_redemptions IS NULL) OR (max_redemptions > 0))),
    CONSTRAINT coupons_per_user_limit_check CHECK ((per_user_limit > 0))
);


ALTER TABLE public.coupons OWNER TO postgres;

--
-- Name: dependents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dependents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    relationship public.dependent_rel NOT NULL,
    dob date NOT NULL,
    color_hex text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.dependents OWNER TO postgres;

--
-- Name: dose_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dose_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reminder_id uuid,
    prescription_id uuid NOT NULL,
    user_id uuid NOT NULL,
    taken_at timestamp with time zone DEFAULT now() NOT NULL,
    scheduled_for timestamp with time zone,
    skipped boolean DEFAULT false NOT NULL,
    notes text
);


ALTER TABLE public.dose_logs OWNER TO postgres;

--
-- Name: driver_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.driver_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    driver_id uuid NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    accuracy_meters double precision,
    heading double precision,
    speed_kmh double precision,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.driver_locations OWNER TO postgres;

--
-- Name: TABLE driver_locations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.driver_locations IS 'Append-only GPS ping log written by the driver-location Edge Function on every location broadcast. Current position = most recent row by captured_at for a given order_id. Read by the track-order Edge Function to serve live driver position to customers via qr_token-authenticated requests.';


--
-- Name: COLUMN driver_locations.captured_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.driver_locations.captured_at IS 'Device clock at GPS read time (from DriverLocationPayload.captured_at). This is the authoritative timestamp for ordering pings, not created_at.';


--
-- Name: drug_interactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drug_interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    drug_a text NOT NULL,
    drug_b text NOT NULL,
    severity public.interaction_severity NOT NULL,
    summary text NOT NULL,
    detail text,
    watch_for text[],
    source text,
    CONSTRAINT drug_interactions_pair_canonical CHECK ((drug_a < drug_b))
);


ALTER TABLE public.drug_interactions OWNER TO postgres;

--
-- Name: favorites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.favorites (
    user_id uuid NOT NULL,
    product_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.favorites OWNER TO postgres;

--
-- Name: gift_catalog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gift_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    image_url text,
    points_cost bigint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    category text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gift_catalog_points_cost_check CHECK ((points_cost > 0))
);


ALTER TABLE public.gift_catalog OWNER TO postgres;

--
-- Name: gift_inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gift_inventory (
    gift_id uuid NOT NULL,
    total_stock integer DEFAULT 0 NOT NULL,
    reserved integer DEFAULT 0 NOT NULL,
    fulfilled integer DEFAULT 0 NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gift_inventory_fulfilled_check CHECK ((fulfilled >= 0)),
    CONSTRAINT gift_inventory_no_oversell CHECK (((reserved + fulfilled) <= total_stock)),
    CONSTRAINT gift_inventory_reserved_check CHECK ((reserved >= 0)),
    CONSTRAINT gift_inventory_total_stock_check CHECK ((total_stock >= 0))
);


ALTER TABLE public.gift_inventory OWNER TO postgres;

--
-- Name: gift_redemptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gift_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    gift_id uuid NOT NULL,
    points_spent bigint NOT NULL,
    ledger_id uuid NOT NULL,
    state text DEFAULT 'reserved'::text NOT NULL,
    reserved_at timestamp with time zone DEFAULT now() NOT NULL,
    fulfilled_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    expires_at timestamp with time zone DEFAULT (now() + '14 days'::interval) NOT NULL,
    address jsonb,
    tracking_number text,
    CONSTRAINT gift_redemptions_points_spent_check CHECK ((points_spent > 0)),
    CONSTRAINT gift_redemptions_state_check CHECK ((state = ANY (ARRAY['reserved'::text, 'fulfilled'::text, 'cancelled'::text, 'expired'::text])))
);


ALTER TABLE public.gift_redemptions OWNER TO postgres;

--
-- Name: inbox_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inbox_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    status text DEFAULT 'delivered'::text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    event_id text
);


ALTER TABLE public.inbox_notifications OWNER TO postgres;

--
-- Name: insurance_cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.insurance_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    carrier text NOT NULL,
    plan text,
    member_id text NOT NULL,
    group_number text,
    rx_bin text,
    pcn text,
    copay_generic_cents integer,
    copay_brand_cents integer,
    deductible_met_cents integer DEFAULT 0 NOT NULL,
    deductible_total_cents integer,
    is_primary boolean DEFAULT false NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.insurance_cards OWNER TO postgres;

--
-- Name: integration_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.integration_events (
    id bigint NOT NULL,
    event_type text NOT NULL,
    aggregate_type text NOT NULL,
    aggregate_id text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    dedupe_key text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    processor text,
    error_message text
);


ALTER TABLE public.integration_events OWNER TO postgres;

--
-- Name: integration_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.integration_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.integration_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory (
    product_id uuid NOT NULL,
    on_hand integer DEFAULT 0,
    reserved integer DEFAULT 0
);


ALTER TABLE public.inventory OWNER TO postgres;

--
-- Name: inventory_reservations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_reservations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id text NOT NULL,
    user_id uuid,
    quantity integer NOT NULL,
    state text DEFAULT 'reserved'::text NOT NULL,
    reservation_kind text NOT NULL,
    reservation_ref text,
    order_id uuid,
    idempotency_key text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:15:00'::interval) NOT NULL,
    reserved_at timestamp with time zone DEFAULT now() NOT NULL,
    committed_at timestamp with time zone,
    released_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT inventory_reservations_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT inventory_reservations_reservation_kind_check CHECK ((reservation_kind = ANY (ARRAY['cart'::text, 'order'::text, 'gift_redemption'::text, 'manual'::text]))),
    CONSTRAINT inventory_reservations_state_check CHECK ((state = ANY (ARRAY['reserved'::text, 'committed'::text, 'released'::text, 'expired'::text])))
);


ALTER TABLE public.inventory_reservations OWNER TO postgres;

--
-- Name: loyalty_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.loyalty_config (
    id integer DEFAULT 1 NOT NULL,
    points_per_egp numeric(6,2) DEFAULT 1.0 NOT NULL,
    min_order_egp numeric(10,2) DEFAULT 0.0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loyalty_config_id_check CHECK ((id = 1))
);


ALTER TABLE public.loyalty_config OWNER TO postgres;

--
-- Name: loyalty_ledger; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.loyalty_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    delta bigint NOT NULL,
    balance_after bigint NOT NULL,
    kind text NOT NULL,
    source text NOT NULL,
    source_ref text,
    parent_ledger_id uuid,
    idempotency_key text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loyalty_ledger_balance_after_check CHECK ((balance_after >= 0)),
    CONSTRAINT loyalty_ledger_delta_check CHECK ((delta <> 0)),
    CONSTRAINT loyalty_ledger_kind_check CHECK ((kind = ANY (ARRAY['earn'::text, 'redeem'::text, 'adjust'::text, 'reverse'::text, 'expire'::text, 'bonus'::text, 'referral'::text, 'cashback'::text])))
);


ALTER TABLE public.loyalty_ledger OWNER TO postgres;

--
-- Name: loyalty_point_awards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.loyalty_point_awards (
    id bigint NOT NULL,
    order_id uuid NOT NULL,
    user_id uuid,
    points integer NOT NULL,
    awarded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loyalty_point_awards_points_check CHECK ((points > 0))
);


ALTER TABLE public.loyalty_point_awards OWNER TO postgres;

--
-- Name: loyalty_point_awards_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.loyalty_point_awards ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.loyalty_point_awards_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: loyalty_user_history; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.loyalty_user_history WITH (security_invoker='on') AS
 SELECT id AS ledger_id,
    user_id,
    delta,
    balance_after,
    kind,
    source,
    source_ref,
    parent_ledger_id,
    created_at,
        CASE
            WHEN (source = 'gift_redeem'::text) THEN ( SELECT jsonb_build_object('gift_id', gr.gift_id, 'state', gr.state) AS jsonb_build_object
               FROM public.gift_redemptions gr
              WHERE (gr.ledger_id = l.id)
             LIMIT 1)
            ELSE metadata
        END AS detail
   FROM public.loyalty_ledger l;


ALTER VIEW public.loyalty_user_history OWNER TO postgres;

--
-- Name: loyalty_wallets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.loyalty_wallets (
    user_id uuid NOT NULL,
    balance integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loyalty_wallets_balance_check CHECK ((balance >= 0))
);


ALTER TABLE public.loyalty_wallets OWNER TO postgres;

--
-- Name: medication_reminders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.medication_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prescription_id uuid NOT NULL,
    user_id uuid NOT NULL,
    dependent_id uuid,
    time_of_day time without time zone NOT NULL,
    frequency public.reminder_freq DEFAULT 'daily'::public.reminder_freq NOT NULL,
    days_of_week smallint[],
    dose_note text,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.medication_reminders OWNER TO postgres;

--
-- Name: notification_batches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    target_audience text NOT NULL,
    template_type text,
    custom_title text,
    custom_body text,
    channels text[] DEFAULT '{push,in_app}'::text[] NOT NULL,
    total_recipients integer DEFAULT 0 NOT NULL,
    processed_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT notification_batches_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


ALTER TABLE public.notification_batches OWNER TO postgres;

--
-- Name: notification_deliveries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    notification_id uuid,
    recipient_id uuid NOT NULL,
    device_id uuid,
    channel text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    provider_message_id text,
    error_code text,
    error_message text,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_deliveries_channel_check CHECK ((channel = ANY (ARRAY['push'::text, 'in_app'::text, 'email'::text, 'sms'::text]))),
    CONSTRAINT notification_deliveries_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'failed'::text])))
);


ALTER TABLE public.notification_deliveries OWNER TO postgres;

--
-- Name: notification_delivery_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_delivery_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    outbox_id uuid NOT NULL,
    token_id uuid,
    expo_ticket_id text,
    status text NOT NULL,
    provider_response jsonb,
    error_code text,
    error_message text,
    receipt_checked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_delivery_attempts_status_check CHECK ((status = ANY (ARRAY['accepted'::text, 'delivered'::text, 'failed'::text, 'retrying'::text, 'skipped'::text])))
);


ALTER TABLE public.notification_delivery_attempts OWNER TO postgres;

--
-- Name: notification_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    description text,
    supported_channels text[] DEFAULT '{push,in_app}'::text[] NOT NULL,
    required_data_keys text[] DEFAULT '{}'::text[] NOT NULL,
    default_priority text DEFAULT 'normal'::text NOT NULL,
    title_ar text NOT NULL,
    body_ar text NOT NULL,
    title_en text NOT NULL,
    body_en text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT notification_templates_default_priority_check CHECK ((default_priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text])))
);


ALTER TABLE public.notification_templates OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    category text,
    title text NOT NULL,
    body text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    action_url text,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    event_key text
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    id bigint NOT NULL,
    order_id uuid NOT NULL,
    product_id text NOT NULL,
    quantity numeric(12,2) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    line_total numeric(12,2) NOT NULL,
    product_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_items_line_total_check CHECK ((line_total >= (0)::numeric)),
    CONSTRAINT order_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT order_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.order_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.order_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: order_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    author_id uuid,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_notes_body_check CHECK (((char_length(TRIM(BOTH FROM body)) >= 1) AND (char_length(TRIM(BOTH FROM body)) <= 2000)))
);


ALTER TABLE public.order_notes OWNER TO postgres;

--
-- Name: order_prescriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_prescriptions (
    order_id uuid NOT NULL,
    prescription_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.order_prescriptions OWNER TO postgres;

--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    previous_status public.order_status,
    new_status public.order_status NOT NULL,
    actor_id uuid,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.order_status_history OWNER TO postgres;

--
-- Name: pharmacies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pharmacies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    address text NOT NULL,
    lat numeric(10,7),
    lng numeric(10,7),
    phone text,
    hours_json jsonb,
    services text[],
    rating numeric(3,2),
    is_open boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.pharmacies OWNER TO postgres;

--
-- Name: product_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id text NOT NULL,
    user_id uuid NOT NULL,
    author_name text NOT NULL,
    rating smallint NOT NULL,
    title text,
    body text,
    photos text[] DEFAULT '{}'::text[] NOT NULL,
    helpful_count integer DEFAULT 0 NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    reported_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.product_reviews OWNER TO postgres;

--
-- Name: product_review_stats; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.product_review_stats WITH (security_invoker='true') AS
 SELECT product_id,
    count(*) AS total_reviews,
    round(avg(rating), 2) AS average_rating,
    count(*) FILTER (WHERE (rating = 5)) AS stars_5,
    count(*) FILTER (WHERE (rating = 4)) AS stars_4,
    count(*) FILTER (WHERE (rating = 3)) AS stars_3,
    count(*) FILTER (WHERE (rating = 2)) AS stars_2,
    count(*) FILTER (WHERE (rating = 1)) AS stars_1,
    count(*) FILTER (WHERE (verified = true)) AS verified_count,
    count(*) FILTER (WHERE (array_length(photos, 1) > 0)) AS photo_count
   FROM public.product_reviews
  GROUP BY product_id;


ALTER VIEW public.product_review_stats OWNER TO postgres;

--
-- Name: referral_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.referral_codes (
    user_id uuid NOT NULL,
    code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.referral_codes OWNER TO postgres;

--
-- Name: referral_rewards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.referral_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referrer_id uuid,
    referee_id uuid,
    referee_first_order_id uuid,
    points_granted bigint NOT NULL,
    ledger_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT referral_rewards_points_granted_check CHECK ((points_granted > 0))
);


ALTER TABLE public.referral_rewards OWNER TO postgres;

--
-- Name: refunds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.refunds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    gateway_reference text,
    idempotency_key text NOT NULL,
    reason text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT refunds_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text, 'PROCESSING'::text, 'FAILED'::text, 'COMPLETED'::text, 'pending'::text, 'succeeded'::text, 'failed'::text])))
);


ALTER TABLE public.refunds OWNER TO postgres;

--
-- Name: return_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.return_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    order_item_id bigint NOT NULL,
    requested_quantity numeric NOT NULL,
    approved_quantity numeric DEFAULT 0,
    received_quantity numeric DEFAULT 0,
    rejected_quantity numeric DEFAULT 0,
    reason_code text,
    disposition public.inventory_disposition DEFAULT 'PENDING_INSPECTION'::public.inventory_disposition NOT NULL,
    refund_amount numeric(12,2) DEFAULT 0,
    CONSTRAINT return_items_requested_quantity_check CHECK ((requested_quantity > (0)::numeric))
);


ALTER TABLE public.return_items OWNER TO postgres;

--
-- Name: return_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.return_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status public.return_status DEFAULT 'REQUESTED'::public.return_status NOT NULL,
    resolution_type public.return_resolution DEFAULT 'PHYSICAL_RETURN'::public.return_resolution NOT NULL,
    idempotency_key text,
    reason text NOT NULL,
    customer_notes text,
    pharmacist_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone
);


ALTER TABLE public.return_requests OWNER TO postgres;

--
-- Name: return_timeline; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.return_timeline (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    return_id uuid NOT NULL,
    order_id uuid NOT NULL,
    actor_type text NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    previous_status public.return_status,
    new_status public.return_status,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT return_timeline_actor_type_check CHECK ((actor_type = ANY (ARRAY['system'::text, 'customer'::text, 'driver'::text, 'pharmacist'::text, 'admin'::text])))
);


ALTER TABLE public.return_timeline OWNER TO postgres;

--
-- Name: review_helpful_votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.review_helpful_votes (
    review_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.review_helpful_votes OWNER TO postgres;

--
-- Name: reward_audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reward_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_id uuid,
    subject_user_id uuid,
    event_kind text NOT NULL,
    rpc_name text,
    success boolean,
    error_code text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_hash text,
    CONSTRAINT reward_audit_logs_event_kind_check CHECK ((event_kind = ANY (ARRAY['rpc_call'::text, 'rpc_reject'::text, 'admin_action'::text, 'reversal'::text, 'anomaly'::text, 'freeze'::text, 'unfreeze'::text])))
);


ALTER TABLE public.reward_audit_logs OWNER TO postgres;

--
-- Name: reward_campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reward_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    multiplier numeric(6,2) DEFAULT 1.0 NOT NULL,
    min_purchase_cents integer,
    max_redemptions_per_user integer,
    total_budget bigint,
    points_issued bigint DEFAULT 0 NOT NULL,
    category_restrictions text[],
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reward_campaigns_budget_respected CHECK (((total_budget IS NULL) OR (points_issued <= total_budget))),
    CONSTRAINT reward_campaigns_max_redemptions_per_user_check CHECK (((max_redemptions_per_user IS NULL) OR (max_redemptions_per_user > 0))),
    CONSTRAINT reward_campaigns_min_purchase_cents_check CHECK (((min_purchase_cents IS NULL) OR (min_purchase_cents >= 0))),
    CONSTRAINT reward_campaigns_multiplier_check CHECK ((multiplier >= (0)::numeric)),
    CONSTRAINT reward_campaigns_points_issued_check CHECK ((points_issued >= 0)),
    CONSTRAINT reward_campaigns_total_budget_check CHECK (((total_budget IS NULL) OR (total_budget >= 0))),
    CONSTRAINT reward_campaigns_window CHECK (((starts_at IS NULL) OR (ends_at IS NULL) OR (ends_at >= starts_at)))
);


ALTER TABLE public.reward_campaigns OWNER TO postgres;

--
-- Name: reward_idempotency_keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reward_idempotency_keys (
    key text NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    request_hash text NOT NULL,
    response jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL
);


ALTER TABLE public.reward_idempotency_keys OWNER TO postgres;

--
-- Name: reward_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reward_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    kind text NOT NULL,
    params jsonb DEFAULT '{}'::jsonb NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reward_rules_kind_check CHECK ((kind = ANY (ARRAY['cashback'::text, 'flat_earn'::text, 'multiplier'::text, 'tier_bonus'::text])))
);


ALTER TABLE public.reward_rules OWNER TO postgres;

--
-- Name: reward_tiers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reward_tiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    min_lifetime_points bigint NOT NULL,
    earn_multiplier numeric(6,2) DEFAULT 1.0 NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reward_tiers_earn_multiplier_check CHECK ((earn_multiplier >= (0)::numeric)),
    CONSTRAINT reward_tiers_min_lifetime_points_check CHECK ((min_lifetime_points >= 0))
);


ALTER TABLE public.reward_tiers OWNER TO postgres;

--
-- Name: search_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.search_events (
    id bigint NOT NULL,
    user_id uuid,
    query text NOT NULL,
    result_count integer DEFAULT 0 NOT NULL,
    source text DEFAULT 'native'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT search_events_query_check CHECK (((char_length(query) >= 1) AND (char_length(query) <= 200))),
    CONSTRAINT search_events_source_check CHECK ((source = ANY (ARRAY['native'::text, 'web'::text])))
);


ALTER TABLE public.search_events OWNER TO postgres;

--
-- Name: TABLE search_events; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.search_events IS 'Analytics log of search submissions. Powers trending searches and admin dashboards.';


--
-- Name: search_analytics_daily_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.search_analytics_daily_summary WITH (security_invoker='true') AS
 SELECT date_trunc('day'::text, created_at) AS day,
    count(*) AS total_searches,
    count(*) FILTER (WHERE (result_count = 0)) AS zero_result_searches,
    round(((100.0 * (count(*) FILTER (WHERE (result_count = 0)))::numeric) / (NULLIF(count(*), 0))::numeric), 1) AS zero_result_rate_pct,
    count(DISTINCT user_id) AS unique_signed_in_searchers
   FROM public.search_events
  GROUP BY (date_trunc('day'::text, created_at))
  ORDER BY (date_trunc('day'::text, created_at)) DESC;


ALTER VIEW public.search_analytics_daily_summary OWNER TO postgres;

--
-- Name: VIEW search_analytics_daily_summary; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.search_analytics_daily_summary IS 'Admin dashboard: daily search volume and zero-result rate trend.';


--
-- Name: search_analytics_top_queries; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.search_analytics_top_queries WITH (security_invoker='true') AS
 SELECT query,
    count(*) AS search_count,
    (avg(result_count))::numeric(10,1) AS avg_result_count,
    max(created_at) AS last_searched_at
   FROM public.search_events
  WHERE (created_at >= (now() - '30 days'::interval))
  GROUP BY query
  ORDER BY (count(*)) DESC;


ALTER VIEW public.search_analytics_top_queries OWNER TO postgres;

--
-- Name: VIEW search_analytics_top_queries; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.search_analytics_top_queries IS 'Admin dashboard: most-searched terms in the last 30 days, with average result count. RLS-inherited from search_events — only admin/manager roles see rows.';


--
-- Name: search_analytics_zero_result_queries; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.search_analytics_zero_result_queries WITH (security_invoker='true') AS
 SELECT query,
    count(*) AS search_count,
    max(created_at) AS last_searched_at
   FROM public.search_events
  WHERE ((result_count = 0) AND (created_at >= (now() - '30 days'::interval)))
  GROUP BY query
  ORDER BY (count(*)) DESC;


ALTER VIEW public.search_analytics_zero_result_queries OWNER TO postgres;

--
-- Name: VIEW search_analytics_zero_result_queries; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.search_analytics_zero_result_queries IS 'Admin dashboard: searches that returned nothing, most frequent first — the actionable "add a synonym / fix a typo mapping" worklist.';


--
-- Name: search_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.search_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.search_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: search_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.search_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    device_key text,
    queries text[] DEFAULT '{}'::text[] NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT search_sessions_owner_chk CHECK (((user_id IS NOT NULL) OR (device_key IS NOT NULL)))
);


ALTER TABLE public.search_sessions OWNER TO postgres;

--
-- Name: search_synonyms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.search_synonyms (
    id bigint NOT NULL,
    alias text NOT NULL,
    canonical text NOT NULL,
    alias_type text DEFAULT 'brand'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT search_synonyms_alias_type_check CHECK ((alias_type = ANY (ARRAY['brand'::text, 'generic'::text, 'category'::text, 'symptom'::text, 'typo'::text])))
);


ALTER TABLE public.search_synonyms OWNER TO postgres;

--
-- Name: TABLE search_synonyms; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.search_synonyms IS 'Admin-editable brand/generic/category/symptom synonym table powering expand_search_query(). Seeded from apps/shopper-native/src/utils/searchUtils.ts''s _RAW_AR_EN map — add new aliases here going forward, not in application code.';


--
-- Name: search_synonyms_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.search_synonyms ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.search_synonyms_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sms_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sms_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    event text NOT NULL,
    actor_id uuid,
    batch_index integer,
    detail jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sms_audit_log OWNER TO postgres;

--
-- Name: sms_campaign_recipients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sms_campaign_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    user_id uuid NOT NULL,
    phone text NOT NULL,
    full_name text DEFAULT ''::text NOT NULL,
    batch_index integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    sent_at timestamp with time zone,
    failed_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sms_campaign_recipients_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])))
);


ALTER TABLE public.sms_campaign_recipients OWNER TO postgres;

--
-- Name: sms_campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sms_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    message_template text NOT NULL,
    batch_size integer NOT NULL,
    total_recipients integer DEFAULT 0 NOT NULL,
    sent_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    rate_limit_secs integer DEFAULT 60 NOT NULL,
    created_by uuid,
    queued_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sms_campaigns_batch_size_check CHECK ((batch_size = ANY (ARRAY[100, 200]))),
    CONSTRAINT sms_campaigns_message_template_check CHECK (((char_length(TRIM(BOTH FROM message_template)) >= 5) AND (char_length(TRIM(BOTH FROM message_template)) <= 480))),
    CONSTRAINT sms_campaigns_name_check CHECK (((char_length(TRIM(BOTH FROM name)) >= 2) AND (char_length(TRIM(BOTH FROM name)) <= 200))),
    CONSTRAINT sms_campaigns_rate_limit_secs_check CHECK ((rate_limit_secs >= 10)),
    CONSTRAINT sms_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'queued'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]))),
    CONSTRAINT sms_campaigns_total_recipients_check CHECK ((total_recipients >= 0))
);


ALTER TABLE public.sms_campaigns OWNER TO postgres;

--
-- Name: special_order_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.special_order_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    product_name text NOT NULL,
    notes text,
    quantity integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    requester_name text,
    requester_phone text,
    requester_email text,
    status text DEFAULT 'submitted'::text NOT NULL,
    CONSTRAINT special_order_requests_phone_check CHECK (((requester_phone IS NULL) OR (requester_phone ~ '^01[0125][0-9]{8}$'::text))),
    CONSTRAINT special_order_requests_quantity_check CHECK (((quantity IS NULL) OR (quantity > 0))),
    CONSTRAINT special_order_requests_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'reviewing'::text, 'fulfilled'::text, 'cancelled'::text])))
);


ALTER TABLE public.special_order_requests OWNER TO postgres;

--
-- Name: special_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.special_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_name text NOT NULL,
    requester_name text NOT NULL,
    requester_phone text NOT NULL,
    requester_email text,
    notes text,
    quantity text,
    status text DEFAULT 'submitted'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT special_orders_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'reviewing'::text, 'fulfilled'::text, 'cancelled'::text])))
);


ALTER TABLE public.special_orders OWNER TO postgres;

--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id text NOT NULL,
    delta_total integer DEFAULT 0 NOT NULL,
    delta_reserved integer DEFAULT 0 NOT NULL,
    delta_committed integer DEFAULT 0 NOT NULL,
    total_after integer NOT NULL,
    reserved_after integer NOT NULL,
    committed_after integer NOT NULL,
    kind text NOT NULL,
    reservation_id uuid,
    actor_id uuid,
    idempotency_key text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_movements_committed_after_check CHECK ((committed_after >= 0)),
    CONSTRAINT stock_movements_kind_check CHECK ((kind = ANY (ARRAY['reserve'::text, 'release'::text, 'commit'::text, 'restock'::text, 'adjust'::text, 'rollback'::text, 'expire'::text]))),
    CONSTRAINT stock_movements_no_negative_after CHECK (((reserved_after + committed_after) <= total_after)),
    CONSTRAINT stock_movements_reserved_after_check CHECK ((reserved_after >= 0)),
    CONSTRAINT stock_movements_total_after_check CHECK ((total_after >= 0))
);


ALTER TABLE public.stock_movements OWNER TO postgres;

--
-- Name: user_deletion_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_deletion_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_user_id uuid NOT NULL,
    deleted_user_email text,
    deleted_user_name text,
    deleted_by uuid,
    deletion_type text DEFAULT 'admin'::text NOT NULL,
    reason text,
    admin_notes text,
    deleted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_deletion_log_deletion_type_check CHECK ((deletion_type = ANY (ARRAY['admin'::text, 'self'::text])))
);


ALTER TABLE public.user_deletion_log OWNER TO postgres;

--
-- Name: user_devices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_id text NOT NULL,
    push_token text NOT NULL,
    platform text NOT NULL,
    app_version text,
    is_active boolean DEFAULT true NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_devices_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text])))
);


ALTER TABLE public.user_devices OWNER TO postgres;

--
-- Name: user_suspensions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_suspensions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    suspended_by uuid,
    reason_codes text[] DEFAULT '{}'::text[] NOT NULL,
    admin_notes text,
    duration_type text DEFAULT 'permanent'::text NOT NULL,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    unsuspended_at timestamp with time zone,
    unsuspended_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_suspensions_duration_type_check CHECK ((duration_type = ANY (ARRAY['permanent'::text, 'temporary'::text])))
);


ALTER TABLE public.user_suspensions OWNER TO postgres;

--
-- Name: wishlist_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wishlist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id text NOT NULL,
    product_snapshot jsonb NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.wishlist_items OWNER TO postgres;

--
-- Name: Branch Branch_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Branch"
    ADD CONSTRAINT "Branch_pkey" PRIMARY KEY (id);


--
-- Name: DeliveryAssignment DeliveryAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DeliveryAssignment"
    ADD CONSTRAINT "DeliveryAssignment_pkey" PRIMARY KEY (id);


--
-- Name: DeliveryZone DeliveryZone_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DeliveryZone"
    ADD CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY (id);


--
-- Name: DriverEarning DriverEarning_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DriverEarning"
    ADD CONSTRAINT "DriverEarning_pkey" PRIMARY KEY (id);


--
-- Name: DriverLocation DriverLocation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DriverLocation"
    ADD CONSTRAINT "DriverLocation_pkey" PRIMARY KEY (id);


--
-- Name: DriverProfile DriverProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DriverProfile"
    ADD CONSTRAINT "DriverProfile_pkey" PRIMARY KEY (id);


--
-- Name: DriverSession DriverSession_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DriverSession"
    ADD CONSTRAINT "DriverSession_pkey" PRIMARY KEY (id);


--
-- Name: NotificationLog NotificationLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."NotificationLog"
    ADD CONSTRAINT "NotificationLog_pkey" PRIMARY KEY (id);


--
-- Name: NotificationToken NotificationToken_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."NotificationToken"
    ADD CONSTRAINT "NotificationToken_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);


--
-- Name: allergies allergies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allergies
    ADD CONSTRAINT allergies_pkey PRIMARY KEY (id);


--
-- Name: anti_fraud_events anti_fraud_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anti_fraud_events
    ADD CONSTRAINT anti_fraud_events_pkey PRIMARY KEY (id);


--
-- Name: cancellations cancellations_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cancellations
    ADD CONSTRAINT cancellations_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: cancellations cancellations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cancellations
    ADD CONSTRAINT cancellations_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: conditions conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conditions
    ADD CONSTRAINT conditions_pkey PRIMARY KEY (id);


--
-- Name: coupon_batches coupon_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupon_batches
    ADD CONSTRAINT coupon_batches_pkey PRIMARY KEY (id);


--
-- Name: coupon_redemptions coupon_redemptions_coupon_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupon_redemptions
    ADD CONSTRAINT coupon_redemptions_coupon_id_user_id_key UNIQUE (coupon_id, user_id);


--
-- Name: coupon_redemptions coupon_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupon_redemptions
    ADD CONSTRAINT coupon_redemptions_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: delivery_assignments delivery_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_pkey PRIMARY KEY (id);


--
-- Name: delivery_issues delivery_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_issues
    ADD CONSTRAINT delivery_issues_pkey PRIMARY KEY (id);


--
-- Name: dependents dependents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dependents
    ADD CONSTRAINT dependents_pkey PRIMARY KEY (id);


--
-- Name: dose_logs dose_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dose_logs
    ADD CONSTRAINT dose_logs_pkey PRIMARY KEY (id);


--
-- Name: driver_locations driver_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_locations
    ADD CONSTRAINT driver_locations_pkey PRIMARY KEY (id);


--
-- Name: drug_interactions drug_interactions_drug_a_drug_b_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drug_interactions
    ADD CONSTRAINT drug_interactions_drug_a_drug_b_key UNIQUE (drug_a, drug_b);


--
-- Name: drug_interactions drug_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drug_interactions
    ADD CONSTRAINT drug_interactions_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (user_id, product_id);


--
-- Name: gift_catalog gift_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_catalog
    ADD CONSTRAINT gift_catalog_pkey PRIMARY KEY (id);


--
-- Name: gift_inventory gift_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_inventory
    ADD CONSTRAINT gift_inventory_pkey PRIMARY KEY (gift_id);


--
-- Name: gift_redemptions gift_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_redemptions
    ADD CONSTRAINT gift_redemptions_pkey PRIMARY KEY (id);


--
-- Name: inbox_notifications inbox_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inbox_notifications
    ADD CONSTRAINT inbox_notifications_pkey PRIMARY KEY (id);


--
-- Name: inbox_notifications inbox_notifications_recipient_id_type_event_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inbox_notifications
    ADD CONSTRAINT inbox_notifications_recipient_id_type_event_id_key UNIQUE (recipient_id, type, event_id);


--
-- Name: insurance_cards insurance_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_cards
    ADD CONSTRAINT insurance_cards_pkey PRIMARY KEY (id);


--
-- Name: integration_events integration_events_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integration_events
    ADD CONSTRAINT integration_events_dedupe_key_key UNIQUE (dedupe_key);


--
-- Name: integration_events integration_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integration_events
    ADD CONSTRAINT integration_events_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (product_id);


--
-- Name: inventory_reservations inventory_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_pkey PRIMARY KEY (id);


--
-- Name: inventory_state inventory_state_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_state
    ADD CONSTRAINT inventory_state_pkey PRIMARY KEY (product_id);


--
-- Name: loyalty_accounts loyalty_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT loyalty_accounts_pkey PRIMARY KEY (user_id);


--
-- Name: loyalty_config loyalty_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_config
    ADD CONSTRAINT loyalty_config_pkey PRIMARY KEY (id);


--
-- Name: loyalty_ledger loyalty_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_ledger
    ADD CONSTRAINT loyalty_ledger_pkey PRIMARY KEY (id);


--
-- Name: loyalty_point_awards loyalty_point_awards_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_point_awards
    ADD CONSTRAINT loyalty_point_awards_order_id_key UNIQUE (order_id);


--
-- Name: loyalty_point_awards loyalty_point_awards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_point_awards
    ADD CONSTRAINT loyalty_point_awards_pkey PRIMARY KEY (id);


--
-- Name: loyalty_wallets loyalty_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_wallets
    ADD CONSTRAINT loyalty_wallets_pkey PRIMARY KEY (user_id);


--
-- Name: medication_reminders medication_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medication_reminders
    ADD CONSTRAINT medication_reminders_pkey PRIMARY KEY (id);


--
-- Name: notification_batches notification_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_batches
    ADD CONSTRAINT notification_batches_pkey PRIMARY KEY (id);


--
-- Name: notification_deliveries notification_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_pkey PRIMARY KEY (id);


--
-- Name: notification_delivery_attempts notification_delivery_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_delivery_attempts
    ADD CONSTRAINT notification_delivery_attempts_pkey PRIMARY KEY (id);


--
-- Name: notification_outbox notification_outbox_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: notification_outbox notification_outbox_notification_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_notification_id_key UNIQUE (notification_id);


--
-- Name: notification_outbox notification_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_pkey PRIMARY KEY (id);


--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- Name: notification_templates notification_templates_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_type_key UNIQUE (type);


--
-- Name: notification_tokens notification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_tokens
    ADD CONSTRAINT notification_tokens_pkey PRIMARY KEY (id);


--
-- Name: notification_tokens notification_tokens_user_id_expo_push_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_tokens
    ADD CONSTRAINT notification_tokens_user_id_expo_push_token_key UNIQUE (user_id, expo_push_token);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_notes order_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_notes
    ADD CONSTRAINT order_notes_pkey PRIMARY KEY (id);


--
-- Name: order_prescriptions order_prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_prescriptions
    ADD CONSTRAINT order_prescriptions_pkey PRIMARY KEY (order_id, prescription_id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);


--
-- Name: orders orders_external_ref_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_external_ref_key UNIQUE (external_ref);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: orders orders_qr_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_qr_token_key UNIQUE (qr_token);


--
-- Name: pharmacies pharmacies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pharmacies
    ADD CONSTRAINT pharmacies_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_rx_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_rx_number_key UNIQUE (rx_number);


--
-- Name: product_reviews product_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_pkey PRIMARY KEY (id);


--
-- Name: product_reviews product_reviews_product_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_product_id_user_id_key UNIQUE (product_id, user_id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_phone_key UNIQUE (phone);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: promotion_products promotion_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promotion_products
    ADD CONSTRAINT promotion_products_pkey PRIMARY KEY (promotion_id, product_id);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: referral_codes referral_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_codes
    ADD CONSTRAINT referral_codes_pkey PRIMARY KEY (user_id);


--
-- Name: referral_rewards referral_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_pkey PRIMARY KEY (id);


--
-- Name: refill_requests refill_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refill_requests
    ADD CONSTRAINT refill_requests_pkey PRIMARY KEY (id);


--
-- Name: refunds refunds_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);


--
-- Name: return_items return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_pkey PRIMARY KEY (id);


--
-- Name: return_requests return_requests_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: return_requests return_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_pkey PRIMARY KEY (id);


--
-- Name: return_timeline return_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_timeline
    ADD CONSTRAINT return_timeline_pkey PRIMARY KEY (id);


--
-- Name: review_helpful_votes review_helpful_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.review_helpful_votes
    ADD CONSTRAINT review_helpful_votes_pkey PRIMARY KEY (review_id, user_id);


--
-- Name: reward_audit_logs reward_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_audit_logs
    ADD CONSTRAINT reward_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: reward_campaigns reward_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_campaigns
    ADD CONSTRAINT reward_campaigns_pkey PRIMARY KEY (id);


--
-- Name: reward_idempotency_keys reward_idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_idempotency_keys
    ADD CONSTRAINT reward_idempotency_keys_pkey PRIMARY KEY (key);


--
-- Name: reward_rules reward_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_rules
    ADD CONSTRAINT reward_rules_pkey PRIMARY KEY (id);


--
-- Name: reward_tiers reward_tiers_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_tiers
    ADD CONSTRAINT reward_tiers_name_key UNIQUE (name);


--
-- Name: reward_tiers reward_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_tiers
    ADD CONSTRAINT reward_tiers_pkey PRIMARY KEY (id);


--
-- Name: search_events search_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.search_events
    ADD CONSTRAINT search_events_pkey PRIMARY KEY (id);


--
-- Name: search_sessions search_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.search_sessions
    ADD CONSTRAINT search_sessions_pkey PRIMARY KEY (id);


--
-- Name: search_synonyms search_synonyms_alias_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.search_synonyms
    ADD CONSTRAINT search_synonyms_alias_key UNIQUE (alias);


--
-- Name: search_synonyms search_synonyms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.search_synonyms
    ADD CONSTRAINT search_synonyms_pkey PRIMARY KEY (id);


--
-- Name: sms_audit_log sms_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_audit_log
    ADD CONSTRAINT sms_audit_log_pkey PRIMARY KEY (id);


--
-- Name: sms_campaign_recipients sms_campaign_recipients_campaign_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_campaign_recipients
    ADD CONSTRAINT sms_campaign_recipients_campaign_id_user_id_key UNIQUE (campaign_id, user_id);


--
-- Name: sms_campaign_recipients sms_campaign_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_campaign_recipients
    ADD CONSTRAINT sms_campaign_recipients_pkey PRIMARY KEY (id);


--
-- Name: sms_campaigns sms_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_campaigns
    ADD CONSTRAINT sms_campaigns_pkey PRIMARY KEY (id);


--
-- Name: special_order_requests special_order_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.special_order_requests
    ADD CONSTRAINT special_order_requests_pkey PRIMARY KEY (id);


--
-- Name: special_orders special_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.special_orders
    ADD CONSTRAINT special_orders_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: user_deletion_log user_deletion_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_deletion_log
    ADD CONSTRAINT user_deletion_log_pkey PRIMARY KEY (id);


--
-- Name: user_devices user_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_pkey PRIMARY KEY (id);


--
-- Name: user_devices user_devices_user_id_device_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_user_id_device_id_key UNIQUE (user_id, device_id);


--
-- Name: user_suspensions user_suspensions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_suspensions
    ADD CONSTRAINT user_suspensions_pkey PRIMARY KEY (id);


--
-- Name: cancellations ux_cancellations_order; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cancellations
    ADD CONSTRAINT ux_cancellations_order UNIQUE (order_id);


--
-- Name: wishlist_items wishlist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_pkey PRIMARY KEY (id);


--
-- Name: DeliveryAssignment_driverId_deliveredAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DeliveryAssignment_driverId_deliveredAt_idx" ON public."DeliveryAssignment" USING btree ("driverId", "deliveredAt" DESC);


--
-- Name: DeliveryAssignment_driverId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DeliveryAssignment_driverId_status_idx" ON public."DeliveryAssignment" USING btree ("driverId", status);


--
-- Name: DeliveryAssignment_orderId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DeliveryAssignment_orderId_idx" ON public."DeliveryAssignment" USING btree ("orderId");


--
-- Name: DeliveryAssignment_orderId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "DeliveryAssignment_orderId_key" ON public."DeliveryAssignment" USING btree ("orderId");


--
-- Name: DeliveryAssignment_status_assignedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DeliveryAssignment_status_assignedAt_idx" ON public."DeliveryAssignment" USING btree (status, "assignedAt" DESC);


--
-- Name: DeliveryZone_branchId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DeliveryZone_branchId_idx" ON public."DeliveryZone" USING btree ("branchId");


--
-- Name: DriverEarning_driverId_earnedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DriverEarning_driverId_earnedAt_idx" ON public."DriverEarning" USING btree ("driverId", "earnedAt" DESC);


--
-- Name: DriverEarning_isPaid_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DriverEarning_isPaid_idx" ON public."DriverEarning" USING btree ("isPaid");


--
-- Name: DriverLocation_driverId_timestamp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DriverLocation_driverId_timestamp_idx" ON public."DriverLocation" USING btree ("driverId", "timestamp" DESC);


--
-- Name: DriverLocation_timestamp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DriverLocation_timestamp_idx" ON public."DriverLocation" USING btree ("timestamp" DESC);


--
-- Name: DriverProfile_isOnline_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DriverProfile_isOnline_idx" ON public."DriverProfile" USING btree ("isOnline");


--
-- Name: DriverProfile_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DriverProfile_status_idx" ON public."DriverProfile" USING btree (status);


--
-- Name: DriverProfile_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DriverProfile_userId_idx" ON public."DriverProfile" USING btree ("userId");


--
-- Name: DriverProfile_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "DriverProfile_userId_key" ON public."DriverProfile" USING btree ("userId");


--
-- Name: DriverSession_driverId_startedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DriverSession_driverId_startedAt_idx" ON public."DriverSession" USING btree ("driverId", "startedAt" DESC);


--
-- Name: NotificationLog_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "NotificationLog_status_idx" ON public."NotificationLog" USING btree (status);


--
-- Name: NotificationLog_userId_sentAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "NotificationLog_userId_sentAt_idx" ON public."NotificationLog" USING btree ("userId", "sentAt" DESC);


--
-- Name: NotificationToken_token_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "NotificationToken_token_idx" ON public."NotificationToken" USING btree (token);


--
-- Name: NotificationToken_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "NotificationToken_token_key" ON public."NotificationToken" USING btree (token);


--
-- Name: NotificationToken_userId_isActive_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "NotificationToken_userId_isActive_idx" ON public."NotificationToken" USING btree ("userId", "isActive");


--
-- Name: addresses_user_default_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX addresses_user_default_idx ON public.addresses USING btree (user_id, is_default DESC);


--
-- Name: addresses_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX addresses_user_id_idx ON public.addresses USING btree (user_id);


--
-- Name: allergies_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX allergies_user_idx ON public.allergies USING btree (user_id);


--
-- Name: anti_fraud_severity_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX anti_fraud_severity_idx ON public.anti_fraud_events USING btree (severity, detected_at DESC);


--
-- Name: anti_fraud_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX anti_fraud_user_idx ON public.anti_fraud_events USING btree (user_id, detected_at DESC);


--
-- Name: cart_items_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cart_items_user_idx ON public.cart_items USING btree (user_id, updated_at DESC);


--
-- Name: cart_items_user_product_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX cart_items_user_product_uniq ON public.cart_items USING btree (user_id, product_id);


--
-- Name: conditions_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX conditions_user_idx ON public.conditions USING btree (user_id);


--
-- Name: coupon_batches_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX coupon_batches_active_idx ON public.coupon_batches USING btree (is_active, expires_at) WHERE (is_active = true);


--
-- Name: coupon_batches_campaign_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX coupon_batches_campaign_idx ON public.coupon_batches USING btree (campaign_id);


--
-- Name: coupon_redemptions_coupon_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX coupon_redemptions_coupon_idx ON public.coupon_redemptions USING btree (coupon_id);


--
-- Name: coupon_redemptions_order_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX coupon_redemptions_order_idx ON public.coupon_redemptions USING btree (order_id);


--
-- Name: coupon_redemptions_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX coupon_redemptions_user_idx ON public.coupon_redemptions USING btree (user_id, redeemed_at DESC);


--
-- Name: coupons_batch_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX coupons_batch_idx ON public.coupons USING btree (batch_id);


--
-- Name: coupons_code_upper_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX coupons_code_upper_idx ON public.coupons USING btree (upper(TRIM(BOTH FROM code)));


--
-- Name: delivery_assignments_driver_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX delivery_assignments_driver_idx ON public.delivery_assignments USING btree (driver_id, response_status, offered_at DESC);


--
-- Name: delivery_assignments_order_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX delivery_assignments_order_idx ON public.delivery_assignments USING btree (order_id, created_at DESC);


--
-- Name: delivery_issues_driver_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX delivery_issues_driver_idx ON public.delivery_issues USING btree (driver_id, created_at DESC);


--
-- Name: delivery_issues_order_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX delivery_issues_order_idx ON public.delivery_issues USING btree (order_id, created_at DESC);


--
-- Name: delivery_issues_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX delivery_issues_status_idx ON public.delivery_issues USING btree (status, created_at DESC);


--
-- Name: dependents_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX dependents_user_idx ON public.dependents USING btree (user_id);


--
-- Name: dose_logs_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX dose_logs_user_idx ON public.dose_logs USING btree (user_id, taken_at DESC);


--
-- Name: driver_locations_driver_captured_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX driver_locations_driver_captured_idx ON public.driver_locations USING btree (driver_id, captured_at DESC);


--
-- Name: driver_locations_order_captured_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX driver_locations_order_captured_idx ON public.driver_locations USING btree (order_id, captured_at DESC);


--
-- Name: favorites_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX favorites_user_id_idx ON public.favorites USING btree (user_id);


--
-- Name: gift_catalog_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX gift_catalog_active_idx ON public.gift_catalog USING btree (is_active) WHERE (is_active = true);


--
-- Name: gift_catalog_cost_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX gift_catalog_cost_idx ON public.gift_catalog USING btree (points_cost) WHERE (is_active = true);


--
-- Name: gift_redemptions_pending_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX gift_redemptions_pending_idx ON public.gift_redemptions USING btree (state, expires_at) WHERE (state = 'reserved'::text);


--
-- Name: gift_redemptions_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX gift_redemptions_user_idx ON public.gift_redemptions USING btree (user_id, reserved_at DESC);


--
-- Name: idx_addresses_user_default; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_addresses_user_default ON public.addresses USING btree (user_id) WHERE is_default;


--
-- Name: idx_addresses_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_addresses_user_id ON public.addresses USING btree (user_id);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_order_prescriptions_prescription; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_prescriptions_prescription ON public.order_prescriptions USING btree (prescription_id);


--
-- Name: idx_order_status_history_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_status_history_order_id ON public.order_status_history USING btree (order_id);


--
-- Name: idx_orders_assigned_driver; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_assigned_driver ON public.orders USING btree (assigned_driver_id) WHERE (assigned_driver_id IS NOT NULL);


--
-- Name: idx_orders_branch_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_branch_id ON public.orders USING btree (branch_id) WHERE (branch_id IS NOT NULL);


--
-- Name: idx_orders_zone_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_zone_id ON public.orders USING btree (zone_id) WHERE (zone_id IS NOT NULL);


--
-- Name: idx_products_active_price; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_active_price ON public.products USING btree ("Price") WHERE (is_active = true);


--
-- Name: idx_products_active_recent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_active_recent ON public.products USING btree (id DESC) WHERE (is_active = true);


--
-- Name: idx_products_barcode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_barcode ON public.products USING btree ("Barcode") WHERE ("Barcode" IS NOT NULL);


--
-- Name: idx_products_barcode_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_barcode_trgm ON public.products USING gin ("Barcode" public.gin_trgm_ops);


--
-- Name: idx_products_browse_default; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_browse_default ON public.products USING btree (is_active DESC, "Name_En");


--
-- Name: idx_products_category_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_category_name ON public.products USING btree ("Category_Name");


--
-- Name: idx_products_code_lower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_code_lower ON public.products USING btree (lower("Code"));


--
-- Name: idx_products_code_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_code_trgm ON public.products USING gin ("Code" public.gin_trgm_ops);


--
-- Name: idx_products_embedding_hnsw; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_embedding_hnsw ON public.products USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: idx_products_is_offer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_is_offer ON public.products USING btree (is_offer) WHERE (is_offer = true);


--
-- Name: idx_products_is_sale; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_is_sale ON public.products USING btree (is_sale) WHERE (is_sale = true);


--
-- Name: idx_products_listing; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_listing ON public.products USING btree ("Category_Name", is_active, "Stock", "Price");


--
-- Name: idx_products_name_ar_gist; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_name_ar_gist ON public.products USING gist ("Name_Ar" public.gist_trgm_ops);


--
-- Name: idx_products_name_ar_norm_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_name_ar_norm_trgm ON public.products USING gist (public.normalize_arabic("Name_Ar") public.gist_trgm_ops);


--
-- Name: idx_products_name_ar_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_name_ar_trgm ON public.products USING gin ("Name_Ar" public.gin_trgm_ops);


--
-- Name: idx_products_name_en_gist; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_name_en_gist ON public.products USING gist ("Name_En" public.gist_trgm_ops);


--
-- Name: idx_products_name_en_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_name_en_trgm ON public.products USING gin ("Name_En" public.gin_trgm_ops);


--
-- Name: idx_products_price; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_price ON public.products USING btree ("Price") WHERE (is_active = true);


--
-- Name: idx_products_requires_prescription; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_requires_prescription ON public.products USING btree (requires_prescription) WHERE requires_prescription;


--
-- Name: idx_products_search_doc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_search_doc ON public.products USING gin (search_doc);


--
-- Name: idx_products_search_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_search_trgm ON public.products USING gin (search_blob public.gin_trgm_ops);


--
-- Name: idx_products_search_vector; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_search_vector ON public.products USING gin (search_vector);


--
-- Name: idx_refunds_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_refunds_order_id ON public.refunds USING btree (order_id);


--
-- Name: idx_search_sessions_device; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_search_sessions_device ON public.search_sessions USING btree (device_key) WHERE (device_key IS NOT NULL);


--
-- Name: idx_search_sessions_recent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_search_sessions_recent ON public.search_sessions USING btree (updated_at DESC);


--
-- Name: idx_search_sessions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_search_sessions_user ON public.search_sessions USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_search_synonyms_alias_norm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_search_synonyms_alias_norm ON public.search_synonyms USING btree (lower(public.normalize_arabic(public.immutable_unaccent(alias)))) WHERE is_active;


--
-- Name: inbox_notifications_recipient_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inbox_notifications_recipient_idx ON public.inbox_notifications USING btree (recipient_id, created_at DESC);


--
-- Name: insurance_one_primary; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX insurance_one_primary ON public.insurance_cards USING btree (user_id) WHERE (is_primary = true);


--
-- Name: integration_events_aggregate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX integration_events_aggregate_idx ON public.integration_events USING btree (aggregate_type, aggregate_id, occurred_at DESC);


--
-- Name: integration_events_event_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX integration_events_event_type_idx ON public.integration_events USING btree (event_type, occurred_at DESC);


--
-- Name: integration_events_occurred_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX integration_events_occurred_at_idx ON public.integration_events USING btree (occurred_at DESC);


--
-- Name: integration_events_processed_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX integration_events_processed_idx ON public.integration_events USING btree (processed_at, occurred_at DESC);


--
-- Name: interactions_drug_b_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX interactions_drug_b_idx ON public.drug_interactions USING btree (drug_b);


--
-- Name: interactions_drug_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX interactions_drug_idx ON public.drug_interactions USING btree (drug_a);


--
-- Name: inventory_reservations_expire_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_reservations_expire_idx ON public.inventory_reservations USING btree (expires_at) WHERE (state = 'reserved'::text);


--
-- Name: inventory_reservations_idem_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX inventory_reservations_idem_uniq ON public.inventory_reservations USING btree (idempotency_key);


--
-- Name: inventory_reservations_order_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_reservations_order_idx ON public.inventory_reservations USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- Name: inventory_reservations_product_state_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_reservations_product_state_idx ON public.inventory_reservations USING btree (product_id, state);


--
-- Name: inventory_reservations_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_reservations_user_idx ON public.inventory_reservations USING btree (user_id, reserved_at DESC);


--
-- Name: inventory_state_low_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_state_low_idx ON public.inventory_state USING btree ((((total - reserved) - committed)));


--
-- Name: loyalty_ledger_idempotency_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX loyalty_ledger_idempotency_uniq ON public.loyalty_ledger USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: loyalty_ledger_reversal_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX loyalty_ledger_reversal_uniq ON public.loyalty_ledger USING btree (parent_ledger_id) WHERE (parent_ledger_id IS NOT NULL);


--
-- Name: loyalty_ledger_source_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX loyalty_ledger_source_idx ON public.loyalty_ledger USING btree (source, source_ref);


--
-- Name: loyalty_ledger_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX loyalty_ledger_user_idx ON public.loyalty_ledger USING btree (user_id, created_at DESC);


--
-- Name: loyalty_ledger_user_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX loyalty_ledger_user_time_idx ON public.loyalty_ledger USING btree (user_id, created_at DESC);


--
-- Name: loyalty_point_awards_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX loyalty_point_awards_user_idx ON public.loyalty_point_awards USING btree (user_id, awarded_at DESC);


--
-- Name: notification_deliveries_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notification_deliveries_status_idx ON public.notification_deliveries USING btree (status);


--
-- Name: notification_delivery_attempts_ticket_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX notification_delivery_attempts_ticket_idx ON public.notification_delivery_attempts USING btree (expo_ticket_id) WHERE (expo_ticket_id IS NOT NULL);


--
-- Name: notification_outbox_claim_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notification_outbox_claim_idx ON public.notification_outbox USING btree (next_attempt_at, created_at) WHERE (status = ANY (ARRAY['queued'::text, 'retrying'::text]));


--
-- Name: notification_tokens_active_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notification_tokens_active_user_idx ON public.notification_tokens USING btree (user_id) WHERE (invalidated_at IS NULL);


--
-- Name: notification_tokens_expo_push_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX notification_tokens_expo_push_token_key ON public.notification_tokens USING btree (expo_push_token);


--
-- Name: notification_tokens_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notification_tokens_user_idx ON public.notification_tokens USING btree (user_id);


--
-- Name: notifications_user_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notifications_user_created_idx ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: notifications_user_event_key_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX notifications_user_event_key_idx ON public.notifications USING btree (user_id, event_key) WHERE (event_key IS NOT NULL);


--
-- Name: notifications_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notifications_user_id_idx ON public.notifications USING btree (user_id);


--
-- Name: notifications_user_unread_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notifications_user_unread_idx ON public.notifications USING btree (user_id) WHERE (is_read = false);


--
-- Name: order_items_order_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX order_items_order_id_idx ON public.order_items USING btree (order_id);


--
-- Name: order_notes_order_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX order_notes_order_idx ON public.order_notes USING btree (order_id, created_at DESC);


--
-- Name: orders_assigned_driver_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX orders_assigned_driver_id_idx ON public.orders USING btree (assigned_driver_id);


--
-- Name: orders_assigned_driver_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX orders_assigned_driver_status_idx ON public.orders USING btree (assigned_driver_id, status);


--
-- Name: orders_payment_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX orders_payment_status_idx ON public.orders USING btree (payment_status, created_at DESC) WHERE (payment_status = 'pending_verification'::text);


--
-- Name: orders_status_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX orders_status_created_at_idx ON public.orders USING btree (status, created_at DESC);


--
-- Name: orders_status_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX orders_status_created_idx ON public.orders USING btree (status, created_at DESC);


--
-- Name: orders_user_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX orders_user_created_idx ON public.orders USING btree (user_id, created_at DESC);


--
-- Name: orders_user_idempotency_key_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX orders_user_idempotency_key_idx ON public.orders USING btree (user_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: orders_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX orders_user_idx ON public.orders USING btree (user_id, created_at DESC);


--
-- Name: pharmacies_geo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX pharmacies_geo_idx ON public.pharmacies USING btree (lat, lng);


--
-- Name: prescriptions_review_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX prescriptions_review_status_idx ON public.prescriptions USING btree (review_status, added_at DESC);


--
-- Name: prescriptions_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX prescriptions_status_idx ON public.prescriptions USING btree (user_id, status);


--
-- Name: prescriptions_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX prescriptions_user_idx ON public.prescriptions USING btree (user_id);


--
-- Name: product_is_bestseller_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_is_bestseller_idx ON public.products USING btree (is_bestseller) WHERE (is_bestseller = true);


--
-- Name: product_is_new_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_is_new_idx ON public.products USING btree (is_new) WHERE (is_new = true);


--
-- Name: product_is_sale_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_is_sale_idx ON public.products USING btree (is_sale) WHERE (is_sale = true);


--
-- Name: product_reviews_product_helpful_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_reviews_product_helpful_idx ON public.product_reviews USING btree (product_id, helpful_count DESC, created_at DESC);


--
-- Name: product_reviews_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_reviews_product_id_idx ON public.product_reviews USING btree (product_id);


--
-- Name: product_reviews_product_rating_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_reviews_product_rating_idx ON public.product_reviews USING btree (product_id, rating DESC, helpful_count DESC);


--
-- Name: product_reviews_product_recent_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_reviews_product_recent_idx ON public.product_reviews USING btree (product_id, created_at DESC);


--
-- Name: product_reviews_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_reviews_user_idx ON public.product_reviews USING btree (user_id);


--
-- Name: products_barcode_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_barcode_active_idx ON public.products USING btree ("Barcode") WHERE (is_active = true);


--
-- Name: products_barcode_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_barcode_trgm ON public.products USING gin ("Barcode" public.gin_trgm_ops);


--
-- Name: products_barcode_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_barcode_trgm_idx ON public.products USING gin (lower("Barcode") public.gin_trgm_ops);


--
-- Name: products_cat_id_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_cat_id_active_idx ON public.products USING btree ("Category_Name", id DESC) WHERE (is_active = true);


--
-- Name: products_cat_price_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_cat_price_active_idx ON public.products USING btree ("Category_Name", "Price") WHERE (is_active = true);


--
-- Name: products_category_name_en_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_category_name_en_idx ON public.products USING btree (lower("Category_Name_En"));


--
-- Name: products_category_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_category_name_idx ON public.products USING btree (lower("Category_Name"));


--
-- Name: products_code_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_code_active_idx ON public.products USING btree ("Code") WHERE (is_active = true);


--
-- Name: products_code_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_code_trgm ON public.products USING gin ("Code" public.gin_trgm_ops);


--
-- Name: products_code_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_code_trgm_idx ON public.products USING gin (lower("Code") public.gin_trgm_ops);


--
-- Name: products_default_sort_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_default_sort_idx ON public.products USING btree (is_active DESC, "Name_En");


--
-- Name: products_in_stock_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_in_stock_id_idx ON public.products USING btree (id DESC) WHERE ((is_active = true) AND ("Stock" > (0)::numeric));


--
-- Name: products_is_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_is_active_idx ON public.products USING btree (is_active);


--
-- Name: products_name_ar_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_name_ar_trgm ON public.products USING gin ("Name_Ar" public.gin_trgm_ops);


--
-- Name: products_name_ar_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_name_ar_trgm_idx ON public.products USING gin (lower("Name_Ar") public.gin_trgm_ops);


--
-- Name: products_name_en_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_name_en_trgm ON public.products USING gin ("Name_En" public.gin_trgm_ops);


--
-- Name: products_name_en_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_name_en_trgm_idx ON public.products USING gin (lower("Name_En") public.gin_trgm_ops);


--
-- Name: products_name_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_name_trgm ON public.products USING gin ("Name" public.gin_trgm_ops);


--
-- Name: products_price_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_price_idx ON public.products USING btree ("Price");


--
-- Name: products_search_vector_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_search_vector_gin ON public.products USING gin (search_vector);


--
-- Name: profiles_marketing_consent_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX profiles_marketing_consent_idx ON public.profiles USING btree (marketing_consent) WHERE (marketing_consent = true);


--
-- Name: promotion_products_product_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX promotion_products_product_idx ON public.promotion_products USING btree (product_id);


--
-- Name: promotions_active_window_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX promotions_active_window_idx ON public.promotions USING btree (starts_at, ends_at) WHERE (is_enabled = true);


--
-- Name: promotions_status_window_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX promotions_status_window_idx ON public.promotions USING btree (status, starts_at, ends_at);


--
-- Name: referral_codes_code_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX referral_codes_code_uniq ON public.referral_codes USING btree (code);


--
-- Name: referral_rewards_referee_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX referral_rewards_referee_uniq ON public.referral_rewards USING btree (referee_id);


--
-- Name: referral_rewards_referrer_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX referral_rewards_referrer_idx ON public.referral_rewards USING btree (referrer_id, created_at DESC);


--
-- Name: refill_requests_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX refill_requests_status_idx ON public.refill_requests USING btree (status);


--
-- Name: refill_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX refill_user_idx ON public.refill_requests USING btree (user_id, placed_at DESC);


--
-- Name: reminders_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reminders_user_idx ON public.medication_reminders USING btree (user_id, enabled);


--
-- Name: review_helpful_votes_review_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX review_helpful_votes_review_idx ON public.review_helpful_votes USING btree (review_id);


--
-- Name: reward_audit_logs_kind_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reward_audit_logs_kind_idx ON public.reward_audit_logs USING btree (event_kind, event_at DESC);


--
-- Name: reward_audit_logs_subject_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reward_audit_logs_subject_idx ON public.reward_audit_logs USING btree (subject_user_id, event_at DESC);


--
-- Name: reward_campaigns_window_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reward_campaigns_window_idx ON public.reward_campaigns USING btree (starts_at, ends_at) WHERE (is_active = true);


--
-- Name: reward_idempotency_expiry_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reward_idempotency_expiry_idx ON public.reward_idempotency_keys USING btree (expires_at);


--
-- Name: reward_rules_campaign_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reward_rules_campaign_idx ON public.reward_rules USING btree (campaign_id);


--
-- Name: reward_tiers_threshold_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reward_tiers_threshold_idx ON public.reward_tiers USING btree (min_lifetime_points);


--
-- Name: search_events_query_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX search_events_query_idx ON public.search_events USING btree (query, created_at DESC) WHERE (char_length(query) >= 2);


--
-- Name: search_events_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX search_events_user_idx ON public.search_events USING btree (user_id, created_at DESC) WHERE (user_id IS NOT NULL);


--
-- Name: sms_audit_log_campaign_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sms_audit_log_campaign_idx ON public.sms_audit_log USING btree (campaign_id, created_at DESC);


--
-- Name: sms_campaigns_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sms_campaigns_status_idx ON public.sms_campaigns USING btree (status, created_at DESC);


--
-- Name: sms_recipients_campaign_batch_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sms_recipients_campaign_batch_idx ON public.sms_campaign_recipients USING btree (campaign_id, batch_index, id);


--
-- Name: sms_recipients_campaign_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sms_recipients_campaign_status_idx ON public.sms_campaign_recipients USING btree (campaign_id, status, batch_index);


--
-- Name: special_order_requests_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX special_order_requests_created_at_idx ON public.special_order_requests USING btree (created_at DESC);


--
-- Name: stock_movements_kind_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_movements_kind_idx ON public.stock_movements USING btree (kind, created_at DESC);


--
-- Name: stock_movements_product_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_movements_product_time_idx ON public.stock_movements USING btree (product_id, created_at DESC);


--
-- Name: stock_movements_reservation_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_movements_reservation_idx ON public.stock_movements USING btree (reservation_id) WHERE (reservation_id IS NOT NULL);


--
-- Name: uq_addresses_one_default_per_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_addresses_one_default_per_user ON public.addresses USING btree (user_id) WHERE is_default;


--
-- Name: uq_inventory_reservations_idempotency_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_inventory_reservations_idempotency_key ON public.inventory_reservations USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: uq_orders_idempotency_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_orders_idempotency_key ON public.orders USING btree (user_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: uq_search_sessions_device; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_search_sessions_device ON public.search_sessions USING btree (device_key) WHERE ((user_id IS NULL) AND (device_key IS NOT NULL));


--
-- Name: uq_search_sessions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_search_sessions_user ON public.search_sessions USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: user_devices_user_id_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_devices_user_id_active_idx ON public.user_devices USING btree (user_id) WHERE (is_active = true);


--
-- Name: user_suspensions_user_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_suspensions_user_active_idx ON public.user_suspensions USING btree (user_id, is_active);


--
-- Name: user_suspensions_user_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_suspensions_user_created_idx ON public.user_suspensions USING btree (user_id, created_at DESC);


--
-- Name: wishlist_items_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX wishlist_items_user_idx ON public.wishlist_items USING btree (user_id, added_at DESC);


--
-- Name: wishlist_items_user_product_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX wishlist_items_user_product_uniq ON public.wishlist_items USING btree (user_id, product_id);


--
-- Name: addresses addresses_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER addresses_updated_at BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: DriverProfile driver_profile_sync_role_trg; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER driver_profile_sync_role_trg AFTER INSERT OR UPDATE OF status ON public."DriverProfile" FOR EACH ROW EXECUTE FUNCTION public.sync_role_on_driver_approval();


--
-- Name: return_requests handle_updated_at_return_requests; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER handle_updated_at_return_requests BEFORE UPDATE ON public.return_requests FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');


--
-- Name: inventory_state inventory_state_touch_trg; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER inventory_state_touch_trg BEFORE UPDATE ON public.inventory_state FOR EACH ROW EXECUTE FUNCTION public.inventory_state_touch();


--
-- Name: loyalty_accounts loyalty_accounts_touch_trg; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER loyalty_accounts_touch_trg BEFORE UPDATE ON public.loyalty_accounts FOR EACH ROW EXECUTE FUNCTION public.loyalty_accounts_touch();


--
-- Name: prescriptions prescriptions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER prescriptions_updated_at BEFORE UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: product_reviews product_reviews_touch_updated; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER product_reviews_touch_updated BEFORE UPDATE ON public.product_reviews FOR EACH ROW EXECUTE FUNCTION public.touch_review_updated_at();


--
-- Name: products products_search_vector_trg; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER products_search_vector_trg BEFORE INSERT OR UPDATE OF "Name", "Name_Ar", "Name_En", "Code", "Barcode", "Category_Name", "Category_Name_En" ON public.products FOR EACH ROW EXECUTE FUNCTION public.products_search_vector_update();


--
-- Name: profiles profiles_ensure_driver_profile_trg; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER profiles_ensure_driver_profile_trg AFTER INSERT OR UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.ensure_driver_profile();


--
-- Name: profiles profiles_guard_role_status_trg; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER profiles_guard_role_status_trg BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_role_status();


--
-- Name: review_helpful_votes review_helpful_votes_sync_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER review_helpful_votes_sync_count AFTER INSERT OR DELETE ON public.review_helpful_votes FOR EACH ROW EXECUTE FUNCTION public.sync_review_helpful_count();


--
-- Name: special_orders set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.special_orders FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: addresses trg_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_addresses_updated_at BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION public.addresses_set_updated_at();


--
-- Name: orders trg_award_loyalty_on_payment_verified; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_award_loyalty_on_payment_verified AFTER UPDATE OF payment_status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.fn_award_loyalty_points_on_payment_verified();


--
-- Name: orders trg_post_driver_earning_on_delivery; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_post_driver_earning_on_delivery AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.post_driver_earning_on_delivery();


--
-- Name: products trg_products_invalidate_embedding; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_products_invalidate_embedding BEFORE UPDATE OF "Name_Ar", "Name_En", "Category_Name", "Category_Name_En" ON public.products FOR EACH ROW EXECUTE FUNCTION public.products_invalidate_embedding();


--
-- Name: search_synonyms trg_search_synonyms_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_search_synonyms_updated_at BEFORE UPDATE ON public.search_synonyms FOR EACH ROW EXECUTE FUNCTION public.touch_search_synonyms_updated_at();


--
-- Name: delivery_assignments trg_supersede_prior_delivery_assignments; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_supersede_prior_delivery_assignments AFTER INSERT ON public.delivery_assignments FOR EACH ROW EXECUTE FUNCTION public.supersede_prior_delivery_assignments();


--
-- Name: inventory_state trg_sync_product_stock; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_product_stock AFTER INSERT OR UPDATE OF total, reserved, committed ON public.inventory_state FOR EACH ROW EXECUTE FUNCTION public.fn_sync_product_stock();


--
-- Name: orders trigger_log_order_status_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_log_order_status_change AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();


--
-- Name: DeliveryAssignment DeliveryAssignment_driverId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DeliveryAssignment"
    ADD CONSTRAINT "DeliveryAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES public."DriverProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DeliveryAssignment DeliveryAssignment_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DeliveryAssignment"
    ADD CONSTRAINT "DeliveryAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DeliveryZone DeliveryZone_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DeliveryZone"
    ADD CONSTRAINT "DeliveryZone_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DriverEarning DriverEarning_driverId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DriverEarning"
    ADD CONSTRAINT "DriverEarning_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES public."DriverProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DriverLocation DriverLocation_driverId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DriverLocation"
    ADD CONSTRAINT "DriverLocation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES public."DriverProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DriverProfile DriverProfile_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DriverProfile"
    ADD CONSTRAINT "DriverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DriverSession DriverSession_driverId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DriverSession"
    ADD CONSTRAINT "DriverSession_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES public."DriverProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NotificationToken NotificationToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."NotificationToken"
    ADD CONSTRAINT "NotificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: addresses addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: admin_audit_log admin_audit_log_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: allergies allergies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allergies
    ADD CONSTRAINT allergies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: anti_fraud_events anti_fraud_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anti_fraud_events
    ADD CONSTRAINT anti_fraud_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: cancellations cancellations_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cancellations
    ADD CONSTRAINT cancellations_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);


--
-- Name: cancellations cancellations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cancellations
    ADD CONSTRAINT cancellations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: conditions conditions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conditions
    ADD CONSTRAINT conditions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: coupon_batches coupon_batches_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupon_batches
    ADD CONSTRAINT coupon_batches_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.reward_campaigns(id) ON DELETE SET NULL;


--
-- Name: coupon_batches coupon_batches_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupon_batches
    ADD CONSTRAINT coupon_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: coupon_redemptions coupon_redemptions_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupon_redemptions
    ADD CONSTRAINT coupon_redemptions_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE RESTRICT;


--
-- Name: coupon_redemptions coupon_redemptions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupon_redemptions
    ADD CONSTRAINT coupon_redemptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: coupon_redemptions coupon_redemptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupon_redemptions
    ADD CONSTRAINT coupon_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: coupons coupons_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.coupon_batches(id) ON DELETE SET NULL;


--
-- Name: coupons coupons_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: delivery_assignments delivery_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: delivery_assignments delivery_assignments_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: delivery_assignments delivery_assignments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: delivery_issues delivery_issues_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_issues
    ADD CONSTRAINT delivery_issues_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: delivery_issues delivery_issues_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_issues
    ADD CONSTRAINT delivery_issues_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: delivery_issues delivery_issues_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_issues
    ADD CONSTRAINT delivery_issues_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: dependents dependents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dependents
    ADD CONSTRAINT dependents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: dose_logs dose_logs_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dose_logs
    ADD CONSTRAINT dose_logs_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;


--
-- Name: dose_logs dose_logs_reminder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dose_logs
    ADD CONSTRAINT dose_logs_reminder_id_fkey FOREIGN KEY (reminder_id) REFERENCES public.medication_reminders(id) ON DELETE SET NULL;


--
-- Name: dose_logs dose_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dose_logs
    ADD CONSTRAINT dose_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: driver_locations driver_locations_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_locations
    ADD CONSTRAINT driver_locations_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES auth.users(id);


--
-- Name: driver_locations driver_locations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_locations
    ADD CONSTRAINT driver_locations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: gift_inventory gift_inventory_gift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_inventory
    ADD CONSTRAINT gift_inventory_gift_id_fkey FOREIGN KEY (gift_id) REFERENCES public.gift_catalog(id) ON DELETE CASCADE;


--
-- Name: gift_redemptions gift_redemptions_gift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_redemptions
    ADD CONSTRAINT gift_redemptions_gift_id_fkey FOREIGN KEY (gift_id) REFERENCES public.gift_catalog(id);


--
-- Name: gift_redemptions gift_redemptions_ledger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_redemptions
    ADD CONSTRAINT gift_redemptions_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES public.loyalty_ledger(id);


--
-- Name: gift_redemptions gift_redemptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_redemptions
    ADD CONSTRAINT gift_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: inbox_notifications inbox_notifications_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inbox_notifications
    ADD CONSTRAINT inbox_notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: inbox_notifications inbox_notifications_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inbox_notifications
    ADD CONSTRAINT inbox_notifications_type_fkey FOREIGN KEY (type) REFERENCES public.notification_templates(type) ON DELETE RESTRICT;


--
-- Name: insurance_cards insurance_cards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.insurance_cards
    ADD CONSTRAINT insurance_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: inventory inventory_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: inventory_reservations inventory_reservations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: inventory_reservations inventory_reservations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: loyalty_accounts loyalty_accounts_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT loyalty_accounts_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.reward_tiers(id);


--
-- Name: loyalty_accounts loyalty_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT loyalty_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: loyalty_ledger loyalty_ledger_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_ledger
    ADD CONSTRAINT loyalty_ledger_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: loyalty_ledger loyalty_ledger_parent_ledger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_ledger
    ADD CONSTRAINT loyalty_ledger_parent_ledger_id_fkey FOREIGN KEY (parent_ledger_id) REFERENCES public.loyalty_ledger(id);


--
-- Name: loyalty_ledger loyalty_ledger_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_ledger
    ADD CONSTRAINT loyalty_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: loyalty_point_awards loyalty_point_awards_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_point_awards
    ADD CONSTRAINT loyalty_point_awards_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: loyalty_wallets loyalty_wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_wallets
    ADD CONSTRAINT loyalty_wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: medication_reminders medication_reminders_dependent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medication_reminders
    ADD CONSTRAINT medication_reminders_dependent_id_fkey FOREIGN KEY (dependent_id) REFERENCES public.dependents(id) ON DELETE SET NULL;


--
-- Name: medication_reminders medication_reminders_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medication_reminders
    ADD CONSTRAINT medication_reminders_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;


--
-- Name: medication_reminders medication_reminders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medication_reminders
    ADD CONSTRAINT medication_reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notification_batches notification_batches_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_batches
    ADD CONSTRAINT notification_batches_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id);


--
-- Name: notification_batches notification_batches_template_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_batches
    ADD CONSTRAINT notification_batches_template_type_fkey FOREIGN KEY (template_type) REFERENCES public.notification_templates(type);


--
-- Name: notification_deliveries notification_deliveries_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.user_devices(id) ON DELETE SET NULL;


--
-- Name: notification_deliveries notification_deliveries_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.inbox_notifications(id) ON DELETE SET NULL;


--
-- Name: notification_deliveries notification_deliveries_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notification_delivery_attempts notification_delivery_attempts_outbox_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_delivery_attempts
    ADD CONSTRAINT notification_delivery_attempts_outbox_id_fkey FOREIGN KEY (outbox_id) REFERENCES public.notification_outbox(id) ON DELETE CASCADE;


--
-- Name: notification_delivery_attempts notification_delivery_attempts_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_delivery_attempts
    ADD CONSTRAINT notification_delivery_attempts_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.notification_tokens(id) ON DELETE SET NULL;


--
-- Name: notification_outbox notification_outbox_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;


--
-- Name: notification_outbox notification_outbox_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notification_tokens notification_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_tokens
    ADD CONSTRAINT notification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_notes order_notes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_notes
    ADD CONSTRAINT order_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: order_notes order_notes_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_notes
    ADD CONSTRAINT order_notes_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_prescriptions order_prescriptions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_prescriptions
    ADD CONSTRAINT order_prescriptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_prescriptions order_prescriptions_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_prescriptions
    ADD CONSTRAINT order_prescriptions_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;


--
-- Name: order_status_history order_status_history_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);


--
-- Name: order_status_history order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_assigned_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_assigned_driver_id_fkey FOREIGN KEY (assigned_driver_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: orders orders_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public."Branch"(id);


--
-- Name: orders orders_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES auth.users(id);


--
-- Name: orders orders_claimed_by_pharmacist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_claimed_by_pharmacist_id_fkey FOREIGN KEY (claimed_by_pharmacist_id) REFERENCES public.profiles(id);


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: orders orders_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public."DeliveryZone"(id);


--
-- Name: prescriptions prescriptions_dependent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_dependent_id_fkey FOREIGN KEY (dependent_id) REFERENCES public.dependents(id) ON DELETE SET NULL;


--
-- Name: prescriptions prescriptions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: prescriptions prescriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_user_id_profiles_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: product_reviews product_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public."Branch"(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: promotion_products promotion_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promotion_products
    ADD CONSTRAINT promotion_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: promotion_products promotion_products_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promotion_products
    ADD CONSTRAINT promotion_products_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE CASCADE;


--
-- Name: promotions promotions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: referral_codes referral_codes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_codes
    ADD CONSTRAINT referral_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: referral_rewards referral_rewards_ledger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES public.loyalty_ledger(id);


--
-- Name: referral_rewards referral_rewards_referee_first_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_referee_first_order_id_fkey FOREIGN KEY (referee_first_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: referral_rewards referral_rewards_referee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_referee_id_fkey FOREIGN KEY (referee_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: referral_rewards referral_rewards_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: refill_requests refill_requests_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refill_requests
    ADD CONSTRAINT refill_requests_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES public.pharmacies(id);


--
-- Name: refill_requests refill_requests_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refill_requests
    ADD CONSTRAINT refill_requests_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;


--
-- Name: refill_requests refill_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refill_requests
    ADD CONSTRAINT refill_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: refill_requests refill_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refill_requests
    ADD CONSTRAINT refill_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refunds refunds_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: refunds refunds_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: return_items return_items_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE;


--
-- Name: return_items return_items_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.return_requests(id) ON DELETE CASCADE;


--
-- Name: return_requests return_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: return_requests return_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: return_timeline return_timeline_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_timeline
    ADD CONSTRAINT return_timeline_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: return_timeline return_timeline_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_timeline
    ADD CONSTRAINT return_timeline_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.return_requests(id) ON DELETE CASCADE;


--
-- Name: review_helpful_votes review_helpful_votes_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.review_helpful_votes
    ADD CONSTRAINT review_helpful_votes_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.product_reviews(id) ON DELETE CASCADE;


--
-- Name: review_helpful_votes review_helpful_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.review_helpful_votes
    ADD CONSTRAINT review_helpful_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reward_audit_logs reward_audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_audit_logs
    ADD CONSTRAINT reward_audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: reward_audit_logs reward_audit_logs_subject_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_audit_logs
    ADD CONSTRAINT reward_audit_logs_subject_user_id_fkey FOREIGN KEY (subject_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: reward_campaigns reward_campaigns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_campaigns
    ADD CONSTRAINT reward_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: reward_rules reward_rules_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_rules
    ADD CONSTRAINT reward_rules_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.reward_campaigns(id) ON DELETE CASCADE;


--
-- Name: search_events search_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.search_events
    ADD CONSTRAINT search_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: search_sessions search_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.search_sessions
    ADD CONSTRAINT search_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sms_audit_log sms_audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_audit_log
    ADD CONSTRAINT sms_audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: sms_audit_log sms_audit_log_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_audit_log
    ADD CONSTRAINT sms_audit_log_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.sms_campaigns(id) ON DELETE SET NULL;


--
-- Name: sms_campaign_recipients sms_campaign_recipients_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_campaign_recipients
    ADD CONSTRAINT sms_campaign_recipients_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.sms_campaigns(id) ON DELETE CASCADE;


--
-- Name: sms_campaign_recipients sms_campaign_recipients_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_campaign_recipients
    ADD CONSTRAINT sms_campaign_recipients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sms_campaigns sms_campaigns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_campaigns
    ADD CONSTRAINT sms_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: special_order_requests special_order_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.special_order_requests
    ADD CONSTRAINT special_order_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.inventory_reservations(id) ON DELETE SET NULL;


--
-- Name: user_deletion_log user_deletion_log_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_deletion_log
    ADD CONSTRAINT user_deletion_log_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: user_devices user_devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_suspensions user_suspensions_suspended_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_suspensions
    ADD CONSTRAINT user_suspensions_suspended_by_fkey FOREIGN KEY (suspended_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: user_suspensions user_suspensions_unsuspended_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_suspensions
    ADD CONSTRAINT user_suspensions_unsuspended_by_fkey FOREIGN KEY (unsuspended_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: user_suspensions user_suspensions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_suspensions
    ADD CONSTRAINT user_suspensions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: wishlist_items wishlist_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: orders Admins and managers can update orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins and managers can update orders" ON public.orders FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))))));


--
-- Name: notifications Admins can insert notifications for any user; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert notifications for any user" ON public.notifications FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))))));


--
-- Name: special_order_requests Admins update special orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins update special orders" ON public.special_order_requests FOR UPDATE USING (((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text) OR ((auth.jwt() ->> 'role'::text) = 'admin'::text))) WITH CHECK (((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text) OR ((auth.jwt() ->> 'role'::text) = 'admin'::text)));


--
-- Name: special_orders Allow insert for authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow insert for authenticated users" ON public.special_orders FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: products Allow public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read access" ON public.products FOR SELECT TO authenticated, anon USING (true);


--
-- Name: special_orders Allow read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow read access for all users" ON public.special_orders FOR SELECT USING (true);


--
-- Name: special_orders Allow update for authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow update for authenticated users" ON public.special_orders FOR UPDATE USING ((auth.role() = 'authenticated'::text));


--
-- Name: special_order_requests Anyone can insert special orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can insert special orders" ON public.special_order_requests FOR INSERT WITH CHECK (true);


--
-- Name: Branch; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."Branch" ENABLE ROW LEVEL SECURITY;

--
-- Name: return_items Customers can insert own return items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Customers can insert own return items" ON public.return_items FOR INSERT TO authenticated WITH CHECK ((request_id IN ( SELECT return_requests.id
   FROM public.return_requests
  WHERE (return_requests.user_id = auth.uid()))));


--
-- Name: return_requests Customers can insert own return requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Customers can insert own return requests" ON public.return_requests FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: cancellations Customers can view own cancellations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Customers can view own cancellations" ON public.cancellations FOR SELECT TO authenticated USING ((order_id IN ( SELECT orders.id
   FROM public.orders
  WHERE (orders.user_id = auth.uid()))));


--
-- Name: return_items Customers can view own return items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Customers can view own return items" ON public.return_items FOR SELECT TO authenticated USING ((request_id IN ( SELECT return_requests.id
   FROM public.return_requests
  WHERE (return_requests.user_id = auth.uid()))));


--
-- Name: return_requests Customers can view own return requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Customers can view own return requests" ON public.return_requests FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: return_timeline Customers can view own return timeline; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Customers can view own return timeline" ON public.return_timeline FOR SELECT TO authenticated USING ((return_id IN ( SELECT return_requests.id
   FROM public.return_requests
  WHERE (return_requests.user_id = auth.uid()))));


--
-- Name: DeliveryAssignment; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."DeliveryAssignment" ENABLE ROW LEVEL SECURITY;

--
-- Name: DeliveryZone; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."DeliveryZone" ENABLE ROW LEVEL SECURITY;

--
-- Name: DriverEarning; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."DriverEarning" ENABLE ROW LEVEL SECURITY;

--
-- Name: DriverLocation; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."DriverLocation" ENABLE ROW LEVEL SECURITY;

--
-- Name: DriverProfile; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."DriverProfile" ENABLE ROW LEVEL SECURITY;

--
-- Name: DriverSession; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."DriverSession" ENABLE ROW LEVEL SECURITY;

--
-- Name: return_requests Drivers can view assigned return requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Drivers can view assigned return requests" ON public.return_requests FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.delivery_assignments da
  WHERE ((da.order_id = return_requests.order_id) AND (da.driver_id = auth.uid())))));


--
-- Name: integration_events Integration events service role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Integration events service role" ON public.integration_events USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text)) WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: integration_events Integration events staff read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Integration events staff read" ON public.integration_events FOR SELECT USING ((public.is_manager() OR public.has_permission('sheets.sync'::text)));


--
-- Name: inventory Inventory insert staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Inventory insert staff" ON public.inventory FOR INSERT WITH CHECK (public.has_permission('inventory.edit'::text));


--
-- Name: inventory Inventory read staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Inventory read staff" ON public.inventory FOR SELECT USING (public.has_permission('inventory.view'::text));


--
-- Name: inventory Inventory update staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Inventory update staff" ON public.inventory FOR UPDATE USING (public.has_permission('inventory.edit'::text)) WITH CHECK (public.has_permission('inventory.edit'::text));


--
-- Name: NotificationLog; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."NotificationLog" ENABLE ROW LEVEL SECURITY;

--
-- Name: NotificationToken; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."NotificationToken" ENABLE ROW LEVEL SECURITY;

--
-- Name: products Products delete staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Products delete staff" ON public.products FOR DELETE USING (public.has_permission('inventory.edit'::text));


--
-- Name: products Products insert staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Products insert staff" ON public.products FOR INSERT WITH CHECK (public.has_permission('inventory.edit'::text));


--
-- Name: products Products read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Products read" ON public.products FOR SELECT USING (((is_active = true) OR public.is_manager()));


--
-- Name: products Products update staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Products update staff" ON public.products FOR UPDATE USING (public.has_permission('inventory.edit'::text)) WITH CHECK (public.has_permission('inventory.edit'::text));


--
-- Name: cancellations Staff can view all cancellations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff can view all cancellations" ON public.cancellations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'pharmacist'::public.app_role, 'manager'::public.app_role]))))));


--
-- Name: return_items Staff can view all return items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff can view all return items" ON public.return_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'pharmacist'::public.app_role, 'manager'::public.app_role]))))));


--
-- Name: return_timeline Staff can view all return timelines; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff can view all return timelines" ON public.return_timeline FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'pharmacist'::public.app_role, 'manager'::public.app_role]))))));


--
-- Name: return_requests Staff can view all returns; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff can view all returns" ON public.return_requests FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'pharmacist'::public.app_role, 'manager'::public.app_role]))))));


--
-- Name: order_status_history Staff can view order history; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff can view order history" ON public.order_status_history FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'pharmacist'::public.app_role, 'manager'::public.app_role]))))) OR (EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_status_history.order_id) AND (orders.assigned_driver_id = auth.uid()))))));


--
-- Name: refunds Staff can view refunds; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff can view refunds" ON public.refunds FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'pharmacist'::public.app_role, 'manager'::public.app_role]))))));


--
-- Name: order_status_history Users can view history for their own orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view history for their own orders" ON public.order_status_history FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_status_history.order_id) AND (orders.user_id = auth.uid())))));


--
-- Name: refunds Users can view their own refunds; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own refunds" ON public.refunds FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = refunds.order_id) AND (orders.user_id = auth.uid())))));


--
-- Name: favorites Users manage own favorites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage own favorites" ON public.favorites USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: special_order_requests Users read own special orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users read own special orders" ON public.special_order_requests FOR SELECT USING (((auth.uid() = user_id) OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text) OR ((auth.jwt() ->> 'role'::text) = 'admin'::text)));


--
-- Name: _prisma_migrations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: addresses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: addresses addresses: delete own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "addresses: delete own" ON public.addresses FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: addresses addresses: insert own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "addresses: insert own" ON public.addresses FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: addresses addresses: select own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "addresses: select own" ON public.addresses FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: addresses addresses: update own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "addresses: update own" ON public.addresses FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: addresses addresses_owner_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY addresses_owner_all ON public.addresses USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: admin_audit_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: allergies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.allergies ENABLE ROW LEVEL SECURITY;

--
-- Name: allergies allergies owner all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "allergies owner all" ON public.allergies USING ((auth.uid() = user_id));


--
-- Name: anti_fraud_events anti_fraud admin read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "anti_fraud admin read" ON public.anti_fraud_events FOR SELECT USING (public.is_admin());


--
-- Name: anti_fraud_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.anti_fraud_events ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_audit_log audit_log: admin select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "audit_log: admin select" ON public.admin_audit_log FOR SELECT USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::public.app_role));


--
-- Name: admin_audit_log audit_log: admin/manager insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "audit_log: admin/manager insert" ON public.admin_audit_log FOR INSERT WITH CHECK ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: Branch branch_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY branch_select_all ON public."Branch" FOR SELECT USING (true);


--
-- Name: cancellations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cancellations ENABLE ROW LEVEL SECURITY;

--
-- Name: cart_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

--
-- Name: cart_items cart_items owner all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "cart_items owner all" ON public.cart_items USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: conditions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conditions ENABLE ROW LEVEL SECURITY;

--
-- Name: conditions conditions owner all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "conditions owner all" ON public.conditions USING ((auth.uid() = user_id));


--
-- Name: coupon_batches; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.coupon_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: coupon_batches coupon_batches admin all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "coupon_batches admin all" ON public.coupon_batches USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: coupon_batches coupon_batches public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "coupon_batches public read" ON public.coupon_batches FOR SELECT USING (((is_active = true) AND ((expires_at IS NULL) OR (expires_at > now()))));


--
-- Name: coupon_batches coupon_batches: manager all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "coupon_batches: manager all" ON public.coupon_batches USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: coupon_redemptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

--
-- Name: coupon_redemptions coupon_redemptions: manager read all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "coupon_redemptions: manager read all" ON public.coupon_redemptions FOR SELECT USING (public.is_manager());


--
-- Name: coupon_redemptions coupon_redemptions: user read own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "coupon_redemptions: user read own" ON public.coupon_redemptions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: coupons; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

--
-- Name: coupons coupons: authenticated read active; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "coupons: authenticated read active" ON public.coupons FOR SELECT USING (((auth.uid() IS NOT NULL) AND (is_active = true)));


--
-- Name: coupons coupons: manager all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "coupons: manager all" ON public.coupons USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: user_deletion_log deletion_log: admin/manager insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "deletion_log: admin/manager insert" ON public.user_deletion_log FOR INSERT WITH CHECK ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: user_deletion_log deletion_log: admin/manager select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "deletion_log: admin/manager select" ON public.user_deletion_log FOR SELECT USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: delivery_assignments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_assignments delivery_assignments: driver select own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "delivery_assignments: driver select own" ON public.delivery_assignments FOR SELECT USING ((driver_id = auth.uid()));


--
-- Name: delivery_assignments delivery_assignments: driver update own response; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "delivery_assignments: driver update own response" ON public.delivery_assignments FOR UPDATE USING ((driver_id = auth.uid())) WITH CHECK ((driver_id = auth.uid()));


--
-- Name: delivery_assignments delivery_assignments: staff insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "delivery_assignments: staff insert" ON public.delivery_assignments FOR INSERT WITH CHECK ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: delivery_assignments delivery_assignments: staff select all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "delivery_assignments: staff select all" ON public.delivery_assignments FOR SELECT USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: delivery_assignments delivery_assignments: staff update all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "delivery_assignments: staff update all" ON public.delivery_assignments FOR UPDATE USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: delivery_assignments delivery_assignments_select_pharmacist; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY delivery_assignments_select_pharmacist ON public.delivery_assignments FOR SELECT USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'pharmacist'::public.app_role));


--
-- Name: delivery_issues; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.delivery_issues ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_issues delivery_issues: driver insert own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "delivery_issues: driver insert own" ON public.delivery_issues FOR INSERT WITH CHECK ((driver_id = auth.uid()));


--
-- Name: delivery_issues delivery_issues: driver select own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "delivery_issues: driver select own" ON public.delivery_issues FOR SELECT USING ((driver_id = auth.uid()));


--
-- Name: delivery_issues delivery_issues: staff select all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "delivery_issues: staff select all" ON public.delivery_issues FOR SELECT USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: delivery_issues delivery_issues: staff update (resolve); Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "delivery_issues: staff update (resolve)" ON public.delivery_issues FOR UPDATE USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: delivery_issues delivery_issues_select_pharmacist; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY delivery_issues_select_pharmacist ON public.delivery_issues FOR SELECT USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'pharmacist'::public.app_role));


--
-- Name: DeliveryZone delivery_zone_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY delivery_zone_select_all ON public."DeliveryZone" FOR SELECT USING (true);


--
-- Name: dependents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.dependents ENABLE ROW LEVEL SECURITY;

--
-- Name: dependents dependents owner all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "dependents owner all" ON public.dependents USING ((auth.uid() = user_id));


--
-- Name: dose_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.dose_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: dose_logs dose_logs owner insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "dose_logs owner insert" ON public.dose_logs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: dose_logs dose_logs owner read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "dose_logs owner read" ON public.dose_logs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: driver_locations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: driver_locations driver_locations: customer select own order; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "driver_locations: customer select own order" ON public.driver_locations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = driver_locations.order_id) AND (o.user_id = auth.uid())))));


--
-- Name: driver_locations driver_locations: driver insert own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "driver_locations: driver insert own" ON public.driver_locations FOR INSERT WITH CHECK (((driver_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.delivery_assignments da
  WHERE ((da.order_id = driver_locations.order_id) AND (da.driver_id = auth.uid()) AND (da.response_status = 'accepted'::text))))));


--
-- Name: driver_locations driver_locations: staff select all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "driver_locations: staff select all" ON public.driver_locations FOR SELECT USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: DriverProfile drivers can create own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "drivers can create own profile" ON public."DriverProfile" FOR INSERT TO authenticated WITH CHECK ((("userId" = auth.uid()) AND (status = 'PENDING_APPROVAL'::public."DriverStatus")));


--
-- Name: notifications drivers can notify their assigned order's customer; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "drivers can notify their assigned order's customer" ON public.notifications FOR INSERT WITH CHECK (((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'driver'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.assigned_driver_id = auth.uid()) AND (o.user_id = notifications.user_id))))));


--
-- Name: DriverEarning drivers can read own earnings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "drivers can read own earnings" ON public."DriverEarning" FOR SELECT TO authenticated USING (("driverId" IN ( SELECT "DriverProfile".id
   FROM public."DriverProfile"
  WHERE ("DriverProfile"."userId" = auth.uid()))));


--
-- Name: DriverProfile drivers can read own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "drivers can read own profile" ON public."DriverProfile" FOR SELECT TO authenticated USING (("userId" = auth.uid()));


--
-- Name: DriverProfile drivers read own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "drivers read own profile" ON public."DriverProfile" FOR SELECT TO authenticated USING ((auth.uid() = "userId"));


--
-- Name: drug_interactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.drug_interactions ENABLE ROW LEVEL SECURITY;

--
-- Name: drug_interactions drug_interactions public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "drug_interactions public read" ON public.drug_interactions FOR SELECT USING (true);


--
-- Name: favorites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: gift_catalog; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.gift_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: gift_catalog gift_catalog admin all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "gift_catalog admin all" ON public.gift_catalog USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: gift_catalog gift_catalog public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "gift_catalog public read" ON public.gift_catalog FOR SELECT USING ((is_active = true));


--
-- Name: gift_inventory; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.gift_inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: gift_inventory gift_inventory public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "gift_inventory public read" ON public.gift_inventory FOR SELECT USING (true);


--
-- Name: gift_redemptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.gift_redemptions ENABLE ROW LEVEL SECURITY;

--
-- Name: gift_redemptions gift_redemptions owner read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "gift_redemptions owner read" ON public.gift_redemptions FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: review_helpful_votes helpful: delete own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "helpful: delete own" ON public.review_helpful_votes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: review_helpful_votes helpful: insert own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "helpful: insert own" ON public.review_helpful_votes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: review_helpful_votes helpful: read all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "helpful: read all" ON public.review_helpful_votes FOR SELECT USING (true);


--
-- Name: reward_idempotency_keys idempotency owner read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "idempotency owner read" ON public.reward_idempotency_keys FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: inbox_notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.inbox_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: inbox_notifications inbox_notifications_manager_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY inbox_notifications_manager_select ON public.inbox_notifications FOR SELECT USING (public.is_manager());


--
-- Name: inbox_notifications inbox_notifications_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY inbox_notifications_select ON public.inbox_notifications FOR SELECT USING ((auth.uid() = recipient_id));


--
-- Name: inbox_notifications inbox_notifications_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY inbox_notifications_update ON public.inbox_notifications FOR UPDATE USING ((auth.uid() = recipient_id));


--
-- Name: insurance_cards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.insurance_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: insurance_cards insurance_cards owner all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "insurance_cards owner all" ON public.insurance_cards USING ((auth.uid() = user_id));


--
-- Name: integration_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_reservations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_reservations inventory_reservations owner read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "inventory_reservations owner read" ON public.inventory_reservations FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: inventory_state; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.inventory_state ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_state inventory_state public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "inventory_state public read" ON public.inventory_state FOR SELECT USING (true);


--
-- Name: loyalty_accounts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_accounts loyalty_accounts owner read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "loyalty_accounts owner read" ON public.loyalty_accounts FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: loyalty_config; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.loyalty_config ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_config loyalty_config_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY loyalty_config_read ON public.loyalty_config FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: loyalty_ledger; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_ledger loyalty_ledger owner read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "loyalty_ledger owner read" ON public.loyalty_ledger FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: loyalty_ledger loyalty_ledger_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY loyalty_ledger_self ON public.loyalty_ledger FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: loyalty_point_awards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.loyalty_point_awards ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_wallets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.loyalty_wallets ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_wallets loyalty_wallets_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY loyalty_wallets_admin ON public.loyalty_wallets USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))))));


--
-- Name: loyalty_wallets loyalty_wallets_no_client_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY loyalty_wallets_no_client_write ON public.loyalty_wallets USING (false) WITH CHECK (false);


--
-- Name: loyalty_wallets loyalty_wallets_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY loyalty_wallets_self ON public.loyalty_wallets FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: medication_reminders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.medication_reminders ENABLE ROW LEVEL SECURITY;

--
-- Name: medication_reminders medication_reminders owner all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "medication_reminders owner all" ON public.medication_reminders USING ((auth.uid() = user_id));


--
-- Name: notification_batches; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_batches notification_batches_manager_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notification_batches_manager_all ON public.notification_batches USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: notification_deliveries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_deliveries notification_deliveries_manager_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notification_deliveries_manager_select ON public.notification_deliveries FOR SELECT USING (public.is_manager());


--
-- Name: notification_delivery_attempts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_delivery_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_outbox; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_templates notification_templates_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notification_templates_select ON public.notification_templates FOR SELECT USING (true);


--
-- Name: notification_tokens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_tokens notification_tokens_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notification_tokens_delete_own ON public.notification_tokens FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: notification_tokens notification_tokens_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notification_tokens_insert_own ON public.notification_tokens FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: notification_tokens notification_tokens_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notification_tokens_select_own ON public.notification_tokens FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notification_tokens notification_tokens_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notification_tokens_update_own ON public.notification_tokens FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_insert_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notifications_insert_admin ON public.notifications FOR INSERT WITH CHECK ((((auth.jwt() ->> 'role'::text) = 'service_role'::text) OR public.is_manager()));


--
-- Name: notifications notifications_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notifications_select_own ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notifications notifications_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items order_items_select_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY order_items_select_admin ON public.order_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))))));


--
-- Name: order_items order_items_select_driver; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY order_items_select_driver ON public.order_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_items.order_id) AND (o.assigned_driver_id = auth.uid())))));


--
-- Name: order_items order_items_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY order_items_select_own ON public.order_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_items.order_id) AND (o.user_id = auth.uid())))));


--
-- Name: order_items order_items_select_pharmacist; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY order_items_select_pharmacist ON public.order_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.profiles p ON ((p.id = auth.uid())))
  WHERE ((o.id = order_items.order_id) AND (p.role = 'pharmacist'::public.app_role) AND ((p.branch_id IS NULL) OR (p.branch_id = o.branch_id))))));


--
-- Name: order_notes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: order_notes order_notes: staff insert own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "order_notes: staff insert own" ON public.order_notes FOR INSERT WITH CHECK (((author_id = auth.uid()) AND (( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role, 'pharmacist'::public.app_role]))));


--
-- Name: order_notes order_notes: staff select all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "order_notes: staff select all" ON public.order_notes FOR SELECT USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role, 'pharmacist'::public.app_role])));


--
-- Name: order_prescriptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.order_prescriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: order_prescriptions order_prescriptions_select_driver; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY order_prescriptions_select_driver ON public.order_prescriptions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_prescriptions.order_id) AND (o.assigned_driver_id = auth.uid())))));


--
-- Name: order_prescriptions order_prescriptions_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY order_prescriptions_select_own ON public.order_prescriptions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_prescriptions.order_id) AND (o.user_id = auth.uid())))));


--
-- Name: order_prescriptions order_prescriptions_select_staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY order_prescriptions_select_staff ON public.order_prescriptions FOR SELECT USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role, 'pharmacist'::public.app_role])));


--
-- Name: order_status_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders owner manual payment proof; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "orders owner manual payment proof" ON public.orders FOR UPDATE USING (((auth.uid() = user_id) AND (status = 'pending_payment'::public.order_status) AND (payment_method = ANY (ARRAY['vodafone'::text, 'instapay'::text])))) WITH CHECK (((auth.uid() = user_id) AND (status = 'pending_payment'::public.order_status) AND (payment_status = 'pending_verification'::text) AND (payment_method = ANY (ARRAY['vodafone'::text, 'instapay'::text]))));


--
-- Name: orders orders_select_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY orders_select_admin ON public.orders FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))))));


--
-- Name: orders orders_select_driver; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY orders_select_driver ON public.orders FOR SELECT USING ((assigned_driver_id = auth.uid()));


--
-- Name: orders orders_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY orders_select_own ON public.orders FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: orders orders_select_pharmacist; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY orders_select_pharmacist ON public.orders FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'pharmacist'::public.app_role) AND ((p.branch_id IS NULL) OR (p.branch_id = orders.branch_id))))));


--
-- Name: pharmacies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;

--
-- Name: pharmacies pharmacies public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pharmacies public read" ON public.pharmacies FOR SELECT USING (true);


--
-- Name: prescriptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: prescriptions prescriptions owner insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "prescriptions owner insert" ON public.prescriptions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: prescriptions prescriptions owner read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "prescriptions owner read" ON public.prescriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: prescriptions prescriptions owner update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "prescriptions owner update" ON public.prescriptions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: prescriptions prescriptions: staff select all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "prescriptions: staff select all" ON public.prescriptions FOR SELECT USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role, 'pharmacist'::public.app_role])));


--
-- Name: prescriptions prescriptions: staff update review; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "prescriptions: staff update review" ON public.prescriptions FOR UPDATE USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role, 'pharmacist'::public.app_role])));


--
-- Name: product_reviews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: products products public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "products public read" ON public.products FOR SELECT USING (true);


--
-- Name: products products_delete_managers_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY products_delete_managers_only ON public.products FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: products products_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY products_select_all ON public.products FOR SELECT USING (true);


--
-- Name: products products_update_staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY products_update_staff ON public.products FOR UPDATE TO authenticated USING ((public.is_manager() OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'pharmacist'::public.app_role)))))) WITH CHECK ((public.is_manager() OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'pharmacist'::public.app_role))))));


--
-- Name: products products_write_staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY products_write_staff ON public.products FOR INSERT TO authenticated WITH CHECK ((public.is_manager() OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'pharmacist'::public.app_role))))));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_insert ON public.profiles FOR INSERT WITH CHECK (((auth.uid() = id) OR public.is_manager()));


--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (((auth.uid() = id) OR public.is_manager()));


--
-- Name: profiles profiles_select_assigned_driver_for_customer; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_select_assigned_driver_for_customer ON public.profiles FOR SELECT USING (((role = 'driver'::public.app_role) AND public.is_customers_assigned_driver(id)));


--
-- Name: profiles profiles_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (((auth.uid() = id) OR public.is_manager())) WITH CHECK (((auth.uid() = id) OR public.is_manager()));


--
-- Name: promotion_products; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.promotion_products ENABLE ROW LEVEL SECURITY;

--
-- Name: promotion_products promotion_products_manager_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY promotion_products_manager_all ON public.promotion_products USING (public.is_promotion_manager()) WITH CHECK (public.is_promotion_manager());


--
-- Name: promotion_products promotion_products_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY promotion_products_public_read ON public.promotion_products FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.promotions p
  WHERE ((p.id = promotion_products.promotion_id) AND (p.is_enabled = true) AND (p.starts_at <= now()) AND (p.ends_at > now())))));


--
-- Name: promotions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

--
-- Name: promotions promotions_manager_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY promotions_manager_all ON public.promotions USING (public.is_promotion_manager()) WITH CHECK (public.is_promotion_manager());


--
-- Name: promotions promotions_public_active_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY promotions_public_active_read ON public.promotions FOR SELECT USING (((is_enabled = true) AND (starts_at <= now()) AND (ends_at > now())));


--
-- Name: referral_codes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: referral_codes referral_codes owner read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "referral_codes owner read" ON public.referral_codes FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: referral_rewards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

--
-- Name: referral_rewards referral_rewards owner read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "referral_rewards owner read" ON public.referral_rewards FOR SELECT USING (((auth.uid() = referrer_id) OR (auth.uid() = referee_id) OR public.is_admin()));


--
-- Name: refill_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.refill_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: refill_requests refill_requests owner cancel; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "refill_requests owner cancel" ON public.refill_requests FOR UPDATE USING (((auth.uid() = user_id) AND (status = ANY (ARRAY['pending'::public.refill_status, 'preparing'::public.refill_status])))) WITH CHECK (((auth.uid() = user_id) AND (status = 'cancelled'::public.refill_status)));


--
-- Name: refill_requests refill_requests owner insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "refill_requests owner insert" ON public.refill_requests FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: refill_requests refill_requests owner read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "refill_requests owner read" ON public.refill_requests FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: refill_requests refill_requests: staff select all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "refill_requests: staff select all" ON public.refill_requests FOR SELECT USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role, 'pharmacist'::public.app_role])));


--
-- Name: refill_requests refill_requests: staff update review; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "refill_requests: staff update review" ON public.refill_requests FOR UPDATE USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role, 'pharmacist'::public.app_role])));


--
-- Name: refunds; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

--
-- Name: return_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

--
-- Name: return_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: return_timeline; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.return_timeline ENABLE ROW LEVEL SECURITY;

--
-- Name: review_helpful_votes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.review_helpful_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: product_reviews reviews: delete own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reviews: delete own" ON public.product_reviews FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: product_reviews reviews: insert own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reviews: insert own" ON public.product_reviews FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: product_reviews reviews: read all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reviews: read all" ON public.product_reviews FOR SELECT USING (true);


--
-- Name: product_reviews reviews: update own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reviews: update own" ON public.product_reviews FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: reward_audit_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reward_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: reward_audit_logs reward_audit_logs admin read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reward_audit_logs admin read" ON public.reward_audit_logs FOR SELECT USING (public.is_admin());


--
-- Name: reward_audit_logs reward_audit_logs owner read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reward_audit_logs owner read" ON public.reward_audit_logs FOR SELECT USING ((auth.uid() = subject_user_id));


--
-- Name: reward_campaigns; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reward_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: reward_campaigns reward_campaigns admin all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reward_campaigns admin all" ON public.reward_campaigns USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: reward_campaigns reward_campaigns public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reward_campaigns public read" ON public.reward_campaigns FOR SELECT USING (((is_active = true) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));


--
-- Name: reward_idempotency_keys; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reward_idempotency_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: reward_rules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reward_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: reward_rules reward_rules admin all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reward_rules admin all" ON public.reward_rules USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: reward_rules reward_rules public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reward_rules public read" ON public.reward_rules FOR SELECT USING (true);


--
-- Name: reward_tiers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reward_tiers ENABLE ROW LEVEL SECURITY;

--
-- Name: reward_tiers reward_tiers public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reward_tiers public read" ON public.reward_tiers FOR SELECT USING (true);


--
-- Name: search_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.search_events ENABLE ROW LEVEL SECURITY;

--
-- Name: search_events search_events_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY search_events_admin ON public.search_events USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))))));


--
-- Name: search_events search_events_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY search_events_insert ON public.search_events FOR INSERT WITH CHECK (true);


--
-- Name: search_events search_events_self_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY search_events_self_select ON public.search_events FOR SELECT USING (((user_id = auth.uid()) OR (user_id IS NULL)));


--
-- Name: search_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.search_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: search_sessions search_sessions_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY search_sessions_owner ON public.search_sessions USING (((user_id = auth.uid()) OR ((user_id IS NULL) AND (device_key IS NOT NULL)))) WITH CHECK (((user_id = auth.uid()) OR ((user_id IS NULL) AND (device_key IS NOT NULL))));


--
-- Name: search_synonyms; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.search_synonyms ENABLE ROW LEVEL SECURITY;

--
-- Name: search_synonyms search_synonyms_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY search_synonyms_admin_write ON public.search_synonyms USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))))));


--
-- Name: search_synonyms search_synonyms_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY search_synonyms_read ON public.search_synonyms FOR SELECT USING (true);


--
-- Name: sms_audit_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sms_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_audit_log sms_audit_log: manager read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "sms_audit_log: manager read" ON public.sms_audit_log FOR SELECT USING (public.is_manager());


--
-- Name: sms_campaign_recipients; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sms_campaign_recipients ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_campaign_recipients sms_campaign_recipients: manager all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "sms_campaign_recipients: manager all" ON public.sms_campaign_recipients USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: sms_campaigns; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_campaigns sms_campaigns: manager all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "sms_campaigns: manager all" ON public.sms_campaigns USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: special_order_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.special_order_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: special_orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.special_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: DriverProfile staff read all driver profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "staff read all driver profiles" ON public."DriverProfile" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))))));


--
-- Name: stock_movements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movements stock_movements admin read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "stock_movements admin read" ON public.stock_movements FOR SELECT USING (public.is_admin());


--
-- Name: stock_movements stock_movements owner via reservation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "stock_movements owner via reservation" ON public.stock_movements FOR SELECT USING (((reservation_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.inventory_reservations r
  WHERE ((r.id = stock_movements.reservation_id) AND (r.user_id = auth.uid()))))));


--
-- Name: user_suspensions suspensions: admin/manager insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "suspensions: admin/manager insert" ON public.user_suspensions FOR INSERT WITH CHECK ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: user_suspensions suspensions: admin/manager select all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "suspensions: admin/manager select all" ON public.user_suspensions FOR SELECT USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: user_suspensions suspensions: admin/manager update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "suspensions: admin/manager update" ON public.user_suspensions FOR UPDATE USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: user_suspensions suspensions: user select own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "suspensions: user select own" ON public.user_suspensions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: user_deletion_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_deletion_log ENABLE ROW LEVEL SECURITY;

--
-- Name: user_devices; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: user_devices user_devices_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_devices_owner ON public.user_devices USING ((auth.uid() = user_id));


--
-- Name: user_suspensions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;

--
-- Name: wishlist_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

--
-- Name: wishlist_items wishlist_items owner all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "wishlist_items owner all" ON public.wishlist_items USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: TABLE inventory_state; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.inventory_state TO anon;
GRANT ALL ON TABLE public.inventory_state TO authenticated;
GRANT ALL ON TABLE public.inventory_state TO service_role;


--
-- Name: FUNCTION _inventory_ensure_state(p_product_id text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public._inventory_ensure_state(p_product_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public._inventory_ensure_state(p_product_id text) TO service_role;


--
-- Name: FUNCTION _inventory_lock(p_product_id text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public._inventory_lock(p_product_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public._inventory_lock(p_product_id text) TO service_role;


--
-- Name: FUNCTION _loyalty_audit(p_subject uuid, p_event_kind text, p_rpc_name text, p_success boolean, p_payload jsonb, p_error_code text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public._loyalty_audit(p_subject uuid, p_event_kind text, p_rpc_name text, p_success boolean, p_payload jsonb, p_error_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public._loyalty_audit(p_subject uuid, p_event_kind text, p_rpc_name text, p_success boolean, p_payload jsonb, p_error_code text) TO service_role;


--
-- Name: TABLE loyalty_accounts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.loyalty_accounts TO anon;
GRANT ALL ON TABLE public.loyalty_accounts TO authenticated;
GRANT ALL ON TABLE public.loyalty_accounts TO service_role;


--
-- Name: FUNCTION _loyalty_ensure_account(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public._loyalty_ensure_account(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._loyalty_ensure_account(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION _loyalty_idempotency_begin(p_key text, p_endpoint text, p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public._loyalty_idempotency_begin(p_key text, p_endpoint text, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._loyalty_idempotency_begin(p_key text, p_endpoint text, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION _loyalty_idempotency_end(p_key text, p_response jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public._loyalty_idempotency_end(p_key text, p_response jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public._loyalty_idempotency_end(p_key text, p_response jsonb) TO service_role;


--
-- Name: FUNCTION _loyalty_lock(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public._loyalty_lock(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._loyalty_lock(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION _loyalty_lock_idem(p_key text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public._loyalty_lock_idem(p_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public._loyalty_lock_idem(p_key text) TO service_role;


--
-- Name: FUNCTION _loyalty_recompute_tier(p_lifetime bigint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public._loyalty_recompute_tier(p_lifetime bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public._loyalty_recompute_tier(p_lifetime bigint) TO service_role;


--
-- Name: FUNCTION _order_status_path(p_from text, p_to text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public._order_status_path(p_from text, p_to text) TO anon;
GRANT ALL ON FUNCTION public._order_status_path(p_from text, p_to text) TO authenticated;
GRANT ALL ON FUNCTION public._order_status_path(p_from text, p_to text) TO service_role;


--
-- Name: FUNCTION addresses_set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.addresses_set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.addresses_set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.addresses_set_updated_at() TO service_role;


--
-- Name: FUNCTION adjust_inventory(p_product_id text, p_delta integer, p_reason text, p_idempotency_key text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.adjust_inventory(p_product_id text, p_delta integer, p_reason text, p_idempotency_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.adjust_inventory(p_product_id text, p_delta integer, p_reason text, p_idempotency_key text) TO anon;
GRANT ALL ON FUNCTION public.adjust_inventory(p_product_id text, p_delta integer, p_reason text, p_idempotency_key text) TO authenticated;
GRANT ALL ON FUNCTION public.adjust_inventory(p_product_id text, p_delta integer, p_reason text, p_idempotency_key text) TO service_role;


--
-- Name: FUNCTION admin_bulk_delete_promotions(promotion_ids uuid[]); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_bulk_delete_promotions(promotion_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_bulk_delete_promotions(promotion_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.admin_bulk_delete_promotions(promotion_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.admin_bulk_delete_promotions(promotion_ids uuid[]) TO service_role;


--
-- Name: FUNCTION admin_bulk_disable_promotions(promotion_ids uuid[]); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_bulk_disable_promotions(promotion_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_bulk_disable_promotions(promotion_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.admin_bulk_disable_promotions(promotion_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.admin_bulk_disable_promotions(promotion_ids uuid[]) TO service_role;


--
-- Name: FUNCTION admin_bulk_enable_promotions(promotion_ids uuid[]); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_bulk_enable_promotions(promotion_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_bulk_enable_promotions(promotion_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.admin_bulk_enable_promotions(promotion_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.admin_bulk_enable_promotions(promotion_ids uuid[]) TO service_role;


--
-- Name: FUNCTION admin_delete_promotion(promotion_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_delete_promotion(promotion_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_delete_promotion(promotion_id uuid) TO anon;
GRANT ALL ON FUNCTION public.admin_delete_promotion(promotion_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_delete_promotion(promotion_id uuid) TO service_role;


--
-- Name: FUNCTION admin_delete_user_permanently(p_target_user_id uuid, p_reason text, p_admin_notes text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_delete_user_permanently(p_target_user_id uuid, p_reason text, p_admin_notes text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_delete_user_permanently(p_target_user_id uuid, p_reason text, p_admin_notes text) TO service_role;
GRANT ALL ON FUNCTION public.admin_delete_user_permanently(p_target_user_id uuid, p_reason text, p_admin_notes text) TO authenticated;


--
-- Name: FUNCTION admin_detect_promotion_conflicts(p_product_ids uuid[], p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_exclude_promotion_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_detect_promotion_conflicts(p_product_ids uuid[], p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_exclude_promotion_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_detect_promotion_conflicts(p_product_ids uuid[], p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_exclude_promotion_id uuid) TO anon;
GRANT ALL ON FUNCTION public.admin_detect_promotion_conflicts(p_product_ids uuid[], p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_exclude_promotion_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_detect_promotion_conflicts(p_product_ids uuid[], p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_exclude_promotion_id uuid) TO service_role;


--
-- Name: FUNCTION admin_directory_summary(p_scope text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_directory_summary(p_scope text) TO anon;
GRANT ALL ON FUNCTION public.admin_directory_summary(p_scope text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_directory_summary(p_scope text) TO service_role;


--
-- Name: FUNCTION admin_get_last_sign_in(user_ids uuid[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_get_last_sign_in(user_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.admin_get_last_sign_in(user_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.admin_get_last_sign_in(user_ids uuid[]) TO service_role;


--
-- Name: FUNCTION admin_order_timeline(p_order_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_order_timeline(p_order_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_order_timeline(p_order_id uuid) TO anon;
GRANT ALL ON FUNCTION public.admin_order_timeline(p_order_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_order_timeline(p_order_id uuid) TO service_role;


--
-- Name: FUNCTION admin_profile_status_counts(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_profile_status_counts() TO anon;
GRANT ALL ON FUNCTION public.admin_profile_status_counts() TO authenticated;
GRANT ALL ON FUNCTION public.admin_profile_status_counts() TO service_role;


--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.orders TO anon;
GRANT ALL ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO service_role;


--
-- Name: COLUMN orders.status; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(status) ON TABLE public.orders TO authenticated;


--
-- Name: COLUMN orders.payment_method; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(payment_method) ON TABLE public.orders TO authenticated;


--
-- Name: COLUMN orders.payment_status; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(payment_status) ON TABLE public.orders TO authenticated;


--
-- Name: COLUMN orders.payment_proof_url; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(payment_proof_url) ON TABLE public.orders TO authenticated;


--
-- Name: COLUMN orders.transfer_number; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(transfer_number) ON TABLE public.orders TO authenticated;


--
-- Name: FUNCTION admin_review_payment(p_order_id uuid, p_decision text, p_failure_reason text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_review_payment(p_order_id uuid, p_decision text, p_failure_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_review_payment(p_order_id uuid, p_decision text, p_failure_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_review_payment(p_order_id uuid, p_decision text, p_failure_reason text) TO service_role;


--
-- Name: FUNCTION admin_save_promotion(p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_is_enabled boolean, p_product_ids text[]); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_save_promotion(p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_is_enabled boolean, p_product_ids text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_save_promotion(p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_is_enabled boolean, p_product_ids text[]) TO anon;
GRANT ALL ON FUNCTION public.admin_save_promotion(p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_is_enabled boolean, p_product_ids text[]) TO authenticated;
GRANT ALL ON FUNCTION public.admin_save_promotion(p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_is_enabled boolean, p_product_ids text[]) TO service_role;


--
-- Name: FUNCTION admin_save_promotion(p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_is_enabled boolean, p_product_ids uuid[], p_status text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_save_promotion(p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_is_enabled boolean, p_product_ids uuid[], p_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_save_promotion(p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_is_enabled boolean, p_product_ids uuid[], p_status text) TO anon;
GRANT ALL ON FUNCTION public.admin_save_promotion(p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_is_enabled boolean, p_product_ids uuid[], p_status text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_save_promotion(p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_is_enabled boolean, p_product_ids uuid[], p_status text) TO service_role;


--
-- Name: FUNCTION admin_search_promotion_products(p_query text, p_category text, p_page integer, p_page_size integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_search_promotion_products(p_query text, p_category text, p_page integer, p_page_size integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_search_promotion_products(p_query text, p_category text, p_page integer, p_page_size integer) TO anon;
GRANT ALL ON FUNCTION public.admin_search_promotion_products(p_query text, p_category text, p_page integer, p_page_size integer) TO authenticated;
GRANT ALL ON FUNCTION public.admin_search_promotion_products(p_query text, p_category text, p_page integer, p_page_size integer) TO service_role;


--
-- Name: FUNCTION admin_search_promotion_products_v2(p_query text, p_category text, p_stock_status text, p_sort text, p_locale text, p_page integer, p_page_size integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_search_promotion_products_v2(p_query text, p_category text, p_stock_status text, p_sort text, p_locale text, p_page integer, p_page_size integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_search_promotion_products_v2(p_query text, p_category text, p_stock_status text, p_sort text, p_locale text, p_page integer, p_page_size integer) TO anon;
GRANT ALL ON FUNCTION public.admin_search_promotion_products_v2(p_query text, p_category text, p_stock_status text, p_sort text, p_locale text, p_page integer, p_page_size integer) TO authenticated;
GRANT ALL ON FUNCTION public.admin_search_promotion_products_v2(p_query text, p_category text, p_stock_status text, p_sort text, p_locale text, p_page integer, p_page_size integer) TO service_role;


--
-- Name: FUNCTION admin_set_promotion_status(p_promotion_id uuid, p_status text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_set_promotion_status(p_promotion_id uuid, p_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_promotion_status(p_promotion_id uuid, p_status text) TO anon;
GRANT ALL ON FUNCTION public.admin_set_promotion_status(p_promotion_id uuid, p_status text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_set_promotion_status(p_promotion_id uuid, p_status text) TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: FUNCTION admin_set_staff_role(p_user_id uuid, p_role text, p_branch_id text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_set_staff_role(p_user_id uuid, p_role text, p_branch_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_staff_role(p_user_id uuid, p_role text, p_branch_id text) TO anon;
GRANT ALL ON FUNCTION public.admin_set_staff_role(p_user_id uuid, p_role text, p_branch_id text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_set_staff_role(p_user_id uuid, p_role text, p_branch_id text) TO service_role;


--
-- Name: FUNCTION admin_transition_order(p_order_id uuid, p_next_status text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_transition_order(p_order_id uuid, p_next_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_transition_order(p_order_id uuid, p_next_status text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_transition_order(p_order_id uuid, p_next_status text) TO service_role;


--
-- Name: FUNCTION admin_update_profile_access(p_target_user_id uuid, p_next_role text, p_next_status text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_update_profile_access(p_target_user_id uuid, p_next_role text, p_next_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_update_profile_access(p_target_user_id uuid, p_next_role text, p_next_status text) TO anon;
GRANT ALL ON FUNCTION public.admin_update_profile_access(p_target_user_id uuid, p_next_role text, p_next_status text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_update_profile_access(p_target_user_id uuid, p_next_role text, p_next_status text) TO service_role;


--
-- Name: TABLE refill_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.refill_requests TO anon;
GRANT ALL ON TABLE public.refill_requests TO authenticated;
GRANT ALL ON TABLE public.refill_requests TO service_role;


--
-- Name: FUNCTION advance_refill_request(p_refill_id uuid, p_next_status text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.advance_refill_request(p_refill_id uuid, p_next_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.advance_refill_request(p_refill_id uuid, p_next_status text) TO anon;
GRANT ALL ON FUNCTION public.advance_refill_request(p_refill_id uuid, p_next_status text) TO authenticated;
GRANT ALL ON FUNCTION public.advance_refill_request(p_refill_id uuid, p_next_status text) TO service_role;


--
-- Name: FUNCTION append_search_session_query(p_user_id uuid, p_device_key text, p_query text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.append_search_session_query(p_user_id uuid, p_device_key text, p_query text) TO anon;
GRANT ALL ON FUNCTION public.append_search_session_query(p_user_id uuid, p_device_key text, p_query text) TO authenticated;
GRANT ALL ON FUNCTION public.append_search_session_query(p_user_id uuid, p_device_key text, p_query text) TO service_role;


--
-- Name: FUNCTION apply_campaign_bonus(p_user_id uuid, p_campaign_id uuid, p_amount bigint, p_idempotency_key text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.apply_campaign_bonus(p_user_id uuid, p_campaign_id uuid, p_amount bigint, p_idempotency_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.apply_campaign_bonus(p_user_id uuid, p_campaign_id uuid, p_amount bigint, p_idempotency_key text) TO anon;
GRANT ALL ON FUNCTION public.apply_campaign_bonus(p_user_id uuid, p_campaign_id uuid, p_amount bigint, p_idempotency_key text) TO authenticated;
GRANT ALL ON FUNCTION public.apply_campaign_bonus(p_user_id uuid, p_campaign_id uuid, p_amount bigint, p_idempotency_key text) TO service_role;


--
-- Name: FUNCTION apply_coupon_checkout(p_code text, p_order_id uuid, p_idempotency_key text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.apply_coupon_checkout(p_code text, p_order_id uuid, p_idempotency_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.apply_coupon_checkout(p_code text, p_order_id uuid, p_idempotency_key text) TO anon;
GRANT ALL ON FUNCTION public.apply_coupon_checkout(p_code text, p_order_id uuid, p_idempotency_key text) TO authenticated;
GRANT ALL ON FUNCTION public.apply_coupon_checkout(p_code text, p_order_id uuid, p_idempotency_key text) TO service_role;


--
-- Name: FUNCTION apply_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.apply_updated_at() TO anon;
GRANT ALL ON FUNCTION public.apply_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.apply_updated_at() TO service_role;


--
-- Name: FUNCTION auto_dispatch_tick(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.auto_dispatch_tick() FROM PUBLIC;
GRANT ALL ON FUNCTION public.auto_dispatch_tick() TO anon;
GRANT ALL ON FUNCTION public.auto_dispatch_tick() TO authenticated;
GRANT ALL ON FUNCTION public.auto_dispatch_tick() TO service_role;


--
-- Name: FUNCTION broadcast_notification(p_type text, p_category text, p_title text, p_body text, p_data jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.broadcast_notification(p_type text, p_category text, p_title text, p_body text, p_data jsonb) TO anon;
GRANT ALL ON FUNCTION public.broadcast_notification(p_type text, p_category text, p_title text, p_body text, p_data jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.broadcast_notification(p_type text, p_category text, p_title text, p_body text, p_data jsonb) TO service_role;


--
-- Name: TABLE notification_outbox; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_outbox TO anon;
GRANT ALL ON TABLE public.notification_outbox TO authenticated;
GRANT ALL ON TABLE public.notification_outbox TO service_role;


--
-- Name: FUNCTION claim_notification_outbox(p_limit integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.claim_notification_outbox(p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_notification_outbox(p_limit integer) TO service_role;


--
-- Name: FUNCTION commit_inventory(p_reservation_id uuid, p_order_id uuid, p_idempotency_key text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.commit_inventory(p_reservation_id uuid, p_order_id uuid, p_idempotency_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.commit_inventory(p_reservation_id uuid, p_order_id uuid, p_idempotency_key text) TO anon;
GRANT ALL ON FUNCTION public.commit_inventory(p_reservation_id uuid, p_order_id uuid, p_idempotency_key text) TO authenticated;
GRANT ALL ON FUNCTION public.commit_inventory(p_reservation_id uuid, p_order_id uuid, p_idempotency_key text) TO service_role;


--
-- Name: FUNCTION create_checkout_order(p_user_id uuid, p_customer jsonb, p_address jsonb, p_payment jsonb, p_cart_lines jsonb, p_expected_pricing jsonb, p_note text, p_promo_code text, p_idempotency_key text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.create_checkout_order(p_user_id uuid, p_customer jsonb, p_address jsonb, p_payment jsonb, p_cart_lines jsonb, p_expected_pricing jsonb, p_note text, p_promo_code text, p_idempotency_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_checkout_order(p_user_id uuid, p_customer jsonb, p_address jsonb, p_payment jsonb, p_cart_lines jsonb, p_expected_pricing jsonb, p_note text, p_promo_code text, p_idempotency_key text) TO service_role;


--
-- Name: FUNCTION create_referral_reward(p_referrer_id uuid, p_referee_id uuid, p_referee_first_order_id uuid, p_points bigint, p_idempotency_key text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.create_referral_reward(p_referrer_id uuid, p_referee_id uuid, p_referee_first_order_id uuid, p_points bigint, p_idempotency_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_referral_reward(p_referrer_id uuid, p_referee_id uuid, p_referee_first_order_id uuid, p_points bigint, p_idempotency_key text) TO anon;
GRANT ALL ON FUNCTION public.create_referral_reward(p_referrer_id uuid, p_referee_id uuid, p_referee_first_order_id uuid, p_points bigint, p_idempotency_key text) TO authenticated;
GRANT ALL ON FUNCTION public.create_referral_reward(p_referrer_id uuid, p_referee_id uuid, p_referee_first_order_id uuid, p_points bigint, p_idempotency_key text) TO service_role;


--
-- Name: FUNCTION current_app_role(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.current_app_role(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.current_app_role(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.current_app_role(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION debug_search_relevance(p_query text, p_product_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.debug_search_relevance(p_query text, p_product_id uuid) TO anon;
GRANT ALL ON FUNCTION public.debug_search_relevance(p_query text, p_product_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.debug_search_relevance(p_query text, p_product_id uuid) TO service_role;


--
-- Name: TABLE delivery_assignments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.delivery_assignments TO anon;
GRANT ALL ON TABLE public.delivery_assignments TO authenticated;
GRANT ALL ON TABLE public.delivery_assignments TO service_role;


--
-- Name: FUNCTION driver_accept_assignment(p_assignment_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.driver_accept_assignment(p_assignment_id uuid) TO anon;
GRANT ALL ON FUNCTION public.driver_accept_assignment(p_assignment_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.driver_accept_assignment(p_assignment_id uuid) TO service_role;


--
-- Name: FUNCTION driver_decline_assignment(p_assignment_id uuid, p_reason text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.driver_decline_assignment(p_assignment_id uuid, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.driver_decline_assignment(p_assignment_id uuid, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.driver_decline_assignment(p_assignment_id uuid, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.driver_decline_assignment(p_assignment_id uuid, p_reason text) TO service_role;


--
-- Name: FUNCTION earn_loyalty_points(p_user_id uuid, p_amount bigint, p_source text, p_source_ref text, p_idempotency_key text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.earn_loyalty_points(p_user_id uuid, p_amount bigint, p_source text, p_source_ref text, p_idempotency_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.earn_loyalty_points(p_user_id uuid, p_amount bigint, p_source text, p_source_ref text, p_idempotency_key text) TO anon;
GRANT ALL ON FUNCTION public.earn_loyalty_points(p_user_id uuid, p_amount bigint, p_source text, p_source_ref text, p_idempotency_key text) TO authenticated;
GRANT ALL ON FUNCTION public.earn_loyalty_points(p_user_id uuid, p_amount bigint, p_source text, p_source_ref text, p_idempotency_key text) TO service_role;


--
-- Name: FUNCTION enqueue_notification(p_recipient_id uuid, p_event_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text, p_idempotency_key text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.enqueue_notification(p_recipient_id uuid, p_event_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text, p_idempotency_key text) TO anon;
GRANT ALL ON FUNCTION public.enqueue_notification(p_recipient_id uuid, p_event_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text, p_idempotency_key text) TO authenticated;
GRANT ALL ON FUNCTION public.enqueue_notification(p_recipient_id uuid, p_event_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text, p_idempotency_key text) TO service_role;


--
-- Name: FUNCTION enqueue_notification_batch(p_recipient_ids uuid[], p_event_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text, p_idempotency_namespace text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.enqueue_notification_batch(p_recipient_ids uuid[], p_event_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text, p_idempotency_namespace text) TO anon;
GRANT ALL ON FUNCTION public.enqueue_notification_batch(p_recipient_ids uuid[], p_event_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text, p_idempotency_namespace text) TO authenticated;
GRANT ALL ON FUNCTION public.enqueue_notification_batch(p_recipient_ids uuid[], p_event_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text, p_idempotency_namespace text) TO service_role;


--
-- Name: FUNCTION ensure_driver_profile(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.ensure_driver_profile() TO anon;
GRANT ALL ON FUNCTION public.ensure_driver_profile() TO authenticated;
GRANT ALL ON FUNCTION public.ensure_driver_profile() TO service_role;


--
-- Name: FUNCTION execute_order_cancellation(p_order_id uuid, p_reason_code text, p_note text, p_idempotency_key text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.execute_order_cancellation(p_order_id uuid, p_reason_code text, p_note text, p_idempotency_key text) TO authenticated;
GRANT ALL ON FUNCTION public.execute_order_cancellation(p_order_id uuid, p_reason_code text, p_note text, p_idempotency_key text) TO service_role;


--
-- Name: FUNCTION expand_search_query(p_query text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.expand_search_query(p_query text) TO anon;
GRANT ALL ON FUNCTION public.expand_search_query(p_query text) TO authenticated;
GRANT ALL ON FUNCTION public.expand_search_query(p_query text) TO service_role;


--
-- Name: FUNCTION expire_stale_reservations(p_batch_size integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.expire_stale_reservations(p_batch_size integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.expire_stale_reservations(p_batch_size integer) TO anon;
GRANT ALL ON FUNCTION public.expire_stale_reservations(p_batch_size integer) TO authenticated;
GRANT ALL ON FUNCTION public.expire_stale_reservations(p_batch_size integer) TO service_role;


--
-- Name: FUNCTION extend_reservation(p_reservation_id uuid, p_extend_by_secs integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.extend_reservation(p_reservation_id uuid, p_extend_by_secs integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.extend_reservation(p_reservation_id uuid, p_extend_by_secs integer) TO anon;
GRANT ALL ON FUNCTION public.extend_reservation(p_reservation_id uuid, p_extend_by_secs integer) TO authenticated;
GRANT ALL ON FUNCTION public.extend_reservation(p_reservation_id uuid, p_extend_by_secs integer) TO service_role;


--
-- Name: FUNCTION find_synonym_terms(p_query text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.find_synonym_terms(p_query text) TO anon;
GRANT ALL ON FUNCTION public.find_synonym_terms(p_query text) TO authenticated;
GRANT ALL ON FUNCTION public.find_synonym_terms(p_query text) TO service_role;


--
-- Name: FUNCTION fn_award_loyalty_points_on_payment_verified(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_award_loyalty_points_on_payment_verified() TO anon;
GRANT ALL ON FUNCTION public.fn_award_loyalty_points_on_payment_verified() TO authenticated;
GRANT ALL ON FUNCTION public.fn_award_loyalty_points_on_payment_verified() TO service_role;


--
-- Name: FUNCTION fn_sync_product_stock(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_sync_product_stock() TO anon;
GRANT ALL ON FUNCTION public.fn_sync_product_stock() TO authenticated;
GRANT ALL ON FUNCTION public.fn_sync_product_stock() TO service_role;


--
-- Name: FUNCTION fold_search(t text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fold_search(t text) TO anon;
GRANT ALL ON FUNCTION public.fold_search(t text) TO authenticated;
GRANT ALL ON FUNCTION public.fold_search(t text) TO service_role;


--
-- Name: FUNCTION get_catalog_light(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_catalog_light() TO anon;
GRANT ALL ON FUNCTION public.get_catalog_light() TO authenticated;
GRANT ALL ON FUNCTION public.get_catalog_light() TO service_role;


--
-- Name: FUNCTION get_category_counts(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_category_counts() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_category_counts() TO anon;
GRANT ALL ON FUNCTION public.get_category_counts() TO authenticated;
GRANT ALL ON FUNCTION public.get_category_counts() TO service_role;


--
-- Name: FUNCTION promotion_effective_price(p_price numeric, p_discount_type text, p_discount_value numeric); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.promotion_effective_price(p_price numeric, p_discount_type text, p_discount_value numeric) TO anon;
GRANT ALL ON FUNCTION public.promotion_effective_price(p_price numeric, p_discount_type text, p_discount_value numeric) TO authenticated;
GRANT ALL ON FUNCTION public.promotion_effective_price(p_price numeric, p_discount_type text, p_discount_value numeric) TO service_role;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.products TO anon;
GRANT ALL ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;


--
-- Name: COLUMN products.is_sale; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(is_sale) ON TABLE public.products TO anon;
GRANT SELECT(is_sale) ON TABLE public.products TO authenticated;


--
-- Name: COLUMN products.original_price; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT(original_price) ON TABLE public.products TO anon;
GRANT SELECT(original_price) ON TABLE public.products TO authenticated;


--
-- Name: TABLE promotion_products; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.promotion_products TO anon;
GRANT ALL ON TABLE public.promotion_products TO authenticated;
GRANT ALL ON TABLE public.promotion_products TO service_role;


--
-- Name: TABLE promotions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.promotions TO anon;
GRANT ALL ON TABLE public.promotions TO authenticated;
GRANT ALL ON TABLE public.promotions TO service_role;


--
-- Name: TABLE product_effective_prices; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.product_effective_prices TO anon;
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.product_effective_prices TO authenticated;
GRANT ALL ON TABLE public.product_effective_prices TO service_role;


--
-- Name: FUNCTION get_effective_product(p_product_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_effective_product(p_product_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_effective_product(p_product_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_effective_product(p_product_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_effective_product(p_product_id uuid) TO service_role;


--
-- Name: FUNCTION get_featured_products(p_limit integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_featured_products(p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_featured_products(p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.get_featured_products(p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_featured_products(p_limit integer) TO service_role;


--
-- Name: FUNCTION get_loyalty_balance(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_loyalty_balance() TO anon;
GRANT ALL ON FUNCTION public.get_loyalty_balance() TO authenticated;
GRANT ALL ON FUNCTION public.get_loyalty_balance() TO service_role;


--
-- Name: FUNCTION get_marketing_targets(p_page integer, p_page_size integer, p_search text, p_sort text, p_consent_only boolean, p_status_filter text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_marketing_targets(p_page integer, p_page_size integer, p_search text, p_sort text, p_consent_only boolean, p_status_filter text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_marketing_targets(p_page integer, p_page_size integer, p_search text, p_sort text, p_consent_only boolean, p_status_filter text) TO anon;
GRANT ALL ON FUNCTION public.get_marketing_targets(p_page integer, p_page_size integer, p_search text, p_sort text, p_consent_only boolean, p_status_filter text) TO authenticated;
GRANT ALL ON FUNCTION public.get_marketing_targets(p_page integer, p_page_size integer, p_search text, p_sort text, p_consent_only boolean, p_status_filter text) TO service_role;


--
-- Name: FUNCTION get_order_actions(p_order_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_order_actions(p_order_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_order_actions(p_order_id uuid) TO service_role;


--
-- Name: FUNCTION get_orders_dashboard(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_orders_dashboard() TO anon;
GRANT ALL ON FUNCTION public.get_orders_dashboard() TO authenticated;
GRANT ALL ON FUNCTION public.get_orders_dashboard() TO service_role;


--
-- Name: FUNCTION get_popular_searches(p_limit integer, p_days integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_popular_searches(p_limit integer, p_days integer) TO anon;
GRANT ALL ON FUNCTION public.get_popular_searches(p_limit integer, p_days integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_popular_searches(p_limit integer, p_days integer) TO service_role;


--
-- Name: FUNCTION get_related_products(p_product_id text, p_limit integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_related_products(p_product_id text, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_related_products(p_product_id text, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.get_related_products(p_product_id text, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_related_products(p_product_id text, p_limit integer) TO service_role;


--
-- Name: FUNCTION get_return_eligibility(p_order_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_return_eligibility(p_order_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_return_eligibility(p_order_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_return_eligibility(p_order_id uuid) TO service_role;


--
-- Name: FUNCTION get_trending_products(p_category text, p_limit integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_trending_products(p_category text, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_trending_products(p_category text, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.get_trending_products(p_category text, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_trending_products(p_category text, p_limit integer) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION has_permission(p_permission_key text, p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.has_permission(p_permission_key text, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.has_permission(p_permission_key text, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.has_permission(p_permission_key text, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision) TO anon;
GRANT ALL ON FUNCTION public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision) TO authenticated;
GRANT ALL ON FUNCTION public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision) TO service_role;


--
-- Name: FUNCTION immutable_unaccent(text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.immutable_unaccent(text) TO anon;
GRANT ALL ON FUNCTION public.immutable_unaccent(text) TO authenticated;
GRANT ALL ON FUNCTION public.immutable_unaccent(text) TO service_role;


--
-- Name: FUNCTION insert_staff_notification(p_user_id uuid, p_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.insert_staff_notification(p_user_id uuid, p_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text) TO anon;
GRANT ALL ON FUNCTION public.insert_staff_notification(p_user_id uuid, p_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text) TO authenticated;
GRANT ALL ON FUNCTION public.insert_staff_notification(p_user_id uuid, p_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text) TO service_role;


--
-- Name: FUNCTION inventory_state_touch(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.inventory_state_touch() TO anon;
GRANT ALL ON FUNCTION public.inventory_state_touch() TO authenticated;
GRANT ALL ON FUNCTION public.inventory_state_touch() TO service_role;


--
-- Name: FUNCTION is_admin(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.is_admin(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_admin(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_admin(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_admin(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION is_customers_assigned_driver(p_driver_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.is_customers_assigned_driver(p_driver_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_customers_assigned_driver(p_driver_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_customers_assigned_driver(p_driver_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_customers_assigned_driver(p_driver_id uuid) TO service_role;


--
-- Name: FUNCTION is_driver(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_driver(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_driver(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_driver(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION is_manager(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_manager(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_manager(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_manager(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION is_promotion_manager(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_promotion_manager() TO anon;
GRANT ALL ON FUNCTION public.is_promotion_manager() TO authenticated;
GRANT ALL ON FUNCTION public.is_promotion_manager() TO service_role;


--
-- Name: FUNCTION log_order_status_change(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.log_order_status_change() TO anon;
GRANT ALL ON FUNCTION public.log_order_status_change() TO authenticated;
GRANT ALL ON FUNCTION public.log_order_status_change() TO service_role;


--
-- Name: FUNCTION log_search_event(p_query text, p_result_count integer, p_source text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.log_search_event(p_query text, p_result_count integer, p_source text) TO anon;
GRANT ALL ON FUNCTION public.log_search_event(p_query text, p_result_count integer, p_source text) TO authenticated;
GRANT ALL ON FUNCTION public.log_search_event(p_query text, p_result_count integer, p_source text) TO service_role;


--
-- Name: FUNCTION loyalty_accounts_touch(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.loyalty_accounts_touch() TO anon;
GRANT ALL ON FUNCTION public.loyalty_accounts_touch() TO authenticated;
GRANT ALL ON FUNCTION public.loyalty_accounts_touch() TO service_role;


--
-- Name: FUNCTION manual_assign_driver(p_order_id uuid, p_driver_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.manual_assign_driver(p_order_id uuid, p_driver_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.manual_assign_driver(p_order_id uuid, p_driver_id uuid) TO anon;
GRANT ALL ON FUNCTION public.manual_assign_driver(p_order_id uuid, p_driver_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.manual_assign_driver(p_order_id uuid, p_driver_id uuid) TO service_role;


--
-- Name: FUNCTION mark_delivery_arrival(p_assignment_id uuid, p_stage text, p_lat numeric, p_lng numeric); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.mark_delivery_arrival(p_assignment_id uuid, p_stage text, p_lat numeric, p_lng numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_delivery_arrival(p_assignment_id uuid, p_stage text, p_lat numeric, p_lng numeric) TO anon;
GRANT ALL ON FUNCTION public.mark_delivery_arrival(p_assignment_id uuid, p_stage text, p_lat numeric, p_lng numeric) TO authenticated;
GRANT ALL ON FUNCTION public.mark_delivery_arrival(p_assignment_id uuid, p_stage text, p_lat numeric, p_lng numeric) TO service_role;


--
-- Name: FUNCTION mark_product_embedding_failed(p_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.mark_product_embedding_failed(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_product_embedding_failed(p_id uuid) TO anon;
GRANT ALL ON FUNCTION public.mark_product_embedding_failed(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mark_product_embedding_failed(p_id uuid) TO service_role;


--
-- Name: FUNCTION normalize_arabic(t text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.normalize_arabic(t text) TO anon;
GRANT ALL ON FUNCTION public.normalize_arabic(t text) TO authenticated;
GRANT ALL ON FUNCTION public.normalize_arabic(t text) TO service_role;


--
-- Name: FUNCTION notification_unread_count(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notification_unread_count(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.notification_unread_count(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.notification_unread_count(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION notify_pharmacist_customer_order_update(p_order_id uuid, p_event_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text, p_idempotency_key text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_pharmacist_customer_order_update(p_order_id uuid, p_event_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text, p_idempotency_key text) TO anon;
GRANT ALL ON FUNCTION public.notify_pharmacist_customer_order_update(p_order_id uuid, p_event_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text, p_idempotency_key text) TO authenticated;
GRANT ALL ON FUNCTION public.notify_pharmacist_customer_order_update(p_order_id uuid, p_event_type text, p_category text, p_title text, p_body text, p_data jsonb, p_action_url text, p_idempotency_key text) TO service_role;


--
-- Name: FUNCTION notify_pharmacist_customer_prescription_review(p_prescription_id uuid, p_decision text, p_event_type text, p_category text, p_title text, p_body text, p_action_url text, p_idempotency_key text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_pharmacist_customer_prescription_review(p_prescription_id uuid, p_decision text, p_event_type text, p_category text, p_title text, p_body text, p_action_url text, p_idempotency_key text) TO anon;
GRANT ALL ON FUNCTION public.notify_pharmacist_customer_prescription_review(p_prescription_id uuid, p_decision text, p_event_type text, p_category text, p_title text, p_body text, p_action_url text, p_idempotency_key text) TO authenticated;
GRANT ALL ON FUNCTION public.notify_pharmacist_customer_prescription_review(p_prescription_id uuid, p_decision text, p_event_type text, p_category text, p_title text, p_body text, p_action_url text, p_idempotency_key text) TO service_role;


--
-- Name: FUNCTION notify_staff_prescription_submitted(p_prescription_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.notify_staff_prescription_submitted(p_prescription_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_staff_prescription_submitted(p_prescription_id uuid) TO anon;
GRANT ALL ON FUNCTION public.notify_staff_prescription_submitted(p_prescription_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.notify_staff_prescription_submitted(p_prescription_id uuid) TO service_role;


--
-- Name: FUNCTION point_in_polygon(p_lat double precision, p_lng double precision, p_polygon jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.point_in_polygon(p_lat double precision, p_lng double precision, p_polygon jsonb) TO anon;
GRANT ALL ON FUNCTION public.point_in_polygon(p_lat double precision, p_lng double precision, p_polygon jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.point_in_polygon(p_lat double precision, p_lng double precision, p_polygon jsonb) TO service_role;


--
-- Name: FUNCTION post_driver_earning_on_delivery(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.post_driver_earning_on_delivery() TO anon;
GRANT ALL ON FUNCTION public.post_driver_earning_on_delivery() TO authenticated;
GRANT ALL ON FUNCTION public.post_driver_earning_on_delivery() TO service_role;


--
-- Name: FUNCTION process_cashback_reward(p_user_id uuid, p_order_id uuid, p_idempotency_key text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.process_cashback_reward(p_user_id uuid, p_order_id uuid, p_idempotency_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.process_cashback_reward(p_user_id uuid, p_order_id uuid, p_idempotency_key text) TO anon;
GRANT ALL ON FUNCTION public.process_cashback_reward(p_user_id uuid, p_order_id uuid, p_idempotency_key text) TO authenticated;
GRANT ALL ON FUNCTION public.process_cashback_reward(p_user_id uuid, p_order_id uuid, p_idempotency_key text) TO service_role;


--
-- Name: FUNCTION product_search_document(p_name_ar text, p_name_en text, p_category_name text, p_category_name_en text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.product_search_document(p_name_ar text, p_name_en text, p_category_name text, p_category_name_en text) TO anon;
GRANT ALL ON FUNCTION public.product_search_document(p_name_ar text, p_name_en text, p_category_name text, p_category_name_en text) TO authenticated;
GRANT ALL ON FUNCTION public.product_search_document(p_name_ar text, p_name_en text, p_category_name text, p_category_name_en text) TO service_role;


--
-- Name: FUNCTION products_invalidate_embedding(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.products_invalidate_embedding() TO anon;
GRANT ALL ON FUNCTION public.products_invalidate_embedding() TO authenticated;
GRANT ALL ON FUNCTION public.products_invalidate_embedding() TO service_role;


--
-- Name: FUNCTION products_pending_embedding(p_limit integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.products_pending_embedding(p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.products_pending_embedding(p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.products_pending_embedding(p_limit integer) TO service_role;


--
-- Name: FUNCTION products_search_vector_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.products_search_vector_update() TO anon;
GRANT ALL ON FUNCTION public.products_search_vector_update() TO authenticated;
GRANT ALL ON FUNCTION public.products_search_vector_update() TO service_role;


--
-- Name: FUNCTION profiles_guard_role_status(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.profiles_guard_role_status() FROM PUBLIC;
GRANT ALL ON FUNCTION public.profiles_guard_role_status() TO anon;
GRANT ALL ON FUNCTION public.profiles_guard_role_status() TO authenticated;
GRANT ALL ON FUNCTION public.profiles_guard_role_status() TO service_role;


--
-- Name: FUNCTION rank_available_drivers(p_order_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rank_available_drivers(p_order_id uuid) TO anon;
GRANT ALL ON FUNCTION public.rank_available_drivers(p_order_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.rank_available_drivers(p_order_id uuid) TO service_role;


--
-- Name: FUNCTION record_coupon_redemption(p_code text, p_user_id uuid, p_order_id uuid, p_subtotal numeric); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.record_coupon_redemption(p_code text, p_user_id uuid, p_order_id uuid, p_subtotal numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_coupon_redemption(p_code text, p_user_id uuid, p_order_id uuid, p_subtotal numeric) TO service_role;


--
-- Name: TABLE "DriverEarning"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."DriverEarning" TO anon;
GRANT ALL ON TABLE public."DriverEarning" TO authenticated;
GRANT ALL ON TABLE public."DriverEarning" TO service_role;


--
-- Name: FUNCTION record_driver_earning(p_assignment_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.record_driver_earning(p_assignment_id uuid) TO anon;
GRANT ALL ON FUNCTION public.record_driver_earning(p_assignment_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.record_driver_earning(p_assignment_id uuid) TO service_role;


--
-- Name: FUNCTION redeem_points_for_coupon(p_batch_id uuid, p_idempotency_key text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.redeem_points_for_coupon(p_batch_id uuid, p_idempotency_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.redeem_points_for_coupon(p_batch_id uuid, p_idempotency_key text) TO anon;
GRANT ALL ON FUNCTION public.redeem_points_for_coupon(p_batch_id uuid, p_idempotency_key text) TO authenticated;
GRANT ALL ON FUNCTION public.redeem_points_for_coupon(p_batch_id uuid, p_idempotency_key text) TO service_role;


--
-- Name: FUNCTION redeem_points_for_gift(p_gift_id uuid, p_address jsonb, p_idempotency_key text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.redeem_points_for_gift(p_gift_id uuid, p_address jsonb, p_idempotency_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.redeem_points_for_gift(p_gift_id uuid, p_address jsonb, p_idempotency_key text) TO anon;
GRANT ALL ON FUNCTION public.redeem_points_for_gift(p_gift_id uuid, p_address jsonb, p_idempotency_key text) TO authenticated;
GRANT ALL ON FUNCTION public.redeem_points_for_gift(p_gift_id uuid, p_address jsonb, p_idempotency_key text) TO service_role;


--
-- Name: TABLE notification_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_tokens TO anon;
GRANT ALL ON TABLE public.notification_tokens TO authenticated;
GRANT ALL ON TABLE public.notification_tokens TO service_role;


--
-- Name: FUNCTION register_push_token(p_expo_push_token text, p_platform text, p_device_id text, p_app_version text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.register_push_token(p_expo_push_token text, p_platform text, p_device_id text, p_app_version text) TO anon;
GRANT ALL ON FUNCTION public.register_push_token(p_expo_push_token text, p_platform text, p_device_id text, p_app_version text) TO authenticated;
GRANT ALL ON FUNCTION public.register_push_token(p_expo_push_token text, p_platform text, p_device_id text, p_app_version text) TO service_role;


--
-- Name: FUNCTION release_gift_inventory(p_redemption_id uuid, p_reason text, p_idempotency_key text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.release_gift_inventory(p_redemption_id uuid, p_reason text, p_idempotency_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.release_gift_inventory(p_redemption_id uuid, p_reason text, p_idempotency_key text) TO anon;
GRANT ALL ON FUNCTION public.release_gift_inventory(p_redemption_id uuid, p_reason text, p_idempotency_key text) TO authenticated;
GRANT ALL ON FUNCTION public.release_gift_inventory(p_redemption_id uuid, p_reason text, p_idempotency_key text) TO service_role;


--
-- Name: FUNCTION release_inventory(p_reservation_id uuid, p_reason text, p_idempotency_key text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.release_inventory(p_reservation_id uuid, p_reason text, p_idempotency_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.release_inventory(p_reservation_id uuid, p_reason text, p_idempotency_key text) TO anon;
GRANT ALL ON FUNCTION public.release_inventory(p_reservation_id uuid, p_reason text, p_idempotency_key text) TO authenticated;
GRANT ALL ON FUNCTION public.release_inventory(p_reservation_id uuid, p_reason text, p_idempotency_key text) TO service_role;


--
-- Name: FUNCTION request_return(p_order_id uuid, p_reason text, p_resolution_type public.return_resolution, p_idempotency_key text, p_items jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.request_return(p_order_id uuid, p_reason text, p_resolution_type public.return_resolution, p_idempotency_key text, p_items jsonb) TO anon;
GRANT ALL ON FUNCTION public.request_return(p_order_id uuid, p_reason text, p_resolution_type public.return_resolution, p_idempotency_key text, p_items jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.request_return(p_order_id uuid, p_reason text, p_resolution_type public.return_resolution, p_idempotency_key text, p_items jsonb) TO service_role;


--
-- Name: FUNCTION reserve_inventory(p_product_id text, p_quantity integer, p_reservation_kind text, p_reservation_ref text, p_idempotency_key text, p_expires_in_secs integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.reserve_inventory(p_product_id text, p_quantity integer, p_reservation_kind text, p_reservation_ref text, p_idempotency_key text, p_expires_in_secs integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reserve_inventory(p_product_id text, p_quantity integer, p_reservation_kind text, p_reservation_ref text, p_idempotency_key text, p_expires_in_secs integer) TO anon;
GRANT ALL ON FUNCTION public.reserve_inventory(p_product_id text, p_quantity integer, p_reservation_kind text, p_reservation_ref text, p_idempotency_key text, p_expires_in_secs integer) TO authenticated;
GRANT ALL ON FUNCTION public.reserve_inventory(p_product_id text, p_quantity integer, p_reservation_kind text, p_reservation_ref text, p_idempotency_key text, p_expires_in_secs integer) TO service_role;


--
-- Name: TABLE delivery_issues; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.delivery_issues TO anon;
GRANT ALL ON TABLE public.delivery_issues TO authenticated;
GRANT ALL ON TABLE public.delivery_issues TO service_role;


--
-- Name: FUNCTION resolve_delivery_issue(p_issue_id uuid, p_resolution_note text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.resolve_delivery_issue(p_issue_id uuid, p_resolution_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolve_delivery_issue(p_issue_id uuid, p_resolution_note text) TO anon;
GRANT ALL ON FUNCTION public.resolve_delivery_issue(p_issue_id uuid, p_resolution_note text) TO authenticated;
GRANT ALL ON FUNCTION public.resolve_delivery_issue(p_issue_id uuid, p_resolution_note text) TO service_role;


--
-- Name: FUNCTION resolve_delivery_zone(p_lat double precision, p_lng double precision, p_subtotal numeric); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.resolve_delivery_zone(p_lat double precision, p_lng double precision, p_subtotal numeric) TO anon;
GRANT ALL ON FUNCTION public.resolve_delivery_zone(p_lat double precision, p_lng double precision, p_subtotal numeric) TO authenticated;
GRANT ALL ON FUNCTION public.resolve_delivery_zone(p_lat double precision, p_lng double precision, p_subtotal numeric) TO service_role;


--
-- Name: FUNCTION reverse_reward_transaction(p_ledger_id uuid, p_reason text, p_idempotency_key text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.reverse_reward_transaction(p_ledger_id uuid, p_reason text, p_idempotency_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reverse_reward_transaction(p_ledger_id uuid, p_reason text, p_idempotency_key text) TO anon;
GRANT ALL ON FUNCTION public.reverse_reward_transaction(p_ledger_id uuid, p_reason text, p_idempotency_key text) TO authenticated;
GRANT ALL ON FUNCTION public.reverse_reward_transaction(p_ledger_id uuid, p_reason text, p_idempotency_key text) TO service_role;


--
-- Name: TABLE prescriptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.prescriptions TO anon;
GRANT ALL ON TABLE public.prescriptions TO authenticated;
GRANT ALL ON TABLE public.prescriptions TO service_role;


--
-- Name: FUNCTION review_prescription(p_prescription_id uuid, p_decision text, p_admin_notes text, p_rejection_reason text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.review_prescription(p_prescription_id uuid, p_decision text, p_admin_notes text, p_rejection_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.review_prescription(p_prescription_id uuid, p_decision text, p_admin_notes text, p_rejection_reason text) TO anon;
GRANT ALL ON FUNCTION public.review_prescription(p_prescription_id uuid, p_decision text, p_admin_notes text, p_rejection_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.review_prescription(p_prescription_id uuid, p_decision text, p_admin_notes text, p_rejection_reason text) TO service_role;


--
-- Name: FUNCTION review_prescription(p_prescription_id uuid, p_decision text, p_admin_notes text, p_rejection_reason text, p_name text, p_dose text, p_doctor text, p_rx_number text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.review_prescription(p_prescription_id uuid, p_decision text, p_admin_notes text, p_rejection_reason text, p_name text, p_dose text, p_doctor text, p_rx_number text) TO anon;
GRANT ALL ON FUNCTION public.review_prescription(p_prescription_id uuid, p_decision text, p_admin_notes text, p_rejection_reason text, p_name text, p_dose text, p_doctor text, p_rx_number text) TO authenticated;
GRANT ALL ON FUNCTION public.review_prescription(p_prescription_id uuid, p_decision text, p_admin_notes text, p_rejection_reason text, p_name text, p_dose text, p_doctor text, p_rx_number text) TO service_role;


--
-- Name: FUNCTION review_refill_request(p_refill_id uuid, p_decision text, p_admin_notes text, p_rejection_reason text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.review_refill_request(p_refill_id uuid, p_decision text, p_admin_notes text, p_rejection_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.review_refill_request(p_refill_id uuid, p_decision text, p_admin_notes text, p_rejection_reason text) TO anon;
GRANT ALL ON FUNCTION public.review_refill_request(p_refill_id uuid, p_decision text, p_admin_notes text, p_rejection_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.review_refill_request(p_refill_id uuid, p_decision text, p_admin_notes text, p_rejection_reason text) TO service_role;


--
-- Name: FUNCTION rollback_committed_reservation(p_reservation_id uuid, p_reason text, p_idempotency_key text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.rollback_committed_reservation(p_reservation_id uuid, p_reason text, p_idempotency_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rollback_committed_reservation(p_reservation_id uuid, p_reason text, p_idempotency_key text) TO anon;
GRANT ALL ON FUNCTION public.rollback_committed_reservation(p_reservation_id uuid, p_reason text, p_idempotency_key text) TO authenticated;
GRANT ALL ON FUNCTION public.rollback_committed_reservation(p_reservation_id uuid, p_reason text, p_idempotency_key text) TO service_role;


--
-- Name: FUNCTION search_effective_products(p_query text, p_category text, p_in_stock boolean, p_min_price numeric, p_max_price numeric, p_is_sale boolean, p_sort text, p_limit integer, p_offset integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.search_effective_products(p_query text, p_category text, p_in_stock boolean, p_min_price numeric, p_max_price numeric, p_is_sale boolean, p_sort text, p_limit integer, p_offset integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.search_effective_products(p_query text, p_category text, p_in_stock boolean, p_min_price numeric, p_max_price numeric, p_is_sale boolean, p_sort text, p_limit integer, p_offset integer) TO anon;
GRANT ALL ON FUNCTION public.search_effective_products(p_query text, p_category text, p_in_stock boolean, p_min_price numeric, p_max_price numeric, p_is_sale boolean, p_sort text, p_limit integer, p_offset integer) TO authenticated;
GRANT ALL ON FUNCTION public.search_effective_products(p_query text, p_category text, p_in_stock boolean, p_min_price numeric, p_max_price numeric, p_is_sale boolean, p_sort text, p_limit integer, p_offset integer) TO service_role;


--
-- Name: FUNCTION search_products(p_query text, p_category text, p_in_stock boolean, p_min_price numeric, p_max_price numeric, p_sort text, p_limit integer, p_offset integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.search_products(p_query text, p_category text, p_in_stock boolean, p_min_price numeric, p_max_price numeric, p_sort text, p_limit integer, p_offset integer) TO anon;
GRANT ALL ON FUNCTION public.search_products(p_query text, p_category text, p_in_stock boolean, p_min_price numeric, p_max_price numeric, p_sort text, p_limit integer, p_offset integer) TO authenticated;
GRANT ALL ON FUNCTION public.search_products(p_query text, p_category text, p_in_stock boolean, p_min_price numeric, p_max_price numeric, p_sort text, p_limit integer, p_offset integer) TO service_role;


--
-- Name: FUNCTION search_products_fuzzy(search_term text, page_number integer, page_size integer, category_ar text, category_en text, in_stock_only boolean, sort_order text, min_similarity real); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.search_products_fuzzy(search_term text, page_number integer, page_size integer, category_ar text, category_en text, in_stock_only boolean, sort_order text, min_similarity real) TO anon;
GRANT ALL ON FUNCTION public.search_products_fuzzy(search_term text, page_number integer, page_size integer, category_ar text, category_en text, in_stock_only boolean, sort_order text, min_similarity real) TO authenticated;
GRANT ALL ON FUNCTION public.search_products_fuzzy(search_term text, page_number integer, page_size integer, category_ar text, category_en text, in_stock_only boolean, sort_order text, min_similarity real) TO service_role;


--
-- Name: FUNCTION search_products_semantic(p_embedding public.vector, p_limit integer, p_min_similarity real); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.search_products_semantic(p_embedding public.vector, p_limit integer, p_min_similarity real) TO anon;
GRANT ALL ON FUNCTION public.search_products_semantic(p_embedding public.vector, p_limit integer, p_min_similarity real) TO authenticated;
GRANT ALL ON FUNCTION public.search_products_semantic(p_embedding public.vector, p_limit integer, p_min_similarity real) TO service_role;


--
-- Name: FUNCTION set_driver_availability(p_is_online boolean, p_lat double precision, p_lng double precision); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.set_driver_availability(p_is_online boolean, p_lat double precision, p_lng double precision) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_driver_availability(p_is_online boolean, p_lat double precision, p_lng double precision) TO anon;
GRANT ALL ON FUNCTION public.set_driver_availability(p_is_online boolean, p_lat double precision, p_lng double precision) TO authenticated;
GRANT ALL ON FUNCTION public.set_driver_availability(p_is_online boolean, p_lat double precision, p_lng double precision) TO service_role;


--
-- Name: FUNCTION set_pharmacist_branch(p_pharmacist_id uuid, p_branch_id text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.set_pharmacist_branch(p_pharmacist_id uuid, p_branch_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_pharmacist_branch(p_pharmacist_id uuid, p_branch_id text) TO anon;
GRANT ALL ON FUNCTION public.set_pharmacist_branch(p_pharmacist_id uuid, p_branch_id text) TO authenticated;
GRANT ALL ON FUNCTION public.set_pharmacist_branch(p_pharmacist_id uuid, p_branch_id text) TO service_role;


--
-- Name: FUNCTION set_product_embedding(p_id uuid, p_embedding public.vector, p_model text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.set_product_embedding(p_id uuid, p_embedding public.vector, p_model text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_product_embedding(p_id uuid, p_embedding public.vector, p_model text) TO anon;
GRANT ALL ON FUNCTION public.set_product_embedding(p_id uuid, p_embedding public.vector, p_model text) TO authenticated;
GRANT ALL ON FUNCTION public.set_product_embedding(p_id uuid, p_embedding public.vector, p_model text) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION submit_manual_payment_proof(p_order_id uuid, p_transfer_number text, p_payment_proof_url text, p_payment_method text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.submit_manual_payment_proof(p_order_id uuid, p_transfer_number text, p_payment_proof_url text, p_payment_method text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_manual_payment_proof(p_order_id uuid, p_transfer_number text, p_payment_proof_url text, p_payment_method text) TO authenticated;
GRANT ALL ON FUNCTION public.submit_manual_payment_proof(p_order_id uuid, p_transfer_number text, p_payment_proof_url text, p_payment_method text) TO service_role;


--
-- Name: FUNCTION supersede_prior_delivery_assignments(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.supersede_prior_delivery_assignments() TO anon;
GRANT ALL ON FUNCTION public.supersede_prior_delivery_assignments() TO authenticated;
GRANT ALL ON FUNCTION public.supersede_prior_delivery_assignments() TO service_role;


--
-- Name: FUNCTION sync_profile_phone_from_auth(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_profile_phone_from_auth() TO anon;
GRANT ALL ON FUNCTION public.sync_profile_phone_from_auth() TO authenticated;
GRANT ALL ON FUNCTION public.sync_profile_phone_from_auth() TO service_role;


--
-- Name: FUNCTION sync_review_helpful_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_review_helpful_count() TO anon;
GRANT ALL ON FUNCTION public.sync_review_helpful_count() TO authenticated;
GRANT ALL ON FUNCTION public.sync_review_helpful_count() TO service_role;


--
-- Name: FUNCTION sync_role_on_driver_approval(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_role_on_driver_approval() TO anon;
GRANT ALL ON FUNCTION public.sync_role_on_driver_approval() TO authenticated;
GRANT ALL ON FUNCTION public.sync_role_on_driver_approval() TO service_role;


--
-- Name: FUNCTION touch_review_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.touch_review_updated_at() TO anon;
GRANT ALL ON FUNCTION public.touch_review_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.touch_review_updated_at() TO service_role;


--
-- Name: FUNCTION touch_search_synonyms_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.touch_search_synonyms_updated_at() TO anon;
GRANT ALL ON FUNCTION public.touch_search_synonyms_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.touch_search_synonyms_updated_at() TO service_role;


--
-- Name: FUNCTION transition_order(p_order_id uuid, p_next_status text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.transition_order(p_order_id uuid, p_next_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.transition_order(p_order_id uuid, p_next_status text) TO authenticated;
GRANT ALL ON FUNCTION public.transition_order(p_order_id uuid, p_next_status text) TO service_role;


--
-- Name: FUNCTION transition_return_status(p_request_id uuid, p_new_status public.return_status, p_actor_type text, p_actor_id uuid, p_reason text, p_metadata jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.transition_return_status(p_request_id uuid, p_new_status public.return_status, p_actor_type text, p_actor_id uuid, p_reason text, p_metadata jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.transition_return_status(p_request_id uuid, p_new_status public.return_status, p_actor_type text, p_actor_id uuid, p_reason text, p_metadata jsonb) TO service_role;


--
-- Name: FUNCTION update_modified_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_modified_column() TO anon;
GRANT ALL ON FUNCTION public.update_modified_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_modified_column() TO service_role;


--
-- Name: FUNCTION validate_coupon(p_code text, p_order_subtotal numeric); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.validate_coupon(p_code text, p_order_subtotal numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_coupon(p_code text, p_order_subtotal numeric) TO anon;
GRANT ALL ON FUNCTION public.validate_coupon(p_code text, p_order_subtotal numeric) TO authenticated;
GRANT ALL ON FUNCTION public.validate_coupon(p_code text, p_order_subtotal numeric) TO service_role;


--
-- Name: FUNCTION validate_coupon(p_code text, p_cart_total_cents integer, p_categories text[]); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.validate_coupon(p_code text, p_cart_total_cents integer, p_categories text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_coupon(p_code text, p_cart_total_cents integer, p_categories text[]) TO anon;
GRANT ALL ON FUNCTION public.validate_coupon(p_code text, p_cart_total_cents integer, p_categories text[]) TO authenticated;
GRANT ALL ON FUNCTION public.validate_coupon(p_code text, p_cart_total_cents integer, p_categories text[]) TO service_role;


--
-- Name: FUNCTION validate_inventory(p_product_id text, p_requested integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.validate_inventory(p_product_id text, p_requested integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_inventory(p_product_id text, p_requested integer) TO anon;
GRANT ALL ON FUNCTION public.validate_inventory(p_product_id text, p_requested integer) TO authenticated;
GRANT ALL ON FUNCTION public.validate_inventory(p_product_id text, p_requested integer) TO service_role;


--
-- Name: TABLE "Branch"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."Branch" TO anon;
GRANT ALL ON TABLE public."Branch" TO authenticated;
GRANT ALL ON TABLE public."Branch" TO service_role;


--
-- Name: TABLE "DeliveryAssignment"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."DeliveryAssignment" TO anon;
GRANT ALL ON TABLE public."DeliveryAssignment" TO authenticated;
GRANT ALL ON TABLE public."DeliveryAssignment" TO service_role;


--
-- Name: TABLE "DeliveryZone"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."DeliveryZone" TO anon;
GRANT ALL ON TABLE public."DeliveryZone" TO authenticated;
GRANT ALL ON TABLE public."DeliveryZone" TO service_role;


--
-- Name: TABLE "DriverLocation"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."DriverLocation" TO anon;
GRANT ALL ON TABLE public."DriverLocation" TO authenticated;
GRANT ALL ON TABLE public."DriverLocation" TO service_role;


--
-- Name: TABLE "DriverProfile"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."DriverProfile" TO anon;
GRANT ALL ON TABLE public."DriverProfile" TO authenticated;
GRANT ALL ON TABLE public."DriverProfile" TO service_role;


--
-- Name: TABLE "DriverSession"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."DriverSession" TO anon;
GRANT ALL ON TABLE public."DriverSession" TO authenticated;
GRANT ALL ON TABLE public."DriverSession" TO service_role;


--
-- Name: TABLE "NotificationLog"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."NotificationLog" TO anon;
GRANT ALL ON TABLE public."NotificationLog" TO authenticated;
GRANT ALL ON TABLE public."NotificationLog" TO service_role;


--
-- Name: TABLE "NotificationToken"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."NotificationToken" TO anon;
GRANT ALL ON TABLE public."NotificationToken" TO authenticated;
GRANT ALL ON TABLE public."NotificationToken" TO service_role;


--
-- Name: TABLE _prisma_migrations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public._prisma_migrations TO service_role;


--
-- Name: TABLE addresses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.addresses TO anon;
GRANT ALL ON TABLE public.addresses TO authenticated;
GRANT ALL ON TABLE public.addresses TO service_role;


--
-- Name: TABLE admin_audit_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.admin_audit_log TO anon;
GRANT ALL ON TABLE public.admin_audit_log TO authenticated;
GRANT ALL ON TABLE public.admin_audit_log TO service_role;


--
-- Name: TABLE allergies; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.allergies TO anon;
GRANT ALL ON TABLE public.allergies TO authenticated;
GRANT ALL ON TABLE public.allergies TO service_role;


--
-- Name: TABLE anti_fraud_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.anti_fraud_events TO anon;
GRANT ALL ON TABLE public.anti_fraud_events TO authenticated;
GRANT ALL ON TABLE public.anti_fraud_events TO service_role;


--
-- Name: TABLE available_inventory; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.available_inventory TO anon;
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.available_inventory TO authenticated;
GRANT ALL ON TABLE public.available_inventory TO service_role;


--
-- Name: TABLE cancellations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cancellations TO anon;
GRANT ALL ON TABLE public.cancellations TO authenticated;
GRANT ALL ON TABLE public.cancellations TO service_role;


--
-- Name: TABLE cart_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cart_items TO anon;
GRANT ALL ON TABLE public.cart_items TO authenticated;
GRANT ALL ON TABLE public.cart_items TO service_role;


--
-- Name: TABLE conditions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.conditions TO anon;
GRANT ALL ON TABLE public.conditions TO authenticated;
GRANT ALL ON TABLE public.conditions TO service_role;


--
-- Name: TABLE coupon_batches; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.coupon_batches TO anon;
GRANT ALL ON TABLE public.coupon_batches TO authenticated;
GRANT ALL ON TABLE public.coupon_batches TO service_role;


--
-- Name: TABLE coupon_redemptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.coupon_redemptions TO anon;
GRANT ALL ON TABLE public.coupon_redemptions TO authenticated;
GRANT ALL ON TABLE public.coupon_redemptions TO service_role;


--
-- Name: TABLE coupons; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.coupons TO anon;
GRANT ALL ON TABLE public.coupons TO authenticated;
GRANT ALL ON TABLE public.coupons TO service_role;


--
-- Name: TABLE dependents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dependents TO anon;
GRANT ALL ON TABLE public.dependents TO authenticated;
GRANT ALL ON TABLE public.dependents TO service_role;


--
-- Name: TABLE dose_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dose_logs TO anon;
GRANT ALL ON TABLE public.dose_logs TO authenticated;
GRANT ALL ON TABLE public.dose_logs TO service_role;


--
-- Name: TABLE driver_locations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.driver_locations TO anon;
GRANT ALL ON TABLE public.driver_locations TO authenticated;
GRANT ALL ON TABLE public.driver_locations TO service_role;


--
-- Name: TABLE drug_interactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.drug_interactions TO anon;
GRANT ALL ON TABLE public.drug_interactions TO authenticated;
GRANT ALL ON TABLE public.drug_interactions TO service_role;


--
-- Name: TABLE favorites; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.favorites TO anon;
GRANT ALL ON TABLE public.favorites TO authenticated;
GRANT ALL ON TABLE public.favorites TO service_role;


--
-- Name: TABLE gift_catalog; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.gift_catalog TO anon;
GRANT ALL ON TABLE public.gift_catalog TO authenticated;
GRANT ALL ON TABLE public.gift_catalog TO service_role;


--
-- Name: TABLE gift_inventory; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.gift_inventory TO anon;
GRANT ALL ON TABLE public.gift_inventory TO authenticated;
GRANT ALL ON TABLE public.gift_inventory TO service_role;


--
-- Name: TABLE gift_redemptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.gift_redemptions TO anon;
GRANT ALL ON TABLE public.gift_redemptions TO authenticated;
GRANT ALL ON TABLE public.gift_redemptions TO service_role;


--
-- Name: TABLE inbox_notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.inbox_notifications TO anon;
GRANT ALL ON TABLE public.inbox_notifications TO authenticated;
GRANT ALL ON TABLE public.inbox_notifications TO service_role;


--
-- Name: TABLE insurance_cards; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.insurance_cards TO anon;
GRANT ALL ON TABLE public.insurance_cards TO authenticated;
GRANT ALL ON TABLE public.insurance_cards TO service_role;


--
-- Name: TABLE integration_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.integration_events TO anon;
GRANT ALL ON TABLE public.integration_events TO authenticated;
GRANT ALL ON TABLE public.integration_events TO service_role;


--
-- Name: SEQUENCE integration_events_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.integration_events_id_seq TO anon;
GRANT ALL ON SEQUENCE public.integration_events_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.integration_events_id_seq TO service_role;


--
-- Name: TABLE inventory; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.inventory TO anon;
GRANT ALL ON TABLE public.inventory TO authenticated;
GRANT ALL ON TABLE public.inventory TO service_role;


--
-- Name: TABLE inventory_reservations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.inventory_reservations TO anon;
GRANT ALL ON TABLE public.inventory_reservations TO authenticated;
GRANT ALL ON TABLE public.inventory_reservations TO service_role;


--
-- Name: TABLE loyalty_config; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.loyalty_config TO anon;
GRANT ALL ON TABLE public.loyalty_config TO authenticated;
GRANT ALL ON TABLE public.loyalty_config TO service_role;


--
-- Name: TABLE loyalty_ledger; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.loyalty_ledger TO anon;
GRANT ALL ON TABLE public.loyalty_ledger TO authenticated;
GRANT ALL ON TABLE public.loyalty_ledger TO service_role;


--
-- Name: TABLE loyalty_point_awards; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.loyalty_point_awards TO anon;
GRANT ALL ON TABLE public.loyalty_point_awards TO authenticated;
GRANT ALL ON TABLE public.loyalty_point_awards TO service_role;


--
-- Name: SEQUENCE loyalty_point_awards_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.loyalty_point_awards_id_seq TO anon;
GRANT ALL ON SEQUENCE public.loyalty_point_awards_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.loyalty_point_awards_id_seq TO service_role;


--
-- Name: TABLE loyalty_user_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.loyalty_user_history TO anon;
GRANT ALL ON TABLE public.loyalty_user_history TO authenticated;
GRANT ALL ON TABLE public.loyalty_user_history TO service_role;


--
-- Name: TABLE loyalty_wallets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.loyalty_wallets TO anon;
GRANT ALL ON TABLE public.loyalty_wallets TO authenticated;
GRANT ALL ON TABLE public.loyalty_wallets TO service_role;


--
-- Name: TABLE medication_reminders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.medication_reminders TO anon;
GRANT ALL ON TABLE public.medication_reminders TO authenticated;
GRANT ALL ON TABLE public.medication_reminders TO service_role;


--
-- Name: TABLE notification_batches; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_batches TO anon;
GRANT ALL ON TABLE public.notification_batches TO authenticated;
GRANT ALL ON TABLE public.notification_batches TO service_role;


--
-- Name: TABLE notification_deliveries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_deliveries TO anon;
GRANT ALL ON TABLE public.notification_deliveries TO authenticated;
GRANT ALL ON TABLE public.notification_deliveries TO service_role;


--
-- Name: TABLE notification_delivery_attempts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_delivery_attempts TO anon;
GRANT ALL ON TABLE public.notification_delivery_attempts TO authenticated;
GRANT ALL ON TABLE public.notification_delivery_attempts TO service_role;


--
-- Name: TABLE notification_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_templates TO anon;
GRANT ALL ON TABLE public.notification_templates TO authenticated;
GRANT ALL ON TABLE public.notification_templates TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE order_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.order_items TO anon;
GRANT ALL ON TABLE public.order_items TO authenticated;
GRANT ALL ON TABLE public.order_items TO service_role;


--
-- Name: SEQUENCE order_items_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.order_items_id_seq TO anon;
GRANT ALL ON SEQUENCE public.order_items_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.order_items_id_seq TO service_role;


--
-- Name: TABLE order_notes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.order_notes TO anon;
GRANT ALL ON TABLE public.order_notes TO authenticated;
GRANT ALL ON TABLE public.order_notes TO service_role;


--
-- Name: TABLE order_prescriptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.order_prescriptions TO anon;
GRANT ALL ON TABLE public.order_prescriptions TO authenticated;
GRANT ALL ON TABLE public.order_prescriptions TO service_role;


--
-- Name: TABLE order_status_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.order_status_history TO anon;
GRANT ALL ON TABLE public.order_status_history TO authenticated;
GRANT ALL ON TABLE public.order_status_history TO service_role;


--
-- Name: TABLE pharmacies; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pharmacies TO anon;
GRANT ALL ON TABLE public.pharmacies TO authenticated;
GRANT ALL ON TABLE public.pharmacies TO service_role;


--
-- Name: TABLE product_reviews; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.product_reviews TO anon;
GRANT ALL ON TABLE public.product_reviews TO authenticated;
GRANT ALL ON TABLE public.product_reviews TO service_role;


--
-- Name: TABLE product_review_stats; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.product_review_stats TO anon;
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.product_review_stats TO authenticated;
GRANT ALL ON TABLE public.product_review_stats TO service_role;


--
-- Name: TABLE referral_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.referral_codes TO anon;
GRANT ALL ON TABLE public.referral_codes TO authenticated;
GRANT ALL ON TABLE public.referral_codes TO service_role;


--
-- Name: TABLE referral_rewards; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.referral_rewards TO anon;
GRANT ALL ON TABLE public.referral_rewards TO authenticated;
GRANT ALL ON TABLE public.referral_rewards TO service_role;


--
-- Name: TABLE refunds; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.refunds TO anon;
GRANT ALL ON TABLE public.refunds TO authenticated;
GRANT ALL ON TABLE public.refunds TO service_role;


--
-- Name: TABLE return_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.return_items TO anon;
GRANT ALL ON TABLE public.return_items TO authenticated;
GRANT ALL ON TABLE public.return_items TO service_role;


--
-- Name: TABLE return_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.return_requests TO anon;
GRANT ALL ON TABLE public.return_requests TO authenticated;
GRANT ALL ON TABLE public.return_requests TO service_role;


--
-- Name: TABLE return_timeline; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.return_timeline TO anon;
GRANT ALL ON TABLE public.return_timeline TO authenticated;
GRANT ALL ON TABLE public.return_timeline TO service_role;


--
-- Name: TABLE review_helpful_votes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.review_helpful_votes TO anon;
GRANT ALL ON TABLE public.review_helpful_votes TO authenticated;
GRANT ALL ON TABLE public.review_helpful_votes TO service_role;


--
-- Name: TABLE reward_audit_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reward_audit_logs TO anon;
GRANT ALL ON TABLE public.reward_audit_logs TO authenticated;
GRANT ALL ON TABLE public.reward_audit_logs TO service_role;


--
-- Name: TABLE reward_campaigns; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reward_campaigns TO anon;
GRANT ALL ON TABLE public.reward_campaigns TO authenticated;
GRANT ALL ON TABLE public.reward_campaigns TO service_role;


--
-- Name: TABLE reward_idempotency_keys; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reward_idempotency_keys TO anon;
GRANT ALL ON TABLE public.reward_idempotency_keys TO authenticated;
GRANT ALL ON TABLE public.reward_idempotency_keys TO service_role;


--
-- Name: TABLE reward_rules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reward_rules TO anon;
GRANT ALL ON TABLE public.reward_rules TO authenticated;
GRANT ALL ON TABLE public.reward_rules TO service_role;


--
-- Name: TABLE reward_tiers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reward_tiers TO anon;
GRANT ALL ON TABLE public.reward_tiers TO authenticated;
GRANT ALL ON TABLE public.reward_tiers TO service_role;


--
-- Name: TABLE search_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.search_events TO anon;
GRANT ALL ON TABLE public.search_events TO authenticated;
GRANT ALL ON TABLE public.search_events TO service_role;


--
-- Name: TABLE search_analytics_daily_summary; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.search_analytics_daily_summary TO anon;
GRANT ALL ON TABLE public.search_analytics_daily_summary TO authenticated;
GRANT ALL ON TABLE public.search_analytics_daily_summary TO service_role;


--
-- Name: TABLE search_analytics_top_queries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.search_analytics_top_queries TO anon;
GRANT ALL ON TABLE public.search_analytics_top_queries TO authenticated;
GRANT ALL ON TABLE public.search_analytics_top_queries TO service_role;


--
-- Name: TABLE search_analytics_zero_result_queries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.search_analytics_zero_result_queries TO anon;
GRANT ALL ON TABLE public.search_analytics_zero_result_queries TO authenticated;
GRANT ALL ON TABLE public.search_analytics_zero_result_queries TO service_role;


--
-- Name: SEQUENCE search_events_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.search_events_id_seq TO anon;
GRANT ALL ON SEQUENCE public.search_events_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.search_events_id_seq TO service_role;


--
-- Name: TABLE search_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.search_sessions TO anon;
GRANT ALL ON TABLE public.search_sessions TO authenticated;
GRANT ALL ON TABLE public.search_sessions TO service_role;


--
-- Name: TABLE search_synonyms; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.search_synonyms TO anon;
GRANT ALL ON TABLE public.search_synonyms TO authenticated;
GRANT ALL ON TABLE public.search_synonyms TO service_role;


--
-- Name: SEQUENCE search_synonyms_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.search_synonyms_id_seq TO anon;
GRANT ALL ON SEQUENCE public.search_synonyms_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.search_synonyms_id_seq TO service_role;


--
-- Name: TABLE sms_audit_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sms_audit_log TO anon;
GRANT ALL ON TABLE public.sms_audit_log TO authenticated;
GRANT ALL ON TABLE public.sms_audit_log TO service_role;


--
-- Name: TABLE sms_campaign_recipients; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sms_campaign_recipients TO anon;
GRANT ALL ON TABLE public.sms_campaign_recipients TO authenticated;
GRANT ALL ON TABLE public.sms_campaign_recipients TO service_role;


--
-- Name: TABLE sms_campaigns; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sms_campaigns TO anon;
GRANT ALL ON TABLE public.sms_campaigns TO authenticated;
GRANT ALL ON TABLE public.sms_campaigns TO service_role;


--
-- Name: TABLE special_order_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.special_order_requests TO anon;
GRANT ALL ON TABLE public.special_order_requests TO authenticated;
GRANT ALL ON TABLE public.special_order_requests TO service_role;


--
-- Name: TABLE special_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.special_orders TO anon;
GRANT ALL ON TABLE public.special_orders TO authenticated;
GRANT ALL ON TABLE public.special_orders TO service_role;


--
-- Name: TABLE stock_movements; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stock_movements TO anon;
GRANT ALL ON TABLE public.stock_movements TO authenticated;
GRANT ALL ON TABLE public.stock_movements TO service_role;


--
-- Name: TABLE user_deletion_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_deletion_log TO anon;
GRANT ALL ON TABLE public.user_deletion_log TO authenticated;
GRANT ALL ON TABLE public.user_deletion_log TO service_role;


--
-- Name: TABLE user_devices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_devices TO anon;
GRANT ALL ON TABLE public.user_devices TO authenticated;
GRANT ALL ON TABLE public.user_devices TO service_role;


--
-- Name: TABLE user_suspensions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_suspensions TO anon;
GRANT ALL ON TABLE public.user_suspensions TO authenticated;
GRANT ALL ON TABLE public.user_suspensions TO service_role;


--
-- Name: TABLE wishlist_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wishlist_items TO anon;
GRANT ALL ON TABLE public.wishlist_items TO authenticated;
GRANT ALL ON TABLE public.wishlist_items TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict e2L2yFoAax8NW7eYlb5caDL6MpnDbB0HwowWo6hfhmUK0miNctdqaGHKdvvP4ua

