-- ─── Offer fields for the products table ──────────────────────────────────────
--
-- is_offer:       Marks the product as a current active offer / promotion.
--                 Admins toggle this from the Product Manager.
-- original_price: Optional original (before-discount) price. When set alongside
--                 a lower Price, the UI shows a "% off" badge and strikethrough.
--
-- Migration is safe to re-run (IF NOT EXISTS / DO NOTHING guards).
-- -----------------------------------------------------------------------------

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_offer      BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS original_price NUMERIC(12, 2);

-- Partial index — only the rows that ARE offers need to be indexed, keeping the
-- index tiny and fast for the Offers page query.
CREATE INDEX IF NOT EXISTS idx_products_is_offer
  ON products (is_offer)
  WHERE is_offer = TRUE;

-- Expose new columns to the anon / authenticated roles that already have SELECT
-- on the table. (Supabase grants table-level by default; this is a no-op if the
-- table already has a broad grant but keeps the migration self-contained.)
GRANT SELECT (is_offer, original_price) ON products TO anon, authenticated;
