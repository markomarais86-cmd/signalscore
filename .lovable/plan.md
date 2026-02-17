
# Fix "With Leads" Metric Showing 0

## Problem
The "With Leads" metric on the Accounts Overview card shows **0** even though there are 53,303 leads in the `Leads` table linked to 13,920 accounts. Two issues:

1. **Wrong metric**: The RPC `count_high_fit_leads_total` counts **leads belonging to high-fit accounts**, not **accounts that have leads**. The label "With Leads" implies "how many accounts have leads linked to them."
2. **The value 0 in the screenshot**: The RPC actually returns 43,698 when called directly, but the destructured result may not be reaching the UI correctly, or the `effectiveOrgId` is not matching at render time.

## Database Confirmation
- `Leads` table: 53,303 rows (no "contacts" table exists -- that's correct)
- Accounts with at least one lead: 13,920
- High-fit accounts with leads: 8,952
- The RPC works when called directly

## Fix

### 1. Replace the RPC call in `Accounts.tsx` (line ~348-351)
Instead of calling `count_high_fit_leads_total` (which counts leads, not accounts), replace with a simple query:

```
supabase
  .from('Leads')
  .select('account_external_id', { count: 'exact', head: true })
  -- can't do distinct count this way
```

Since Supabase JS doesn't support `COUNT(DISTINCT ...)` easily, create a small new RPC function `count_accounts_with_leads` that returns:

```sql
SELECT COUNT(DISTINCT l.account_external_id)::integer
FROM "Leads" l
INNER JOIN accounts a ON l.account_external_id = a.account_external_id
WHERE l.org_id = p_org_id AND a.org_id = p_org_id
AND l.account_external_id IS NOT NULL;
```

### 2. Update `Accounts.tsx` line ~348-351
Call the new RPC instead:
```ts
supabase.rpc('count_accounts_with_leads', { p_org_id: effectiveOrgId })
```

### 3. Update the label (optional clarification)
The label "With Leads" is fine -- it now correctly shows how many accounts have at least one lead linked.

## Summary
| Change | File |
|--------|------|
| New SQL function `count_accounts_with_leads` | Database migration |
| Replace RPC call | `src/pages/Accounts.tsx` (~line 348) |

No other files need changes. The `AccountsSummaryCard` component already displays `withLeads` correctly.
