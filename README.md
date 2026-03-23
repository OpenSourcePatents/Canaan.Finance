# CANAAN.FINANCE

### Your Tax Dollars — Digitized

Public budget transparency tool for Canaan, NH. Salaries, department budgets, and financial history — all public record under NH RSA 91-A.

-----

## Stack
-
- Next.js 14 + React 18
- Supabase (Postgres)
- Vercel

## Setup

```bash
git clone https://github.com/OpenSourcePatents/CanaanFinance.git
cd CanaanFinance
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

To add historical years — just insert new rows into `budget_years`, `budget_lines`, and `positions` with the appropriate year value. No code changes needed.

## Data Sources

All data is public record under NH RSA 91-A (Right to Know Law):

- Operating budget: Valley News reporting on 2026 voter-approved budget
- Salaries: Town job postings, Valley News, and canaannh.gov
- Office hours: canaannh.gov staff directory
- Annual reports: scholars.unh.edu and canaannh.gov

Items marked with a green dot are verified. Orange dot = estimated pending annual report confirmation.

## License

Apache 2.0  — OpenSourcePatents. Not affiliated with the Town of Canaan, NH.
