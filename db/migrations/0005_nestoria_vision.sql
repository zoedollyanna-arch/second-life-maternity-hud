-- Labor / birth RP state and optional journal photo URLs.
-- Hospital bag is a physical in-world object (see lsl/nestoria_hospital_bag.lsl),
-- not a database checklist.

alter table pregnancies
  add column if not exists labor_stage text not null default 'none'
    check (labor_stage in ('none', 'contractions', 'water_broken', 'hospital', 'birth', 'delivered')),
  add column if not exists water_broken_at timestamptz,
  add column if not exists contractions_started_at timestamptz,
  add column if not exists hospital_at timestamptz,
  add column if not exists birth_at timestamptz,
  add column if not exists contraction_intensity integer not null default 0
    check (contraction_intensity between 0 and 100);

alter table journal_entries
  add column if not exists photo_url text;
