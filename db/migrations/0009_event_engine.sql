-- Nestoria event engine v2 + wearer preferences.
--
-- The old popup system had no memory: every roll re-ran the same if/else chain
-- and the in-world dialog offered one hardcoded set of five buttons. Two things
-- are needed to fix that properly, and both are stored here rather than held in
-- process memory, because the mom HUD, the partner HUD and the LSL dialog are
-- three independent readers of the same moment.
--
--   1. event_history becomes the live popup record, not just a log. An event
--      that has not been answered yet is *the* pending event — the HUD screen
--      renders it as a card and the blue menu offers the same buttons, so
--      answering in one place closes it in the other.
--   2. The choices are stored with the event. They are generated per event
--      type, so replaying an old row (or a HUD that reconnects mid-popup)
--      shows the buttons that event actually had.

-- ---------------------------------------------------------------------------
-- 1. Live popup state on event_history
-- ---------------------------------------------------------------------------
alter table event_history
  add column if not exists category    text not null default 'mood',
  add column if not exists choices     jsonb not null default '[]'::jsonb,
  add column if not exists answered_at timestamptz,
  add column if not exists expires_at  timestamptz,
  add column if not exists surface     text not null default 'both';

-- Everything that already exists is historical: mark it answered so no old row
-- resurfaces as a pending popup the first time somebody opens their HUD.
update event_history
   set answered_at = created_at
 where answered_at is null;

-- At most one unanswered event per pregnancy. The roller relies on this: it
-- refuses to fire a new popup while one is still open, which is what stops a
-- backlog of dialogs landing at once after the HUD has been offline.
create unique index if not exists event_history_one_pending_idx
  on event_history (pregnancy_id) where answered_at is null;

create index if not exists event_history_recent_types_idx
  on event_history (pregnancy_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Preferences.
--
-- Kept in user_settings.settings (a merged jsonb blob) rather than a wide
-- table: the shape is owned by src/lib/preferences.ts, which validates on both
-- read and write, and new keys must stay backwards compatible with HUDs that
-- have not been updated. Only the default is set here, for brand new users.
-- ---------------------------------------------------------------------------
alter table user_settings
  alter column settings set default jsonb_build_object(
    'popupFrequencyMinutes', 20,
    'popupSurface', 'both',
    'soundEnabled', true,
    'soundVolume', 70,
    'privacyMode', 'partner',
    'publicEmotes', false,
    'decayPace', 'normal',
    'allowPica', true,
    'testMode', false
  );

-- ---------------------------------------------------------------------------
-- 3. event_schedules gains a manual-roll cooldown so a wearer spamming
--    "surprise me" cannot outpace her own popup frequency.
-- ---------------------------------------------------------------------------
alter table event_schedules
  add column if not exists last_manual_at timestamptz;

-- ---------------------------------------------------------------------------
-- 4. Test mode.
--
-- Labor is normally drawn once and never touched. Test mode rewrites the plan
-- (see game.ts test_* actions) and must be able to put it back, so the drawn
-- plan is snapshotted the first time a test action runs.
-- ---------------------------------------------------------------------------
alter table pregnancies
  add column if not exists labor_plan_backup jsonb,
  add column if not exists labor_onset_backup numeric(7,6),
  add column if not exists test_mode boolean not null default false;

-- ---------------------------------------------------------------------------
-- Same PostgREST lockdown as the rest of the schema.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table event_history, event_schedules, user_settings from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table event_history, event_schedules, user_settings from authenticated;
  end if;
end
$$;
