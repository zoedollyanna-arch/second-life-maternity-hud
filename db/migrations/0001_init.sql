-- Nestoria Pregnancy HUD — initial schema
-- All access goes through the app server (postgres role). RLS is enabled with
-- no policies so Supabase's PostgREST (anon/authenticated) cannot read these
-- tables directly.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Users (one row per Second Life avatar)
-- ---------------------------------------------------------------------------
create table if not exists hud_users (
  id           uuid primary key default gen_random_uuid(),
  avatar_key   uuid not null unique,
  avatar_name  text not null,
  display_name text,
  role         text not null default 'mom' check (role in ('mom', 'partner')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Web sessions: the LSL HUD registers and receives a token which is embedded
-- in the MOAP URL. Every web/API request is authenticated with this token.
create table if not exists hud_sessions (
  token      uuid primary key default gen_random_uuid(),
  user_id    uuid not null references hud_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days'
);
create index if not exists hud_sessions_user_idx on hud_sessions (user_id);

-- In-world objects (HUD, belly, partner HUD) that talk to the server.
-- callback_url is the llRequestURL() http-in URL used to push commands.
create table if not exists sl_devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references hud_users(id) on delete cascade,
  object_key   uuid not null,
  kind         text not null default 'hud' check (kind in ('hud', 'belly', 'partner')),
  callback_url text,
  region       text,
  last_seen    timestamptz not null default now(),
  unique (user_id, kind)
);

-- ---------------------------------------------------------------------------
-- Pregnancy
-- ---------------------------------------------------------------------------
create table if not exists pregnancies (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references hud_users(id) on delete cascade,
  partner_user_id uuid references hud_users(id) on delete set null,
  partner_name    text,
  partner_code    text unique,          -- pairing code the partner HUD redeems
  status          text not null default 'active'
                  check (status in ('active', 'paused', 'delivered', 'archived')),
  conceived_at    timestamptz not null default now(),
  duration_days   integer not null default 30 check (duration_days between 1 and 280),
  baby_name       text,
  baby_gender     text not null default 'surprise'
                  check (baby_gender in ('girl', 'boy', 'twins', 'surprise')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists pregnancies_user_idx on pregnancies (user_id, status);

-- ---------------------------------------------------------------------------
-- Well-being meters (0-100). Decay is applied lazily by the server based on
-- updated_at, then persisted.
-- ---------------------------------------------------------------------------
create table if not exists user_stats (
  user_id    uuid primary key references hud_users(id) on delete cascade,
  energy     numeric(5,2) not null default 80,
  hydration  numeric(5,2) not null default 70,
  hunger     numeric(5,2) not null default 70,  -- satiation: 100 = full
  bladder    numeric(5,2) not null default 80,  -- capacity left: 0 = must go
  mood       numeric(5,2) not null default 75,
  immunity   numeric(5,2) not null default 70,
  sickness   numeric(5,2) not null default 10,  -- higher = worse
  rest       numeric(5,2) not null default 75,
  vitamins   numeric(5,2) not null default 60,
  comfort    numeric(5,2) not null default 70,
  updated_at timestamptz not null default now()
);

create table if not exists symptoms (
  id           uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null references pregnancies(id) on delete cascade,
  name         text not null,
  severity     integer not null default 0 check (severity between 0 and 100),
  updated_at   timestamptz not null default now(),
  unique (pregnancy_id, name)
);

create table if not exists kick_events (
  id           uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null references pregnancies(id) on delete cascade,
  source       text not null default 'server' check (source in ('server', 'belly', 'web')),
  created_at   timestamptz not null default now()
);
create index if not exists kick_events_preg_idx on kick_events (pregnancy_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Journal, partner, notifications, events
-- ---------------------------------------------------------------------------
create table if not exists journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references hud_users(id) on delete cascade,
  title      text not null,
  body       text,
  kind       text not null default 'note'
             check (kind in ('note', 'milestone', 'memory', 'appointment')),
  completed  boolean not null default false,
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists journal_user_idx on journal_entries (user_id, entry_date desc);

create table if not exists partner_activities (
  id           uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null references pregnancies(id) on delete cascade,
  actor_name   text not null,
  activity     text not null,
  support_pts  integer not null default 5,
  created_at   timestamptz not null default now()
);
create index if not exists partner_act_idx on partner_activities (pregnancy_id, created_at desc);

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references hud_users(id) on delete cascade,
  title      text not null,
  body       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, read, created_at desc);

-- ---------------------------------------------------------------------------
-- Second Life command queue: web actions push commands here; the in-world
-- scripts receive them by push (http-in callback) or by polling /api/sl/poll.
-- ---------------------------------------------------------------------------
create table if not exists sl_commands (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references hud_users(id) on delete cascade,
  device_kind text not null default 'hud' check (device_kind in ('hud', 'belly', 'partner')),
  command     text not null,
  params      jsonb not null default '{}'::jsonb,
  status      text not null default 'pending' check (status in ('pending', 'sent')),
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index if not exists sl_commands_pending_idx
  on sl_commands (user_id, device_kind, status, created_at);

create table if not exists action_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references hud_users(id) on delete cascade,
  action     text not null,
  source     text not null default 'web' check (source in ('web', 'sl')),
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists action_log_user_idx on action_log (user_id, created_at desc);

create table if not exists user_settings (
  user_id  uuid primary key references hud_users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Lock the schema down from PostgREST (Supabase anon/authenticated roles).
-- The app connects as postgres, which bypasses RLS.
-- ---------------------------------------------------------------------------
alter table hud_users          enable row level security;
alter table hud_sessions       enable row level security;
alter table sl_devices         enable row level security;
alter table pregnancies        enable row level security;
alter table user_stats         enable row level security;
alter table symptoms           enable row level security;
alter table kick_events        enable row level security;
alter table journal_entries    enable row level security;
alter table partner_activities enable row level security;
alter table notifications      enable row level security;
alter table sl_commands        enable row level security;
alter table action_log         enable row level security;
alter table user_settings      enable row level security;

-- Supabase creates these PostgREST roles, while plain Render PostgreSQL does
-- not. Guard the grants so the same migration works with either provider.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables in schema public from authenticated;
  end if;
end
$$;
