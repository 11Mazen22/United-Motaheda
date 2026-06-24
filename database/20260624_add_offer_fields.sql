-- ─── Offer / sale fields for the products table ─────────────────────────────
--
-- is_sale:        Marks the product as a current active offer / promotion.
--                 Admins toggle this from the Product Manager.
--                 Used by both web and native to filter the Offers / Flash Sale
--                 page.
-- original_price: Optional original (before-discount) price. When set alongside
--                 a lower Price, the UI shows a "% off" badge and strikethrough.
--                 The discount percentage is computed as:
--                   ROUND((original_price - Price) / original_price * 100)
--
-- Migration is safe to re-run (IF NOT EXISTS guards).
-- -----------------------------------------------------------------------------

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_sale       BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS original_price NUMERIC(12, 2);

-- Partial index — only the rows that ARE on sale need to be indexed, keeping the
-- index tiny and fast for the Offers / Flash Sale page query.
CREATE INDEX IF NOT EXISTS idx_products_is_sale
  ON products (is_sale)
  WHERE is_sale = TRUE;

-- Expose new columns to the anon / authenticated roles that already have SELECT
-- on the table. (Supabase grants table-level by default; this is a no-op if the
-- table already has a broad grant but keeps the migration self-contained.)
GRANT SELECT (is_sale, original_price) ON products TO anon, authenticated;
