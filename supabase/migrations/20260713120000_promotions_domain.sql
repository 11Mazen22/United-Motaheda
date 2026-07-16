-- First-class promotion domain. Product `is_sale` / `original_price` remain
-- backward-compatible merchandising fields; this table owns scheduled rules.

CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value numeric(12,2) NOT NULL CHECK (discount_value > 0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (discount_type <> 'percentage' OR discount_value <= 100)
);

CREATE TABLE IF NOT EXISTS public.promotion_products (
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (promotion_id, product_id)
);

CREATE INDEX IF NOT EXISTS promotions_active_window_idx
  ON public.promotions (starts_at, ends_at)
  WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS promotion_products_product_idx
  ON public.promotion_products (product_id);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY promotions_public_active_read ON public.promotions
  FOR SELECT USING (is_enabled = true AND starts_at <= now() AND ends_at > now());
CREATE POLICY promotion_products_public_read ON public.promotion_products
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.promotions p
    WHERE p.id = promotion_id AND p.is_enabled = true AND p.starts_at <= now() AND p.ends_at > now()
  ));

CREATE OR REPLACE FUNCTION public.is_promotion_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_manager();
$$;

CREATE POLICY promotions_manager_all ON public.promotions
  FOR ALL USING (public.is_promotion_manager()) WITH CHECK (public.is_promotion_manager());
CREATE POLICY promotion_products_manager_all ON public.promotion_products
  FOR ALL USING (public.is_promotion_manager()) WITH CHECK (public.is_promotion_manager());

CREATE OR REPLACE FUNCTION public.promotion_effective_price(
  p_price numeric,
  p_discount_type text,
  p_discount_value numeric
) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT greatest(0, round(CASE p_discount_type
    WHEN 'percentage' THEN p_price * (1 - p_discount_value / 100)
    WHEN 'fixed_amount' THEN p_price - p_discount_value
    ELSE p_price END, 2));
$$;
