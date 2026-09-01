-- Nestoria Partner HUD integration.
--
-- Extends the existing pregnancy system; it does not replace any of it.
--   * pregnancies.partner_user_id stays the fast "who is the active partner"
--     pointer every existing query already reads. pregnancy_partner_links is
--     the authoritative record that adds pending/declined/removed states,
--     per-link permissions and history, which a single nullable column cannot
--     express. The two are kept in sync by the server (see partner.ts).
--   * notifications is extended in place rather than duplicated into a second
--     partner_notifications table.
--   * The hospital bag becomes a shared checklist AND keeps working as the
--     worn in-world object (lsl/nestoria_hospital_bag.lsl); 0006 dropped the
--     old table, this re-adds it with the sharing/attribution columns it
--     needed to be useful to two people.

-- ---------------------------------------------------------------------------
-- 1. Labor engine state.
--
-- Labor is decided by the server, never by a button. The onset point is stored
-- as a GESTATIONAL FRACTION rather than a timestamp so that changing
-- duration_days (which rescales conceived_at, see settings_update) keeps labor
-- at the same point in the pregnancy instead of teleporting it.
-- ---------------------------------------------------------------------------
alter table pregnancies
  add column if not exists labor_onset_frac numeric(7,6),
  add column if not exists labor_plan jsonb not null default '{}'::jsonb,
  add column if not exists labor_phase text not null default 'none',
  add column if not exists labor_engine_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pregnancies_labor_phase_check'
  ) then
    alter table pregnancies add constraint pregnancies_labor_phase_check
      check (labor_phase in ('none','prelabor','early','active','transition','pushing','delivered'));
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Partner relationship
-- ---------------------------------------------------------------------------
create table if not exists pregnancy_partner_links (
  id               uuid primary key default gen_random_uuid(),
  pregnancy_id     uuid not null references pregnancies(id) on delete cascade,
  pregnant_user_id uuid not null references hud_users(id) on delete cascade,
  partner_user_id  uuid not null references hud_users(id) on delete cascade,
  status           text not null default 'pending'
                   check (status in ('pending', 'active', 'declined', 'removed')),
  permissions      jsonb not null default '{}'::jsonb,
  requested_at     timestamptz not null default now(),
  accepted_at      timestamptz,
  disconnected_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- One active partner per pregnancy, and a partner cannot hold two active links
-- to the same pregnancy. Multi-partner is not a feature of the pregnancy system.
create unique index if not exists partner_links_one_active_idx
  on pregnancy_partner_links (pregnancy_id) where status = 'active';
create unique index if not exists partner_links_one_pending_idx
  on pregnancy_partner_links (pregnancy_id, partner_user_id) where status = 'pending';
create index if not exists partner_links_partner_idx
  on pregnancy_partner_links (partner_user_id, status);

-- Backfill: every pregnancy that already has a linked partner becomes an
-- active link, so existing couples keep working with no re-pairing.
insert into pregnancy_partner_links
  (pregnancy_id, pregnant_user_id, partner_user_id, status, accepted_at)
select p.id, p.user_id, p.partner_user_id, 'active', p.updated_at
from pregnancies p
where p.partner_user_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Normalized pregnancy event bus.
--
-- event_history stays what it is (mom-facing RP popups). This is the shared,
-- ordered, replayable stream both HUDs read — it is what makes "while you were
-- away" and dedupe-by-event-id possible.
-- ---------------------------------------------------------------------------
create table if not exists pregnancy_events (
  id           uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null references pregnancies(id) on delete cascade,
  type         text not null,
  severity     text not null default 'info'
               check (severity in ('info','milestone','request','important','labor','urgent','birth')),
  title        text not null,
  body         text,
  actor_id     uuid references hud_users(id) on delete set null,
  metadata     jsonb not null default '{}'::jsonb,
  -- Idempotency handle: an engine event that must only ever fire once for a
  -- pregnancy carries a stable key (e.g. 'water_broke'), so a race between two
  -- concurrent HUD polls cannot emit it twice.
  dedupe_key   text,
  created_at   timestamptz not null default now()
);
create index if not exists pregnancy_events_feed_idx
  on pregnancy_events (pregnancy_id, created_at desc);
create unique index if not exists pregnancy_events_dedupe_idx
  on pregnancy_events (pregnancy_id, dedupe_key) where dedupe_key is not null;

-- ---------------------------------------------------------------------------
-- 4. Reusable interaction request framework (one implementation for every
--    consent-gated partner action).
-- ---------------------------------------------------------------------------
create table if not exists pregnancy_interaction_requests (
  id           uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null references pregnancies(id) on delete cascade,
  sender_id    uuid not null references hud_users(id) on delete cascade,
  recipient_id uuid not null references hud_users(id) on delete cascade,
  action_type  text not null,
  payload      jsonb not null default '{}'::jsonb,
  status       text not null default 'pending'
               check (status in ('pending','accepted','declined','expired','cancelled')),
  expires_at   timestamptz not null default now() + interval '3 minutes',
  responded_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists interaction_requests_inbox_idx
  on pregnancy_interaction_requests (recipient_id, status, created_at desc);
-- Anti-spam / anti-double-tap: only one pending request of a given type may be
-- in flight from one sender on one pregnancy at a time.
create unique index if not exists interaction_requests_one_pending_idx
  on pregnancy_interaction_requests (pregnancy_id, sender_id, action_type)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- 5. Shared hospital bag checklist.
--    Complements the worn in-world bag object; it does not replace it.
-- ---------------------------------------------------------------------------
create table if not exists hospital_bag_items (
  id           uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null references pregnancies(id) on delete cascade,
  item_key     text not null,
  checked      boolean not null default false,
  checked_by   uuid references hud_users(id) on delete set null,
  checked_name text,
  checked_at   timestamptz,
  updated_at   timestamptz not null default now(),
  unique (pregnancy_id, item_key)
);
create index if not exists hospital_bag_preg_idx on hospital_bag_items (pregnancy_id);

-- ---------------------------------------------------------------------------
-- 6. Shared milestone feed (both HUDs read it; either may celebrate).
-- ---------------------------------------------------------------------------
create table if not exists pregnancy_milestones (
  id             uuid primary key default gen_random_uuid(),
  pregnancy_id   uuid not null references pregnancies(id) on delete cascade,
  key            text not null,
  title          text not null,
  body           text,
  week           integer,
  celebrated_by  jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  unique (pregnancy_id, key)
);
create index if not exists pregnancy_milestones_idx
  on pregnancy_milestones (pregnancy_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 7. Notifications gain routing/severity instead of a parallel table.
-- ---------------------------------------------------------------------------
alter table notifications
  add column if not exists pregnancy_id uuid references pregnancies(id) on delete cascade,
  add column if not exists sender_id uuid references hud_users(id) on delete set null,
  add column if not exists severity text not null default 'info',
  add column if not exists event_type text,
  add column if not exists event_id uuid references pregnancy_events(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'notifications_severity_check'
  ) then
    alter table notifications add constraint notifications_severity_check
      check (severity in ('info','milestone','request','important','labor','urgent','birth'));
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Lock the new tables down from PostgREST exactly like the rest of the schema.
-- The app connects as postgres and bypasses RLS; anon/authenticated get nothing.
-- ---------------------------------------------------------------------------
alter table pregnancy_partner_links        enable row level security;
alter table pregnancy_events               enable row level security;
alter table pregnancy_interaction_requests enable row level security;
alter table hospital_bag_items             enable row level security;
alter table pregnancy_milestones           enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table pregnancy_partner_links, pregnancy_events,
      pregnancy_interaction_requests, hospital_bag_items, pregnancy_milestones
      from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table pregnancy_partner_links, pregnancy_events,
      pregnancy_interaction_requests, hospital_bag_items, pregnancy_milestones
      from authenticated;
  end if;
end
$$;
