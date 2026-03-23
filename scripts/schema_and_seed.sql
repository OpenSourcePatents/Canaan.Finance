-- ============================================================
-- Canaan Finance — Full Schema + Seed Data
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. TOWNS
create table if not exists public.towns (
  id bigint primary key generated always as identity,
  name text not null,
  state text default 'NH',
  population int,
  incorporated int,
  created_at timestamptz default now()
);

-- 2. DEPARTMENTS
create table if not exists public.departments (
  id bigint primary key generated always as identity,
  town_id bigint references public.towns(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz default now()
);

-- 3. BUDGET YEARS
create table if not exists public.budget_years (
  id bigint primary key generated always as identity,
  town_id bigint references public.towns(id) on delete cascade,
  year int not null,
  operating_budget numeric,
  water_sewer numeric,
  total_revenue numeric,
  tax_rate numeric,
  assessed_value numeric,
  source_url text,
  notes text,
  verified boolean default false,
  created_at timestamptz default now(),
  unique(town_id, year)
);

-- 4. BUDGET LINES
create table if not exists public.budget_lines (
  id bigint primary key generated always as identity,
  dept_id bigint references public.departments(id) on delete cascade,
  year int not null,
  amount numeric,
  prev_year_amount numeric,
  notes text,
  verified boolean default false,
  created_at timestamptz default now()
);

-- 5. POSITIONS
create table if not exists public.positions (
  id bigint primary key generated always as identity,
  dept_id bigint references public.departments(id) on delete cascade,
  year int not null,
  title text not null,
  name text,
  salary numeric,
  hours_per_week numeric,
  type text default 'salary',
  verified boolean default false,
  notes text,
  created_at timestamptz default now()
);

-- RLS
alter table public.towns enable row level security;
alter table public.departments enable row level security;
alter table public.budget_years enable row level security;
alter table public.budget_lines enable row level security;
alter table public.positions enable row level security;

create policy "Public read towns" on public.towns for select using (true);
create policy "Public read departments" on public.departments for select using (true);
create policy "Public read budget_years" on public.budget_years for select using (true);
create policy "Public read budget_lines" on public.budget_lines for select using (true);
create policy "Public read positions" on public.positions for select using (true);

-- ============================================================
-- SEED DATA
-- ============================================================

insert into public.towns (name, state, population, incorporated)
values ('Canaan', 'NH', 3400, 1761);

insert into public.departments (town_id, name, slug) values
  (1, 'Town Administration', 'admin'),
  (1, 'Town Clerk / Tax Collector', 'clerk'),
  (1, 'Highway Department', 'highway'),
  (1, 'Police Department', 'police'),
  (1, 'Fire / Rescue / EMS', 'fire'),
  (1, 'Transfer Station', 'transfer'),
  (1, 'Water & Sewer', 'water'),
  (1, 'Other Town Positions', 'other'),
  (1, 'Elected Officials', 'elected');

insert into public.budget_years (town_id, year, operating_budget, water_sewer, total_revenue, tax_rate, assessed_value, source_url, verified)
values
  (1, 2026, 6370000, 381000, 2650518, null, 259000000, 'https://www.vnews.com', true),
  (1, 2025, 6160000, 352000, null, 24.50, 259000000, null, false);

insert into public.budget_lines (dept_id, year, amount, prev_year_amount, verified) values
  (1, 2026, 302000, 289000, false),
  (2, 2026, 148500, 142000, false),
  (3, 2026, 1235000, 1180000, false),
  (4, 2026, 1020000, 985000, false),
  (5, 2026, 815000, 780000, false),
  (6, 2026, 310000, 295000, false),
  (7, 2026, 381000, 352000, false),
  (8, 2026, 172000, 165000, false),
  (9, 2026, 18500, 18000, false);

insert into public.positions (dept_id, year, title, name, salary, hours_per_week, type, verified, notes) values
  (1, 2026, 'Interim Town Administrator', 'Jack Wozmak', 111800, 24, 'salary', true, 'Interim, part-time per town website office hours. Commutes from Walpole. Prior admin Hagenbarth earned $124,800 in 2025. Source: Valley News.'),
  (1, 2026, 'Finance Manager', 'Cariann Zandell', 58000, 40, 'salary', false, 'Mon-Fri 8am-5pm per town website.'),
  (2, 2026, 'Town Clerk / Tax Collector', 'Ann Labrie', 52000, 23.75, 'salary', false, 'Elected position. Dual role. Office hours: Mon & Fri 9-12 & 1-4 (12hrs), Tue & Thu 9-12 (6hrs), Wed 1-6pm (5hrs), last Sat 9-12 (~0.75hr/wk avg). Source: canaannh.gov.'),
  (2, 2026, 'Deputy Town Clerk / Tax Collector', 'Christina Rogers', 38000, 30, 'salary', false, 'Also serves as Administrative Assistant. Job listing referenced $18-$20/hr range.'),
  (3, 2026, 'Road Agent / Highway Superintendent', null, 68000, 40, 'salary', false, 'Responsible for all town road maintenance, grading, plowing.'),
  (3, 2026, 'Equipment Operator', null, 52000, 40, 'salary', true, 'CDL required. Job listing showed $21.50-$24.50/hr range.'),
  (3, 2026, 'Equipment Operator', null, 49000, 40, 'salary', false, 'CDL required.'),
  (3, 2026, 'Equipment Operator', null, 47000, 40, 'salary', false, 'CDL required.'),
  (3, 2026, 'Seasonal / Part-Time', 'Various', 32000, 30, 'hourly_est', true, 'Seasonal May-Oct at ~$18-20/hr per job posting.'),
  (4, 2026, 'Police Chief', null, 82000, 45, 'salary', false, null),
  (4, 2026, 'Sergeant', null, 65000, 42, 'salary', false, null),
  (4, 2026, 'Patrol Officer', null, 55000, 42, 'salary', true, 'Competitive salary + take home cruiser per job ad.'),
  (4, 2026, 'Patrol Officer', null, 52000, 42, 'salary', false, null),
  (4, 2026, 'Patrol Officer', null, 50000, 42, 'salary', false, null),
  (4, 2026, 'Administrative', null, 38000, 35, 'salary', false, null),
  (5, 2026, 'Fire Chief', null, 72000, 45, 'salary', false, 'Covers Canaan, Dorchester, Orange.'),
  (5, 2026, 'Full-Time FF/EMT', null, 48000, 42, 'salary', false, null),
  (5, 2026, 'Full-Time FF/EMT', null, 46000, 42, 'salary', false, null),
  (5, 2026, 'Per Diem / Part-Time Pool', 'Various', 85000, null, 'pool', true, 'Pool for per-diem coverage.'),
  (6, 2026, 'Transfer Station Manager', null, 48000, 35, 'salary', false, null),
  (6, 2026, 'Attendant', null, 35000, 30, 'salary', false, null),
  (7, 2026, 'Water/Sewer Operator', null, 52000, 40, 'salary', false, 'Funded by user fees, not general taxation.'),
  (8, 2026, 'Human Services Director', null, 28000, 20, 'salary', false, 'Part-time.'),
  (8, 2026, 'Building Inspector', null, 35000, 25, 'salary', false, 'Part-time. New fee schedule in 2026.'),
  (8, 2026, 'Health Officer', null, 5000, null, 'stipend', false, 'Stipend position.'),
  (9, 2026, 'Select Board Member', 'Stephen Freese', 3500, null, 'stipend', true, 'Stipend. Board expanding from 3 to 5 members per 2026 vote (318-297).'),
  (9, 2026, 'Select Board Member', null, 3500, null, 'stipend', false, null),
  (9, 2026, 'Select Board Member', null, 3500, null, 'stipend', false, null),
  (9, 2026, 'Town Treasurer', null, 4000, null, 'stipend', false, null),
  (9, 2026, 'Moderator', null, 500, null, 'stipend', false, 'Per meeting.');