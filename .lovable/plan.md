

# Fix Multi-Page Issues: Accounts, Dashboard, Onboarding, and AI ICP

## Issue Summary

There are 5 distinct problems to fix:

### 1. Accounts Page Not Loading (Database Fix)

**Root Cause**: The `get_filtered_accounts` database function declares `enrichment_overall_score` as `numeric` in its return type, but the actual `accounts` table column is `integer`. This type mismatch causes PostgreSQL error 42804.

**Fix**: Alter the database function to cast `enrichment_overall_score` to `numeric`, or change the return type to `integer`. The simplest fix is to cast the column in the function: `a.enrichment_overall_score::numeric as enrichment_overall_score`.

### 2. Remove Funnel Health from Dashboard

**Root Cause**: The `FunnelHealthDashboard` component is rendered at the bottom of the Executive Dashboard.

**Fix**: Remove the `<FunnelHealthDashboard />` component and its import from `src/pages/ExecutiveDashboard.tsx` (lines 31 and 654).

### 3. LaunchPulse Onboarding Shows "Not Started"

**Root Cause**: There is no row in `org_onboarding_config` for the LaunchPulse org (`726a0dc0-...`). The onboarding card shows "Not started" when no config exists.

**Fix**: Either auto-create a config row when the org already has data (accounts, ICPs, etc.), or update the Customer Onboarding page to detect existing data and show a more accurate status like "Active" even without a config row. The pragmatic fix is to insert an `org_onboarding_config` row for LaunchPulse with `onboarding_status = 'active'` and populate `company_name` from the `organizations` table.

### 4. AI ICP Recommendations Fail for Ninety One Life

**Root Cause**: The `generate-icp-recommendations` edge function only looks at the `accounts` table to build its AI prompt. Ninety One Life has 0 accounts, so the AI gets an empty dataset and produces no useful recommendations.

**Fix**: Update the edge function to also query `org_onboarding_config` for company context (website URL, value proposition, target persona description) and the `organizations` table for the company name. This way, even with no accounts, the AI can generate ICP recommendations based on the onboarding data that was uploaded.

### 5. Ninety One Life Onboarding Incomplete

**Root Cause**: The onboarding config for Ninety One Life exists with status "draft" but `value_proposition` and other fields are empty. The data from the uploaded documents may not have been saved back to the config.

**Fix**: This ties into issue 4. Once the AI ICP generation uses onboarding data, the workflow will function. Additionally, the onboarding wizard should check if the ICP document parsing already populated data and reflect that in the status.

## Technical Changes

### Database Migration (SQL)
```sql
-- Fix the get_filtered_accounts function return type mismatch
CREATE OR REPLACE FUNCTION get_filtered_accounts(...)
RETURNS TABLE(
  ...
  enrichment_overall_score numeric,  -- keep as numeric
  ...
)
-- Change the SELECT to cast: a.enrichment_overall_score::numeric
```

### `src/pages/ExecutiveDashboard.tsx`
- Remove line 31: `import { FunnelHealthDashboard } ...`
- Remove line 654: `<FunnelHealthDashboard />`

### `supabase/functions/generate-icp-recommendations/index.ts`
- Add a query to `org_onboarding_config` for the org's website, value proposition, and target persona
- Add a query to `organizations` for the company name
- Include this context in the AI prompt so recommendations work even with 0 accounts
- When accounts are empty, generate a "seed ICP" recommendation based on the onboarding data instead of returning empty results

### `src/pages/admin/CustomerOnboarding.tsx`
- In the org card grid, when no `org_onboarding_config` row exists but the org has accounts/ICPs/leads, show status as "Active" instead of "Not started"
- Query account counts per org to determine data presence

