-- ============================================================
-- 우리 가계부 (커플용) : 공유 저장소 만들기
--
-- 사용법:
--   1. supabase.com 에서 무료 프로젝트를 만든다
--   2. 왼쪽 메뉴 "SQL Editor" 를 연다
--   3. 이 파일 내용 전체를 붙여넣고 Run 을 누른다
--   4. Settings → API 에서 Project URL 과 anon public 키를 복사해
--      앱의 설정 → 커플 공유에 넣는다
--
-- 이미 예전 버전 SQL을 실행했다면, 이 파일을 그대로 다시 Run 하면 됩니다.
-- ============================================================

-- 가계부 내역
create table if not exists entries (
  id text primary key,
  couple_code text not null,
  date date not null,
  type text not null,
  amount numeric not null,
  category text,
  memo text,
  member text,        -- 입력한 사람
  payer text,         -- 실제로 돈 낸 사람 (정산 계산용)
  split text,         -- 'half' = 함께 쓴 돈, 'personal' = 개인 돈
  method text,             -- 결제수단(카드) id
  tip numeric default 0,   -- amount 에 포함된 팁 (기록용)
  auto boolean default false,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- 예전 버전에서 올라오는 경우를 위한 컬럼 보강
alter table entries add column if not exists couple_code text;
alter table entries add column if not exists payer text;
alter table entries add column if not exists split text;
alter table entries add column if not exists method text;
alter table entries add column if not exists tip numeric default 0;
-- 앞으로 새 항목이 생겨도 이 칸에 담기므로 SQL 을 다시 실행할 필요가 없다
alter table entries add column if not exists extra jsonb;
alter table entries add column if not exists auto boolean default false;

-- 예전 family_code 데이터가 있으면 옮겨오기
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'entries' and column_name = 'family_code') then
    update entries set couple_code = family_code where couple_code is null;
  end if;
end $$;

create index if not exists entries_couple_updated on entries (couple_code, updated_at);

-- 둘이 공유하는 설정 (분류, 예산, 통화, 분담 비율, 저축 목표, 반복 지출)
create table if not exists couple_meta (
  couple_code text primary key,
  categories jsonb,
  budget numeric,
  currency text,
  split_ratio numeric,
  fixed_share numeric,   -- 고정지출 정액 부담
  goal jsonb,
  recurring jsonb,
  methods jsonb,        -- 결제수단(카드) 목록
  members jsonb,      -- 두 사람의 실제 이름 (앱이 자동으로 맞춰줌)
  updated_at timestamptz not null default now()
);

alter table couple_meta add column if not exists members jsonb;
alter table couple_meta add column if not exists fixed_share numeric;
alter table couple_meta add column if not exists methods jsonb;
alter table couple_meta add column if not exists extra jsonb;

-- 접근 정책: anon 키와 커플 코드를 아는 사람(=두 사람)만 읽고 쓸 수 있게 허용
alter table entries enable row level security;
alter table couple_meta enable row level security;

drop policy if exists "couple entries all" on entries;
create policy "couple entries all" on entries for all using (true) with check (true);

drop policy if exists "couple meta all" on couple_meta;
create policy "couple meta all" on couple_meta for all using (true) with check (true);
