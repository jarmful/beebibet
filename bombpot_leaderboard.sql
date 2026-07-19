-- Bomb Pot edetabeli tabel + RLS poliitikad
-- Käivita Supabase dashboardis (SQL Editor) samas projektis,
-- mida kasutavad teised beebibet mängud.
-- Skript on idempotentne — seda võib ohutult mitu korda käivitada.

create table if not exists public.bombpot_scores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  score integer not null,
  created_at timestamptz not null default now()
);

alter table public.bombpot_scores enable row level security;

-- Avalik lugemine ja lisamine (sama muster nagu teiste mängude tabelitel)
drop policy if exists "Public read bombpot_scores" on public.bombpot_scores;
create policy "Public read bombpot_scores"
  on public.bombpot_scores for select
  using (true);

drop policy if exists "Public insert bombpot_scores" on public.bombpot_scores;
create policy "Public insert bombpot_scores"
  on public.bombpot_scores for insert
  with check (true);
