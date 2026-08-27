-- =============================================================================
-- Reconstruction Stage 1c: prescription-required flag on products
-- Date: 2026-08-26
--
-- Audit finding: no representation of "this product requires a prescription"
-- exists anywhere in the schema or checkout flow. Prescriptions today are a
-- fully separate feature (upload/review/refill) with zero linkage to the
-- product catalog or cart — a customer can buy a prescription-only
-- medication with no gate at all. This column is step one of connecting
-- them; checkout-side gating logic is added separately.
-- =============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS requires_prescription boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_requires_prescription
  ON public.products (requires_prescription) WHERE requires_prescription;

COMMENT ON COLUMN public.products.requires_prescription IS
  'True for prescription-only medications — checkout must block/require a verified prescription before this item can be ordered. Defaults false (over-the-counter) since the catalog was imported without this classification; needs a pharmacist-driven data pass to mark real prescription items, this migration only adds the capability.';

NOTIFY pgrst, 'reload schema';
