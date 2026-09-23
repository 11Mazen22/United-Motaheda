-- ============================================================================
-- STAGE 1: PRE-HISTORY FOUNDATION
-- ============================================================================
-- NOT AN ACTIVE MIGRATION. Contains ONLY the objects proven, via real FK/
-- policy/type dependency sweeps against production + the 120 historical
-- migrations, to be required for the EARLIEST migrations to execute:
--
--   Tables (12):  orders, prescriptions, notifications, notification_tokens,
--                 products, order_items, reward_campaigns, profiles, Branch,
--                 DeliveryZone, DriverProfile, refill_requests
--   Types (6):    order_status, app_role, DriverStatus, rx_status,
--                 refill_delivery, refill_status
--   Functions (2): is_manager, fold_search
--
-- Everything else that could reconstruct these 59 tables / 57 functions is
-- deliberately NOT here -- it belongs in Stage 3 (post-history), run AFTER
-- the 120 migrations, because nothing in migration history needs it to
-- pre-exist. See FINAL_baseline_manifest.md for the full object-by-object
-- placement evidence (pg_depend catalog queries + migration text sweeps).
--
-- Replay order: Stage 1 (this file) -> all 120 files in supabase/migrations/
-- in their existing order -> Stage 3 (03_stage3_post_history.sql).
-- ============================================================================

-- ---- Extensions ----
-- Confirmed needed starting from the 2nd historical migration
-- (20260713090000, uses gen_random_uuid()). btree_gin isn't needed until
-- 20260825120000 but is harmless to declare here too (CREATE EXTENSION IF
-- NOT EXISTS is idempotent) rather than tracking a separate mid-history
-- injection point for one extension.
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "btree_gin";
-- unaccent is otherwise migration-tracked (created later too, harmlessly,
-- via CREATE EXTENSION IF NOT EXISTS) but fold_search() -- LANGUAGE sql,
-- validated immediately at CREATE time -- calls unaccent() directly, so it
-- must already be installed here. Found only by actually running this
-- against a real server, not by inspection.
CREATE EXTENSION IF NOT EXISTS "unaccent";
-- pg_trgm: one of the 16 pre-history tables' own indexes uses gin_trgm_ops.
-- Also migration-tracked (redundant CREATE EXTENSION IF NOT EXISTS later is
-- harmless) but needed here for this specific index to be creatable.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ---- Types (6) ----
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
CREATE TYPE public.app_role AS ENUM (
    'manager',
    'pharmacist',
    'driver',
    'admin',
    'customer'
);
CREATE TYPE public."DriverStatus" AS ENUM (
    'PENDING_APPROVAL',
    'APPROVED',
    'ACTIVE',
    'SUSPENDED',
    'REJECTED',
    'INACTIVE'
);
CREATE TYPE public.rx_status AS ENUM (
    'ready',
    'active',
    'expiring',
    'expired'
);
CREATE TYPE public.refill_delivery AS ENUM (
    'same_day',
    'standard',
    'pickup'
);
CREATE TYPE public.refill_status AS ENUM (
    'pending',
    'preparing',
    'ready',
    'on_the_way',
    'delivered',
    'cancelled'
);
CREATE TYPE public.dependent_rel AS ENUM (
    'Spouse',
    'Child',
    'Parent',
    'Sibling',
    'Other'
);

-- ---- fold_search FIRST -- required by products.search_doc/search_blob's
-- own GENERATED/DEFAULT expressions below. Caught only by actually running
-- this against a real server: fold_search has zero table dependencies of
-- its own, so it must precede the tables section, not follow it. ----
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


-- ---- Tables (12) ----
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
    CONSTRAINT orders_location_source_check CHECK ((location_source = ANY (ARRAY['gps'::text, 'manual'::text, 'gps_corrected'::text])))
);
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
    requires_prescription boolean DEFAULT false NOT NULL
);
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
CREATE TABLE public.dependents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    relationship public.dependent_rel NOT NULL,
    dob date NOT NULL,
    color_hex text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
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
    CONSTRAINT delivery_assignments_assignment_kind_check CHECK ((assignment_kind = ANY (ARRAY['assigned'::text, 'reassigned'::text]))),
    CONSTRAINT delivery_assignments_response_status_check CHECK ((response_status = ANY (ARRAY['offered'::text, 'accepted'::text, 'declined'::text, 'superseded'::text, 'completed'::text, 'expired'::text])))
);

-- ---- delivery_issues moved here from Stage 3 (placement correction) ----
-- Evidence: migration 20260827010000_delivery_issue_photos.sql (supabase/
-- migrations/, tracked history) runs `ALTER TABLE public.delivery_issues ADD
-- COLUMN IF NOT EXISTS photo_url` -- a hard dependency on the table already
-- existing (unlike 20260715120000's guarded to_regclass() check on this same
-- table, which is why that earlier migration didn't already surface this).
-- Same root cause and same fix pattern as the search_events correction above:
-- Stage 3's exhaustive text sweep missed this reference too. Column shape
-- (including photo_url, added by the migration above) copied byte-for-byte
-- from the removed Stage 3 block.
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

-- ---- NotificationLog / NotificationToken moved here from Stage 3
-- (placement correction) ----
-- Evidence: migration 20260902140000_close_anon_write_and_auth_gaps.sql
-- (tracked history) does `ALTER TABLE public."NotificationToken" ENABLE ROW
-- LEVEL SECURITY` and `ALTER TABLE public."NotificationLog" ENABLE ROW LEVEL
-- SECURITY` -- a hard dependency on both tables already existing. Same root
-- cause as the search_events/delivery_issues/DriverProfile_userId_key
-- corrections above: the "exhaustive text sweep" only checks for CREATE
-- TABLE/ADD CONSTRAINT-style references, not ALTER TABLE ... ENABLE ROW
-- LEVEL SECURITY. Column shape copied byte-for-byte from the removed Stage 3
-- block.
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

-- ---- reward_idempotency_keys / reward_tiers moved here from Stage 3
-- (placement correction) ----
-- Evidence: this same batch's REVOKE EXECUTE statements (see the function
-- block below) target _loyalty_idempotency_end and _loyalty_recompute_tier,
-- both LANGUAGE sql (not plpgsql) -- their bodies are parsed and validated
-- immediately at CREATE time (same reasoning as the is_manager comment
-- elsewhere in this file), and they reference these two tables directly.
CREATE TABLE public.reward_idempotency_keys (
    key text NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    request_hash text NOT NULL,
    response jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL
);

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

-- ---- _prisma_migrations: genuinely missing from the ENTIRE baseline (not a
-- placement correction) ----
-- Evidence: migration 20260902164000_security_advisor_fixes.sql does
-- `ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY` -- a hard
-- dependency. This table is Prisma's own internal migration ledger, normally
-- auto-created by `prisma migrate deploy`/`dev` the first time Prisma
-- migrations run against a database -- it was never created by ANY sql file
-- in supabase/migrations or database/, and wasn't in Stage 3 either (the
-- Stage 3 sweep only covers "genuinely missing" objects that were verified
-- present in the live pg_dump; this one is real and live but was apparently
-- missed entirely rather than misplaced). Confirmed live via
-- public_schema_live_dump.sql (full CREATE TABLE + PK there). Belongs in
-- pre-history since Prisma creates it before any tracked SQL migration ever
-- runs.
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

-- ---- loyalty_accounts moved here from Stage 3 (placement correction) ----
-- Evidence: _loyalty_ensure_account's RETURNS public.loyalty_accounts
-- declaration is a signature-level type reference, resolved at CREATE
-- FUNCTION time regardless of LANGUAGE plpgsql -- unlike a plpgsql BODY,
-- parameter/return types are never deferred. Confirmed live via the actual
-- error this produced: "type \"public.loyalty_accounts\" does not exist".
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

-- ---- DriverEarning moved here from Stage 3 (placement correction) ----
-- Evidence: 20261010150000_record_driver_earning_rpc.sql's
-- record_driver_earning() function declares `RETURNS public."DriverEarning"`
-- -- a signature-level type reference, resolved at CREATE FUNCTION time
-- regardless of LANGUAGE plpgsql (same class of issue as loyalty_accounts
-- above). Definition copied byte-for-byte from the removed Stage 3 block.
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

-- ---- product_reviews + available_inventory/product_review_stats views
-- moved here from Stage 3 (placement correction) ----
-- Evidence: 20260902164000_security_advisor_fixes.sql does
-- `ALTER VIEW public.available_inventory SET (security_invoker = true)` and
-- the same for product_review_stats -- ALTER VIEW needs the view to already
-- exist. product_review_stats in turn selects from product_reviews, which
-- must exist first too. Definitions copied byte-for-byte from the removed
-- Stage 3 blocks (already carrying security_invoker='true' at CREATE time in
-- that removed copy, so this migration's ALTER VIEW is a correctness no-op
-- once it can find the view at all).
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

-- ---- Internal loyalty/inventory helper functions moved here from Stage 3
-- (placement correction) ----
-- Evidence: 20260902140000_close_anon_write_and_auth_gaps.sql REVOKEs
-- EXECUTE on all 8 of these (a hard dependency -- REVOKE needs the exact
-- signature to already exist, unlike CREATE OR REPLACE). Bodies copied
-- byte-for-byte from the removed Stage 3 definitions.
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

CREATE FUNCTION public._inventory_lock(p_product_id text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select pg_advisory_xact_lock(hashtext('inv-product:' || p_product_id));
$$;

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
  null;
end;
$$;

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

  insert into public.reward_idempotency_keys (key, user_id, endpoint, request_hash)
    values (p_key, p_user_id, p_endpoint, '')
    on conflict (key) do nothing;

  return null;
end;
$$;

CREATE FUNCTION public._loyalty_idempotency_end(p_key text, p_response jsonb) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  update public.reward_idempotency_keys
     set response = p_response
   where key = p_key
     and response is null;
$$;

CREATE FUNCTION public._loyalty_lock(p_user_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select pg_advisory_xact_lock(hashtext('loyalty-user:' || p_user_id::text));
$$;

CREATE FUNCTION public._loyalty_lock_idem(p_key text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select pg_advisory_xact_lock(hashtext('loyalty-idem:' || p_key));
$$;

CREATE FUNCTION public._loyalty_recompute_tier(p_lifetime bigint) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select id from public.reward_tiers
   where min_lifetime_points <= p_lifetime
   order by min_lifetime_points desc
   limit 1;
$$;

-- ---- search_events moved here from Stage 3 (placement correction) ----
-- Evidence: migration 20260826099000_product_intelligence_stage6_analytics_views.sql
-- (supabase/migrations/, tracked history) queries public.search_events directly
-- in its view definitions. Stage 3's own header claims its objects are "safe...
-- BECAUSE nothing in the 120 migrations references them by name (proven via
-- exhaustive text sweep)" -- that sweep missed this one. Confirmed live via
-- public_schema_live_dump.sql (table exists in production) and
-- FINAL_baseline_manifest.md section C, which already lists search_events among
-- the 59 tables to include -- it was simply drafted into the wrong stage file.
-- Column shape and constraints copied byte-for-byte from the removed Stage 3
-- block (03_stage3_post_history.sql), including its existing lack of an
-- IDENTITY/default on `id`, matching that document's existing style for its
-- other bigint-id tables (unrelated pre-existing characteristic, not
-- introduced here).
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

-- ---- create_checkout_order moved here from Stage 3 (placement correction) ----
-- Evidence: migration 20260902140000_close_anon_write_and_auth_gaps.sql
-- (tracked history) does `REVOKE EXECUTE ON FUNCTION
-- public.create_checkout_order(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text,
-- text, text) FROM PUBLIC, anon, authenticated` -- REVOKE (unlike CREATE OR
-- REPLACE) requires the exact function signature to already exist. Same root
-- cause as every other placement correction in this file: the "exhaustive
-- text sweep" behind Stage 3 only checked for CREATE FUNCTION/ADD CONSTRAINT-
-- style references, not REVOKE/ALTER statements naming an existing object.
-- Body copied byte-for-byte from the removed Stage 3 definition. LANGUAGE
-- plpgsql, so it has no bearing on where it's created relative to any
-- function or table it internally references (all internal references —
-- public.orders — already exist earlier in this same file anyway).
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

-- ---- is_manager LAST of the functions -- LANGUAGE sql (not plpgsql), so
-- its body is parsed and validated immediately at CREATE time; it queries
-- public.profiles and casts to public.app_role, both of which must already
-- exist above it, not just "eventually". ----
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


-- ---- RLS enable (bug fix, found by the final smoke-test pass) ----
-- build_baseline_v2.cjs's extractTable() captured each table's CREATE TABLE
-- body and its CREATE POLICY statements, but never the table-level
-- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` line pg_dump emits separately.
-- Confirmed via pg_class.relrowsecurity: production has this true on every
-- single public table; the reconstructed copy had it false on the ~51 tables
-- sourced this way (tables created by a tracked migration were unaffected,
-- since that migration's own ALTER TABLE statement already replayed).
-- Silent bug: policies existed and looked correct, but were never evaluated.
ALTER TABLE public."DriverEarning" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_events ENABLE ROW LEVEL SECURITY;

-- ---- Constraints, pass 1: PRIMARY KEY / UNIQUE for the 16 pre-history tables ----
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_external_ref_key UNIQUE (external_ref);
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_qr_token_key UNIQUE (qr_token);
ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_rx_number_key UNIQUE (rx_number);
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notification_tokens
    ADD CONSTRAINT notification_tokens_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notification_tokens
    ADD CONSTRAINT notification_tokens_user_id_expo_push_token_key UNIQUE (user_id, expo_push_token);
ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.reward_campaigns
    ADD CONSTRAINT reward_campaigns_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_phone_key UNIQUE (phone);
ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public."Branch"
    ADD CONSTRAINT "Branch_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."DeliveryZone"
    ADD CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."DriverProfile"
    ADD CONSTRAINT "DriverProfile_pkey" PRIMARY KEY (id);
-- "DriverProfile_userId_key" moved here from being entirely absent from the
-- baseline (it was deliberately excluded per FINAL_baseline_manifest.md's
-- "Required exclusions" table, which attributes it to
-- 20260902150000_ensure_driver_profile_on_role_change.sql). Evidence this
-- attribution is wrong for placement purposes: apps/api/prisma/schema.prisma
-- declares `userId String @unique` on DriverProfile -- this constraint is
-- part of the table's real original shape, not something introduced later --
-- and the earlier tracked migration 20260828150000_backfill_missing_driver_
-- profile.sql already does `INSERT ... ON CONFLICT ("userId") DO NOTHING`,
-- which Postgres validates against a real unique constraint/index at plan
-- time regardless of row count. The original exhaustive text sweep behind
-- the exclusions table evidently only checked for literal "ADD CONSTRAINT"
-- matches, which doesn't catch this ON CONFLICT-implied dependency -- same
-- root cause as the search_events/delivery_issues placement corrections
-- above, just surfacing on a constraint instead of a table. NOTE: this
-- means 20260902150000's own `ADD CONSTRAINT "DriverProfile_userId_key"`
-- will now hit a duplicate-object error when replayed later; that is
-- resolved by dropping the constraint immediately beforehand as a one-off
-- compensating step (not a migration-file edit) right before that batch, so
-- the migration's own statement recreates it exactly as authored.
ALTER TABLE ONLY public."DriverProfile"
    ADD CONSTRAINT "DriverProfile_userId_key" UNIQUE ("userId");
ALTER TABLE ONLY public.refill_requests
    ADD CONSTRAINT refill_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.dependents
    ADD CONSTRAINT dependents_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.pharmacies
    ADD CONSTRAINT pharmacies_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.delivery_issues
    ADD CONSTRAINT delivery_issues_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public."NotificationLog"
    ADD CONSTRAINT "NotificationLog_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."NotificationToken"
    ADD CONSTRAINT "NotificationToken_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public."DriverEarning"
    ADD CONSTRAINT "DriverEarning_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_product_id_user_id_key UNIQUE (product_id, user_id);
ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT loyalty_accounts_pkey PRIMARY KEY (user_id);
ALTER TABLE ONLY public.reward_idempotency_keys
    ADD CONSTRAINT reward_idempotency_keys_pkey PRIMARY KEY (key);
ALTER TABLE ONLY public.reward_tiers
    ADD CONSTRAINT reward_tiers_name_key UNIQUE (name);
ALTER TABLE ONLY public.reward_tiers
    ADD CONSTRAINT reward_tiers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.inventory_state
    ADD CONSTRAINT inventory_state_pkey PRIMARY KEY (product_id);
ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.search_events
    ADD CONSTRAINT search_events_pkey PRIMARY KEY (id);

-- ---- Constraints, pass 2: FOREIGN KEY for the 16 pre-history tables ----
-- All external targets confirmed to be auth.users (always exists) or
-- another one of these 12 tables, now safe since pass 1 completed above.
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_assigned_driver_id_fkey FOREIGN KEY (assigned_driver_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public."Branch"(id);
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public."DeliveryZone"(id);
ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_dependent_id_fkey FOREIGN KEY (dependent_id) REFERENCES public.dependents(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.notification_tokens
    ADD CONSTRAINT notification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reward_campaigns
    ADD CONSTRAINT reward_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public."Branch"(id);
ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public."DeliveryZone"
    ADD CONSTRAINT "DeliveryZone_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."DriverProfile"
    ADD CONSTRAINT "DriverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.refill_requests
    ADD CONSTRAINT refill_requests_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES public.pharmacies(id);
ALTER TABLE ONLY public.refill_requests
    ADD CONSTRAINT refill_requests_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.refill_requests
    ADD CONSTRAINT refill_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.refill_requests
    ADD CONSTRAINT refill_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.dependents
    ADD CONSTRAINT dependents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.delivery_issues
    ADD CONSTRAINT delivery_issues_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.delivery_issues
    ADD CONSTRAINT delivery_issues_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.delivery_issues
    ADD CONSTRAINT delivery_issues_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.search_events
    ADD CONSTRAINT search_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public."DriverEarning"
    ADD CONSTRAINT "DriverEarning_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES public."DriverProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT loyalty_accounts_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.reward_tiers(id);
ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT loyalty_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public."NotificationToken"
    ADD CONSTRAINT "NotificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- ---- Indexes for the 16 pre-history tables ----
CREATE INDEX idx_orders_assigned_driver ON public.orders USING btree (assigned_driver_id) WHERE (assigned_driver_id IS NOT NULL);
CREATE INDEX idx_orders_branch_id ON public.orders USING btree (branch_id) WHERE (branch_id IS NOT NULL);
CREATE INDEX idx_orders_zone_id ON public.orders USING btree (zone_id) WHERE (zone_id IS NOT NULL);
CREATE INDEX orders_assigned_driver_id_idx ON public.orders USING btree (assigned_driver_id);
CREATE INDEX orders_assigned_driver_status_idx ON public.orders USING btree (assigned_driver_id, status);
CREATE INDEX orders_payment_status_idx ON public.orders USING btree (payment_status, created_at DESC) WHERE (payment_status = 'pending_verification'::text);
CREATE INDEX orders_status_created_at_idx ON public.orders USING btree (status, created_at DESC);
CREATE INDEX orders_status_created_idx ON public.orders USING btree (status, created_at DESC);
CREATE INDEX orders_user_created_idx ON public.orders USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX orders_user_idempotency_key_idx ON public.orders USING btree (user_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE INDEX orders_user_idx ON public.orders USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX uq_orders_idempotency_key ON public.orders USING btree (user_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE INDEX prescriptions_review_status_idx ON public.prescriptions USING btree (review_status, added_at DESC);
CREATE INDEX prescriptions_status_idx ON public.prescriptions USING btree (user_id, status);
CREATE INDEX prescriptions_user_idx ON public.prescriptions USING btree (user_id);
CREATE INDEX notifications_user_created_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX notifications_user_event_key_idx ON public.notifications USING btree (user_id, event_key) WHERE (event_key IS NOT NULL);
CREATE INDEX notifications_user_id_idx ON public.notifications USING btree (user_id);
CREATE INDEX notifications_user_unread_idx ON public.notifications USING btree (user_id) WHERE (is_read = false);
CREATE INDEX notification_tokens_active_user_idx ON public.notification_tokens USING btree (user_id) WHERE (invalidated_at IS NULL);
CREATE UNIQUE INDEX notification_tokens_expo_push_token_key ON public.notification_tokens USING btree (expo_push_token);
CREATE INDEX notification_tokens_user_idx ON public.notification_tokens USING btree (user_id);
CREATE INDEX idx_products_active_price ON public.products USING btree ("Price") WHERE (is_active = true);
CREATE INDEX idx_products_active_recent ON public.products USING btree (id DESC) WHERE (is_active = true);
CREATE INDEX idx_products_barcode ON public.products USING btree ("Barcode") WHERE ("Barcode" IS NOT NULL);
CREATE INDEX idx_products_barcode_trgm ON public.products USING gin ("Barcode" public.gin_trgm_ops);
CREATE INDEX idx_products_browse_default ON public.products USING btree (is_active DESC, "Name_En");
CREATE INDEX idx_products_category_name ON public.products USING btree ("Category_Name");
CREATE INDEX idx_products_code_lower ON public.products USING btree (lower("Code"));
CREATE INDEX idx_products_code_trgm ON public.products USING gin ("Code" public.gin_trgm_ops);
CREATE INDEX idx_products_embedding_hnsw ON public.products USING hnsw (embedding public.vector_cosine_ops);
CREATE INDEX idx_products_is_offer ON public.products USING btree (is_offer) WHERE (is_offer = true);
CREATE INDEX idx_products_is_sale ON public.products USING btree (is_sale) WHERE (is_sale = true);
CREATE INDEX idx_products_listing ON public.products USING btree ("Category_Name", is_active, "Stock", "Price");
CREATE INDEX idx_products_name_ar_gist ON public.products USING gist ("Name_Ar" public.gist_trgm_ops);
CREATE INDEX idx_products_name_ar_trgm ON public.products USING gin ("Name_Ar" public.gin_trgm_ops);
CREATE INDEX idx_products_name_en_gist ON public.products USING gist ("Name_En" public.gist_trgm_ops);
CREATE INDEX idx_products_name_en_trgm ON public.products USING gin ("Name_En" public.gin_trgm_ops);
CREATE INDEX idx_products_price ON public.products USING btree ("Price") WHERE (is_active = true);
CREATE INDEX idx_products_requires_prescription ON public.products USING btree (requires_prescription) WHERE requires_prescription;
CREATE INDEX idx_products_search_doc ON public.products USING gin (search_doc);
CREATE INDEX idx_products_search_trgm ON public.products USING gin (search_blob public.gin_trgm_ops);
CREATE INDEX idx_products_search_vector ON public.products USING gin (search_vector);
CREATE INDEX product_is_bestseller_idx ON public.products USING btree (is_bestseller) WHERE (is_bestseller = true);
CREATE INDEX product_is_new_idx ON public.products USING btree (is_new) WHERE (is_new = true);
CREATE INDEX product_is_sale_idx ON public.products USING btree (is_sale) WHERE (is_sale = true);
CREATE INDEX products_barcode_active_idx ON public.products USING btree ("Barcode") WHERE (is_active = true);
CREATE INDEX products_barcode_trgm ON public.products USING gin ("Barcode" public.gin_trgm_ops);
CREATE INDEX products_barcode_trgm_idx ON public.products USING gin (lower("Barcode") public.gin_trgm_ops);
CREATE INDEX products_cat_id_active_idx ON public.products USING btree ("Category_Name", id DESC) WHERE (is_active = true);
CREATE INDEX products_cat_price_active_idx ON public.products USING btree ("Category_Name", "Price") WHERE (is_active = true);
CREATE INDEX products_category_name_en_idx ON public.products USING btree (lower("Category_Name_En"));
CREATE INDEX products_category_name_idx ON public.products USING btree (lower("Category_Name"));
CREATE INDEX products_code_active_idx ON public.products USING btree ("Code") WHERE (is_active = true);
CREATE INDEX products_code_trgm ON public.products USING gin ("Code" public.gin_trgm_ops);
CREATE INDEX products_code_trgm_idx ON public.products USING gin (lower("Code") public.gin_trgm_ops);
CREATE INDEX products_default_sort_idx ON public.products USING btree (is_active DESC, "Name_En");
CREATE INDEX products_in_stock_id_idx ON public.products USING btree (id DESC) WHERE ((is_active = true) AND ("Stock" > (0)::numeric));
CREATE INDEX products_is_active_idx ON public.products USING btree (is_active);
CREATE INDEX products_name_ar_trgm ON public.products USING gin ("Name_Ar" public.gin_trgm_ops);
CREATE INDEX products_name_ar_trgm_idx ON public.products USING gin (lower("Name_Ar") public.gin_trgm_ops);
CREATE INDEX products_name_en_trgm ON public.products USING gin ("Name_En" public.gin_trgm_ops);
CREATE INDEX products_name_en_trgm_idx ON public.products USING gin (lower("Name_En") public.gin_trgm_ops);
CREATE INDEX products_name_trgm ON public.products USING gin ("Name" public.gin_trgm_ops);
CREATE INDEX products_price_idx ON public.products USING btree ("Price");
CREATE INDEX products_search_vector_gin ON public.products USING gin (search_vector);
CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);
CREATE INDEX order_items_order_id_idx ON public.order_items USING btree (order_id);
CREATE INDEX reward_campaigns_window_idx ON public.reward_campaigns USING btree (starts_at, ends_at) WHERE (is_active = true);
CREATE INDEX profiles_marketing_consent_idx ON public.profiles USING btree (marketing_consent) WHERE (marketing_consent = true);
CREATE INDEX "DeliveryZone_branchId_idx" ON public."DeliveryZone" USING btree ("branchId");
CREATE INDEX "DriverProfile_isOnline_idx" ON public."DriverProfile" USING btree ("isOnline");
CREATE INDEX "DriverProfile_status_idx" ON public."DriverProfile" USING btree (status);
CREATE INDEX "DriverProfile_userId_idx" ON public."DriverProfile" USING btree ("userId");
CREATE INDEX refill_requests_status_idx ON public.refill_requests USING btree (status);
CREATE INDEX refill_user_idx ON public.refill_requests USING btree (user_id, placed_at DESC);
CREATE INDEX dependents_user_idx ON public.dependents USING btree (user_id);
CREATE INDEX pharmacies_geo_idx ON public.pharmacies USING btree (lat, lng);
CREATE INDEX delivery_assignments_driver_idx ON public.delivery_assignments USING btree (driver_id, response_status, offered_at DESC);
CREATE INDEX delivery_assignments_order_idx ON public.delivery_assignments USING btree (order_id, created_at DESC);
CREATE INDEX delivery_issues_driver_idx ON public.delivery_issues USING btree (driver_id, created_at DESC);
CREATE INDEX delivery_issues_order_idx ON public.delivery_issues USING btree (order_id, created_at DESC);
CREATE INDEX delivery_issues_status_idx ON public.delivery_issues USING btree (status, created_at DESC);
CREATE INDEX inventory_state_low_idx ON public.inventory_state USING btree ((((total - reserved) - committed)));
CREATE INDEX inventory_reservations_expire_idx ON public.inventory_reservations USING btree (expires_at) WHERE (state = 'reserved'::text);
CREATE UNIQUE INDEX inventory_reservations_idem_uniq ON public.inventory_reservations USING btree (idempotency_key);
CREATE INDEX inventory_reservations_order_idx ON public.inventory_reservations USING btree (order_id) WHERE (order_id IS NOT NULL);
CREATE INDEX inventory_reservations_product_state_idx ON public.inventory_reservations USING btree (product_id, state);
CREATE INDEX inventory_reservations_user_idx ON public.inventory_reservations USING btree (user_id, reserved_at DESC);
CREATE INDEX search_events_query_idx ON public.search_events USING btree (query, created_at DESC) WHERE (char_length(query) >= 2);
CREATE INDEX search_events_user_idx ON public.search_events USING btree (user_id, created_at DESC) WHERE (user_id IS NOT NULL);
CREATE INDEX "NotificationLog_status_idx" ON public."NotificationLog" USING btree (status);
CREATE INDEX "NotificationLog_userId_sentAt_idx" ON public."NotificationLog" USING btree ("userId", "sentAt" DESC);
CREATE INDEX "NotificationToken_token_idx" ON public."NotificationToken" USING btree (token);
CREATE UNIQUE INDEX "NotificationToken_token_key" ON public."NotificationToken" USING btree (token);
CREATE INDEX "NotificationToken_userId_isActive_idx" ON public."NotificationToken" USING btree ("userId", "isActive");
CREATE INDEX product_reviews_product_helpful_idx ON public.product_reviews USING btree (product_id, helpful_count DESC, created_at DESC);
CREATE INDEX product_reviews_product_id_idx ON public.product_reviews USING btree (product_id);
CREATE INDEX product_reviews_product_rating_idx ON public.product_reviews USING btree (product_id, rating DESC, helpful_count DESC);
CREATE INDEX product_reviews_product_recent_idx ON public.product_reviews USING btree (product_id, created_at DESC);
CREATE INDEX product_reviews_user_idx ON public.product_reviews USING btree (user_id);
CREATE INDEX "DriverEarning_driverId_earnedAt_idx" ON public."DriverEarning" USING btree ("driverId", "earnedAt" DESC);
CREATE INDEX "DriverEarning_isPaid_idx" ON public."DriverEarning" USING btree ("isPaid");
CREATE INDEX reward_idempotency_expiry_idx ON public.reward_idempotency_keys USING btree (expires_at);
CREATE INDEX reward_tiers_threshold_idx ON public.reward_tiers USING btree (min_lifetime_points);
CREATE UNIQUE INDEX uq_inventory_reservations_idempotency_key ON public.inventory_reservations USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
