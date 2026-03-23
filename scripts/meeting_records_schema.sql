-- ============================================================
-- Canaan Finance — Meeting Records Schema
-- Run in Supabase SQL Editor AFTER schema_and_seed.sql
-- ============================================================

-- MEETING RECORDS
-- Stores parsed data from town board/committee meeting minutes
-- Populated by scripts/scrape_minutes.py
create table if not exists public.meeting_records (
  id bigint primary key generated always as identity,
  town_id bigint references public.towns(id) on delete cascade default 1,
  meeting_date date not null,
  committee text not null,
  title text,
  agenda_id text,
  start_time text,
  end_time text,
  duration_minutes int,
  attendees jsonb default '[]'::jsonb,
  officials_present jsonb default '[]'::jsonb,
  source_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(town_id, agenda_id)
);

-- Index for fast queries by official name and date
create index if not exists idx_meeting_records_date
  on public.meeting_records(meeting_date desc);

create index if not exists idx_meeting_records_committee
  on public.meeting_records(committee);

create index if not exists idx_meeting_records_officials
  on public.meeting_records using gin(officials_present);

-- RLS
alter table public.meeting_records enable row level security;

create policy "Public read meeting_records"
  on public.meeting_records for select using (true);

-- ============================================================
-- VIEW: Official attendance summary
-- Aggregates meeting attendance per official per year
-- ============================================================
create or replace view public.official_attendance_summary as
select
  town_id,
  extract(year from meeting_date)::int as year,
  official,
  count(*) as meetings_attended,
  sum(coalesce(duration_minutes, 0)) as total_documented_minutes,
  round(sum(coalesce(duration_minutes, 0)) / 60.0, 1) as total_documented_hours,
  min(meeting_date) as first_meeting,
  max(meeting_date) as last_meeting,
  array_agg(distinct committee) as committees
from public.meeting_records,
  jsonb_array_elements_text(officials_present) as official
group by town_id, extract(year from meeting_date), official
order by total_documented_minutes desc;
