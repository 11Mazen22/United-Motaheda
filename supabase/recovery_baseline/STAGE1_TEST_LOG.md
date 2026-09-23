# Stage 1 Native-PostgreSQL Replay — Test Log

Environment: local PostgreSQL 17.11 (portable binaries, official EnterpriseDB distribution), disposable database `recovery_test`, port 5433. Compatibility shim at `<scratchpad>/native_pg_test_only/00_shim_roles_and_schemas.sql` (outside this directory, per instruction — see that file's own README for its full scope and skipped-dependency list).

**Production was never touched.** All of this ran against a local, disposable database created and destroyed multiple times during iteration.

## Result
Stage 1 (pre-history): **passes cleanly**, 0 errors, verified on a fresh database from scratch.
Historical migration replay: **27 of 120 migrations replay successfully** (through `20260826093000_product_intelligence_stage4_embeddings.sql`), at which point replay stops on `CREATE EXTENSION vector` — pgvector is not installed in this test environment (no prebuilt Windows binary readily available; building from source is out of scope for a structural check). This is a disclosed environment limitation, not a defect in the baseline — see the shim's own skipped-dependency list. Continuing past it would require editing multiple migration files' embedding-related statements, which risks masking real application logic rather than testing it.

## Real bugs found in the CANONICAL baseline files, fixed there (not just in the test copies)
Six of these were found only by actually executing the SQL, not by static inspection:

1. **`orders_dispatch_status_check`** — an auto-named inline CHECK tied to the `orders.dispatch_status` column, which is deliberately excluded from the baseline (its real migration adds it later). Excluding the column without also excluding this constraint broke `CREATE TABLE` outright.
2. **`orders_claimed_by_pharmacist_id_fkey`** — same pattern, a foreign key tied to the excluded `claimed_by_pharmacist_id` column.
3. **Function/table ordering within Stage 1 itself** — `fold_search()` is used in `products.search_doc`/`search_blob`'s own `GENERATED`/`DEFAULT` expressions; it must precede the tables section, not follow it as originally drafted.
4. **`unaccent` and `pg_trgm` extensions** — needed before `fold_search()` (calls `unaccent()`) and before one of `products`' own indexes (`gin_trgm_ops`) can be created; neither was in the original extension list.
5. **Two-pass constraint ordering** — primary keys/unique constraints must be added across ALL tables before ANY foreign key, matching `pg_dump`'s own convention. The original per-table interleaving failed when table A's FK referenced table B's primary key and B sorted later in the table list.
6. **`idx_products_name_ar_norm_trgm`** — an index on the pre-history table `products` that calls `normalize_arabic()`, a function created by a historical migration. Deferred to Stage 3, since it cannot exist before that migration runs.

## Real placement corrections — tables moved from post-history to pre-history
Found by actually replaying the historical migrations in order, not by static text sweeps (each of these represents a dependency class no grep-based check could have caught):

- **`delivery_assignments`** — migration #15 has a `CREATE POLICY` whose `USING` clause does `EXISTS (SELECT 1 FROM public.delivery_assignments ...)`. A policy referencing an unrelated table in its body is not something an FK sweep or a "does this migration create a duplicate policy" check would ever surface.
- **`inventory_state`, `inventory_reservations`** — referenced via `%ROWTYPE` variable declarations inside migration-defined `plpgsql` functions (e.g. `v_state public.inventory_state%rowtype;`). Unlike ordinary SQL statements in a function body, `%ROWTYPE`/`%TYPE` are resolved at function-*compile* time, so the referenced table must already exist.
- **`dependents`, `pharmacies`** — found via a proper transitive-closure computation over real `pg_constraint` foreign-key data (`prescriptions → dependents`, `refill_requests → pharmacies`), neither of which was ever added by a migration (both predate migration tracking), so no migration-text sweep could have found them either.

Final pre-history set: **17 tables**, up from the originally-estimated 12 — each addition backed by a specific, reproduced failure, not a guess.

## What Stage 1 proves and does not prove
Proves: SQL syntax correctness for everything replayed so far, correct dependency ordering for 17 pre-history tables against the first 27 historical migrations, all 143 policies'/19 triggers'/57 functions' extraction fidelity (bodies untouched from the verified `pg_dump` source), and structural soundness of the two-pass constraint strategy.

Does not prove: anything past migration #27, any pgvector/embeddings-dependent behavior, real Realtime/Storage/Auth/Vault/pg_cron/pg_net functional behavior (all stubbed or absent — see shim README), or Stage 3's own correctness (not yet reached in this pass).

## Next step
A genuine disposable Supabase project (real `auth`, `storage`, pg_cron, pg_net, Vault, and pgvector already installed) is still required to complete verification past this point, exactly as anticipated going in.
