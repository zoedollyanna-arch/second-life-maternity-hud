-- Cooldowns and missed prenatal doses survive HUD refresh, relog, and a new bottle.
create table if not exists care_schedule (
  user_id uuid primary key references hud_users(id) on delete cascade,
  prenatal_completed_at timestamptz,
  prenatal_miss_marked_at timestamptz,
  water_completed_at timestamptz
);

alter table care_schedule enable row level security;
