-- Free analytics foundation: backend-only event tracking.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  contractor_id uuid null references public.contractors(id) on delete set null,
  quote_id uuid null references public.quotes(id) on delete set null,
  slug text null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Indexes for the analytics queries we actually need.
create index if not exists idx_events_event_type on public.events(event_type);
create index if not exists idx_events_contractor_id on public.events(contractor_id);
create index if not exists idx_events_quote_id on public.events(quote_id);
create index if not exists idx_events_created_at on public.events(created_at);

-- Row Level Security: no direct client access. Backend uses service_role.
alter table public.events enable row level security;

-- Backend service role needs explicit CRUD even though it bypasses RLS.
grant select, insert, update, delete on table public.events to service_role;
