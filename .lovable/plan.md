
# Add Aster to Skip Patterns and Reset Bed Counts

## Problem
Two false-positive accounts still have inflated bed counts:
- **Blackstone** (5,150 beds) -- already in skip patterns from previous update, but data cleanup was never run
- **Aster** (5,159 beds, domain: astercare.com) -- not in skip patterns

## Changes

### 1. Update SKIP_PATTERNS regex (line 20 of `enrich-bed-counts/index.ts`)

Add `aster` with a negative lookahead to avoid matching legitimate healthcare names containing "aster" (e.g., "Eastern Health", "Northeastern Vermont Regional Hospital"):

```
aster\b(?!a|.*health|.*hospital)
```

This matches "Aster" exactly (word boundary) but NOT "Astera", "Eastern", or any name containing "health" or "hospital" after "aster".

### 2. Reset bed counts (data cleanup SQL -- run manually in SQL Editor)

```sql
UPDATE accounts
SET custom_attributes = jsonb_set(
  COALESCE(custom_attributes::jsonb, '{}'::jsonb),
  '{bed_count}', '0'
)
WHERE id IN (
  'df178fe2-2921-425f-90d1-1d0eb433480f',  -- Blackstone
  '8bda3c70-5203-4b3f-9f51-10e471d71d0f'   -- Aster
);
```

Using IDs directly to be precise and avoid accidental matches.

## Impact
- Removes 10,309 false-positive beds (5,150 + 5,159) from the dataset
- Prevents future enrichment runs from re-assigning bed counts to these companies
- Both accounts' scores will drop to more accurate levels
