

# Fix enrich-bed-counts Stalled Pipeline

## Root Cause

The function on line 68-74 fetches accounts like this:

```
.order('name', { ascending: true })
.limit(batchSize * 3)  // = 600
```

Then on lines 82-85, it filters client-side for accounts where `bed_count` is null/undefined.

**The problem:** The first ~625 accounts alphabetically were already processed and now have `bed_count` set (either 0 for non-hospitals or a real number). Since the query always fetches the FIRST 600 alphabetically and ALL of them already have `bed_count`, the client-side filter returns 0 every time. The remaining 39,303 accounts are never reached.

**Data confirms this:**
- 625 accounts have `bed_count` key (47 with actual beds, 576 marked as 0)
- 39,303 accounts have no `bed_count` key at all
- But the query always returns the same 600 already-processed accounts

## The Fix

Move the `bed_count` filter to the database query instead of doing it client-side. PostgREST supports filtering on JSONB key absence using `custom_attributes->bed_count.is.null`.

**File:** `supabase/functions/enrich-bed-counts/index.ts`

**Change:** Replace lines 68-85 with a server-side filtered query:

```typescript
// Find accounts missing bed_count that have a name or domain
// Filter bed_count absence at DB level to avoid fetching already-processed accounts
const { data: accounts, error: fetchErr } = await supabase
  .from('accounts')
  .select('id, external_id, name, domain, custom_attributes')
  .eq('org_id', dataOrgId)
  .or('name.not.is.null,domain.not.is.null')
  .is('custom_attributes->bed_count', null)
  .order('name', { ascending: true })
  .limit(batchSize);

if (fetchErr) {
  console.error('Fetch error:', fetchErr);
  return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch accounts', 500);
}

const needsBeds = accounts || [];
```

This single change:
1. Filters out already-processed accounts at the database level
2. Removes the need for over-fetching (no more `batchSize * 3`)
3. Removes the redundant client-side filter
4. Correctly advances through all 39,303 remaining accounts

## Technical Details

- `custom_attributes->bed_count` returns SQL NULL when the key doesn't exist in JSONB
- `.is('custom_attributes->bed_count', null)` translates to `custom_attributes->'bed_count' IS NULL` in PostgREST
- This correctly matches accounts without the `bed_count` key while excluding those with `bed_count: 0` or any positive value

## Expected Outcome

After deployment, each cron run (every 2 minutes) will process up to 200 accounts that truly lack `bed_count` data, steadily working through all 39,303 remaining accounts.
