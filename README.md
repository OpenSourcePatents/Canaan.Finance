# CANAAN.FINANCE

### Your Tax Dollars — Digitized

Public budget transparency tool for Canaan, NH. Salaries, department budgets, meeting attendance, and financial history — all public record under NH RSA 91-A.

**Live:** [canaan.finance](https://canaan.finance)

-----

## Features

- Department-level budget breakdowns with per-position salary data
- Effective hourly rate calculations based on posted hours vs. compensation
- Verified vs. estimated data transparency (green dot = verified, orange = estimated)
- Meeting attendance tracking parsed from official town minutes
- Per-official documented meeting hours with committee breakdowns
- Year-over-year budget comparison
- Per-capita spending analysis
- Four views: Departments, All Salaries, Meetings, Overview

## Stack

- Next.js 14 + React 18
- Supabase (Postgres)
- Vercel
- Python (meeting minutes scraper)
- GitHub Actions (automated weekly scraping)

## Setup

```bash
git clone https://github.com/OpenSourcePatents/Canaan.Finance.git
cd Canaan.Finance
npm install
```

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

```bash
npm run dev
```

## Database

Run `scripts/schema_and_seed.sql` in your Supabase SQL Editor. This creates all tables and seeds 2026 Canaan budget data.

Then run `scripts/meeting_records_schema.sql` to add the meeting records table and attendance summary view.

To add historical years — just insert new rows into `budget_years`, `budget_lines`, and `positions` with the appropriate year value. No code changes needed.

## Meeting Minutes Scraper

The scraper pulls meeting minutes from [canaannh.gov/AgendaCenter](https://www.canaannh.gov/AgendaCenter), extracts start/end times, attendees, and duration from the PDFs, and pushes structured data to Supabase.

### Local usage

```bash
pip install requests beautifulsoup4 pdfplumber
```

```bash
# Scrape all minutes, output JSON only
python scripts/scrape_minutes.py

# Scrape Select Board 2026 only
python scripts/scrape_minutes.py --committee "Select Board" --year 2026

# Scrape all and push to Supabase
export SUPABASE_URL=your_supabase_url
export SUPABASE_SERVICE_KEY=your_service_role_key
python scripts/scrape_minutes.py --push
```

### Automated scraping

The GitHub Action at `.github/workflows/scrape-minutes.yml` runs every Monday at 3am EST. It scrapes all new minutes and pushes them to Supabase automatically.

Required repo secrets:

- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_SERVICE_KEY` — your Supabase service role key

The Action can also be triggered manually from the Actions tab with optional committee and year filters.

### What it extracts

For each meeting with published minutes:

- Meeting date and committee name
- Call to order time and adjournment time
- Calculated duration in minutes
- Full attendee list parsed from the header
- Tracked officials identified by name match (Select Board members, Town Administrator, department heads)

### Disclaimer

Documented meeting hours represent only public meeting time with recorded start and end times. They do not include prep work, driving, after-hours calls, training, non-public sessions, or other work performed outside of public meetings. Actual hours worked are likely higher than what meeting minutes capture.

## Data Sources

All data is public record under NH RSA 91-A (Right to Know Law):

- Operating budget: Valley News reporting on 2026 voter-approved budget
- Salaries: Town job postings, Valley News, and canaannh.gov
- Office hours: canaannh.gov staff directory
- Meeting minutes: canaannh.gov/AgendaCenter
- Annual reports: scholars.unh.edu and canaannh.gov

Items marked with a green dot are verified. Orange dot = estimated pending annual report confirmation.

## Project Structure

```
Canaan.Finance/
  app/
    page.js              # Main React frontend (all four views)
    layout.js            # Next.js layout
    globals.css          # Global styles
  lib/
    supabase.js          # Supabase client config
  scripts/
    schema_and_seed.sql  # Core database schema + 2026 seed data
    meeting_records_schema.sql  # Meeting records table + attendance view
    scrape_minutes.py    # Meeting minutes scraper
  .github/
    workflows/
      scrape-minutes.yml # Automated weekly scraping
```

## License

Apache 2.0 — OpenSourcePatents. Not affiliated with the Town of Canaan, NH.
