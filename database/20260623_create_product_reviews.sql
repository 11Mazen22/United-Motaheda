-- ────────────────────────────────────────────────────────────────────────────
-- product_reviews — customer ratings + reviews for catalog products
-- ────────────────────────────────────────────────────────────────────────────
-- One row per (user, product). A user can edit/delete their own review.
-- Public can read all reviews. helpful_votes are tracked separately so
-- multiple users can mark the same review helpful exactly once each.

create table if not exists public.product_reviews (
  id              uuid primary key default gen_random_uuid(),
  product_id      text not null,                          -- catalog product id (free-form, matches products.id)
  user_id         uuid not null references auth.users(id) on delete cascade,
  author_name     text not null,
  rating          smallint not null check (rating between 1 and 5),
  title           text,
  body            text,
  photos          text[] not null default '{}',           -- array of public storage URLs
  helpful_count   integer not null default 0,
  verified        boolean not null default false,         -- true when we can confirm purchase from orders
  reported_count  integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (product_id, user_id)
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

create index if not exists product_reviews_product_id_idx
  on public.product_reviews (product_id);

create index if not exists product_reviews_product_helpful_idx
  on public.product_reviews (product_id, helpful_count desc, created_at desc);

create index if not exists product_reviews_product_recent_idx
  on public.product_reviews (product_id, created_at desc);

create index if not exists product_reviews_product_rating_idx
  on public.product_reviews (product_id, rating desc, helpful_count desc);

create index if not exists product_reviews_user_idx
  on public.product_reviews (user_id);

-- ─── helpful_votes — one row per (user, review) ─────────────────────────────

create table if not exists public.review_helpful_votes (
  review_id  uuid not null references public.product_reviews(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create index if not exists review_helpful_votes_review_idx
  on public.review_helpful_votes (review_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.product_reviews enable row level security;
alter table public.review_helpful_votes enable row level security;

-- Reviews: anyone (auth or anon) can read
drop policy if exists "reviews: read all" on public.product_reviews;
create policy "reviews: read all"
  on public.product_reviews for select
  using (true);

-- Reviews: authenticated users can insert their own
drop policy if exists "reviews: insert own" on public.product_reviews;
create policy "reviews: insert own"
  on public.product_reviews for insert
  with check (auth.uid() = user_id);

-- Reviews: users can update only their own
drop policy if exists "reviews: update own" on public.product_reviews;
create policy "reviews: update own"
  on public.product_reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Reviews: users can delete only their own
drop policy if exists "reviews: delete own" on public.product_reviews;
create policy "reviews: delete own"
  on public.product_reviews for delete
  using (auth.uid() = user_id);

-- Helpful votes: anyone can read aggregate
drop policy if exists "helpful: read all" on public.review_helpful_votes;
create policy "helpful: read all"
  on public.review_helpful_votes for select
  using (true);

-- Helpful votes: only auth user can insert / delete their own vote
drop policy if exists "helpful: insert own" on public.review_helpful_votes;
create policy "helpful: insert own"
  on public.review_helpful_votes for insert
  with check (auth.uid() = user_id);

drop policy if exists "helpful: delete own" on public.review_helpful_votes;
create policy "helpful: delete own"
  on public.review_helpful_votes for delete
  using (auth.uid() = user_id);

-- ─── updated_at trigger ─────────────────────────────────────────────────────

create or replace function public.touch_review_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists product_reviews_touch_updated on public.product_reviews;
create trigger product_reviews_touch_updated
  before update on public.product_reviews
  for each row execute function public.touch_review_updated_at();

-- ─── helpful_count keeper trigger ───────────────────────────────────────────
-- Keeps product_reviews.helpful_count in sync with review_helpful_votes count.

create or replace function public.sync_review_helpful_count()
returns trigger language plpgsql as $$
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

drop trigger if exists review_helpful_votes_sync_count on public.review_helpful_votes;
create trigger review_helpful_votes_sync_count
  after insert or delete on public.review_helpful_votes
  for each row execute function public.sync_review_helpful_count();

-- ─── product_review_stats — materialized aggregate view ─────────────────────
-- Cheap to read: SELECT * FROM product_review_stats WHERE product_id = 'x'.

create or replace view public.product_review_stats as
  select
    product_id,
    count(*)                                              as total_reviews,
    round(avg(rating)::numeric, 2)                        as average_rating,
    count(*) filter (where rating = 5)                    as stars_5,
    count(*) filter (where rating = 4)                    as stars_4,
    count(*) filter (where rating = 3)                    as stars_3,
    count(*) filter (where rating = 2)                    as stars_2,
    count(*) filter (where rating = 1)                    as stars_1,
    count(*) filter (where verified = true)               as verified_count,
    count(*) filter (where array_length(photos, 1) > 0)   as photo_count
  from public.product_reviews
  group by product_id;
