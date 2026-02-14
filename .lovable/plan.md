

# Fix "Fill Data Gaps" Enrichment and Add Sub-Industry Tracking

## Problem 1: "Fill Data Gaps" Button Does Nothing

The `DataGapsVisualization` component's `startEnrichment` function sends `records: []` (an empty array) to the `enrich-unified` edge function. The function dutifully creates a job with `total_records: 0` and immediately completes it. This is confirmed by the database -- every recent enrichment job shows `total_records: 0` or very small numbers with `accounts_enriched: 0`.

The batch size dropdown (100, 500, 1000, etc.) is purely cosmetic -- its value is never sent to the backend.

### Fix

Update `DataGapsVisualization.tsx` to:
1. Actually query accounts with data gaps from the database (limited by the selected batch size)
2. Send those account records to `enrich-unified` with their `external_id`, `name`, `domain`, and existing field values
3. Pass the batch size so only the selected number of accounts are processed

The accounts should be fetched with a query like:
```
SELECT id, external_id, name, domain, industry_norm, employee_count, revenue_range, country, ...
FROM accounts
WHERE org_id = ? AND (employee_count IS NULL OR revenue_range IS NULL OR industry_raw IS NULL OR ...)
LIMIT <batchSize>
```

Then pass those records to `enrich-unified`.

The same fix is needed in `UnifiedEnrichmentWizard.tsx` if it also sends empty arrays.

## Problem 2: Sub-Industry Never Decreases

The `enrich-unified` edge function maps enriched data to account fields on lines 271-285, but there is **no mapping for `sub_industry`**. Even if the enrichment provider returns sub-industry data, it is silently discarded.

### Fix

Add sub-industry mapping in `enrich-unified/index.ts`:
```typescript
if (result.data.sub_industry) updateData.sub_industry = result.data.sub_industry;
```

Also check the provider waterfall to ensure sub-industry is being extracted from enrichment sources.

## Files to Change

| File | Change |
|------|--------|
| `src/components/enrichment/DataGapsVisualization.tsx` | Fetch actual accounts with gaps, pass them to the edge function, use the batch size selection |
| `supabase/functions/enrich-unified/index.ts` | Add `sub_industry` field mapping in the account update block |
| `src/components/enrichment/UnifiedEnrichmentWizard.tsx` | Verify it also passes real records (may need same fix) |

## Expected Result

- Clicking "Fill Data Gaps (500)" will actually fetch 500 accounts missing data and send them for enrichment
- The enrichment job will show real progress (processing 500 records, enriching fields)
- Sub-industry field will be updated when enrichment providers return that data
- Data gap counts (including sub-industry) will decrease after enrichment runs

