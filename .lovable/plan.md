

# Fix: Shared Data Architecture -- Parent Org Data Sharing

## The Real Problem

The current system assumes every org owns its own accounts and leads. But the consulting model works differently:

- **Launchpulse** is the parent org that owns all 39,928 accounts and 53,000+ leads
- **Child orgs** (like 91.Life) are created as different ICP viewpoints on that same shared dataset
- Each child org has its **own ICPs and scores**, but queries accounts/leads from the **parent org**
- Only when a customer gets their own login and manages things themselves do they have isolated data

Right now, every dashboard query, scoring function, match count, and data display filters by the child org's `org_id` -- which has zero data. The ICP might be correctly saved to 91.Life, but all the underlying data queries return nothing because they look for accounts/leads with `org_id = 91.Life`, and there are none.

## Solution: Add `parent_org_id` to Organizations

Add a `parent_org_id` column to the `organizations` table. When a child org is created (consulting model), it points to Launchpulse. When querying **accounts and leads**, use the `parent_org_id` (falling back to own `org_id` if null). When querying **ICPs and scores**, use the child org's own `org_id`.

### What Changes

#### 1. Database: Add `parent_org_id` column
- Add `parent_org_id uuid REFERENCES organizations(id)` to the `organizations` table
- Set 91.Life's `parent_org_id` to Launchpulse's ID
- This is the single source of truth for "where does this org's data live?"

#### 2. New SQL helper function: `get_data_org_id()`
- A small SQL function that returns `parent_org_id` if set, otherwise the org's own `id`
- Used by scoring functions, dashboard metrics, and match estimates

#### 3. Update `calculate_account_score` function
- When scoring accounts for a child org's ICP, look up accounts from the **parent org** (via `parent_org_id`), not the child org
- Scores are still written with the child org's `org_id` so each org has its own score results

#### 4. Update `estimate_icp_matches` function
- When counting matches during ICP editing, query accounts from the parent org's data

#### 5. Update `get_dashboard_metrics_cached` function
- The materialized view and/or the function need to pull account/lead counts from the parent org's data, joined with the child org's scores

#### 6. Frontend: Add `useDataOrgId` hook
- A hook that resolves the "data org" for the current effective org
- Queries the `organizations` table for `parent_org_id`
- Returns `parent_org_id` if set, otherwise the effective org ID
- Used in dashboard data queries, account listings, lead listings, and enrichment

#### 7. Update `use-dashboard-data.ts`
- Pass the data org ID (parent) for account/lead counts
- Pass the effective org ID (child) for ICP and score queries
- This is the key change that makes the dashboard show Launchpulse's accounts scored against 91.Life's ICP

#### 8. Update pages that query accounts/leads directly
- `Leads.tsx`, `Accounts.tsx` (if exists), enrichment pages -- use data org ID for account/lead queries
- ICP Manager, scoring -- use effective org ID for ICP queries, data org ID for account lookups

### Data Flow After Fix

```text
91.Life (child org)
  |-- parent_org_id -> Launchpulse
  |-- ICPs: own (Heart+ ICP with org_id = 91.Life)
  |-- Scores: own (scored against Launchpulse's accounts, stored with org_id = 91.Life)
  |-- Accounts: from Launchpulse (39,928)
  |-- Leads: from Launchpulse (53,000+)
```

### Files to Change

| File | Change |
|------|--------|
| Database migration | Add `parent_org_id` column, set for 91.Life, create `get_data_org_id()` function |
| `calculate_account_score` (SQL) | Use `get_data_org_id()` to find accounts from parent org |
| `estimate_icp_matches` (SQL) | Use `get_data_org_id()` to count from parent org |
| `get_dashboard_metrics_cached` (SQL) | Join parent org accounts with child org scores |
| `src/hooks/use-data-org.ts` (new) | Hook to resolve data org ID from parent_org_id |
| `src/hooks/use-dashboard-data.ts` | Use data org ID for account/lead queries |
| `src/pages/ExecutiveDashboard.tsx` | Pass both org IDs appropriately |
| `src/pages/Leads.tsx` | Use data org ID for lead queries |
| `src/components/icp/ICPWizardStep2.tsx` | Use data org ID for match counts |
| `src/components/icp/ICPWizardStep3.tsx` | Use data org ID for lead title suggestions |
| `src/components/BulkScoring.tsx` | Use data org ID for account lookups in scoring |
| `QuickCreateOrgDialog` | Add option to set parent org when creating child orgs |

### What This Does NOT Change
- ICPs remain per-org (each child org has its own ICPs)
- Scores remain per-org (each child org has its own scoring results)
- When a customer logs in with their own account (self-service), `parent_org_id` is NULL, so they see only their own data -- no change in behavior

