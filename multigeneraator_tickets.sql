-- Multi Generaatori piletite tabel + RLS poliitikad
-- Käivita Supabase dashboardis (SQL Editor) samas projektis,
-- mida kasutavad teised beebibet mängud.
-- Skript on idempotentne — seda võib ohutult mitu korda käivitada.
-- (Juba rakendatud migratsioonina "create_multi_tickets".)

create table if not exists public.multi_tickets (
  id uuid primary key default gen_random_uuid(),
  name text default '',
  legs jsonb not null,
  leg_count int not null,
  buy_in numeric not null,
  raw_odds numeric not null,
  boost_pct int not null,
  boosted_odds numeric not null,
  potential_win numeric not null,
  created_at timestamptz not null default now()
);

alter table public.multi_tickets enable row level security;

-- Avalik lugemine ja lisamine (sama muster nagu teistel edetabelitel)
drop policy if exists "Public read multi_tickets" on public.multi_tickets;
create policy "Public read multi_tickets"
  on public.multi_tickets for select
  using (true);

drop policy if exists "Public insert multi_tickets" on public.multi_tickets;
create policy "Public insert multi_tickets"
  on public.multi_tickets for insert
  with check (true);
