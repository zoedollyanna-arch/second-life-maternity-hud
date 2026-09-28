-- A retry after a lost HTTP/chat acknowledgement must never credit care twice.
create table if not exists prop_uses (
  user_id uuid not null references hud_users(id) on delete cascade,
  use_id uuid not null,
  prop_key text not null,
  pregnancy_id uuid not null references pregnancies(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, use_id)
);
alter table prop_uses enable row level security;
