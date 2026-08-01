-- Dogs of Olympics edetabeli tabel + RLS poliitikad
-- Käivita Supabase dashboardis (SQL Editor) samas projektis,
-- mida kasutavad teised beebibet mängud.
-- Skript on idempotentne — seda võib ohutult mitu korda käivitada.

create table if not exists public.dogs_leaderboard (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  win_amount numeric not null,
  win_multiplier numeric not null,
  created_at timestamptz not null default now()
);

alter table public.dogs_leaderboard enable row level security;

-- Avalik lugemine ja lisamine (sama muster nagu zooland_leaderboard tabelil)
drop policy if exists "Public read dogs_leaderboard" on public.dogs_leaderboard;
create policy "Public read dogs_leaderboard"
  on public.dogs_leaderboard for select
  using (true);

drop policy if exists "Public insert dogs_leaderboard" on public.dogs_leaderboard;
create policy "Public insert dogs_leaderboard"
  on public.dogs_leaderboard for insert
  with check (true);
