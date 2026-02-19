

## Fix Industry Slide: Supabase 1000-Row Query Cap

### Problem

The slide shows only **969 accounts** total (33 + 8 + 4 + 3 + 1 + 1 + 919) instead of **39,928**. The reason: Supabase PostgREST enforces a server-side `max-rows` limit of **1000**, regardless of what `.limit(50000)` says in the code. Every query in `generate-board-report` that tries to fetch all accounts is silently truncated to 1000 rows.

This affects **all** data aggregations in the report:
- Industry breakdown (showing 969 instead of ~39,928)
- Geography distribution (same issue)
- Size breakdown (same issue)
- Score map for high-fit counts (same issue)
- Revenue range breakdown (same issue)

### Expected vs Actual for 91.Life

| Industry | Actual (DB) | Shown on Slide |
|---|---|---|
| Hospitals & Physicians Clinics | 1,113 | 33 |
| Healthcare (all related) | ~2,500+ | ~50 |
| Total accounts | 39,928 | 969 |

### Solution

Replace client-side aggregation (fetch all rows, then count in JS) with **server-side aggregation** using Supabase RPC functions. Instead of fetching 40,000 rows and looping, we run SQL that returns pre-aggregated results (e.g., 20 industry rows, 10 geography rows).

### Changes

#### 1. Database Migration: Create 3 aggregation RPC functions

**`get_industry_breakdown(p_org_id, p_score_org_id)`** -- Returns industry name, account count, high-fit count, avg score, grouped and sorted. Joins accounts (from data org) with scores (from score org). Runs server-side, no row limits.

**`get_geography_breakdown(p_org_id, p_score_org_id)`** -- Same pattern for country aggregation.

**`get_size_breakdown(p_org_id)`** -- Aggregates employee count buckets server-side.

Each function accepts the data org ID (parent) and optionally the score org ID (child), handling the parent-child architecture natively.

#### 2. Edge Function Update: `generate-board-report/index.ts`

Replace these queries and their JS aggregation loops:
- Lines 78-79 (`accountsWithIndustry` select + limit) and lines 123-142 (JS loop) -- replace with `supabase.rpc('get_industry_breakdown', { p_org_id: dataOrgId, p_score_org_id: orgId })`
- Lines 80 (`accountsForSize` select) and lines 161-168 (JS loop) -- replace with `supabase.rpc('get_size_breakdown', { p_org_id: dataOrgId })`
- Lines 83-84 (`accountsForGeo` select) and lines 171-187 (JS loop) -- replace with `supabase.rpc('get_geography_breakdown', { p_org_id: dataOrgId, p_score_org_id: orgId })`
- Lines 87-88 (`scoresRes` for scoreMap) -- still needed for top prospects, but can reduce to just top-10 scores which is already handled separately
- Lines 144-158 (revenue range JS loop) -- move into `get_industry_breakdown` or a separate RPC

The score map (lines 118-121) used for industry/geo high-fit counting becomes unnecessary since the RPC functions handle it server-side via JOINs.

#### 3. No Frontend Changes Needed

The `IndustrySlide`, `GeographySlide`, and data shape remain the same -- only the source of the aggregated data changes from client-side JS to server-side SQL.

### Why Not Just Paginate?

Paginating (fetching 40 batches of 1000 rows) would work but adds latency and complexity. Server-side aggregation returns ~20 rows instead of 40,000, making the report generation faster and eliminating the row-limit problem entirely.

