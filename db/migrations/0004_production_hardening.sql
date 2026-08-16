-- Production reliability: prevent duplicate active journeys/cravings, persist
-- automatic event timing, and add indexes used by session/device housekeeping.

create unique index if not exists pregnancies_one_active_per_user_idx
  on pregnancies (user_id) where status = 'active';

create unique index if not exists cravings_one_active_per_pregnancy_idx
  on cravings (pregnancy_id) where active = true;

create index if not exists hud_sessions_expiry_idx on hud_sessions (expires_at);
create index if not exists sl_devices_last_seen_idx on sl_devices (last_seen);
create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);

create table if not exists event_schedules (
  pregnancy_id      uuid primary key references pregnancies(id) on delete cascade,
  user_id           uuid not null references hud_users(id) on delete cascade,
  frequency_minutes integer not null check (frequency_minutes between 1 and 240),
  next_event_at     timestamptz not null,
  last_event_at     timestamptz,
  updated_at        timestamptz not null default now()
);
create index if not exists event_schedules_due_idx on event_schedules (next_event_at);

alter table event_schedules enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table event_schedules from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table event_schedules from authenticated;
  end if;
end
$$;
