-- Ultrasound scrapbook: photos unlock as the pregnancy reaches each scan week.
-- The web dashboard shows a toast when a new one appears; "seen" clears the
-- NEW badge once it has been viewed in the scrapbook.

create table if not exists ultrasounds (
  id           uuid primary key default gen_random_uuid(),
  pregnancy_id uuid not null references pregnancies(id) on delete cascade,
  photo_index  integer not null check (photo_index between 1 and 10),
  week         integer not null,
  seen         boolean not null default false,
  unlocked_at  timestamptz not null default now(),
  unique (pregnancy_id, photo_index)
);
create index if not exists ultrasounds_preg_idx on ultrasounds (pregnancy_id, photo_index);

alter table ultrasounds enable row level security;
revoke all on table ultrasounds from anon, authenticated;
