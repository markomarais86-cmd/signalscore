

# Fix the Intent Engine to Actually Work

## The Problem

The intent scoring function (`calculate_intent_score`) averages 25.7/100 because it relies on 3 data sources that are almost entirely empty:

| Data Source | Populated | Total | Coverage |
|------------|-----------|-------|----------|
| `last_funding_date` | 2 | 39,928 | 0.005% |
| `tech_stack` | 319 | 39,928 | 0.8% |
| `total_raised_usd` | 67 | 39,928 | 0.17% |
| `enriched_at` | 11,049 | 39,928 | 27.7% |

Meanwhile, data sources that DO exist are completely ignored:

| Available Data | Records | Used by Intent? |
|---------------|---------|-----------------|
| `score_history` | 85,546 | No |
| `account_signals` | table exists | No |
| `custom_attributes` | column exists | No |
| `Leads` (contacts) | exists | No |
| `enriched_at` freshness | 11,049 | Yes (only source giving points) |

The fix has two parts:
1. **Rewrite `calculate_intent_score`** to use everything we have
2. **Add a bulk intent enrichment action** that runs `enrich-funding-data` and `enrich-tech-stack` for accounts missing those fields, using the existing edge functions

## Part 1: Rewrite `calculate_intent_score` (SQL Migration)

The new scoring model uses 5 dimensions, each contributing to a 100-point scale. It works with whatever data is available -- if funding data is empty, the other dimensions compensate.

**New Scoring Dimensions:**

| Dimension | Max Points | Source | Why |
|-----------|-----------|--------|-----|
| Engagement Recency | 25 | `score_history.changed_at`, `enriched_at` | Recent scoring/enrichment = someone is paying attention |
| Score Momentum | 25 | `score_history` (old vs new) | Rising scores = improving fit, high intent signal |
| Contact Density | 20 | `Leads` count per account | More contacts = deeper engagement / bigger deal |
| Funding Signals | 15 | `last_funding_date`, `total_raised_usd` | Same as before but lower weight |
| Tech Stack Depth | 15 | `tech_stack` array length | Same as before but lower weight |

**Key logic:**

```text
Engagement Recency (25 pts):
  - Score was updated in last 7 days  -> 25
  - Score was updated in last 30 days -> 18
  - enriched_at in last 30 days       -> 12
  - enriched_at in last 90 days       -> 6

Score Momentum (25 pts):
  - Net score change from score_history (last 30 days)
  - Gain >= 15 points -> 25
  - Gain >= 5 points  -> 18
  - Stable (+-5)      -> 10
  - Drop >= 5         -> 5
  - No history        -> 8 (neutral)

Contact Density (20 pts):
  - 5+ leads -> 20
  - 3-4 leads -> 15
  - 2 leads   -> 10
  - 1 lead    -> 5
  - 0 leads   -> 0

Funding (15 pts):  [same logic, rescaled from 30 to 15]
Tech Stack (15 pts): [same logic, rescaled from 30 to 15]
```

This means even with zero funding/tech data, an account with recent score changes and multiple leads can score 70/100 intent.

## Part 2: Bulk Intent Data Enrichment

Add a "Boost Intent Data" button to the dashboard or scoring UI that batch-enriches accounts missing `last_funding_date` and `tech_stack` using the existing `enrich-funding-data` and `enrich-tech-stack` edge functions.

**New file: `src/hooks/use-intent-enrichment.ts`**

A hook that:
1. Queries accounts where `last_funding_date IS NULL AND domain IS NOT NULL` (up to 100)
2. Calls `enrich-funding-data` for each (with concurrency limit of 3)
3. Then queries accounts where `(tech_stack IS NULL OR tech_stack = '{}')` AND `domain IS NOT NULL` (up to 100)
4. Calls `enrich-tech-stack` for each
5. Tracks progress and shows completion toast

**UI: Add button to existing scoring section**

In the component that handles "Score All Accounts", add a secondary button: "Enrich Intent Data" that triggers this hook. Shows progress like "Enriching funding: 15/100... Enriching tech stack: 8/100..."

## Part 3: Update `compute-intent-signals` Edge Function

The edge function already works well structurally, but it queries `activities` (which has 0 rows). Update it to also generate signals from `score_history` data (85k rows) when activities are empty. Specifically:

- In `computeEngagementVelocity`: Fall back to `score_history` changes as a proxy for engagement when `activities` is empty
- In `computeCoverageGaps`: Use `score_history` last `changed_at` instead of `activities.activity_date` when no activities exist

## Technical Details

### Migration SQL

Creates `OR REPLACE FUNCTION calculate_intent_score` with the new 5-dimension model. The function signature stays identical (`p_account_external_id TEXT, p_org_id UUID`) so no callers need changes.

### Files Changed

| File | Change |
|------|--------|
| New migration `.sql` | Rewrite `calculate_intent_score` with 5 dimensions |
| New `src/hooks/use-intent-enrichment.ts` | Hook for bulk funding + tech stack enrichment |
| `supabase/functions/compute-intent-signals/index.ts` | Fall back to `score_history` when `activities` is empty |
| Scoring UI component (where "Score All" button lives) | Add "Enrich Intent Data" button |

### No Breaking Changes

- The function signature is unchanged -- all existing callers (`calculate_account_score`, `bulk_score_all_accounts`) work as before
- Accounts with funding/tech data still get those points (just weighted less)
- The new dimensions only add points, never reduce them vs. what the old function would give for the same data

