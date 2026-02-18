

## Increase Enrichment Credit Limit to 15,000

A single data update to the `organizations` table for your **Launchpulse** org.

**Current state:**
- `enrichment_credits_total`: 10,000
- `enrichment_credits_used`: 11,057 (already over limit)

**Change:**
- Update `enrichment_credits_total` from 10,000 to 15,000

This is a one-line SQL update -- no schema changes, no code changes needed.

### Technical Details

Run this update on the `organizations` table:

```sql
UPDATE organizations
SET enrichment_credits_total = 15000
WHERE id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';
```

This will immediately unblock "Fill Missing" enrichment runs since used (11,057) will be under the new limit (15,000), giving you ~3,943 credits to test Perplexity on healthcare accounts.

