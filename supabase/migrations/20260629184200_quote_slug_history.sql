-- Quote slug history: support reissue flows and archival state.

-- Track whether a quote is archived (replaced by a reissued quote).
alter table quotes
  add column if not exists is_active boolean default true,
  add column if not exists replaced_by_slug text default null;

-- History table for every slug ever assigned to a quote.
-- Public links resolve here so old slugs can point to their replacements.
create table if not exists quote_slugs (
  slug text primary key,
  quote_id uuid not null references quotes(id) on delete cascade,
  is_active boolean not null default true,
  replaced_by_slug text default null,
  created_at timestamptz not null default now()
);

-- Backfill existing slugs so current public links keep working.
insert into quote_slugs (slug, quote_id, is_active, created_at)
select slug, id, coalesce(is_active, true), created_at
from quotes
on conflict (slug) do nothing;

-- Indexes for the public resolve path.
create index if not exists idx_quote_slugs_quote_id on quote_slugs(quote_id);
create index if not exists idx_quote_slugs_is_active on quote_slugs(is_active);

-- Backend service role needs explicit table privileges even though it bypasses RLS.
grant select, insert, update, delete on table public.quote_slugs to service_role;
