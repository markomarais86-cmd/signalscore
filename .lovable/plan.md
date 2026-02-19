

# Fix: Enrich Bed Counts Stuck in Loop

## Problem

The `enrich-bed-counts` cron job runs every 2 minutes but makes zero progress. Each cycle:
- Fetches 200 accounts missing `bed_count`
- Skips ~36 via regex (non-hospitals) but **never writes this to the database**
- Attempts AI calls on remaining ~164 accounts, but the 50-second time budget expires before any complete
- Next cycle: same 200 accounts are fetched again (infinite loop)

## Root Causes

1. **Skipped accounts are never persisted** — When `enrichBedCount()` returns `null` (non-hospital), the code increments a counter but never writes `bed_count: 0` to the database. These accounts re-enter the queue every cycle.

2. **AI calls timeout** — Perplexity key is broken (401), and the fallback Gemini calls take too long. With 3 parallel calls and 2-second delays, plus slow/failing HTTP requests, the 50-second budget is consumed before any results return.

## Fix (2 changes to `supabase/functions/enrich-bed-counts/index.ts`)

### Change 1: Mark skipped accounts with `bed_count: 0`

In the results processing loop (around line 130), when an account is skipped (AI returns `null`), write `bed_count: 0` to `custom_attributes` so it's permanently removed from the enrichment queue.

Current code:
```typescript
} else if (result.status === 'fulfilled' && result.value == null) {
  // AI couldn't determine bed count (not a hospital?)
  skipped++;
}
```

Updated code:
```typescript
} else if (result.status === 'fulfilled' && result.value == null) {
  // Not a hospital — mark with 0 so it's excluded from future runs
  const existingAttrs = (account.custom_attributes as Record<string, any>) || {};
  const updatedAttrs = { ...existingAttrs, bed_count: 0 };
  await supabase
    .from('accounts')
    .update({ custom_attributes: updatedAttrs })
    .eq('id', account.id);
  skipped++;
}
```

### Change 2: Pre-skip non-hospitals in bulk before AI calls

The regex skip check currently happens inside `enrichBedCount()` (the AI call function), which means each skip still costs a `Promise.allSettled` slot and delays processing. Instead, move the skip logic **before** the AI loop — identify all regex-matched non-hospitals upfront, bulk-update them with `bed_count: 0`, and only send the remaining accounts to AI.

This will:
- Immediately clear ~36+ non-hospitals per cycle from the DB queue
- Leave only potential hospitals for AI processing
- Dramatically reduce wasted time

### Change 3: Add a timeout to AI fetch calls

Wrap Perplexity and Gemini `fetch()` calls with `AbortController` and a 15-second timeout. This prevents a single slow/broken API from consuming the entire 50-second budget.

## Expected Outcome

- First few runs: bulk-clear hundreds of non-hospital accounts (regex matches)
- Subsequent runs: AI processes only potential hospitals with proper timeouts
- The queue shrinks steadily instead of looping forever

## Files Modified

- `supabase/functions/enrich-bed-counts/index.ts` — all three changes above
