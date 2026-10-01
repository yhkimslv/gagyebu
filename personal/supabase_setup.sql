-- ============================================================
-- My Ledger: set up sync storage
--
-- How to use:
--   1. Create a free project at supabase.com.
--   2. Open "SQL Editor" from the left sidebar.
--   3. Paste the entire contents of this file, then select Run.
--   4. Under Settings → API, copy the Project URL and anon public key,
--      then enter them under Settings → Sync between my devices in the app.
--
-- If you ran an older version of this SQL, you can safely run this entire file again.
-- ============================================================

-- Ledger entries
create table if not exists entries (
  id text primary key,
  couple_code text not null,
  date date not null,
  type text not null,
  amount numeric not null,
  category text,
  memo text,
  member text,        -- person who entered the item
  payer text,         -- person who actually paid (used for settlement calculations)
  split text,         -- 'half' = shared expense, 'personal' = personal expense
  method text,             -- payment method (card) ID
  tip numeric default 0,   -- tip included in amount (kept for reporting)
  auto boolean default false,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- Add columns needed when upgrading from an older version.
alter table entries add column if not exists couple_code text;
alter table entries add column if not exists payer text;
alter table entries add column if not exists split text;
alter table entries add column if not exists method text;
alter table entries add column if not exists tip numeric default 0;
-- Future fields can be stored here without rerunning this SQL for each one.
alter table entries add column if not exists extra jsonb;
alter table entries add column if not exists auto boolean default false;

-- Migrate any existing family_code data.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'entries' and column_name = 'family_code') then
    update entries set couple_code = family_code where couple_code is null;
  end if;
end $$;

create index if not exists entries_couple_updated on entries (couple_code, updated_at);

-- Settings shared across devices (categories, budget, currency, split ratio, savings goal, recurring expenses)
create table if not exists couple_meta (
  couple_code text primary key,
  categories jsonb,
  budget numeric,
  currency text,
  split_ratio numeric,
  fixed_share numeric,   -- flat contribution toward fixed expenses
  goal jsonb,
  recurring jsonb,
  methods jsonb,        -- payment methods (cards)
  members jsonb,      -- retained for schema compatibility with older shared-ledger data
  updated_at timestamptz not null default now()
);

alter table couple_meta add column if not exists members jsonb;
alter table couple_meta add column if not exists fixed_share numeric;
alter table couple_meta add column if not exists methods jsonb;
alter table couple_meta add column if not exists extra jsonb;

-- Access policy: allow clients that know the anon key and sync code to read and write.
alter table entries enable row level security;
alter table couple_meta enable row level security;

drop policy if exists "couple entries all" on entries;
create policy "couple entries all" on entries for all using (true) with check (true);

drop policy if exists "couple meta all" on couple_meta;
create policy "couple meta all" on couple_meta for all using (true) with check (true);
