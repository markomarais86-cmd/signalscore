
# Investigation: Revenue at Risk Shows $9.0M with No Scores

## Root Cause

The Revenue at Risk metric is **not related to scoring at all**. It is calculated purely from enrichment data completeness applied to the total account pool:

```text
revenueAtRisk = (1 - dataCompleteness / 100) * totalAccounts * averageDealSize * 0.1
```

For 91.Life:
- `totalAccounts` = 39,928 (inherited from Launchpulse parent)
- `averageDealSize` = $75,000 (default, no org-specific override)
- `dataCompleteness` = ~97% (from enrichment metrics, not scoring)
- Result: `0.03 * 39,928 * 75,000 * 0.1 = ~$9.0M`

The formula says: "For every account with incomplete enrichment data, assume 10% of ACV is at risk." With ~1,200 under-enriched accounts at $75K ACV, that produces $9M.

## The Problem

This is **not a bug** -- the formula is working as designed. However, it is **misleading** because:

1. It implies $9M in revenue is threatened, but no accounts have been scored or entered a pipeline
2. The metric conflates "enrichment gaps" with "revenue risk" -- these are different concerns
3. The 10% multiplier and $75K default ACV are arbitrary, producing an inflated-sounding number
4. For a child org with zero scoring history, it creates a false sense of urgency about revenue that doesn't exist yet

## Recommended Fix

Make Revenue at Risk **scoring-aware** so it only counts accounts that have actually been scored and are in-play:

### Option A: Only count scored accounts (recommended)

```text
revenueAtRisk = unscoredAccounts * averageDealSize * conversionRate
```

Where `unscoredAccounts = totalAccounts - scoredAccounts`. This tells you: "Here's the pipeline value you can't prioritize because these accounts haven't been scored yet."

- When 0 accounts are scored: shows the full potential gap
- When all accounts are scored: shows $0 (no risk)
- Uses org-specific `conversionRate` instead of arbitrary 0.1

### Option B: Hybrid approach

Keep the enrichment-gap angle but scale by scoring coverage:

```text
enrichmentGap = (1 - dataCompleteness / 100) * scoredAccounts * averageDealSize * conversionRate
scoringGap = unscoredAccounts * averageDealSize * conversionRate
revenueAtRisk = enrichmentGap + scoringGap
```

### Changes Required

**File: `src/pages/ExecutiveDashboard.tsx` (line 644-648)**

Replace the inline calculation with a scoring-aware formula. Use `totalScores` (already available in the component) to determine how many accounts are scored vs unscored.

**File: `src/components/executive/GrowthCommandKPIs.tsx` (line 91)**

Update the `soWhat` text from "Opportunity lost to data gaps" to something more accurate like "Unscored accounts represent unrealized pipeline" when scores are missing.

### No backend changes needed

All the data (`totalAccounts`, `totalScores`, `averageDealSize`, `conversionRate`) is already available in the dashboard component. This is a frontend-only formula change.
