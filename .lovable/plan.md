
# Fix: Accounts Page + Credits Not Decreasing

## Two Issues Found

### Issue 1: Accounts Page Still Not Loading
The database function `get_filtered_accounts` has been fixed and **works correctly in the test environment** (verified: returns 39,928 accounts). If you're seeing the issue on the **published (live) URL** (signalscore.lovable.app), you need to **Publish** the project to push the database migration to production. The test/preview environment already works.

### Issue 2: Credits Never Decrease
The `enrichment_credits_used` counter in your `organizations` table is `0` despite 11,055 enriched accounts. **Root cause**: the main enrichment function (`enrich-unified`) processes records and tracks cost internally but **never writes back to `organizations.enrichment_credits_used`**. No enrichment function in the codebase increments this counter.

## Plan

### Step 1: Add credit deduction to `enrich-unified`
After the enrichment loop completes and we know how many records were enriched, increment `enrichment_credits_used` on the organization:

```typescript
// After enrichment loop, before returning response:
if (enriched > 0) {
  await supabase.rpc('increment_enrichment_credits', {
    p_org_id: org_id,
    p_amount: enriched
  });
}
```

### Step 2: Create the database function `increment_enrichment_credits`
A simple atomic increment function to avoid race conditions:

```sql
CREATE OR REPLACE FUNCTION increment_enrichment_credits(
  p_org_id UUID,
  p_amount INTEGER
) RETURNS void AS $$
BEGIN
  UPDATE organizations
  SET enrichment_credits_used = COALESCE(enrichment_credits_used, 0) + p_amount
  WHERE id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 3: Add pre-enrichment credit check
Before processing records, check if the org has enough credits remaining. If not, reject with a clear error:

```typescript
// Before processing, check credits
const { data: org } = await supabase
  .from('organizations')
  .select('enrichment_credits_used, enrichment_credits_total')
  .eq('id', org_id)
  .single();

const remaining = (org?.enrichment_credits_total || 0) - (org?.enrichment_credits_used || 0);
if (remaining < records.length) {
  throw new Error(`Insufficient credits: ${remaining} remaining, ${records.length} requested`);
}
```

### Step 4: Backfill current usage (optional one-time fix)
Since 11,055 accounts were already enriched without tracking, update the current count:

```sql
UPDATE organizations
SET enrichment_credits_used = (
  SELECT COUNT(*) FROM accounts 
  WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f' 
  AND enriched_at IS NOT NULL
)
WHERE id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
```

## Files Changed
- `supabase/functions/enrich-unified/index.ts` -- Add credit check before processing and credit deduction after
- New database migration -- Create `increment_enrichment_credits` function

## Technical Notes
- The credit deduction uses an atomic `UPDATE ... SET col = col + N` pattern to avoid race conditions from concurrent enrichment jobs
- The pre-check is advisory (not a hard lock) since concurrent jobs could pass the check simultaneously, but the deduction itself is always accurate
- The `CreditsDisplay` component already has a real-time subscription on the `organizations` table, so the UI will update automatically when credits change
