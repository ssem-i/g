-- =====================================================================
-- 실시간 방송 플랫폼 — Supabase 스키마 (단일 파일)
--
-- Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여 넣고 Run 하세요.
-- 여러 번 실행해도 오류가 나지 않도록(idempotent) 작성되어 있습니다.
--
-- 포함 내용
--   1. 테이블: profiles, streams, chat_messages, donations, recordings
--   2. 회원가입 트리거 (닉네임 저장, 10,000 포인트 지급)
--   3. RLS 정책 (모든 테이블 RLS 활성화)
--   4. 함수: donate() — 포인트 차감/적립/후원 기록을 한 트랜잭션으로 처리
--   5. Realtime 퍼블리케이션 등록
--   6. Storage 버킷(recordings)과 정책
--   7. 테스트 계정 시드 (스트리머/시청자)
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  points integer not null default 10000,
  created_at timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_points_nonnegative;
alter table public.profiles add constraint profiles_points_nonnegative check (points >= 0);
alter table public.profiles drop constraint if exists profiles_nickname_length;
alter table public.profiles add constraint profiles_nickname_length
  check (char_length(nickname) between 1 and 20);

create table if not exists public.streams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null default '기타',
  status text not null default 'offline',
  started_at timestamptz,
  created_at timestamptz not null default now()
);

-- 비정상 종료 감지용 하트비트 (송출 중 20초마다 갱신)
alter table public.streams add column if not exists last_seen_at timestamptz;

alter table public.streams drop constraint if exists streams_status_check;
alter table public.streams add constraint streams_status_check
  check (status in ('offline', 'live'));
alter table public.streams drop constraint if exists streams_title_length;
alter table public.streams add constraint streams_title_length
  check (char_length(title) between 1 and 100);
alter table public.streams drop constraint if exists streams_description_length;
alter table public.streams add constraint streams_description_length
  check (char_length(description) <= 2000);

create index if not exists streams_owner_idx on public.streams (owner_id);
create index if not exists streams_status_idx on public.streams (status, started_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_messages drop constraint if exists chat_content_length;
alter table public.chat_messages add constraint chat_content_length
  check (char_length(content) between 1 and 300);
create index if not exists chat_stream_idx on public.chat_messages (stream_id, created_at desc);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams (id) on delete cascade,
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null,
  message text not null default '',
  created_at timestamptz not null default now()
);

alter table public.donations drop constraint if exists donations_amount_positive;
alter table public.donations add constraint donations_amount_positive check (amount > 0);
create index if not exists donations_stream_idx on public.donations (stream_id, created_at desc);

create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid references public.streams (id) on delete set null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  duration integer not null default 0,
  created_at timestamptz not null default now()
);

-- 방송이 삭제되어도 다시보기 제목을 보여주기 위한 스냅샷
alter table public.recordings add column if not exists title text not null default '';
create index if not exists recordings_stream_idx on public.recordings (stream_id, created_at desc);
create index if not exists recordings_owner_idx on public.recordings (owner_id, created_at desc);

-- ---------------------------------------------------------------------
-- 2. 회원가입 트리거: 닉네임 저장 + 가입 포인트 10,000 지급
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nickname text;
begin
  v_nickname := nullif(trim(coalesce(new.raw_user_meta_data ->> 'nickname', '')), '');
  if v_nickname is null then
    v_nickname := split_part(coalesce(new.email, 'user'), '@', 1);
  end if;
  v_nickname := left(v_nickname, 20);

  insert into public.profiles (id, nickname, points)
  values (new.id, v_nickname, 10000)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.streams enable row level security;
alter table public.chat_messages enable row level security;
alter table public.donations enable row level security;
alter table public.recordings enable row level security;

-- profiles: 누구나 조회, 본인만 닉네임 수정 (포인트는 donate() 로만 변경)
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (nickname) on public.profiles to authenticated;

-- streams: 누구나 조회, 로그인 사용자가 본인 소유로 등록, 소유자만 수정/삭제
drop policy if exists "streams_select_all" on public.streams;
create policy "streams_select_all" on public.streams
  for select using (true);

drop policy if exists "streams_insert_own" on public.streams;
create policy "streams_insert_own" on public.streams
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "streams_update_owner" on public.streams;
create policy "streams_update_owner" on public.streams
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "streams_delete_owner" on public.streams;
create policy "streams_delete_owner" on public.streams
  for delete to authenticated
  using (owner_id = auth.uid());

grant select on public.streams to anon, authenticated;
grant insert, update, delete on public.streams to authenticated;

-- chat_messages: 누구나 조회, 로그인 사용자만 본인 이름으로 작성,
--                작성자 본인 또는 방송 소유자만 삭제
drop policy if exists "chat_select_all" on public.chat_messages;
create policy "chat_select_all" on public.chat_messages
  for select using (true);

drop policy if exists "chat_insert_own" on public.chat_messages;
create policy "chat_insert_own" on public.chat_messages
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "chat_delete_owner_or_author" on public.chat_messages;
create policy "chat_delete_owner_or_author" on public.chat_messages
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.streams s
      where s.id = chat_messages.stream_id and s.owner_id = auth.uid()
    )
  );

revoke update on public.chat_messages from anon, authenticated;
grant select on public.chat_messages to anon, authenticated;
grant insert, delete on public.chat_messages to authenticated;

-- donations: 누구나 조회 (알림 오버레이용). 쓰기는 donate() 함수로만.
drop policy if exists "donations_select_all" on public.donations;
create policy "donations_select_all" on public.donations
  for select using (true);

revoke insert, update, delete on public.donations from anon, authenticated;
grant select on public.donations to anon, authenticated;

-- recordings: 누구나 조회, 본인 방송에 대해서만 등록, 소유자만 삭제
drop policy if exists "recordings_select_all" on public.recordings;
create policy "recordings_select_all" on public.recordings
  for select using (true);

drop policy if exists "recordings_insert_owner" on public.recordings;
create policy "recordings_insert_owner" on public.recordings
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (
      stream_id is null
      or exists (
        select 1 from public.streams s
        where s.id = recordings.stream_id and s.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "recordings_delete_owner" on public.recordings;
create policy "recordings_delete_owner" on public.recordings
  for delete to authenticated
  using (owner_id = auth.uid());

revoke update on public.recordings from anon, authenticated;
grant select on public.recordings to anon, authenticated;
grant insert, delete on public.recordings to authenticated;

-- ---------------------------------------------------------------------
-- 4. 함수: 후원 (원자적 포인트 차감)
-- ---------------------------------------------------------------------

create or replace function public.donate(
  p_stream_id uuid,
  p_amount integer,
  p_message text default ''
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_balance integer;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다. 로그인 후 다시 시도하세요.';
  end if;

  if p_amount is null or p_amount < 100 or p_amount > 1000000 then
    raise exception '후원 금액은 100 ~ 1,000,000 포인트 사이로 입력하세요.';
  end if;

  if char_length(coalesce(p_message, '')) > 100 then
    raise exception '후원 메시지는 100자 이하로 입력하세요.';
  end if;

  select owner_id into v_owner from public.streams where id = p_stream_id;
  if v_owner is null then
    raise exception '방송을 찾을 수 없습니다. 페이지를 새로고침하세요.';
  end if;

  if v_owner = v_uid then
    raise exception '자신의 방송에는 후원할 수 없습니다. 다른 계정으로 로그인하세요.';
  end if;

  -- 잔액이 충분할 때만 차감 (행 잠금으로 동시 요청에도 음수가 되지 않음)
  update public.profiles
     set points = points - p_amount
   where id = v_uid and points >= p_amount
  returning points into v_balance;

  if not found then
    raise exception '포인트가 부족합니다. 금액을 줄여서 다시 시도하세요.';
  end if;

  update public.profiles set points = points + p_amount where id = v_owner;

  insert into public.donations (stream_id, from_user_id, amount, message)
  values (p_stream_id, v_uid, p_amount, coalesce(trim(p_message), ''));

  return v_balance;
end;
$$;

revoke execute on function public.donate(uuid, integer, text) from public, anon;
grant execute on function public.donate(uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Realtime: 채팅, 후원, 방송 상태 변경을 실시간으로 받기
-- ---------------------------------------------------------------------

alter table public.chat_messages replica identity full;

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['streams', 'chat_messages', 'donations'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Storage: 다시보기 영상 버킷 (공개 읽기, 본인 폴더에만 업로드/삭제)
--    경로 규칙: recordings/{user_id}/{파일명}.webm
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', true)
on conflict (id) do update set public = true;

drop policy if exists "recordings_bucket_read" on storage.objects;
create policy "recordings_bucket_read" on storage.objects
  for select using (bucket_id = 'recordings');

drop policy if exists "recordings_bucket_insert_own" on storage.objects;
create policy "recordings_bucket_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "recordings_bucket_delete_own" on storage.objects;
create policy "recordings_bucket_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------
-- 7. 테스트 계정 시드
--    스트리머: streamer@test.com / test1234!
--    시청자  : viewer@test.com   / test1234!
-- ---------------------------------------------------------------------

do $$
declare
  r record;
  c text;
begin
  for r in
    select * from (values
      ('11111111-1111-4111-8111-111111111111'::uuid, 'streamer@test.com', '테스트스트리머'),
      ('22222222-2222-4222-8222-222222222222'::uuid, 'viewer@test.com',   '테스트시청자')
    ) as v(id, email, nickname)
  loop
    if not exists (select 1 from auth.users where id = r.id or email = r.email) then
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (
        '00000000-0000-0000-0000-000000000000', r.id, 'authenticated', 'authenticated',
        r.email, extensions.crypt('test1234!', extensions.gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nickname', r.nickname),
        now(), now()
      );
    end if;

    if not exists (
      select 1 from auth.identities where provider = 'email' and provider_id = r.id::text
    ) and exists (select 1 from auth.users where id = r.id) then
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), r.id, r.id::text,
        jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true),
        'email', now(), now(), now()
      );
    end if;

    insert into public.profiles (id, nickname, points)
    select r.id, r.nickname, 10000
    where exists (select 1 from auth.users where id = r.id)
    on conflict (id) do nothing;
  end loop;

  -- GoTrue 는 아래 토큰 컬럼이 NULL 이면 로그인 시 오류를 냅니다. 빈 문자열로 채웁니다.
  foreach c in array array[
    'confirmation_token', 'recovery_token', 'email_change_token_new',
    'email_change', 'email_change_token_current', 'phone_change',
    'phone_change_token', 'reauthentication_token'
  ] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'users' and column_name = c
    ) then
      execute format(
        'update auth.users set %I = '''' where %I is null and id in (%L::uuid, %L::uuid)',
        c, c,
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222'
      );
    end if;
  end loop;

  -- 스트리머 테스트 계정의 샘플 방송
  if exists (select 1 from public.profiles where id = '11111111-1111-4111-8111-111111111111') then
    insert into public.streams (id, owner_id, title, description, category)
    values (
      '33333333-3333-4333-8333-333333333333',
      '11111111-1111-4111-8111-111111111111',
      '테스트 방송: 화면 공유 데모',
      '테스트 스트리머 계정의 샘플 방송입니다. 스튜디오에서 송출을 시작해 보세요.',
      '토크'
    )
    on conflict (id) do nothing;
  end if;
end;
$$;
