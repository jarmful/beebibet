-- Jõuluvana loos (Salajane jõuluvana) — tabelid, RLS ja RPC funktsioonid
-- Käivita Supabase dashboardis (SQL Editor) samas projektis,
-- mida kasutavad teised beebibet mängud.
-- Skript on idempotentne — seda võib ohutult mitu korda käivitada.
--
-- Erinevalt teistest beebibet tabelitest EI OLE siin avalikke
-- select/insert/update poliitikaid: RLS on sees ja anon-rollil pole
-- tabelitele mingit ligipääsu. Kõik käib läbi SECURITY DEFINER RPC
-- funktsioonide, mis kontrollivad PIN-i serveris. Nii ei näe keegi
-- teiste soove ega loosi tulemusi ka otse API-t pärides — iga osaleja
-- saab kätte ainult oma soovid ja selle inimese, kellele ta kingi ostab.
-- PIN-id on salvestatud bcrypt-räsina (pgcrypto), mitte lihttekstina.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------
-- Tabelid
-- ---------------------------------------------------------------
create table if not exists public.ss_events (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,              -- 6-numbriline mängu PIN, jagatakse perega
  title text not null,
  admin_pin_hash text not null,           -- bcrypt
  admin_failed int not null default 0,
  admin_locked_until timestamptz,
  drawn_at timestamptz,                   -- null = loos veel toimumata
  created_at timestamptz not null default now()
);

create table if not exists public.ss_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.ss_events(id) on delete cascade,
  name text not null,
  pin_hash text,                          -- osaleja enda valitud 4-numbriline PIN (bcrypt)
  wishes text[],                          -- täpselt 3 soovi
  submitted_at timestamptz,
  recipient_id uuid references public.ss_participants(id) on delete set null,
  failed int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default clock_timestamp()   -- säilitab sisestusjärjekorra
);

create unique index if not exists ss_participants_event_name
  on public.ss_participants (event_id, lower(name));

alter table public.ss_events enable row level security;
alter table public.ss_participants enable row level security;

-- Mingeid poliitikaid ei looda => anon/authenticated ei saa ridu lugeda ega muuta.
revoke all on table public.ss_events from anon, authenticated;
revoke all on table public.ss_participants from anon, authenticated;

-- ---------------------------------------------------------------
-- Sisemised abifunktsioonid (EI ole avalikud)
-- ---------------------------------------------------------------

-- Osaleja PIN-i kontroll koos lukustusega (5 viga => 15 min lukus).
-- Tagastab null kui OK, muidu veateate.
create or replace function public.ss__check_participant_pin(p_id uuid, p_pin text)
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare r public.ss_participants;
begin
  select * into r from public.ss_participants where id = p_id for update;
  if r.locked_until is not null and r.locked_until > now() then
    return 'Liiga palju valesid katseid — proovi 15 minuti pärast uuesti';
  end if;
  if r.pin_hash is null then
    return 'Sul pole veel PIN-i — esita kõigepealt oma soovid';
  end if;
  if r.pin_hash = crypt(p_pin, r.pin_hash) then
    update public.ss_participants set failed = 0, locked_until = null where id = p_id;
    return null;
  end if;
  if r.failed + 1 >= 5 then
    update public.ss_participants set failed = 0, locked_until = now() + interval '15 minutes' where id = p_id;
  else
    update public.ss_participants set failed = r.failed + 1 where id = p_id;
  end if;
  return 'Vale PIN';
end $$;

-- Admin PIN-i kontroll. Tagastab {ok:true, event_id} või {ok:false, error}.
create or replace function public.ss__admin_auth(p_code text, p_admin_pin text)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare ev public.ss_events;
begin
  select * into ev from public.ss_events where code = p_code for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Sellise PIN-iga loosi ei leitud'); end if;
  if ev.admin_locked_until is not null and ev.admin_locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'Liiga palju valesid katseid — proovi 15 minuti pärast uuesti');
  end if;
  if ev.admin_pin_hash = crypt(coalesce(p_admin_pin, ''), ev.admin_pin_hash) then
    update public.ss_events set admin_failed = 0, admin_locked_until = null where id = ev.id;
    return jsonb_build_object('ok', true, 'event_id', ev.id);
  end if;
  if ev.admin_failed + 1 >= 5 then
    update public.ss_events set admin_failed = 0, admin_locked_until = now() + interval '15 minutes' where id = ev.id;
  else
    update public.ss_events set admin_failed = ev.admin_failed + 1 where id = ev.id;
  end if;
  return jsonb_build_object('ok', false, 'error', 'Vale admin PIN');
end $$;

-- Loos: juhuslik permutatsioon ilma püsipunktideta (derangement).
-- Tagasilükkamisega valim => iga derangement on võrdselt tõenäoline
-- (keskmiselt ~2,7 katset). Varuvariant: üks suur tsükkel.
create or replace function public.ss__draw(p_event uuid)
returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
declare ids uuid[]; perm uuid[]; n int; i int; tries int := 0; good boolean := false;
begin
  select array_agg(id order by gen_random_bytes(8)) into ids
    from public.ss_participants where event_id = p_event;
  n := coalesce(array_length(ids, 1), 0);
  if n < 3 then return false; end if;
  loop
    tries := tries + 1;
    select array_agg(x order by gen_random_bytes(8)) into perm from unnest(ids) as x;
    good := true;
    for i in 1..n loop
      if perm[i] = ids[i] then good := false; exit; end if;
    end loop;
    exit when good or tries >= 1000;
  end loop;
  if not good then
    for i in 1..n loop perm[i] := ids[(i % n) + 1]; end loop;
  end if;
  for i in 1..n loop
    update public.ss_participants set recipient_id = perm[i] where id = ids[i];
  end loop;
  update public.ss_events set drawn_at = now() where id = p_event;
  return true;
end $$;

-- Kõik osalejad (nimi + kas esitanud) — ilma soovide ja loosita.
create or replace function public.ss__roster(p_event uuid)
returns jsonb
language sql security definer set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', name,
           'submitted', submitted_at is not null) order by created_at, name), '[]'::jsonb)
    from public.ss_participants where event_id = p_event;
$$;

-- Nimede puhastus: trim, tühjad välja, duplikaadid (tõstutundetult) välja.
create or replace function public.ss__clean_names(p_names text[])
returns text[]
language sql immutable
as $$
  select coalesce(array_agg(n order by ord), '{}') from (
    select distinct on (lower(btrim(x))) btrim(x) as n, ord
      from unnest(p_names) with ordinality as t(x, ord)
     where btrim(coalesce(x, '')) <> '' and length(btrim(x)) <= 40
     order by lower(btrim(x)), ord
  ) s;
$$;

-- ---------------------------------------------------------------
-- Avalikud RPC-d (anon)
-- ---------------------------------------------------------------

-- Uue loosi loomine. Tagastab {ok, code}.
create or replace function public.ss_create_event(p_title text, p_admin_pin text, p_names text[])
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare v_code text; v_id uuid; v_names text[]; nm text;
begin
  if btrim(coalesce(p_title, '')) = '' or length(p_title) > 80 then
    return jsonb_build_object('ok', false, 'error', 'Sisesta loosi nimi');
  end if;
  if coalesce(p_admin_pin, '') !~ '^\d{4}$' then
    return jsonb_build_object('ok', false, 'error', 'Admin PIN peab olema 4 numbrit');
  end if;
  v_names := public.ss__clean_names(p_names);
  if coalesce(array_length(v_names, 1), 0) < 3 then
    return jsonb_build_object('ok', false, 'error', 'Lisa vähemalt 3 osalejat');
  end if;
  if array_length(v_names, 1) > 100 then
    return jsonb_build_object('ok', false, 'error', 'Liiga palju osalejaid');
  end if;
  loop
    v_code := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from public.ss_events where code = v_code);
  end loop;
  insert into public.ss_events (code, title, admin_pin_hash)
    values (v_code, btrim(p_title), crypt(p_admin_pin, gen_salt('bf')))
    returning id into v_id;
  foreach nm in array v_names loop
    insert into public.ss_participants (event_id, name) values (v_id, nm);
  end loop;
  return jsonb_build_object('ok', true, 'code', v_code);
end $$;

-- Loosi üldinfo: nimi, kas loos toimunud, osalejate nimed + kas esitanud.
create or replace function public.ss_event_info(p_code text)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare ev public.ss_events;
begin
  select * into ev from public.ss_events where code = p_code;
  if not found then return jsonb_build_object('ok', false, 'error', 'Sellise PIN-iga loosi ei leitud'); end if;
  return jsonb_build_object('ok', true, 'title', ev.title, 'drawn', ev.drawn_at is not null,
                            'participants', public.ss__roster(ev.id));
end $$;

-- Soovide esitamine / muutmine (kuni loosini). Esimesel korral PIN salvestatakse.
-- Kui pärast seda on kõik esitanud, toimub loos automaatselt.
create or replace function public.ss_submit(p_code text, p_name text, p_pin text, p_wishes text[])
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare ev public.ss_events; p public.ss_participants; err text; w text[]; total int; done int; drawn boolean := false;
begin
  select * into ev from public.ss_events where code = p_code for update;  -- serialiseerib viimase esitaja
  if not found then return jsonb_build_object('ok', false, 'error', 'Sellise PIN-iga loosi ei leitud'); end if;
  if ev.drawn_at is not null then
    return jsonb_build_object('ok', false, 'error', 'Loos on juba toimunud — soove enam muuta ei saa');
  end if;
  select * into p from public.ss_participants where event_id = ev.id and lower(name) = lower(btrim(p_name));
  if not found then return jsonb_build_object('ok', false, 'error', 'Sellist osalejat pole nimekirjas'); end if;
  if coalesce(p_pin, '') !~ '^\d{4}$' then
    return jsonb_build_object('ok', false, 'error', 'PIN peab olema 4 numbrit');
  end if;
  select array_agg(btrim(x) order by ord) into w
    from unnest(p_wishes) with ordinality as t(x, ord);
  if coalesce(array_length(w, 1), 0) <> 3 or exists (select 1 from unnest(w) x where x = '' or x is null) then
    return jsonb_build_object('ok', false, 'error', 'Kirjuta kõik kolm soovi');
  end if;
  if exists (select 1 from unnest(w) x where length(x) > 300) then
    return jsonb_build_object('ok', false, 'error', 'Soov on liiga pikk (max 300 märki)');
  end if;
  if p.pin_hash is null then
    update public.ss_participants set pin_hash = crypt(p_pin, gen_salt('bf')) where id = p.id;
  else
    err := public.ss__check_participant_pin(p.id, p_pin);
    if err is not null then return jsonb_build_object('ok', false, 'error', err); end if;
  end if;
  update public.ss_participants set wishes = w, submitted_at = now() where id = p.id;

  select count(*), count(submitted_at) into total, done from public.ss_participants where event_id = ev.id;
  if total >= 3 and total = done then
    drawn := public.ss__draw(ev.id);
  end if;
  return jsonb_build_object('ok', true, 'drawn', drawn);
end $$;

-- Minu vaade: oma soovid + (pärast loosi) kellele ostan ja tema soovid.
create or replace function public.ss_me(p_code text, p_name text, p_pin text)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare ev public.ss_events; p public.ss_participants; r public.ss_participants; err text;
begin
  select * into ev from public.ss_events where code = p_code;
  if not found then return jsonb_build_object('ok', false, 'error', 'Sellise PIN-iga loosi ei leitud'); end if;
  select * into p from public.ss_participants where event_id = ev.id and lower(name) = lower(btrim(p_name));
  if not found then return jsonb_build_object('ok', false, 'error', 'Sellist osalejat pole nimekirjas'); end if;
  if p.pin_hash is null then
    return jsonb_build_object('ok', true, 'name', p.name, 'title', ev.title, 'new', true,
                              'drawn', ev.drawn_at is not null);
  end if;
  err := public.ss__check_participant_pin(p.id, coalesce(p_pin, ''));
  if err is not null then return jsonb_build_object('ok', false, 'error', err); end if;
  if p.recipient_id is not null then
    select * into r from public.ss_participants where id = p.recipient_id;
  end if;
  return jsonb_build_object(
    'ok', true, 'name', p.name, 'title', ev.title, 'new', false,
    'wishes', to_jsonb(coalesce(p.wishes, '{}')),
    'drawn', ev.drawn_at is not null,
    'participants', public.ss__roster(ev.id),
    'recipient', case when ev.drawn_at is not null and r.id is not null
                      then jsonb_build_object('name', r.name, 'wishes', to_jsonb(r.wishes))
                      else null end);
end $$;

-- ---------------------------------------------------------------
-- Admin RPC-d (admin PIN kontrollitakse serveris)
-- Admin näeb ainult nimesid ja olekut — mitte soove ega loosi tulemust.
-- ---------------------------------------------------------------

create or replace function public.ss_admin_status(p_code text, p_admin_pin text)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare a jsonb; ev public.ss_events;
begin
  a := public.ss__admin_auth(p_code, p_admin_pin);
  if not (a->>'ok')::boolean then return a; end if;
  select * into ev from public.ss_events where id = (a->>'event_id')::uuid;
  return jsonb_build_object('ok', true, 'title', ev.title, 'drawn', ev.drawn_at is not null,
    'participants', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', name, 'submitted', submitted_at is not null, 'has_pin', pin_hash is not null,
        'locked', locked_until is not null and locked_until > now()) order by created_at, name), '[]'::jsonb)
      from public.ss_participants where event_id = ev.id));
end $$;

-- Lisa osalejaid (ainult enne loosi). p_names = nimede massiiv.
create or replace function public.ss_admin_add(p_code text, p_admin_pin text, p_names text[])
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare a jsonb; v_event uuid; nm text; added int := 0;
begin
  a := public.ss__admin_auth(p_code, p_admin_pin);
  if not (a->>'ok')::boolean then return a; end if;
  v_event := (a->>'event_id')::uuid;
  if exists (select 1 from public.ss_events where id = v_event and drawn_at is not null) then
    return jsonb_build_object('ok', false, 'error', 'Loos on juba toimunud — tühista see enne uute osalejate lisamist');
  end if;
  foreach nm in array public.ss__clean_names(p_names) loop
    if not exists (select 1 from public.ss_participants where event_id = v_event and lower(name) = lower(nm)) then
      insert into public.ss_participants (event_id, name) values (v_event, nm);
      added := added + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'added', added);
end $$;

-- Eemalda osaleja (ainult enne loosi).
create or replace function public.ss_admin_remove(p_code text, p_admin_pin text, p_name text)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare a jsonb; v_event uuid;
begin
  a := public.ss__admin_auth(p_code, p_admin_pin);
  if not (a->>'ok')::boolean then return a; end if;
  v_event := (a->>'event_id')::uuid;
  if exists (select 1 from public.ss_events where id = v_event and drawn_at is not null) then
    return jsonb_build_object('ok', false, 'error', 'Loos on juba toimunud — tühista see enne osaleja eemaldamist');
  end if;
  delete from public.ss_participants where event_id = v_event and lower(name) = lower(btrim(p_name));
  return jsonb_build_object('ok', true);
end $$;

-- Määra osalejale uus PIN (kui ta unustas oma PIN-i).
create or replace function public.ss_admin_set_pin(p_code text, p_admin_pin text, p_name text, p_new_pin text)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare a jsonb; n int;
begin
  a := public.ss__admin_auth(p_code, p_admin_pin);
  if not (a->>'ok')::boolean then return a; end if;
  if coalesce(p_new_pin, '') !~ '^\d{4}$' then
    return jsonb_build_object('ok', false, 'error', 'Uus PIN peab olema 4 numbrit');
  end if;
  update public.ss_participants
     set pin_hash = crypt(p_new_pin, gen_salt('bf')), failed = 0, locked_until = null
   where event_id = (a->>'event_id')::uuid and lower(name) = lower(btrim(p_name));
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'Sellist osalejat pole'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Käivita loos käsitsi (nt pärast mitte-esitanu eemaldamist). Kõik peavad olema esitanud.
create or replace function public.ss_admin_draw(p_code text, p_admin_pin text)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare a jsonb; v_event uuid; total int; done int;
begin
  a := public.ss__admin_auth(p_code, p_admin_pin);
  if not (a->>'ok')::boolean then return a; end if;
  v_event := (a->>'event_id')::uuid;
  perform 1 from public.ss_events where id = v_event for update;
  if exists (select 1 from public.ss_events where id = v_event and drawn_at is not null) then
    return jsonb_build_object('ok', false, 'error', 'Loos on juba toimunud');
  end if;
  select count(*), count(submitted_at) into total, done from public.ss_participants where event_id = v_event;
  if total < 3 then return jsonb_build_object('ok', false, 'error', 'Vaja on vähemalt 3 osalejat'); end if;
  if total <> done then return jsonb_build_object('ok', false, 'error', 'Kõik pole veel soove esitanud'); end if;
  perform public.ss__draw(v_event);
  return jsonb_build_object('ok', true);
end $$;

-- Tühista loos (paarid kustutatakse; soovid ja PIN-id jäävad alles).
create or replace function public.ss_admin_reset_draw(p_code text, p_admin_pin text)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare a jsonb; v_event uuid;
begin
  a := public.ss__admin_auth(p_code, p_admin_pin);
  if not (a->>'ok')::boolean then return a; end if;
  v_event := (a->>'event_id')::uuid;
  update public.ss_participants set recipient_id = null where event_id = v_event;
  update public.ss_events set drawn_at = null where id = v_event;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------
-- Õigused: sisemised abifunktsioonid kinni, avalikud RPC-d anon-ile lahti.
-- (Supabase annab uutele funktsioonidele vaikimisi execute-õiguse, seega
-- abifunktsioonidelt tuleb see eraldi ära võtta.)
-- ---------------------------------------------------------------
revoke all on function public.ss__check_participant_pin(uuid, text) from public, anon, authenticated;
revoke all on function public.ss__admin_auth(text, text) from public, anon, authenticated;
revoke all on function public.ss__draw(uuid) from public, anon, authenticated;
revoke all on function public.ss__roster(uuid) from public, anon, authenticated;
revoke all on function public.ss__clean_names(text[]) from public, anon, authenticated;

grant execute on function public.ss_create_event(text, text, text[]) to anon, authenticated;
grant execute on function public.ss_event_info(text) to anon, authenticated;
grant execute on function public.ss_submit(text, text, text, text[]) to anon, authenticated;
grant execute on function public.ss_me(text, text, text) to anon, authenticated;
grant execute on function public.ss_admin_status(text, text) to anon, authenticated;
grant execute on function public.ss_admin_add(text, text, text[]) to anon, authenticated;
grant execute on function public.ss_admin_remove(text, text, text) to anon, authenticated;
grant execute on function public.ss_admin_set_pin(text, text, text, text) to anon, authenticated;
grant execute on function public.ss_admin_draw(text, text) to anon, authenticated;
grant execute on function public.ss_admin_reset_draw(text, text) to anon, authenticated;

-- ---------------------------------------------------------------
-- VALIKULINE: pere jõululoosi loomine otse SQL-ist.
-- Sama saab teha ka lehel /jouluvana → "Loo uus loos".
-- Asenda VAHETA_MIND oma 4-numbrilise admin PIN-iga ja eemalda
-- rea algusest "--". Tulemuses näed 6-numbrilist mängu PIN-i (code).
-- ---------------------------------------------------------------
-- select public.ss_create_event('Jõulud 2026', 'VAHETA_MIND',
--   array['Jarmo','Linda','Mati','Imbi','Johan','Merka']);
