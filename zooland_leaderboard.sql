-- Zooland edetabeli tabel + RLS poliitikad
-- Käivita Supabase dashboardis (SQL Editor) samas projektis,
-- mida kasutavad teised beebibet mängud.
-- Skript on idempotentne — seda võib ohutult mitu korda käivitada.

create table if not exists public.zooland_leaderboard (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  win_amount numeric not null,
  win_multiplier numeric not null,
  created_at timestamptz not null default now()
);

alter table public.zooland_leaderboard enable row level security;

-- Avalik lugemine ja lisamine (sama muster nagu kosmos_leaderboard tabelil)
drop policy if exists "Public read zooland_leaderboard" on public.zooland_leaderboard;
create policy "Public read zooland_leaderboard"
  on public.zooland_leaderboard for select
  using (true);

drop policy if exists "Public insert zooland_leaderboard" on public.zooland_leaderboard;
create policy "Public insert zooland_leaderboard"
  on public.zooland_leaderboard for insert
  with check (true);
