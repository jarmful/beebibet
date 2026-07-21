-- USA Lahtiste (US Open) piletite ja tulemuste tabelid + RLS poliitikad
-- Käivita Supabase dashboardis (SQL Editor) samas projektis,
-- mida kasutavad teised beebibet mängud.
-- Skript on idempotentne — seda võib ohutult mitu korda käivitada.
-- (Juba rakendatud migratsioonina "create_usopen_tables".)

-- Piletid: iga keerutus = üks rida. Arveldus muudab status + win_amount.
create table if not exists public.usopen_tickets (
  id uuid primary key default gen_random_uuid(),
  game text not null,                 -- survivor | slot | bagel | rulett | puhaspaev | yllataja
  name text not null default '',
  buy_in numeric not null,
  details jsonb not null,             -- mängupõhine pileti sisu
  potential_win numeric not null,
  status text not null default 'pending',  -- pending | won | lost
  win_amount numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Tulemused: admin-lehe sisestused. id = matši id (m1..m8) või mängija id (a1..w16).
create table if not exists public.usopen_results (
  id text primary key,
  kind text not null,                 -- match | player
  data jsonb not null,                -- match: {winner, score, bagel, sixOne, tiebreak}
                                      -- player: {roundsWon, eliminated}
  updated_at timestamptz not null default now()
);

alter table public.usopen_tickets enable row level security;
alter table public.usopen_results enable row level security;

-- Avalik lugemine/lisamine/uuendamine (sama avatud muster nagu teistel
-- beebibet tabelitel; uuendusi vajavad admin-arveldus ja Survivor cash-out)
drop policy if exists "Public read usopen_tickets" on public.usopen_tickets;
create policy "Public read usopen_tickets"
  on public.usopen_tickets for select
  using (true);

drop policy if exists "Public insert usopen_tickets" on public.usopen_tickets;
create policy "Public insert usopen_tickets"
  on public.usopen_tickets for insert
  with check (true);

drop policy if exists "Public update usopen_tickets" on public.usopen_tickets;
create policy "Public update usopen_tickets"
  on public.usopen_tickets for update
  using (true)
  with check (true);

drop policy if exists "Public read usopen_results" on public.usopen_results;
create policy "Public read usopen_results"
  on public.usopen_results for select
  using (true);

drop policy if exists "Public insert usopen_results" on public.usopen_results;
create policy "Public insert usopen_results"
  on public.usopen_results for insert
  with check (true);

drop policy if exists "Public update usopen_results" on public.usopen_results;
create policy "Public update usopen_results"
  on public.usopen_results for update
  using (true)
  with check (true);
