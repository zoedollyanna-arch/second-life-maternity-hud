-- Conception, fertility and the pregnancy test.
--
-- The client asked for the journey to start before the pregnancy does: a
-- "Try to Conceive" button, a fertility setting, and a test that confirms it.
--
-- The obvious implementation — no pregnancy row until she conceives — is a
-- trap. Four things in the existing schema and code depend on that row:
--
--   * `pregnancies.partner_code` is where the pairing code lives, so with no
--     row a partner could never pair. The client explicitly wants the PARTNER
--     to be able to start the attempt, so he has to be linked first.
--   * `conceived_at` is NOT NULL.
--   * performAction resolves a pregnancy before dispatching anything, so with
--     no row there is no way to send "conceive" through the normal pipe.
--   * registerDevice reads preg.conceived_at with no null guard on the mom
--     path — the very first request a new wearer makes.
--
-- So the row exists from the moment she wears the HUD, and simply is not a
-- pregnancy yet: status 'trying'. The labor engine already returns early for
-- any status other than 'active' (labor.ts), so a trying row cannot draw a
-- labor plan or deliver a baby, which is the behaviour we want for free.

-- ---------------------------------------------------------------------------
-- 1. 'trying' becomes a legal status.
-- ---------------------------------------------------------------------------
alter table pregnancies drop constraint if exists pregnancies_status_check;
alter table pregnancies add constraint pregnancies_status_check
  check (status in ('trying', 'active', 'paused', 'delivered', 'archived'));

-- ---------------------------------------------------------------------------
-- 2. One LIVE pregnancy per user, where live now means trying or active.
--
-- The old index covered only 'active'. Without widening it a user could end up
-- with a trying row and an active row at once. Note that ensureActivePregnancy
-- infers this index in its ON CONFLICT clause, so the predicate there has to be
-- changed in the same commit — an inference predicate must match exactly.
-- ---------------------------------------------------------------------------
drop index if exists pregnancies_one_active_per_user_idx;
create unique index if not exists pregnancies_one_live_per_user_idx
  on pregnancies (user_id) where status in ('active', 'trying');

-- ---------------------------------------------------------------------------
-- 3. Conception state.
--
-- `conceived_on` is deliberately separate from `conceived_at`. The former is
-- when conception actually happened and is set the moment an attempt succeeds;
-- the latter is the pregnancy clock the whole app already reads, and is only
-- written when the test confirms. That gap is what lets a positive test be a
-- reveal rather than a formality, and it keeps every existing computeProgress
-- call honest — a trying row's conceived_at is never used for anything.
-- ---------------------------------------------------------------------------
alter table pregnancies
  add column if not exists fertility text not null default 'normal',
  add column if not exists trying_since timestamptz,
  add column if not exists attempts integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists conceived_on timestamptz,
  add column if not exists test_ready_at timestamptz,
  add column if not exists test_taken_at timestamptz,
  add column if not exists tests_taken integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pregnancies_fertility_check'
  ) then
    alter table pregnancies add constraint pregnancies_fertility_check
      check (fertility in ('low', 'normal', 'high'));
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Everything that already exists stays a real pregnancy.
--
-- Only brand new rows start as 'trying' (see ensureActivePregnancy). Existing
-- players — including the client's current test pregnancy — are untouched.
-- ---------------------------------------------------------------------------

-- A log of attempts, so "we have been trying for a while" is answerable and
-- the odds can be tuned later against real play rather than guesswork.
create table if not exists conception_attempts (
  id           uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null references pregnancies(id) on delete cascade,
  actor_id     uuid references hud_users(id) on delete set null,
  actor_name   text,
  fertility    text not null,
  chance       numeric(4,3) not null,
  succeeded    boolean not null,
  created_at   timestamptz not null default now()
);
create index if not exists conception_attempts_preg_idx
  on conception_attempts (pregnancy_id, created_at desc);

alter table conception_attempts enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table conception_attempts from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table conception_attempts from authenticated;
  end if;
end
$$;
