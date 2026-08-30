-- Journal photos uploaded from the wearer's PC through the MOAP HUD.
create table if not exists journal_photos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references hud_users(id) on delete cascade,
  mime       text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes      bytea not null,
  created_at timestamptz not null default now()
);
create index if not exists journal_photos_user_idx on journal_photos (user_id);
