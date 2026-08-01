-- Tennis Run edetabeli tabel + RLS poliitikad
-- Käivita Supabase dashboardis (SQL Editor) samas projektis,
-- mida kasutavad teised beebibet mängud.
-- Skript on idempotentne — seda võib ohutult mitu korda käivitada.

create table if not exists public.tennisrun_leaderboard (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rounds integer not null,        -- õnnestunud servide arv rallis
  rally_score integer not null,   -- rounds + 3 boonusringi väljakorjamise korral
  cashed_out boolean not null default false,
  win_amount numeric not null,
  difficulty text not null default 'keskmine', -- kerge/keskmine/raske/meister
  created_at timestamptz not null default now()
);

alter table public.tennisrun_leaderboard
  add column if not exists difficulty text not null default 'keskmine';

alter table public.tennisrun_leaderboard enable row level security;

-- Avalik lugemine ja lisamine (sama muster nagu zooland/kosmos tabelitel)
drop policy if exists "Public read tennisrun_leaderboard" on public.tennisrun_leaderboard;
create policy "Public read tennisrun_leaderboard"
  on public.tennisrun_leaderboard for select
  using (true);

drop policy if exists "Public insert tennisrun_leaderboard" on public.tennisrun_leaderboard;
create policy "Public insert tennisrun_leaderboard"
  on public.tennisrun_leaderboard for insert
  with check (true);
