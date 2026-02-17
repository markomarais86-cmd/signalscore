

# Fix: Move 91.Life ICP to Correct Org + Apollo Sync Returning Low Accounts

## Problem 1: ICP in Wrong Organization

The **91.Life Heart+ ICP** (`f0d17a6b-...`) is currently assigned to **Launchpulse** (`726a0dc0-...`) instead of **Ninety One Life** (`cd592f73-...`). This also explains the earlier sync error -- when syncing for the 91.Life org, no primary ICP was found because it's under the wrong org.

**Fix:** Update the ICP's `org_id` to point to the Ninety One Life organization.

```sql
UPDATE icp_profiles
SET org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634'
WHERE id = 'f0d17a6b-6476-4e2d-a90f-9afc8d8e232b';
```

---

## Problem 2: Apollo Sync Only Fetching ~500 Accounts

The `sync-external-provider` edge function currently fetches **only 1 page** from Apollo (line 163: `maxPages = 1`). Apollo returns approximately 25-100 organizations per page, so you're only getting a small sample. It then uses the `pagination.total_entries` value for the total count but the **breakdowns are based on that tiny sample**, making them statistically unreliable.

Additionally, the `company_sizes` in the ICP contain values like `[30, 50, 75, 100, 150, 300, 500, 900, 1000]` which don't map well to Apollo's expected size buckets (1, 10, 50, 200, 500, 1000, 2000, 5000, 10000). Many of those values (30, 75, 100, 150, 300, 900) have no mapping and are silently dropped, resulting in overly narrow filters.

**Fix:** 
1. Increase pagination to fetch more pages (e.g., 10-20 pages) for better breakdown accuracy
2. Improve the company size mapping to handle intermediate values by mapping them to the nearest Apollo range bracket

### Technical Details

**Company size mapping fix** -- map each ICP size to the nearest Apollo range:

```text
30  -> "11,50"    (was: dropped)
50  -> "51,200"   (already works)
75  -> "51,200"   (was: dropped)
100 -> "51,200"   (was: dropped)
150 -> "51,200"   (was: dropped)
300 -> "201,500"  (was: dropped)
500 -> "501,1000" (already works)
900 -> "501,1000" (was: dropped)
1000 -> "1001,5000" (already works)
```

**Pagination fix** -- increase `maxPages` from 1 to 20 and add a small delay between requests to avoid rate limiting.

### Files Changed

1. **Data update** -- Move the 91.Life ICP to the correct org via SQL UPDATE
2. **`supabase/functions/sync-external-provider/index.ts`** -- Fix company size mapping to handle intermediate values; increase pagination from 1 page to 20 pages for better statistical coverage
3. **Redeploy** the edge function

### Result

After these fixes:
- The 91.Life Heart+ ICP will appear under the Ninety One Life organization
- Syncing Apollo for the 91.Life org will find the ICP and return accurate results
- Company size filters will correctly map all ICP sizes to Apollo ranges, capturing far more accounts

