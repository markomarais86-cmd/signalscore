

## Fix: Pipeline Potential and Campaign-Ready Accounts Show $0/0 on CRM Tab

### Root Cause

Two issues combine to produce $0 Pipeline Potential and 0 campaign-ready accounts:

1. **GrowthCommandKPIs receives unfiltered props** -- On lines 644-648 of `ExecutiveDashboard.tsx`, `highFitAccounts`, `medFitAccounts`, and `campaignReadyAccounts` are passed as global (unfiltered) values. While other components like `ICPCoveragePanel` (line 660) properly switch based on `sourceFilter`, `GrowthCommandKPIs` does not.

2. **No source-filtered campaign-ready count exists** -- The `count_campaign_ready_accounts` SQL function has no `data_source` filter parameter. It always returns the global count (7,718 for the main org). When the CRM tab is active, there's no way to get a CRM-only campaign-ready count.

   However, for the main org (LaunchPulse), all 39,928 accounts are CRM-sourced, so the global count (7,718) IS the CRM count. This means the value should still display correctly -- unless the RPC result isn't being read properly.

3. **Likely data-shape issue with `campaignReadyResult`** -- The `count_campaign_ready_accounts` RPC returns a scalar integer. The Supabase client wraps this as `{ data: 7718 }`. Line 211 reads `campaignReadyResult?.data || 0`. If the destructured `campaignReadyResult` from `Promise.all` is somehow `undefined` or the `data` field is unexpectedly `null`, it falls back to `rawMetrics?.campaign_ready_accounts` which also doesn't exist in the cached metrics response -- yielding 0.

### What Changes

**File: `src/hooks/use-dashboard-data.ts`**

- Add defensive logging when `campaignReadyResult` returns to verify the actual value
- Use explicit null check instead of falsy check (since `campaignReadyResult?.data` could theoretically be `0` for orgs with no campaign-ready accounts, but `|| 0` already handles that -- the real risk is the shape)
- Change line 211 to: `campaign_ready_accounts: (typeof campaignReadyResult?.data === 'number' ? campaignReadyResult.data : 0) || rawMetrics?.campaign_ready_accounts || 0`

**File: `src/pages/ExecutiveDashboard.tsx`**

- Apply source filtering to `GrowthCommandKPIs` props to match the pattern used by `ICPCoveragePanel`:
  - `highFitAccounts` -- switch between `highFitCrmAccounts`, `highFitDatabaseAccounts`, and global
  - `medFitAccounts` -- switch between `medFitCrmAccounts`, `medFitDatabaseAccounts`, and global
  - `campaignReadyAccounts` -- for now, pass the global value for all tabs (since the RPC doesn't filter by source), but ensure it's not zero
  - `pipelinePotential` -- recalculate using the correctly filtered `campaignReadyAccounts`

**File: SQL migration (optional enhancement)**

- Add an optional `p_data_source` parameter to `count_campaign_ready_accounts` so it can return source-filtered counts:
  ```sql
  CREATE OR REPLACE FUNCTION count_campaign_ready_accounts(p_org_id uuid, p_data_source text DEFAULT NULL)
  RETURNS integer AS $$
  ...
  WHERE a.org_id = p_org_id
    AND (p_data_source IS NULL OR a.data_source = p_data_source)
  ...
  ```

### Implementation Steps

1. Update `count_campaign_ready_accounts` SQL function to accept optional `p_data_source` parameter
2. Update `use-dashboard-data.ts` to pass the source filter to the RPC and add defensive type checking
3. Update `ExecutiveDashboard.tsx` to pass source-filtered props to `GrowthCommandKPIs` consistently

### Expected Result

- CRM tab: Pipeline Potential = 7,718 x $75,000 x 0.25 = ~$144.7M
- Database tab: Pipeline Potential = 0 (no database accounts currently)
- All tab: Pipeline Potential = 7,718 x $75,000 x 0.25 = ~$144.7M

