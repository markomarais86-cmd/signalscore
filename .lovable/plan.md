
# Add Blackstone and Aramco Services to Skip Patterns

## Problem
Two non-healthcare companies are showing false-positive bed counts:
- **Blackstone** (Private Equity firm) -- 5,150 beds
- **Aramco Services** (Oil/Gas company) -- 374 beds

## Changes

### 1. Update skip pattern regex in `supabase/functions/enrich-bed-counts/index.ts` (line 20)

Add `blackstone` and `aramco` to the SKIP_PATTERNS regex. They fit naturally alongside the existing financial and petroleum terms:

- `blackstone` -- add near the financial sector block (after `wealth management`)
- `aramco` -- add near the petroleum/oil sector block (after `arcelormittal`)

### 2. Reset false-positive bed counts to 0

Run a data update to set `bed_count` to `0` for these two accounts so the incorrect data no longer affects scoring:

```sql
UPDATE accounts
SET custom_attributes = jsonb_set(custom_attributes, '{bed_count}', '0')
WHERE lower(name) IN ('blackstone', 'aramco services')
AND (custom_attributes->>'bed_count')::numeric > 0;
```

This matches the same approach used previously when 15 other false positives were cleaned up.

## Impact
- Prevents future enrichment runs from re-assigning bed counts to these companies
- Immediately removes 5,150 and 374 false-positive beds from the dataset
- Blackstone's score will drop from 40 to a more accurate level (loses segment points from bed_count match)
