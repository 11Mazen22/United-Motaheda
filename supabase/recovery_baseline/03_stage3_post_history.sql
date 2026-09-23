-- ============================================================================
-- STAGE 3: POST-HISTORY RECONCILIATION
-- ============================================================================
-- Run AFTER all 120 files in supabase/migrations/ have replayed in order.
-- Contains every remaining genuinely-missing object that is NOT required by
-- any historical migration: the other 38 of the 59 Prisma-only tables, 46
-- of the 57 missing functions, all 19 missing triggers + 2 auth triggers,
-- all 143 missing policies, storage config, and 0 of 3 missing views (2
-- moved to Stage 1, 1 deliberately excluded).
--
-- These objects are safe here specifically BECAUSE nothing in the 120
-- migrations references them by name (proven via exhaustive text sweep) --
-- placing them here, not before, avoids the exact class of bug this whole
-- exercise exists to catch (a final-state definition failing mid-replay
-- because it pre-empted an object a migration was still going to create).
--
-- CORRECTIONS (found during batch replay verification): 4 of the original 47
-- tables were moved OUT of this file and into 02_stage1_pre_history.sql --
-- the "exhaustive text sweep" mentioned above missed all four:
--   - search_events: queried directly by
--     20260826099000_product_intelligence_stage6_analytics_views.sql.
--   - delivery_issues: ALTER TABLE'd (a hard dependency, not a guarded
--     to_regclass() check) by 20260827010000_delivery_issue_photos.sql.
--   - NotificationLog, NotificationToken: ALTER TABLE ... ENABLE ROW LEVEL
--     SECURITY'd by 20260902140000_close_anon_write_and_auth_gaps.sql.
-- Each one's CREATE TABLE, PK, FK, and indexes now live in Stage 1; their
-- policies remain below, unchanged, since is_manager()/profiles already
-- exist by Stage 3 either way. Also, DriverProfile_userId_key (a UNIQUE
-- constraint, not a table) was similarly moved into Stage 1 -- see that
-- file's own comment and FINAL_baseline_manifest.md's correction note.
-- ============================================================================

-- SET check_function_bodies = false: ADDED after hitting, during the actual
-- replay run against aimqudywbzajaabkghwr:
--   `ERROR: 42703: column p.code does not exist`
--   `HINT:  Perhaps you meant to reference the column "p.Code".`
-- on CREATE FUNCTION public.get_catalog_light(). That function's body (also
-- references i.available on public.inventory, which only has on_hand/
-- reserved) is copied verbatim from public_schema_live_dump.sql line 3414 --
-- it is a broken/dead function in the live production database too, and
-- pg_dump's own output (public_schema_live_dump.sql line 17) sets this same
-- session GUC precisely so a body like this can still be recreated exactly
-- as it exists live, without Postgres validating column references at
-- CREATE FUNCTION time. Neither stage file had this set. Matches upstream
-- convention; not a behavior change to any working function.
SET check_function_bodies = false;

-- ---- Remaining custom types (used only by post-history tables) ----
-- MOVED HERE from below the tables section (original placement caused:
-- `ERROR: 42704: type "public.DeliveryStatus" does not exist` at the
-- DeliveryAssignment.status column, during the actual replay run against
-- aimqudywbzajaabkghwr -- CREATE TYPE must precede any CREATE TABLE that
-- references it. Also fixes the same latent ordering issue for
-- allergy_severity (allergies.severity), interaction_severity
-- (drug_interactions.severity), and reminder_freq
-- (medication_reminders.frequency), all originally declared after the
-- tables that use them.
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
CREATE TYPE public.allergy_severity AS ENUM (
    'mild',
    'moderate',
    'severe'
);
CREATE TYPE public.interaction_severity AS ENUM (
    'mild',
    'moderate',
    'severe'
);
CREATE TYPE public.reminder_freq AS ENUM (
    'daily',
    'weekly',
    'custom'
);

-- ---- Remaining 47 tables (of the 59; 12 already created in Stage 1) ----
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
CREATE TABLE public.admin_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid,
    action text NOT NULL,
    target_user_id uuid,
    target_user_email text,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.allergies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    severity public.allergy_severity DEFAULT 'moderate'::public.allergy_severity NOT NULL,
    reaction text,
    notes text,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);
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
CREATE TABLE public.cart_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id text NOT NULL,
    quantity integer NOT NULL,
    product_snapshot jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cart_items_quantity_check CHECK ((quantity > 0))
);
CREATE TABLE public.conditions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    since date,
    managed boolean DEFAULT true NOT NULL,
    notes text,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);
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
CREATE TABLE public.favorites (
    user_id uuid NOT NULL,
    product_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
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
CREATE TABLE public.inventory (
    product_id uuid NOT NULL,
    on_hand integer DEFAULT 0,
    reserved integer DEFAULT 0
);
CREATE TABLE public.loyalty_config (
    id integer DEFAULT 1 NOT NULL,
    points_per_egp numeric(6,2) DEFAULT 1.0 NOT NULL,
    min_order_egp numeric(10,2) DEFAULT 0.0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loyalty_config_id_check CHECK ((id = 1))
);
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
CREATE TABLE public.loyalty_point_awards (
    id bigint NOT NULL,
    order_id uuid NOT NULL,
    user_id uuid,
    points integer NOT NULL,
    awarded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loyalty_point_awards_points_check CHECK ((points > 0))
);
CREATE TABLE public.loyalty_wallets (
    user_id uuid NOT NULL,
    balance integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loyalty_wallets_balance_check CHECK ((balance >= 0))
);
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
CREATE TABLE public.referral_codes (
    user_id uuid NOT NULL,
    code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
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
CREATE TABLE public.review_helpful_votes (
    review_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
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
CREATE TABLE public.reward_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    kind text NOT NULL,
    params jsonb DEFAULT '{}'::jsonb NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reward_rules_kind_check CHECK ((kind = ANY (ARRAY['cashback'::text, 'flat_earn'::text, 'multiplier'::text, 'tier_bonus'::text])))
);
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
CREATE TABLE public.wishlist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id text NOT NULL,
    product_snapshot jsonb NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ---- RLS enable (bug fix, found by the final smoke-test pass) ----
-- Same class of bug as Stage 1's own note above: extractTable() dropped the
-- table-level ENABLE ROW LEVEL SECURITY line pg_dump emits per table.
ALTER TABLE public."DeliveryAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DriverLocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DriverSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anti_fraud_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dose_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drug_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_point_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_helpful_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_order_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_deletion_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

-- ---- Deferred index from a Stage 1 (pre-history) table ----
-- idx_products_name_ar_norm_trgm calls normalize_arabic(), a function
-- created by a historical migration -- it could not be created in Stage 1
-- (before migrations run) and is deferred here instead.
CREATE INDEX idx_products_name_ar_norm_trgm ON public.products USING gist (public.normalize_arabic("Name_Ar") public.gist_trgm_ops);

-- (Remaining custom types -- DeliveryStatus, allergy_severity,
-- interaction_severity, reminder_freq -- moved up above the "Remaining 47
-- tables" section; see the comment there citing the exact CREATE TYPE
-- ordering error hit during replay.)

-- ---- Remaining 46 functions (of the 57; is_manager/fold_search/the 8
-- internal loyalty+inventory helpers/create_checkout_order already in
-- Stage 1 -- see that file's placement-correction comments) ----
CREATE FUNCTION public.admin_get_last_sign_in(user_ids uuid[]) RETURNS TABLE(id uuid, last_sign_in_at timestamp with time zone, email_confirmed_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
     select u.id, u.last_sign_in_at, u.email_confirmed_at
     from auth.users u
     where u.id = any(user_ids) and public.is_manager();
   $$;

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

CREATE FUNCTION public.apply_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

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

CREATE FUNCTION public.current_app_role(p_user_id uuid DEFAULT auth.uid()) RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(
    (select role from public.profiles where id = p_user_id),
    'customer'::public.app_role
  );
$$;

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

CREATE FUNCTION public.has_permission(p_permission_key text, p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  return public.is_manager(p_user_id);
end;
$$;

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

CREATE FUNCTION public.inventory_state_touch() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  new.version    := old.version + 1;
  return new;
end;
$$;

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

CREATE FUNCTION public.is_driver(p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.current_app_role(p_user_id) = 'driver'::public.app_role;
$$;

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

CREATE FUNCTION public.loyalty_accounts_touch() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  new.version    := old.version + 1;
  return new;
end;
$$;

CREATE FUNCTION public.notification_unread_count(p_user_id uuid DEFAULT auth.uid()) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.notifications
  WHERE user_id = p_user_id AND is_read = FALSE;
$$;

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

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

CREATE FUNCTION public.touch_review_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;

CREATE FUNCTION public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

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


-- ---- Constraints, pass 1: PRIMARY KEY / UNIQUE for the remaining 47 tables ----
-- Same two-pass ordering as Stage 1, for the same reason (PK/UNIQUE before
-- any FK, across all tables, not per-table).
ALTER TABLE ONLY public."DeliveryAssignment"
    ADD CONSTRAINT "DeliveryAssignment_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."DriverLocation"
    ADD CONSTRAINT "DriverLocation_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."DriverSession"
    ADD CONSTRAINT "DriverSession_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.allergies
    ADD CONSTRAINT allergies_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.anti_fraud_events
    ADD CONSTRAINT anti_fraud_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.conditions
    ADD CONSTRAINT conditions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.dose_logs
    ADD CONSTRAINT dose_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.drug_interactions
    ADD CONSTRAINT drug_interactions_drug_a_drug_b_key UNIQUE (drug_a, drug_b);
ALTER TABLE ONLY public.drug_interactions
    ADD CONSTRAINT drug_interactions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (user_id, product_id);
ALTER TABLE ONLY public.gift_catalog
    ADD CONSTRAINT gift_catalog_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.gift_inventory
    ADD CONSTRAINT gift_inventory_pkey PRIMARY KEY (gift_id);
ALTER TABLE ONLY public.gift_redemptions
    ADD CONSTRAINT gift_redemptions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.insurance_cards
    ADD CONSTRAINT insurance_cards_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.integration_events
    ADD CONSTRAINT integration_events_dedupe_key_key UNIQUE (dedupe_key);
ALTER TABLE ONLY public.integration_events
    ADD CONSTRAINT integration_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (product_id);
ALTER TABLE ONLY public.loyalty_config
    ADD CONSTRAINT loyalty_config_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.loyalty_ledger
    ADD CONSTRAINT loyalty_ledger_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.loyalty_point_awards
    ADD CONSTRAINT loyalty_point_awards_order_id_key UNIQUE (order_id);
ALTER TABLE ONLY public.loyalty_point_awards
    ADD CONSTRAINT loyalty_point_awards_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.loyalty_wallets
    ADD CONSTRAINT loyalty_wallets_pkey PRIMARY KEY (user_id);
ALTER TABLE ONLY public.medication_reminders
    ADD CONSTRAINT medication_reminders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.referral_codes
    ADD CONSTRAINT referral_codes_pkey PRIMARY KEY (user_id);
ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.review_helpful_votes
    ADD CONSTRAINT review_helpful_votes_pkey PRIMARY KEY (review_id, user_id);
ALTER TABLE ONLY public.reward_audit_logs
    ADD CONSTRAINT reward_audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.reward_rules
    ADD CONSTRAINT reward_rules_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.special_order_requests
    ADD CONSTRAINT special_order_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.special_orders
    ADD CONSTRAINT special_orders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_deletion_log
    ADD CONSTRAINT user_deletion_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_suspensions
    ADD CONSTRAINT user_suspensions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_pkey PRIMARY KEY (id);

-- ---- Constraints, pass 2: FOREIGN KEY for the remaining 47 tables ----
-- Safe here regardless of target: every table in the whole schema (Stage 1
-- + all 120 migrations + Stage 3's own tables above) already exists by
-- this point.
ALTER TABLE ONLY public."DeliveryAssignment"
    ADD CONSTRAINT "DeliveryAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES public."DriverProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."DeliveryAssignment"
    ADD CONSTRAINT "DeliveryAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."DriverLocation"
    ADD CONSTRAINT "DriverLocation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES public."DriverProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."DriverSession"
    ADD CONSTRAINT "DriverSession_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES public."DriverProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.allergies
    ADD CONSTRAINT allergies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.anti_fraud_events
    ADD CONSTRAINT anti_fraud_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.conditions
    ADD CONSTRAINT conditions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.dose_logs
    ADD CONSTRAINT dose_logs_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.dose_logs
    ADD CONSTRAINT dose_logs_reminder_id_fkey FOREIGN KEY (reminder_id) REFERENCES public.medication_reminders(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.dose_logs
    ADD CONSTRAINT dose_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.gift_inventory
    ADD CONSTRAINT gift_inventory_gift_id_fkey FOREIGN KEY (gift_id) REFERENCES public.gift_catalog(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.gift_redemptions
    ADD CONSTRAINT gift_redemptions_gift_id_fkey FOREIGN KEY (gift_id) REFERENCES public.gift_catalog(id);
ALTER TABLE ONLY public.gift_redemptions
    ADD CONSTRAINT gift_redemptions_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES public.loyalty_ledger(id);
ALTER TABLE ONLY public.gift_redemptions
    ADD CONSTRAINT gift_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.insurance_cards
    ADD CONSTRAINT insurance_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE ONLY public.loyalty_ledger
    ADD CONSTRAINT loyalty_ledger_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.loyalty_ledger
    ADD CONSTRAINT loyalty_ledger_parent_ledger_id_fkey FOREIGN KEY (parent_ledger_id) REFERENCES public.loyalty_ledger(id);
ALTER TABLE ONLY public.loyalty_ledger
    ADD CONSTRAINT loyalty_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.loyalty_point_awards
    ADD CONSTRAINT loyalty_point_awards_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.loyalty_wallets
    ADD CONSTRAINT loyalty_wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.medication_reminders
    ADD CONSTRAINT medication_reminders_dependent_id_fkey FOREIGN KEY (dependent_id) REFERENCES public.dependents(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.medication_reminders
    ADD CONSTRAINT medication_reminders_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.medication_reminders
    ADD CONSTRAINT medication_reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.referral_codes
    ADD CONSTRAINT referral_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES public.loyalty_ledger(id);
ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_referee_first_order_id_fkey FOREIGN KEY (referee_first_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_referee_id_fkey FOREIGN KEY (referee_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.review_helpful_votes
    ADD CONSTRAINT review_helpful_votes_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.product_reviews(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.review_helpful_votes
    ADD CONSTRAINT review_helpful_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reward_audit_logs
    ADD CONSTRAINT reward_audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.reward_audit_logs
    ADD CONSTRAINT reward_audit_logs_subject_user_id_fkey FOREIGN KEY (subject_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.reward_rules
    ADD CONSTRAINT reward_rules_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.reward_campaigns(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.special_order_requests
    ADD CONSTRAINT special_order_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.inventory_reservations(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.user_deletion_log
    ADD CONSTRAINT user_deletion_log_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.user_suspensions
    ADD CONSTRAINT user_suspensions_suspended_by_fkey FOREIGN KEY (suspended_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.user_suspensions
    ADD CONSTRAINT user_suspensions_unsuspended_by_fkey FOREIGN KEY (unsuspended_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.user_suspensions
    ADD CONSTRAINT user_suspensions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ---- Indexes for the remaining 47 tables ----
CREATE INDEX "DeliveryAssignment_driverId_deliveredAt_idx" ON public."DeliveryAssignment" USING btree ("driverId", "deliveredAt" DESC);
CREATE INDEX "DeliveryAssignment_driverId_status_idx" ON public."DeliveryAssignment" USING btree ("driverId", status);
CREATE INDEX "DeliveryAssignment_orderId_idx" ON public."DeliveryAssignment" USING btree ("orderId");
CREATE UNIQUE INDEX "DeliveryAssignment_orderId_key" ON public."DeliveryAssignment" USING btree ("orderId");
CREATE INDEX "DeliveryAssignment_status_assignedAt_idx" ON public."DeliveryAssignment" USING btree (status, "assignedAt" DESC);
CREATE INDEX "DriverLocation_driverId_timestamp_idx" ON public."DriverLocation" USING btree ("driverId", "timestamp" DESC);
CREATE INDEX "DriverLocation_timestamp_idx" ON public."DriverLocation" USING btree ("timestamp" DESC);
CREATE INDEX "DriverSession_driverId_startedAt_idx" ON public."DriverSession" USING btree ("driverId", "startedAt" DESC);
CREATE INDEX allergies_user_idx ON public.allergies USING btree (user_id);
CREATE INDEX anti_fraud_severity_idx ON public.anti_fraud_events USING btree (severity, detected_at DESC);
CREATE INDEX anti_fraud_user_idx ON public.anti_fraud_events USING btree (user_id, detected_at DESC);
CREATE INDEX cart_items_user_idx ON public.cart_items USING btree (user_id, updated_at DESC);
CREATE UNIQUE INDEX cart_items_user_product_uniq ON public.cart_items USING btree (user_id, product_id);
CREATE INDEX conditions_user_idx ON public.conditions USING btree (user_id);
CREATE INDEX dose_logs_user_idx ON public.dose_logs USING btree (user_id, taken_at DESC);
CREATE INDEX interactions_drug_b_idx ON public.drug_interactions USING btree (drug_b);
CREATE INDEX interactions_drug_idx ON public.drug_interactions USING btree (drug_a);
CREATE INDEX favorites_user_id_idx ON public.favorites USING btree (user_id);
CREATE INDEX gift_catalog_active_idx ON public.gift_catalog USING btree (is_active) WHERE (is_active = true);
CREATE INDEX gift_catalog_cost_idx ON public.gift_catalog USING btree (points_cost) WHERE (is_active = true);
CREATE INDEX gift_redemptions_pending_idx ON public.gift_redemptions USING btree (state, expires_at) WHERE (state = 'reserved'::text);
CREATE INDEX gift_redemptions_user_idx ON public.gift_redemptions USING btree (user_id, reserved_at DESC);
CREATE UNIQUE INDEX insurance_one_primary ON public.insurance_cards USING btree (user_id) WHERE (is_primary = true);
CREATE INDEX integration_events_aggregate_idx ON public.integration_events USING btree (aggregate_type, aggregate_id, occurred_at DESC);
CREATE INDEX integration_events_event_type_idx ON public.integration_events USING btree (event_type, occurred_at DESC);
CREATE INDEX integration_events_occurred_at_idx ON public.integration_events USING btree (occurred_at DESC);
CREATE INDEX integration_events_processed_idx ON public.integration_events USING btree (processed_at, occurred_at DESC);
CREATE UNIQUE INDEX loyalty_ledger_idempotency_uniq ON public.loyalty_ledger USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE UNIQUE INDEX loyalty_ledger_reversal_uniq ON public.loyalty_ledger USING btree (parent_ledger_id) WHERE (parent_ledger_id IS NOT NULL);
CREATE INDEX loyalty_ledger_source_idx ON public.loyalty_ledger USING btree (source, source_ref);
CREATE INDEX loyalty_ledger_user_idx ON public.loyalty_ledger USING btree (user_id, created_at DESC);
CREATE INDEX loyalty_ledger_user_time_idx ON public.loyalty_ledger USING btree (user_id, created_at DESC);
CREATE INDEX loyalty_point_awards_user_idx ON public.loyalty_point_awards USING btree (user_id, awarded_at DESC);
CREATE INDEX reminders_user_idx ON public.medication_reminders USING btree (user_id, enabled);
CREATE UNIQUE INDEX referral_codes_code_uniq ON public.referral_codes USING btree (code);
CREATE UNIQUE INDEX referral_rewards_referee_uniq ON public.referral_rewards USING btree (referee_id);
CREATE INDEX referral_rewards_referrer_idx ON public.referral_rewards USING btree (referrer_id, created_at DESC);
CREATE INDEX review_helpful_votes_review_idx ON public.review_helpful_votes USING btree (review_id);
CREATE INDEX reward_audit_logs_kind_idx ON public.reward_audit_logs USING btree (event_kind, event_at DESC);
CREATE INDEX reward_audit_logs_subject_idx ON public.reward_audit_logs USING btree (subject_user_id, event_at DESC);
CREATE INDEX reward_rules_campaign_idx ON public.reward_rules USING btree (campaign_id);
CREATE INDEX special_order_requests_created_at_idx ON public.special_order_requests USING btree (created_at DESC);
CREATE INDEX stock_movements_kind_idx ON public.stock_movements USING btree (kind, created_at DESC);
CREATE INDEX stock_movements_product_time_idx ON public.stock_movements USING btree (product_id, created_at DESC);
CREATE INDEX stock_movements_reservation_idx ON public.stock_movements USING btree (reservation_id) WHERE (reservation_id IS NOT NULL);
CREATE INDEX user_suspensions_user_active_idx ON public.user_suspensions USING btree (user_id, is_active);
CREATE INDEX user_suspensions_user_created_idx ON public.user_suspensions USING btree (user_id, created_at DESC);
CREATE INDEX wishlist_items_user_idx ON public.wishlist_items USING btree (user_id, added_at DESC);
CREATE UNIQUE INDEX wishlist_items_user_product_uniq ON public.wishlist_items USING btree (user_id, product_id);

-- ---- Deferred column reconciliation: coupon_batches ----
-- During the actual replay run against aimqudywbzajaabkghwr, after fixing
-- the trigger and policy duplicates above, hit:
--   `ERROR: 42703: column "is_active" does not exist`
-- on CREATE POLICY "coupon_batches public read", which (correctly, per the
-- live schema) reads is_active/expires_at. Root cause: the only migration
-- that ever touches coupon_batches (20260728090000_coupons.sql) creates it
-- with just 6 columns (id, name, description, created_by, created_at,
-- updated_at); the live production table (public_schema_live_dump.sql,
-- lines 8278-8306) has a materially different shape -- 12 additional
-- columns, 9 CHECK constraints, an FK to reward_campaigns, 2 indexes, and
-- no updated_at -- meaning it was redesigned directly against production
-- with no migration ever committed for it (grepped the whole
-- supabase/migrations/ tree; nothing else references this table's schema).
-- Verified safe: no migration or stage file ever inserts into
-- coupon_batches, so it is empty at this point in the replay -- this
-- reconciliation is structure-only, sourced verbatim from the live dump.
ALTER TABLE public.coupon_batches DROP COLUMN updated_at;
ALTER TABLE public.coupon_batches
  ADD COLUMN discount_kind text NOT NULL,
  ADD COLUMN discount_value integer NOT NULL,
  ADD COLUMN min_spend_cents integer,
  ADD COLUMN max_discount_cents integer,
  ADD COLUMN category_restrictions text[],
  ADD COLUMN points_cost bigint DEFAULT 0 NOT NULL,
  ADD COLUMN total_supply integer,
  ADD COLUMN issued_count integer DEFAULT 0 NOT NULL,
  ADD COLUMN redeemed_count integer DEFAULT 0 NOT NULL,
  ADD COLUMN expires_at timestamp with time zone,
  ADD COLUMN is_active boolean DEFAULT true NOT NULL,
  ADD COLUMN campaign_id uuid;
ALTER TABLE public.coupon_batches
  ADD CONSTRAINT coupon_batches_discount_kind_check CHECK ((discount_kind = ANY (ARRAY['percent'::text, 'flat'::text, 'free_shipping'::text]))),
  ADD CONSTRAINT coupon_batches_discount_value_check CHECK ((discount_value >= 0)),
  ADD CONSTRAINT coupon_batches_issued_count_check CHECK ((issued_count >= 0)),
  ADD CONSTRAINT coupon_batches_max_discount_cents_check CHECK (((max_discount_cents IS NULL) OR (max_discount_cents >= 0))),
  ADD CONSTRAINT coupon_batches_min_spend_cents_check CHECK (((min_spend_cents IS NULL) OR (min_spend_cents >= 0))),
  ADD CONSTRAINT coupon_batches_percent_range CHECK (((discount_kind <> 'percent'::text) OR ((discount_value >= 0) AND (discount_value <= 100)))),
  ADD CONSTRAINT coupon_batches_points_cost_check CHECK ((points_cost >= 0)),
  ADD CONSTRAINT coupon_batches_redeemed_count_check CHECK ((redeemed_count >= 0)),
  ADD CONSTRAINT coupon_batches_supply_respected CHECK (((total_supply IS NULL) OR (issued_count <= total_supply))),
  ADD CONSTRAINT coupon_batches_total_supply_check CHECK (((total_supply IS NULL) OR (total_supply > 0)));
ALTER TABLE public.coupon_batches
  ADD CONSTRAINT coupon_batches_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.reward_campaigns(id) ON DELETE SET NULL;
CREATE INDEX coupon_batches_active_idx ON public.coupon_batches USING btree (is_active, expires_at) WHERE (is_active = true);
CREATE INDEX coupon_batches_campaign_idx ON public.coupon_batches USING btree (campaign_id);

-- ---- Triggers (11 of the original 19 -- 8 REMOVED as duplicates) ----
-- During the actual replay run against aimqudywbzajaabkghwr, hit:
--   `ERROR: 42710: trigger "driver_profile_sync_role_trg" for relation
--   "DriverProfile" already exists`
-- Investigation (grep across supabase/migrations/ for `CREATE TRIGGER`)
-- showed 8 of these 19 triggers are already created by historical
-- migrations, each with its own `DROP TRIGGER IF EXISTS ...` guard, so they
-- exist in the DB well before Stage 3 runs -- the same class of bug as the
-- 4 tables + 1 constraint already documented as moved to Stage 1 above; the
-- "exhaustive text sweep" missed these too. Removed here (not moved, since
-- an identical CREATE TRIGGER already ran historically -- nothing to add):
--   - driver_profile_sync_role_trg  -- 20261010180000_sync_role_on_driver_approval.sql
--   - trg_addresses_updated_at      -- 20260826950000_reconcile_addresses_table.sql
--   - trg_supersede_prior_delivery_assignments -- 20260826980000_delivery_assignments_supersede_and_decline_rpc.sql
--   - trg_post_driver_earning_on_delivery -- 20260826984000_driver_earning_on_delivery.sql
--   - trigger_log_order_status_change -- 20260830110000_cancellation_system_schema.sql
--   - trg_products_invalidate_embedding -- 20260826093000_product_intelligence_stage4_embeddings.sql
--   - profiles_ensure_driver_profile_trg -- 20260902150000_ensure_driver_profile_on_role_change.sql
--   - trg_search_synonyms_updated_at -- 20260826090000_product_intelligence_stage1_core.sql
CREATE TRIGGER addresses_updated_at BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER inventory_state_touch_trg BEFORE UPDATE ON public.inventory_state FOR EACH ROW EXECUTE FUNCTION public.inventory_state_touch();
CREATE TRIGGER trg_sync_product_stock AFTER INSERT OR UPDATE OF total, reserved, committed ON public.inventory_state FOR EACH ROW EXECUTE FUNCTION public.fn_sync_product_stock();
CREATE TRIGGER loyalty_accounts_touch_trg BEFORE UPDATE ON public.loyalty_accounts FOR EACH ROW EXECUTE FUNCTION public.loyalty_accounts_touch();
CREATE TRIGGER trg_award_loyalty_on_payment_verified AFTER UPDATE OF payment_status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.fn_award_loyalty_points_on_payment_verified();
CREATE TRIGGER prescriptions_updated_at BEFORE UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER product_reviews_touch_updated BEFORE UPDATE ON public.product_reviews FOR EACH ROW EXECUTE FUNCTION public.touch_review_updated_at();
CREATE TRIGGER products_search_vector_trg BEFORE INSERT OR UPDATE OF "Name", "Name_Ar", "Name_En", "Code", "Barcode", "Category_Name", "Category_Name_En" ON public.products FOR EACH ROW EXECUTE FUNCTION public.products_search_vector_update();
CREATE TRIGGER profiles_guard_role_status_trg BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_role_status();
CREATE TRIGGER review_helpful_votes_sync_count AFTER INSERT OR DELETE ON public.review_helpful_votes FOR EACH ROW EXECUTE FUNCTION public.sync_review_helpful_count();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.special_orders FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- ---- Auth-schema triggers (2) -- signup/profile-bootstrap pipeline ----
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER on_auth_user_phone_updated AFTER UPDATE OF phone, phone_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION public.sync_profile_phone_from_auth();

-- ---- RLS Policies (114 of the original 143 -- 29 REMOVED as duplicates) ----
-- During the actual replay run against aimqudywbzajaabkghwr, after fixing
-- the trigger duplicates above, hit:
--   `ERROR: 42710: policy "branch_select_all" for table "Branch" already
--   exists`
-- Same investigation method as the trigger fix: grepped supabase/migrations/
-- for every `CREATE POLICY` name+table pair and diffed against this file's
-- 143. Found 29 policies already created by historical migrations (several
-- with their own `DROP POLICY IF EXISTS` guard, several without -- doesn't
-- matter, either way they already exist in the DB by the time Stage 3
-- runs). Same class of bug as the tables/constraint/triggers already
-- documented as corrected above; the "exhaustive text sweep" missed these
-- too. Removed here (not moved -- nothing to add, an identical policy
-- already exists): addresses_owner_all, branch_select_all,
-- delivery_zone_select_all, delivery_assignments_select_pharmacist,
-- delivery_issues_select_pharmacist, inbox_notifications_manager_select,
-- inbox_notifications_select, inbox_notifications_update,
-- notification_batches_manager_all, notification_deliveries_manager_select,
-- notification_templates_select, notifications_insert_admin,
-- order_items_select_pharmacist, order_prescriptions_select_driver,
-- order_prescriptions_select_own, order_prescriptions_select_staff,
-- orders_select_pharmacist, products_delete_managers_only,
-- products_select_all, products_update_staff, products_write_staff,
-- promotion_products_manager_all, promotion_products_public_read,
-- promotions_manager_all, promotions_public_active_read,
-- search_sessions_owner, search_synonyms_admin_write, search_synonyms_read,
-- user_devices_owner.
CREATE POLICY "drivers can read own earnings" ON public."DriverEarning" FOR SELECT TO authenticated USING (("driverId" IN ( SELECT "DriverProfile".id
   FROM public."DriverProfile"
  WHERE ("DriverProfile"."userId" = auth.uid()))));
CREATE POLICY "drivers can create own profile" ON public."DriverProfile" FOR INSERT TO authenticated WITH CHECK ((("userId" = auth.uid()) AND (status = 'PENDING_APPROVAL'::public."DriverStatus")));
CREATE POLICY "drivers can read own profile" ON public."DriverProfile" FOR SELECT TO authenticated USING (("userId" = auth.uid()));
CREATE POLICY "addresses: delete own" ON public.addresses FOR DELETE USING ((auth.uid() = user_id));
CREATE POLICY "addresses: insert own" ON public.addresses FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "addresses: select own" ON public.addresses FOR SELECT USING ((auth.uid() = user_id));
CREATE POLICY "addresses: update own" ON public.addresses FOR UPDATE USING ((auth.uid() = user_id));
CREATE POLICY "audit_log: admin select" ON public.admin_audit_log FOR SELECT USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::public.app_role));
CREATE POLICY "audit_log: admin/manager insert" ON public.admin_audit_log FOR INSERT WITH CHECK ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));
CREATE POLICY "allergies owner all" ON public.allergies USING ((auth.uid() = user_id));
CREATE POLICY "anti_fraud admin read" ON public.anti_fraud_events FOR SELECT USING (public.is_admin());
CREATE POLICY "cart_items owner all" ON public.cart_items USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "conditions owner all" ON public.conditions USING ((auth.uid() = user_id));
CREATE POLICY "coupon_batches admin all" ON public.coupon_batches USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "coupon_batches public read" ON public.coupon_batches FOR SELECT USING (((is_active = true) AND ((expires_at IS NULL) OR (expires_at > now()))));
CREATE POLICY "delivery_assignments: driver select own" ON public.delivery_assignments FOR SELECT USING ((driver_id = auth.uid()));
CREATE POLICY "delivery_assignments: driver update own response" ON public.delivery_assignments FOR UPDATE USING ((driver_id = auth.uid())) WITH CHECK ((driver_id = auth.uid()));
CREATE POLICY "delivery_assignments: staff insert" ON public.delivery_assignments FOR INSERT WITH CHECK ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));
CREATE POLICY "delivery_assignments: staff select all" ON public.delivery_assignments FOR SELECT USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));
CREATE POLICY "delivery_assignments: staff update all" ON public.delivery_assignments FOR UPDATE USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));
CREATE POLICY "delivery_issues: driver insert own" ON public.delivery_issues FOR INSERT WITH CHECK ((driver_id = auth.uid()));
CREATE POLICY "delivery_issues: driver select own" ON public.delivery_issues FOR SELECT USING ((driver_id = auth.uid()));
CREATE POLICY "delivery_issues: staff select all" ON public.delivery_issues FOR SELECT USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));
CREATE POLICY "delivery_issues: staff update (resolve)" ON public.delivery_issues FOR UPDATE USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));
CREATE POLICY "dependents owner all" ON public.dependents USING ((auth.uid() = user_id));
CREATE POLICY "dose_logs owner insert" ON public.dose_logs FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "dose_logs owner read" ON public.dose_logs FOR SELECT USING ((auth.uid() = user_id));
CREATE POLICY "drug_interactions public read" ON public.drug_interactions FOR SELECT USING (true);
CREATE POLICY "Users manage own favorites" ON public.favorites USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "gift_catalog admin all" ON public.gift_catalog USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "gift_catalog public read" ON public.gift_catalog FOR SELECT USING ((is_active = true));
CREATE POLICY "gift_inventory public read" ON public.gift_inventory FOR SELECT USING (true);
CREATE POLICY "gift_redemptions owner read" ON public.gift_redemptions FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));
CREATE POLICY "insurance_cards owner all" ON public.insurance_cards USING ((auth.uid() = user_id));
CREATE POLICY "Integration events service role" ON public.integration_events USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text)) WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));
CREATE POLICY "Integration events staff read" ON public.integration_events FOR SELECT USING ((public.is_manager() OR public.has_permission('sheets.sync'::text)));
CREATE POLICY "Inventory insert staff" ON public.inventory FOR INSERT WITH CHECK (public.has_permission('inventory.edit'::text));
CREATE POLICY "Inventory read staff" ON public.inventory FOR SELECT USING (public.has_permission('inventory.view'::text));
CREATE POLICY "Inventory update staff" ON public.inventory FOR UPDATE USING (public.has_permission('inventory.edit'::text)) WITH CHECK (public.has_permission('inventory.edit'::text));
CREATE POLICY "inventory_reservations owner read" ON public.inventory_reservations FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));
CREATE POLICY "inventory_state public read" ON public.inventory_state FOR SELECT USING (true);
CREATE POLICY "loyalty_accounts owner read" ON public.loyalty_accounts FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));
CREATE POLICY loyalty_config_read ON public.loyalty_config FOR SELECT USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "loyalty_ledger owner read" ON public.loyalty_ledger FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));
CREATE POLICY loyalty_ledger_self ON public.loyalty_ledger FOR SELECT USING ((auth.uid() = user_id));
CREATE POLICY loyalty_wallets_admin ON public.loyalty_wallets USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))))));
CREATE POLICY loyalty_wallets_no_client_write ON public.loyalty_wallets USING (false) WITH CHECK (false);
CREATE POLICY loyalty_wallets_self ON public.loyalty_wallets FOR SELECT USING ((auth.uid() = user_id));
CREATE POLICY "medication_reminders owner all" ON public.medication_reminders USING ((auth.uid() = user_id));
CREATE POLICY notification_tokens_delete_own ON public.notification_tokens FOR DELETE USING ((auth.uid() = user_id));
CREATE POLICY notification_tokens_insert_own ON public.notification_tokens FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY notification_tokens_select_own ON public.notification_tokens FOR SELECT USING ((auth.uid() = user_id));
CREATE POLICY notification_tokens_update_own ON public.notification_tokens FOR UPDATE USING ((auth.uid() = user_id));
CREATE POLICY "Admins can insert notifications for any user" ON public.notifications FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))))));
CREATE POLICY "drivers can notify their assigned order's customer" ON public.notifications FOR INSERT WITH CHECK (((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'driver'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.assigned_driver_id = auth.uid()) AND (o.user_id = notifications.user_id))))));
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT USING ((auth.uid() = user_id));
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));
CREATE POLICY order_items_select_admin ON public.order_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))))));
CREATE POLICY order_items_select_driver ON public.order_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_items.order_id) AND (o.assigned_driver_id = auth.uid())))));
CREATE POLICY order_items_select_own ON public.order_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_items.order_id) AND (o.user_id = auth.uid())))));
CREATE POLICY orders_select_admin ON public.orders FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))))));
CREATE POLICY orders_select_driver ON public.orders FOR SELECT USING ((assigned_driver_id = auth.uid()));
CREATE POLICY orders_select_own ON public.orders FOR SELECT USING ((user_id = auth.uid()));
CREATE POLICY "pharmacies public read" ON public.pharmacies FOR SELECT USING (true);
CREATE POLICY "prescriptions owner insert" ON public.prescriptions FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "prescriptions owner read" ON public.prescriptions FOR SELECT USING ((auth.uid() = user_id));
CREATE POLICY "prescriptions owner update" ON public.prescriptions FOR UPDATE USING ((auth.uid() = user_id));
CREATE POLICY "reviews: delete own" ON public.product_reviews FOR DELETE USING ((auth.uid() = user_id));
CREATE POLICY "reviews: insert own" ON public.product_reviews FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "reviews: read all" ON public.product_reviews FOR SELECT USING (true);
CREATE POLICY "reviews: update own" ON public.product_reviews FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Allow public read access" ON public.products FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Products delete staff" ON public.products FOR DELETE USING (public.has_permission('inventory.edit'::text));
CREATE POLICY "Products insert staff" ON public.products FOR INSERT WITH CHECK (public.has_permission('inventory.edit'::text));
CREATE POLICY "Products read" ON public.products FOR SELECT USING (((is_active = true) OR public.is_manager()));
CREATE POLICY "Products update staff" ON public.products FOR UPDATE USING (public.has_permission('inventory.edit'::text)) WITH CHECK (public.has_permission('inventory.edit'::text));
CREATE POLICY "products public read" ON public.products FOR SELECT USING (true);
CREATE POLICY profiles_insert ON public.profiles FOR INSERT WITH CHECK (((auth.uid() = id) OR public.is_manager()));
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (((auth.uid() = id) OR public.is_manager()));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (((auth.uid() = id) OR public.is_manager())) WITH CHECK (((auth.uid() = id) OR public.is_manager()));
CREATE POLICY "referral_codes owner read" ON public.referral_codes FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));
CREATE POLICY "referral_rewards owner read" ON public.referral_rewards FOR SELECT USING (((auth.uid() = referrer_id) OR (auth.uid() = referee_id) OR public.is_admin()));
CREATE POLICY "refill_requests owner cancel" ON public.refill_requests FOR UPDATE USING (((auth.uid() = user_id) AND (status = ANY (ARRAY['pending'::public.refill_status, 'preparing'::public.refill_status])))) WITH CHECK (((auth.uid() = user_id) AND (status = 'cancelled'::public.refill_status)));
CREATE POLICY "refill_requests owner insert" ON public.refill_requests FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "refill_requests owner read" ON public.refill_requests FOR SELECT USING ((auth.uid() = user_id));
CREATE POLICY "helpful: delete own" ON public.review_helpful_votes FOR DELETE USING ((auth.uid() = user_id));
CREATE POLICY "helpful: insert own" ON public.review_helpful_votes FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "helpful: read all" ON public.review_helpful_votes FOR SELECT USING (true);
CREATE POLICY "reward_audit_logs admin read" ON public.reward_audit_logs FOR SELECT USING (public.is_admin());
CREATE POLICY "reward_audit_logs owner read" ON public.reward_audit_logs FOR SELECT USING ((auth.uid() = subject_user_id));
CREATE POLICY "reward_campaigns admin all" ON public.reward_campaigns USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "reward_campaigns public read" ON public.reward_campaigns FOR SELECT USING (((is_active = true) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));
CREATE POLICY "idempotency owner read" ON public.reward_idempotency_keys FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin()));
CREATE POLICY "reward_rules admin all" ON public.reward_rules USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "reward_rules public read" ON public.reward_rules FOR SELECT USING (true);
CREATE POLICY "reward_tiers public read" ON public.reward_tiers FOR SELECT USING (true);
CREATE POLICY search_events_admin ON public.search_events USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))))));
CREATE POLICY search_events_insert ON public.search_events FOR INSERT WITH CHECK (true);
CREATE POLICY search_events_self_select ON public.search_events FOR SELECT USING (((user_id = auth.uid()) OR (user_id IS NULL)));
CREATE POLICY "Admins update special orders" ON public.special_order_requests FOR UPDATE USING (((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text) OR ((auth.jwt() ->> 'role'::text) = 'admin'::text))) WITH CHECK (((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text) OR ((auth.jwt() ->> 'role'::text) = 'admin'::text)));
CREATE POLICY "Anyone can insert special orders" ON public.special_order_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Users read own special orders" ON public.special_order_requests FOR SELECT USING (((auth.uid() = user_id) OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text) OR ((auth.jwt() ->> 'role'::text) = 'admin'::text)));
CREATE POLICY "Allow insert for authenticated users" ON public.special_orders FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "Allow read access for all users" ON public.special_orders FOR SELECT USING (true);
CREATE POLICY "Allow update for authenticated users" ON public.special_orders FOR UPDATE USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "stock_movements admin read" ON public.stock_movements FOR SELECT USING (public.is_admin());
CREATE POLICY "stock_movements owner via reservation" ON public.stock_movements FOR SELECT USING (((reservation_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.inventory_reservations r
  WHERE ((r.id = stock_movements.reservation_id) AND (r.user_id = auth.uid()))))));
CREATE POLICY "deletion_log: admin/manager insert" ON public.user_deletion_log FOR INSERT WITH CHECK ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));
CREATE POLICY "deletion_log: admin/manager select" ON public.user_deletion_log FOR SELECT USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));
CREATE POLICY "suspensions: admin/manager insert" ON public.user_suspensions FOR INSERT WITH CHECK ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));
CREATE POLICY "suspensions: admin/manager select all" ON public.user_suspensions FOR SELECT USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));
CREATE POLICY "suspensions: admin/manager update" ON public.user_suspensions FOR UPDATE USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])));
CREATE POLICY "suspensions: user select own" ON public.user_suspensions FOR SELECT USING ((user_id = auth.uid()));
CREATE POLICY "wishlist_items owner all" ON public.wishlist_items USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- ---- Storage: bucket config (exact live values only, no new restrictions) ----
UPDATE storage.buckets SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg','image/png','image/jpg'] WHERE id = 'driver-documents';
UPDATE storage.buckets SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic'] WHERE id = 'receipts';
-- COMPATIBILITY STATE, NOT approved security design -- see receipts_security_followup.md
UPDATE storage.buckets SET public = true WHERE id = 'receipts';
-- NOTE: all 3 previously-considered untracked receipts storage.objects
-- policies are EXCLUDED per correction -- Supabase public buckets serve
-- objects via a code path that bypasses storage.objects RLS entirely; the
-- bucket's public=true flag above is what makes getPublicUrl() work, not
-- any SELECT policy. The tracked customers-upload/read-own and
-- staff-read-all policies (already in migration history) are untouched.

-- ---- Views: 0 of 3 remain here -- available_inventory and
-- product_review_stats moved to Stage 1 (placement correction, see that
-- file's comment); loyalty_user_history stays deliberately excluded, unused. ----

-- ---- 2 superseded function overloads missed by build_baseline_v2.cjs's
-- extraction, found via the final object-by-object comparison against
-- gntpxffonjvnvadjclpl (production still had both old overloads live,
-- never dropped by any migration). Verbatim from public_schema_live_dump.sql. ----
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
REVOKE ALL ON FUNCTION public.admin_save_promotion(p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_is_enabled boolean, p_product_ids text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_save_promotion(p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_is_enabled boolean, p_product_ids text[]) TO anon;
GRANT ALL ON FUNCTION public.admin_save_promotion(p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_is_enabled boolean, p_product_ids text[]) TO authenticated;
GRANT ALL ON FUNCTION public.admin_save_promotion(p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_is_enabled boolean, p_product_ids text[]) TO service_role;

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
REVOKE ALL ON FUNCTION public.validate_coupon(p_code text, p_cart_total_cents integer, p_categories text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_coupon(p_code text, p_cart_total_cents integer, p_categories text[]) TO anon;
GRANT ALL ON FUNCTION public.validate_coupon(p_code text, p_cart_total_cents integer, p_categories text[]) TO authenticated;
GRANT ALL ON FUNCTION public.validate_coupon(p_code text, p_cart_total_cents integer, p_categories text[]) TO service_role;
