-- Nestoria MOAP HUD journey expansion.
-- Adds setup state, cravings, wellness/event history, and popup settings used
-- by the Render-hosted web HUD.

alter table pregnancies
  add column if not exists pregnancy_day integer not null default 0 check (pregnancy_day between 0 and 6),
  add column if not exists baby_count integer not null default 1 check (baby_count between 1 and 3),
  add column if not exists baby_names jsonb not null default '[]'::jsonb,
  add column if not exists privacy_mode text not null default 'partner'
    check (privacy_mode in ('private', 'partner', 'partner_doctor', 'public_rp')),
  add column if not exists progression_mode text not null default 'scaled'
    check (progression_mode in ('realtime', 'scaled', 'manual')),
  add column if not exists setup_complete boolean not null default false,
  add column if not exists setup_step integer not null default 1;

alter table user_stats
  add column if not exists nutrition numeric(5,2) not null default 72,
  add column if not exists stress numeric(5,2) not null default 20,
  add column if not exists baby_wellness numeric(5,2) not null default 88,
  add column if not exists baby_bond numeric(5,2) not null default 40,
  add column if not exists baby_movement numeric(5,2) not null default 45;

create table if not exists cravings (
  id             uuid primary key default gen_random_uuid(),
  pregnancy_id   uuid not null references pregnancies(id) on delete cascade,
  craving        text not null,
  category       text not null default 'sweet',
  intensity      integer not null default 50 check (intensity between 0 and 100),
  relief         integer not null default 0 check (relief between 0 and 100),
  sweets_streak  integer not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists cravings_active_idx on cravings (pregnancy_id, active, updated_at desc);

create table if not exists wellness_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references hud_users(id) on delete cascade,
  pregnancy_id uuid references pregnancies(id) on delete cascade,
  action       text not null,
  deltas       jsonb not null default '{}'::jsonb,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists wellness_logs_user_idx on wellness_logs (user_id, created_at desc);

create table if not exists event_history (
  id           uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null references pregnancies(id) on delete cascade,
  user_id      uuid not null references hud_users(id) on delete cascade,
  event_type   text not null,
  title        text not null,
  body         text,
  choice       text,
  created_at   timestamptz not null default now()
);
create index if not exists event_history_preg_idx on event_history (pregnancy_id, created_at desc);

alter table user_settings
  alter column settings set default jsonb_build_object(
    'popupFrequencyMinutes', 20,
    'setupComplete', false,
    'partnerPermissions', jsonb_build_object(
      'babyUpdates', true,
      'momWellness', false,
      'cravings', true,
      'appointments', true,
      'journalMemories', false
    )
  );

alter table cravings      enable row level security;
alter table wellness_logs enable row level security;
alter table event_history enable row level security;

revoke all on table cravings, wellness_logs, event_history from anon, authenticated;
